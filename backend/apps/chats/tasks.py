import logging
import tempfile
import os
import io
import shutil
import subprocess
import uuid
import re
import fitz  # PyMuPDF
from celery import shared_task
from django.conf import settings
from .models import Document, ChatMemory
from .services import ChatMemoryService
try:
    from PIL import Image
    import pytesseract
except ImportError:
    Image = None
    pytesseract = None

try:
    from storage.s3 import minio_client
except ImportError:
    # Fallback for circular import or if storage app is not ready
    import boto3
    minio_client = None

logger = logging.getLogger(__name__)

def page_ocr_enabled() -> bool:
    """Gate the slower pytesseract page OCR path behind an env flag."""
    raw = os.environ.get("DOCUMENT_PAGE_OCR_ENABLED", "")
    return str(raw).strip().lower() in {"1", "true", "yes", "on"}


def image_ocr_enabled() -> bool:
    """Gate the slower external image OCR path behind an env flag."""
    raw = os.environ.get("DOCUMENT_IMAGE_OCR_ENABLED", "")
    return str(raw).strip().lower() in {"1", "true", "yes", "on"}


def update_document_progress(
    doc_record: Document,
    *,
    status: str | None = None,
    total_pages: int | None = None,
    processed_pages: int | None = None,
    progress_label: str | None = None,
    error_message: str | None = None,
) -> None:
    update_fields: list[str] = []
    if status is not None and doc_record.status != status:
        doc_record.status = status
        update_fields.append('status')
    if total_pages is not None and doc_record.total_pages != total_pages:
        doc_record.total_pages = total_pages
        update_fields.append('total_pages')
    if processed_pages is not None:
        next_processed_pages = processed_pages
        if total_pages is not None and total_pages > 0:
            next_processed_pages = min(next_processed_pages, total_pages)
        next_processed_pages = max(doc_record.processed_pages, next_processed_pages)
        if doc_record.processed_pages != next_processed_pages:
            doc_record.processed_pages = next_processed_pages
            update_fields.append('processed_pages')
    if progress_label is not None and doc_record.progress_label != progress_label:
        doc_record.progress_label = progress_label
        update_fields.append('progress_label')
    if error_message is not None and doc_record.error_message != error_message:
        doc_record.error_message = error_message
        update_fields.append('error_message')
    if update_fields:
        doc_record.save(update_fields=[*update_fields, 'updated_at'])

def convert_to_pdf(input_path: str) -> str:
    """
    Convert a document to PDF using LibreOffice.
    Returns the output PDF path.
    """
    if not shutil.which("soffice"):
        raise RuntimeError("LibreOffice (soffice) is not available for document conversion.")
    output_dir = tempfile.mkdtemp(prefix="doc_convert_")
    try:
        result = subprocess.run(
            [
                "soffice",
                "--headless",
                "--nologo",
                "--norestore",
                "--convert-to",
                "pdf",
                "--outdir",
                output_dir,
                input_path,
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=90,
            check=False,
        )
        stdout = (result.stdout or "").strip()
        stderr = (result.stderr or "").strip()
        if result.returncode != 0:
            raise RuntimeError(f"LibreOffice conversion failed: {stderr or stdout}")

        # Try to parse output path from stdout
        match = re.search(r"->\\s+(.*?\\.pdf)\\s+using", stdout)
        if match:
            candidate = match.group(1)
            if os.path.exists(candidate):
                return candidate

        base = os.path.splitext(os.path.basename(input_path))[0]
        candidate = os.path.join(output_dir, f"{base}.pdf")
        if os.path.exists(candidate):
            return candidate
        # Fallback: pick the first PDF in output dir
        for name in os.listdir(output_dir):
            if name.lower().endswith(".pdf"):
                return os.path.join(output_dir, name)
        detail = stderr or stdout or "No output from LibreOffice."
        raise RuntimeError(f"Converted PDF not found after conversion. {detail}")
    except Exception:
        shutil.rmtree(output_dir, ignore_errors=True)
        raise

def get_bbox_iou(box1, box2):
    """
    Calculate Intersection over Union (IoU) of two bounding boxes.
    box: [x0, y0, x1, y1]
    """
    x0_1, y0_1, x1_1, y1_1 = box1
    x0_2, y0_2, x1_2, y1_2 = box2

    x_left = max(x0_1, x0_2)
    y_top = max(y0_1, y0_2)
    x_right = min(x1_1, x1_2)
    y_bottom = min(y1_1, y1_2)

    if x_right < x_left or y_bottom < y_top:
        return 0.0

    intersection_area = (x_right - x_left) * (y_bottom - y_top)
    box1_area = (x1_1 - x0_1) * (y1_1 - y0_1)
    box2_area = (x1_2 - x0_2) * (y1_2 - y0_2)

    union_area = box1_area + box2_area - intersection_area
    if union_area == 0:
        return 0.0
    return intersection_area / union_area

def extract_text_blocks_from_page(page, page_number: int):
    """
    Extract text blocks from a single PDF page.
    """
    extracted_data = []
    try:
        page_width = float(page.rect.width)
        page_height = float(page.rect.height)
        blocks = page.get_text("blocks")
        for block in blocks:
            if block[6] == 0:
                text = block[4].strip()
                if not text:
                    continue
                bbox = list(block[0:4])
                extracted_data.append({
                    'text': text,
                    'bbox': bbox,
                    'page': page_number,
                    'source_type': 'parsed',
                    'page_width': page_width,
                    'page_height': page_height,
                })
    except Exception as e:
        logger.error(f"PyMuPDF page extraction failed on page {page_number}: {e}")
    return extracted_data


def extract_text_and_bbox_with_pymupdf(doc, progress_callback=None):
    """
    Backward-compatible wrapper that extracts text blocks for the whole document.
    """
    extracted_data = []
    for page_num, page in enumerate(doc):
        if progress_callback:
            progress_callback(page_num + 1, "페이지 텍스트 추출 중")
        extracted_data.extend(extract_text_blocks_from_page(page, page_num + 1))
    return extracted_data

def extract_ocr_blocks_from_page(page, page_number: int):
    """
    Extract OCR blocks from a single PDF page image.
    """
    extracted_data = []
    if not pytesseract or not Image:
        logger.warning("pytesseract or PIL not installed. Skipping OCR.")
        return extracted_data

    try:
        page_width = float(page.rect.width)
        page_height = float(page.rect.height)
        pix = page.get_pixmap()
        img_data = pix.tobytes("png")
        image = Image.open(io.BytesIO(img_data))

        ocr_res = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
        n_boxes = len(ocr_res['text'])
        blocks = {}

        for i in range(n_boxes):
            if int(ocr_res['conf'][i]) < 30:
                continue
            text = ocr_res['text'][i].strip()
            if not text:
                continue

            block_num = ocr_res['block_num'][i]
            x, y, w, h = ocr_res['left'][i], ocr_res['top'][i], ocr_res['width'][i], ocr_res['height'][i]
            x0, y0, x1, y1 = x, y, x + w, y + h

            if block_num not in blocks:
                blocks[block_num] = {'text': [text], 'bbox': [x0, y0, x1, y1]}
            else:
                blocks[block_num]['text'].append(text)
                b = blocks[block_num]['bbox']
                blocks[block_num]['bbox'] = [
                    min(b[0], x0), min(b[1], y0),
                    max(b[2], x1), max(b[3], y1)
                ]

        for content in blocks.values():
            full_text = " ".join(content['text'])
            if len(full_text) > 3:
                extracted_data.append({
                    'text': full_text,
                    'bbox': content['bbox'],
                    'page': page_number,
                    'source_type': 'ocr',
                    'page_width': page_width,
                    'page_height': page_height
                })
    except Exception as e:
        logger.error(f"OCR extraction failed on page {page_number}: {e}")

    return extracted_data


def extract_text_and_bbox_with_ocr(doc):
    """
    Backward-compatible wrapper that extracts OCR blocks for the whole document.
    """
    extracted_data = []
    for page_num, page in enumerate(doc):
        extracted_data.extend(extract_ocr_blocks_from_page(page, page_num + 1))
    return extracted_data

def merge_parsed_and_ocr(parsed_data, ocr_data):
    """
    Merges parsed text and OCR text. 
    1. Prefer parsed text.
    2. Add OCR text only if it doesn't significantly overlap with parsed text.
    """
    if not ocr_data:
        return parsed_data
        
    merged_data = list(parsed_data)
    
    # Organize parsed data by page for faster lookup
    parsed_by_page = {}
    for item in parsed_data:
        p = item['page']
        if p not in parsed_by_page:
            parsed_by_page[p] = []
        parsed_by_page[p].append(item)
    
    for ocr_item in ocr_data:
        page = ocr_item['page']
        ocr_bbox = ocr_item['bbox']
        
        is_duplicate = False
        if page in parsed_by_page:
            for parsed_item in parsed_by_page[page]:
                # Check IoU or simple box overlap
                parsed_bbox = parsed_item['bbox']
                iou = get_bbox_iou(ocr_bbox, parsed_bbox)
                
                # If overlap is significant, assume it's covered by parsed text
                if iou > 0.1:
                    is_duplicate = True
                    break
        
        if not is_duplicate:
            logger.info(f"Adding OCR unique content on page {page}: {ocr_item['text'][:30]}...")
            merged_data.append(ocr_item)
            
    # Sort by page then y position
    merged_data.sort(key=lambda x: (x['page'], x['bbox'][1]))
    return merged_data

def merge_text_chunks_by_page(chunks, max_chars: int = 450, overlap_chars: int = 80):
    """
    Merge consecutive text blocks into paragraph-like chunks with overlap.
    This improves retrieval by preserving context while keeping chunks reasonably small.
    """
    if not chunks:
        return []

    by_page: dict[int, list[dict]] = {}
    for chunk in chunks:
        by_page.setdefault(chunk['page'], []).append(chunk)

    merged: list[dict] = []
    for page, blocks in by_page.items():
        blocks = sorted(blocks, key=lambda x: (x['bbox'][1], x['bbox'][0]))
        i = 0
        carry_blocks: list[dict] = []
        while i < len(blocks):
            current_blocks = list(carry_blocks)
            current_text = " ".join(b['text'].strip() for b in current_blocks if b['text'].strip()).strip()
            bbox = None

            def union_bbox(base, new_box):
                if base is None:
                    return list(new_box)
                return [
                    min(base[0], new_box[0]),
                    min(base[1], new_box[1]),
                    max(base[2], new_box[2]),
                    max(base[3], new_box[3]),
                ]

            for b in current_blocks:
                bbox = union_bbox(bbox, b['bbox'])

            while i < len(blocks):
                b = blocks[i]
                b_text = b['text'].strip()
                i += 1
                if not b_text:
                    continue
                candidate = b_text if not current_text else f"{current_text} {b_text}"
                if current_text and len(candidate) > max_chars:
                    i -= 1
                    break
                current_text = candidate
                current_blocks.append(b)
                bbox = union_bbox(bbox, b['bbox'])

            if not current_text and i < len(blocks):
                b = blocks[i]
                b_text = b['text'].strip()
                i += 1
                current_text = b_text
                current_blocks = [b]
                bbox = union_bbox(bbox, b['bbox'])

            if not current_text:
                break

            ref = current_blocks[0]
            merged.append({
                'text': current_text,
                'bbox': bbox,
                'page': page,
                'source_type': 'merged',
                'page_width': ref.get('page_width'),
                'page_height': ref.get('page_height'),
            })

            # Build overlap blocks for next chunk
            carry_blocks = []
            carry_text = ""
            if overlap_chars > 0:
                for b in reversed(current_blocks):
                    b_text = b['text'].strip()
                    if not b_text:
                        continue
                    candidate = b_text if not carry_text else f"{b_text} {carry_text}"
                    if len(candidate) > overlap_chars and carry_text:
                        break
                    carry_text = candidate
                    carry_blocks.insert(0, b)

    return merged

def extract_images_from_page(pdf_doc, page, page_number: int, session_id):
    """
    Extract embedded images from a single PDF page and upload them.
    """
    extracted_images = []
    if not minio_client:
        return extracted_images

    try:
        image_list = page.get_images(full=True)
        page_width = float(page.rect.width)
        page_height = float(page.rect.height)

        for img_idx, img in enumerate(image_list):
            xref = img[0]
            try:
                base_image = pdf_doc.extract_image(xref)
                image_bytes = base_image["image"]
                image_ext = base_image["ext"]

                rects = page.get_image_rects(xref)
                if not rects:
                    continue
                r = rects[0]
                bbox = [r.x0, r.y0, r.x1, r.y1]

                if (bbox[2] - bbox[0] < 50) or (bbox[3] - bbox[1] < 50):
                    continue

                filename = f"images/{session_id}/{page_number}_{img_idx}.{image_ext}"
                file_obj = io.BytesIO(image_bytes)
                url = minio_client.upload_file(file_obj, filename, content_type=f"image/{image_ext}")

                extracted_images.append({
                    'text': '',
                    'bbox': bbox,
                    'page': page_number,
                    'source_type': 'image_ocr',
                    'image_url': url,
                    'page_width': page_width,
                    'page_height': page_height,
                    'is_image_ocr': True
                })
            except Exception as e:
                logger.warning(f"Image extraction error on page {page_number}: {e}")
                continue
    except Exception as e:
        logger.error(f"Failed to get images from page {page_number}: {e}")

    return extracted_images


def extract_images_from_pdf(doc, session_id, progress_callback=None):
    """
    Backward-compatible wrapper that extracts images for the whole document.
    """
    extracted_images = []
    for page_num, page in enumerate(doc):
        if progress_callback:
            progress_callback(page_num + 1, "페이지 이미지 추출 중")
        extracted_images.extend(extract_images_from_page(doc, page, page_num + 1, session_id))
    return extracted_images

@shared_task(bind=True, max_retries=3)
def process_pdf_document(self, document_id):
    tmp_path = None # Initialize tmp_path to ensure it's defined for os.unlink
    converted_pdf_path = None
    converted_dir = None
    try:
        doc_record = Document.objects.get(id=document_id)
        update_document_progress(
            doc_record,
            status=Document.STATUS_PROCESSING,
            processed_pages=0,
            progress_label='문서 준비 중',
            error_message='',
        )

        original_name = doc_record.original_name or doc_record.file_name
        original_ext = os.path.splitext(original_name)[1].lower()
        with tempfile.NamedTemporaryFile(delete=False, suffix=original_ext or ".pdf") as tmp:
            tmp_path = tmp.name

        # 1. Download Content
        if minio_client:
            minio_client.download_file_to_path(doc_record.file_name, tmp_path)
        else:
            logger.warning("minio_client not available, cannot download file content.")
            raise Exception("Failed to retrieve file content from MinIO")

        pdf_path = tmp_path
        if original_ext in ('.hwp', '.hwpx'):
            converted_pdf_path = convert_to_pdf(tmp_path)
            converted_dir = os.path.dirname(converted_pdf_path)
            pdf_key = f"{doc_record.session_id}/{uuid.uuid4()}.pdf"
            with open(converted_pdf_path, "rb") as pdf_file:
                minio_client.upload_file(pdf_file, pdf_key, content_type="application/pdf")
            doc_record.pdf_file_name = pdf_key
            doc_record.save(update_fields=['pdf_file_name'])
            pdf_path = converted_pdf_path

        # 2. Extract & index page-by-page to keep memory bounded.
        pdf_doc = fitz.open(pdf_path)
        total_pages = getattr(pdf_doc, 'page_count', None) or len(pdf_doc)
        update_document_progress(
            doc_record,
            total_pages=total_pages,
            processed_pages=0,
            progress_label=f"0 / {total_pages} 페이지 준비 중",
        )
        
        logger.info(f"Starting extraction for doc {document_id}")
        page_ocr = page_ocr_enabled()
        image_ocr = image_ocr_enabled()

        def mark_page_progress(page_number: int, phase: str):
            capped_page = max(0, min(page_number, total_pages))
            update_document_progress(
                doc_record,
                total_pages=total_pages,
                processed_pages=capped_page,
                progress_label=f"{capped_page} / {total_pages} {phase}",
            )
        service = ChatMemoryService()
        if not image_ocr:
            logger.info("Image OCR disabled; skipping external image OCR.")
        if not page_ocr:
            logger.info("Page OCR disabled; skipping pytesseract OCR.")

        indexed_chunk_count = 0
        for page_index in range(total_pages):
            page_number = page_index + 1
            page = pdf_doc.load_page(page_index)

            mark_page_progress(page_number, "페이지 텍스트 추출 중")
            parsed_chunks = extract_text_blocks_from_page(page, page_number)

            valid_image_chunks = []
            if image_ocr:
                mark_page_progress(page_number, "페이지 이미지 추출 중")
                image_chunks = extract_images_from_page(pdf_doc, page, page_number, doc_record.session_id)
                for img in image_chunks:
                    if img.get('image_url'):
                        mark_page_progress(page_number, "페이지 이미지 OCR 중")
                        extracted_text = service.ocr_image_with_fal(img['image_url'])
                        if extracted_text and len(extracted_text.strip()) > 5:
                            img['text'] = extracted_text.strip()
                            img['source_type'] = 'image_ocr'
                            valid_image_chunks.append(img)

            ocr_chunks = []
            if page_ocr:
                mark_page_progress(page_number, "페이지 OCR 중")
                ocr_chunks = extract_ocr_blocks_from_page(page, page_number)

            final_chunks = merge_parsed_and_ocr(parsed_chunks, ocr_chunks)
            final_chunks = merge_text_chunks_by_page(final_chunks)
            final_chunks.extend(valid_image_chunks)

            if not final_chunks:
                continue

            mark_page_progress(page_number, "페이지 인덱싱 중")
            for chunk in final_chunks:
                content_text = chunk['text']
                page_width = chunk.get('page_width') or 1.0
                page_height = chunk.get('page_height') or 1.0
                bbox = chunk['bbox']
                bbox_norm = [
                    bbox[0] / page_width,
                    bbox[1] / page_height,
                    bbox[2] / page_width,
                    bbox[3] / page_height,
                ]

                meta = {
                    'source': 'pdf',
                    'document_id': doc_record.id,
                    'filename': doc_record.original_name or doc_record.file_name,
                    'page': chunk['page'],
                    'bbox': bbox,
                    'bbox_norm': bbox_norm,
                    'page_width': page_width,
                    'page_height': page_height,
                    'source_type': chunk.get('source_type', 'unknown'),
                    'image_url': chunk.get('image_url'),
                    'is_image_ocr': chunk.get('is_image_ocr', False)
                }

                service.add_memory(
                    session_id=doc_record.session_id,
                    content=content_text,
                    metadata=meta
                )
                indexed_chunk_count += 1

        if indexed_chunk_count == 0:
            logger.warning(f"No text extracted from {doc_record.file_name}")
            update_document_progress(
                doc_record,
                status=Document.STATUS_FAILED,
                progress_label='실패',
                error_message="No text extracted (Parsed + OCR both empty).",
            )
            return

        update_document_progress(
            doc_record,
            status=Document.STATUS_COMPLETED,
            total_pages=total_pages,
            processed_pages=total_pages,
            progress_label='완료',
        )
        
    except Exception as e:
        logger.error(f"Error processing document {document_id}: {e}", exc_info=True)
        try:
            # Re-fetch in case transaction failed or stale
            doc_record = Document.objects.get(id=document_id)
            update_document_progress(
                doc_record,
                status=Document.STATUS_FAILED,
                progress_label='실패',
                error_message=str(e),
            )
        except:
            pass
    finally:
        try:
            if 'pdf_doc' in locals():
                pdf_doc.close()
        except Exception:
            pass
        if converted_dir and os.path.isdir(converted_dir):
            shutil.rmtree(converted_dir, ignore_errors=True)
        if tmp_path and os.path.exists(tmp_path):
            try:
                # PDF might be open by fitz, close it explicitly if referenced, 
                # but 'pdf_doc' is local. fitz usually doesn't lock heavily on linux but on windows might.
                # pdf_doc.close() should be called if we persist the object
                pass
            except:
                pass
            try:
                os.unlink(tmp_path)
            except Exception as e:
                 logger.warning(f"Failed to delete temp file {tmp_path}: {e}")

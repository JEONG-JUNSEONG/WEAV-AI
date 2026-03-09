"""
세션 API 테스트.
Docker 환경에서만 실행합니다.
"""
import os
from unittest.mock import MagicMock, patch
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.auth import get_user_model
from django.test import TestCase, Client
from apps.chats.models import Session, Job, Message, Document, SESSION_KIND_CHAT, SESSION_KIND_IMAGE
from apps.chats.tasks import process_pdf_document, update_document_progress


class SessionAPITests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_create_chat_session(self):
        response = self.client.post(
            '/api/v1/sessions/',
            data={'kind': SESSION_KIND_CHAT, 'title': '테스트 채팅'},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data['kind'], SESSION_KIND_CHAT)
        self.assertEqual(data['title'], '테스트 채팅')
        self.assertIn('id', data)

    def test_create_image_session(self):
        response = self.client.post(
            '/api/v1/sessions/',
            data={'kind': SESSION_KIND_IMAGE},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data['kind'], SESSION_KIND_IMAGE)

    def test_list_sessions(self):
        Session.objects.create(kind=SESSION_KIND_CHAT, title='A')
        Session.objects.create(kind=SESSION_KIND_IMAGE, title='B')
        response = self.client.get('/api/v1/sessions/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data), 2)

    def test_list_sessions_filter_by_kind(self):
        Session.objects.create(kind=SESSION_KIND_CHAT, title='A')
        Session.objects.create(kind=SESSION_KIND_IMAGE, title='B')
        response = self.client.get('/api/v1/sessions/?kind=chat')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['kind'], SESSION_KIND_CHAT)


class ImageGenerationAPITests(TestCase):
    """이미지 생성 API 요청/검증 구조 테스트. fal 호출은 mock."""

    def setUp(self):
        self.client = Client()
        self.session = Session.objects.create(kind=SESSION_KIND_IMAGE, title='이미지 세션')

    def test_complete_image_requires_session_id(self):
        response = self.client.post(
            '/api/v1/chat/image/',
            data={'prompt': 'a cat'},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('session_id', response.json().get('detail', ''))

    def test_complete_image_accepts_chat_session(self):
        """채팅 세션에서도 이미지 생성 요청이 가능해야 함 (단일 채팅방 통합 UX)."""
        chat_session = Session.objects.create(kind=SESSION_KIND_CHAT, title='채팅')
        with patch('apps.ai.tasks.task_image.delay') as mock_delay:
            mock_delay.return_value.id = 'mock-task-id'
            response = self.client.post(
                '/api/v1/chat/image/',
                data={
                    'session_id': chat_session.id,
                    'prompt': 'a cat',
                },
                content_type='application/json',
            )
        self.assertEqual(response.status_code, 202)
        data = response.json()
        self.assertIn('task_id', data)
        self.assertIn('job_id', data)
        job = Job.objects.get(pk=data['job_id'])
        self.assertEqual(job.session_id, chat_session.id)
        self.assertEqual(job.kind, 'image')
        self.assertEqual(job.status, 'pending')

    def test_complete_image_accepts_valid_request_returns_202(self):
        with patch('apps.ai.tasks.task_image.delay') as mock_delay:
            mock_delay.return_value.id = 'mock-task-id'
            response = self.client.post(
                '/api/v1/chat/image/',
                data={
                    'session_id': self.session.id,
                    'prompt': 'a red apple',
                },
                content_type='application/json',
            )
        self.assertEqual(response.status_code, 202)
        data = response.json()
        self.assertIn('task_id', data)
        self.assertIn('job_id', data)
        job = Job.objects.get(pk=data['job_id'])
        self.assertEqual(job.session_id, self.session.id)
        self.assertEqual(job.kind, 'image')
        self.assertEqual(job.status, 'pending')

    def test_complete_image_validates_model_and_attachments(self):
        """이미지 첨부 시 Imagen/FLUX 등 비지원 모델이면 400."""
        with patch('apps.ai.tasks.task_image.delay'):
            response = self.client.post(
                '/api/v1/chat/image/',
                data={
                    'session_id': self.session.id,
                    'prompt': 'edit this',
                    'model': 'fal-ai/imagen4/preview',
                    'image_urls': ['https://example.com/img.png'],
                },
                content_type='application/json',
            )
        self.assertEqual(response.status_code, 400)
        self.assertIn('이 모델은 이미지 첨부를 지원하지 않습니다', response.json().get('detail', ''))


class ChatPermissionAPITests(TestCase):
    def setUp(self):
        self.client = Client()
        user_model = get_user_model()
        self.owner = user_model.objects.create_user(username='owner', password='testpass123')
        self.other = user_model.objects.create_user(username='other', password='testpass123')
        self.chat_session = Session.objects.create(kind=SESSION_KIND_CHAT, title='보호된 채팅', user=self.owner)
        self.image_session = Session.objects.create(kind=SESSION_KIND_IMAGE, title='보호된 이미지', user=self.owner)

    def test_complete_chat_forbidden_for_other_user(self):
        self.client.force_login(self.other)
        response = self.client.post(
            '/api/v1/chat/complete/',
            data={'session_id': self.chat_session.id, 'prompt': '안녕', 'model': 'google/gemini-2.5-flash'},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json().get('detail'), 'Permission denied')

    def test_complete_image_forbidden_for_anonymous_user_on_owned_session(self):
        response = self.client.post(
            '/api/v1/chat/image/',
            data={'session_id': self.image_session.id, 'prompt': 'a cat'},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json().get('detail'), 'Permission denied')

    def test_job_endpoints_forbidden_for_other_user(self):
        job = Job.objects.create(
            session=self.chat_session,
            kind='chat',
            status='pending',
            task_id='protected-task-id',
        )
        Message.objects.create(session=self.chat_session, role='user', content='테스트')

        self.client.force_login(self.other)

        status_response = self.client.get(f'/api/v1/chat/job/{job.task_id}/')
        self.assertEqual(status_response.status_code, 403)
        self.assertEqual(status_response.json().get('detail'), 'Permission denied')

        with patch('celery.current_app.control.revoke') as mock_revoke:
            cancel_response = self.client.post(f'/api/v1/chat/job/{job.task_id}/cancel/')
        self.assertEqual(cancel_response.status_code, 403)
        self.assertEqual(cancel_response.json().get('detail'), 'Permission denied')
        mock_revoke.assert_not_called()


class DocumentUploadAPITests(TestCase):
    def setUp(self):
        self.client = Client()
        self.session = Session.objects.create(kind=SESSION_KIND_CHAT, title='문서 세션')

    def test_session_upload_creates_document_and_queues_task(self):
        storage = MagicMock()
        storage.upload_file.return_value = 'http://example.com/uploaded.pdf'
        upload = SimpleUploadedFile('sample.pdf', b'%PDF-1.4 fake pdf', content_type='application/pdf')

        with patch('apps.chats.views.minio_client', storage), patch('apps.chats.views.process_pdf_document.delay') as mock_delay:
            response = self.client.post(f'/api/v1/sessions/{self.session.id}/upload/', data={'file': upload})

        self.assertEqual(response.status_code, 202)
        data = response.json()
        doc = Document.objects.get(pk=data['document_id'])
        self.assertEqual(doc.session_id, self.session.id)
        self.assertEqual(doc.original_name, 'sample.pdf')
        self.assertEqual(doc.status, Document.STATUS_PENDING)
        mock_delay.assert_called_once_with(doc.id)

    def test_session_documents_includes_progress_fields(self):
        doc = Document.objects.create(
            session=self.session,
            file_name='1/sample.pdf',
            original_name='sample.pdf',
            file_url='http://example.com/sample.pdf',
            status=Document.STATUS_PROCESSING,
            total_pages=12,
            processed_pages=3,
            progress_label='3 / 12 페이지 텍스트 추출 중',
        )

        response = self.client.get(f'/api/v1/sessions/{self.session.id}/documents/')

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['id'], doc.id)
        self.assertEqual(data[0]['total_pages'], 12)
        self.assertEqual(data[0]['processed_pages'], 3)
        self.assertEqual(data[0]['progress_label'], '3 / 12 페이지 텍스트 추출 중')


class DocumentProcessingTaskTests(TestCase):
    def setUp(self):
        self.session = Session.objects.create(kind=SESSION_KIND_CHAT, title='문서 처리 세션')

    def test_update_document_progress_keeps_processed_pages_monotonic(self):
        doc = Document.objects.create(
            session=self.session,
            file_name='1/sample.pdf',
            original_name='sample.pdf',
            file_url='http://example.com/sample.pdf',
            status=Document.STATUS_PROCESSING,
            total_pages=10,
            processed_pages=5,
            progress_label='5 / 10 페이지 텍스트 추출 중',
        )

        update_document_progress(
            doc,
            total_pages=10,
            processed_pages=3,
            progress_label='3 / 10 페이지 이미지 추출 중',
        )

        doc.refresh_from_db()
        self.assertEqual(doc.processed_pages, 5)
        self.assertEqual(doc.progress_label, '3 / 10 페이지 이미지 추출 중')

    def test_process_pdf_document_skips_page_ocr_when_disabled(self):
        doc = Document.objects.create(
            session=self.session,
            file_name='1/sample.pdf',
            original_name='sample.pdf',
            file_url='http://example.com/sample.pdf',
            status=Document.STATUS_PENDING,
        )
        storage = MagicMock()

        class DummyPdfDoc:
            page_count = 1

            def load_page(self, _index):
                return object()

            def close(self):
                return None

        parsed_chunk = {
            'text': '테스트 문서 본문',
            'bbox': [0, 0, 100, 20],
            'page': 1,
            'source_type': 'parsed',
            'page_width': 100.0,
            'page_height': 200.0,
        }

        with patch.dict(os.environ, {'DOCUMENT_PAGE_OCR_ENABLED': 'false'}, clear=False):
            with patch('apps.chats.tasks.minio_client', storage), \
                 patch('apps.chats.tasks.fitz.open', return_value=DummyPdfDoc()), \
                 patch('apps.chats.tasks.extract_text_blocks_from_page', return_value=[parsed_chunk]), \
                 patch('apps.chats.tasks.extract_images_from_page', return_value=[]), \
                 patch('apps.chats.tasks.extract_ocr_blocks_from_page') as mock_ocr, \
                 patch('apps.chats.tasks.ChatMemoryService') as mock_service_cls:
                process_pdf_document.run(doc.id)

        doc.refresh_from_db()
        self.assertEqual(doc.status, Document.STATUS_COMPLETED)
        self.assertEqual(doc.total_pages, 1)
        self.assertEqual(doc.processed_pages, 1)
        self.assertEqual(doc.progress_label, '완료')
        mock_ocr.assert_not_called()
        storage.download_file_to_path.assert_called_once()
        mock_service_cls.return_value.add_memory.assert_called_once()

    def test_process_pdf_document_skips_image_ocr_when_disabled(self):
        doc = Document.objects.create(
            session=self.session,
            file_name='1/sample.pdf',
            original_name='sample.pdf',
            file_url='http://example.com/sample.pdf',
            status=Document.STATUS_PENDING,
        )
        storage = MagicMock()

        class DummyPdfDoc:
            page_count = 1

            def load_page(self, _index):
                return object()

            def close(self):
                return None

        parsed_chunk = {
            'text': '테스트 문서 본문',
            'bbox': [0, 0, 100, 20],
            'page': 1,
            'source_type': 'parsed',
            'page_width': 100.0,
            'page_height': 200.0,
        }
        image_chunk = {
            'text': '',
            'bbox': [0, 20, 100, 100],
            'page': 1,
            'source_type': 'image_ocr',
            'image_url': 'http://example.com/image.png',
            'page_width': 100.0,
            'page_height': 200.0,
            'is_image_ocr': True,
        }

        with patch.dict(
            os.environ,
            {'DOCUMENT_PAGE_OCR_ENABLED': 'false', 'DOCUMENT_IMAGE_OCR_ENABLED': 'false'},
            clear=False,
        ):
            with patch('apps.chats.tasks.minio_client', storage), \
                 patch('apps.chats.tasks.fitz.open', return_value=DummyPdfDoc()), \
                 patch('apps.chats.tasks.extract_text_blocks_from_page', return_value=[parsed_chunk]), \
                 patch('apps.chats.tasks.extract_images_from_page', return_value=[image_chunk]), \
                 patch('apps.chats.tasks.extract_ocr_blocks_from_page') as mock_page_ocr, \
                 patch('apps.chats.tasks.ChatMemoryService') as mock_service_cls:
                process_pdf_document.run(doc.id)

        doc.refresh_from_db()
        self.assertEqual(doc.status, Document.STATUS_COMPLETED)
        mock_page_ocr.assert_not_called()
        mock_service_cls.return_value.ocr_image_with_fal.assert_not_called()
        storage.download_file_to_path.assert_called_once()
        mock_service_cls.return_value.add_memory.assert_called_once()

    def test_process_pdf_document_indexes_page_by_page(self):
        doc = Document.objects.create(
            session=self.session,
            file_name='1/sample.pdf',
            original_name='sample.pdf',
            file_url='http://example.com/sample.pdf',
            status=Document.STATUS_PENDING,
        )
        storage = MagicMock()

        class DummyPdfDoc:
            page_count = 2

            def load_page(self, index):
                return f'page-{index + 1}'

            def close(self):
                return None

        page_chunks = {
            'page-1': [{
                'text': '첫 페이지 본문',
                'bbox': [0, 0, 100, 20],
                'page': 1,
                'source_type': 'parsed',
                'page_width': 100.0,
                'page_height': 200.0,
            }],
            'page-2': [{
                'text': '둘째 페이지 본문',
                'bbox': [0, 0, 100, 20],
                'page': 2,
                'source_type': 'parsed',
                'page_width': 100.0,
                'page_height': 200.0,
            }],
        }

        def extract_for_page(page, _page_number):
            return page_chunks[page]

        with patch.dict(
            os.environ,
            {'DOCUMENT_PAGE_OCR_ENABLED': 'false', 'DOCUMENT_IMAGE_OCR_ENABLED': 'false'},
            clear=False,
        ):
            with patch('apps.chats.tasks.minio_client', storage), \
                 patch('apps.chats.tasks.fitz.open', return_value=DummyPdfDoc()), \
                 patch('apps.chats.tasks.extract_text_blocks_from_page', side_effect=extract_for_page), \
                 patch('apps.chats.tasks.extract_images_from_page', return_value=[]), \
                 patch('apps.chats.tasks.ChatMemoryService') as mock_service_cls:
                process_pdf_document.run(doc.id)

        doc.refresh_from_db()
        self.assertEqual(doc.status, Document.STATUS_COMPLETED)
        self.assertEqual(doc.total_pages, 2)
        self.assertEqual(doc.processed_pages, 2)
        self.assertEqual(mock_service_cls.return_value.add_memory.call_count, 2)

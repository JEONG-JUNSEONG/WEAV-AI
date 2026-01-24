# WEAV AI Jobs 앱 Celery 작업
# AI 작업 처리 (FAL.ai 제외 - 추후 확장 예정)

import logging
from celery import shared_task
from django.utils import timezone
from .models import Job, Artifact
# from .fal_queue import get_fal_client  # FAL.ai 제외
from weavai.apps.storage.s3 import S3Storage

logger = logging.getLogger(__name__)


# ===== AI 작업 비동기 처리 =====

MAX_CONCURRENT_JOBS_PER_USER = 4


@shared_task(bind=True, max_retries=3)
def run_ai_job(self, job_id: str) -> None:
    """
    AI 작업 실행 Celery 태스크.
    Job을 IN_PROGRESS로 두고 ai_router로 실제 호출 후, 결과를 Job/Artifact에 반영.
    """
    from weavai.apps.ai.router import ai_router
    from weavai.apps.ai.errors import AIProviderError, AIRequestError, AIQuotaExceededError

    try:
        job = Job.objects.get(id=job_id)
    except Job.DoesNotExist:
        logger.error(f"Job not found: {job_id}")
        return

    if job.status not in ('PENDING', 'IN_QUEUE'):
        logger.warning(f"Job {job_id} already processed (status={job.status})")
        return

    job.status = 'IN_PROGRESS'
    job.save(update_fields=['status', 'updated_at'])

    model_id = (job.model_id or '').lower()
    if 'image' in model_id or 'dall-e' in model_id or 'gpt-image' in model_id:
        model_type = 'image'
    elif 'video' in model_id or 'sora' in model_id or 'veo' in model_id:
        model_type = 'video'
    else:
        model_type = 'text'

    try:
        ai_result = ai_router.route_and_run(
            provider=job.provider,
            model_type=model_type,
            arguments=job.arguments or {}
        )
    except (AIProviderError, AIRequestError, AIQuotaExceededError) as e:
        job.status = 'FAILED'
        job.error = str(e)
        job.save(update_fields=['status', 'error', 'updated_at'])
        logger.error(f"AI job failed: {job_id} - {e}")
        return
    except Exception as e:
        job.status = 'FAILED'
        job.error = str(e)
        job.save(update_fields=['status', 'error', 'updated_at'])
        logger.exception(f"AI job error: {job_id}")
        return

    job.status = 'COMPLETED'
    job.result_json = ai_result
    job.save(update_fields=['status', 'result_json', 'updated_at'])

    if ai_result.get('text'):
        Artifact.objects.create(job=job, kind='text', text_content=ai_result['text'])
    elif ai_result.get('url'):
        kind = 'image' if model_type == 'image' else 'video' if model_type == 'video' else 'file'
        Artifact.objects.create(
            job=job,
            kind=kind,
            s3_key=ai_result.get('url'),
            presigned_url=ai_result['url'],
            mime_type=ai_result.get('mime_type') or ('image/png' if kind == 'image' else 'video/mp4'),
            size_bytes=ai_result.get('size_bytes')
        )
    logger.info(f"AI job completed: {job_id}")


# ===== AI 작업 관련 Celery 작업들 - 추후 구현 예정 =====
# 현재는 모두 주석 처리되어 있음
# 추후 AI 서비스(OpenAI, Gemini 등) 연동 시 활성화 예정

# @shared_task(bind=True, max_retries=3)
# def submit_ai_job(self, job_id: str) -> str:
#     """AI 서비스에 작업을 제출하는 Celery 작업"""
#     pass

# @shared_task(bind=True, max_retries=10)
# def poll_ai_job(self, job_id: str) -> str:
#     """AI 작업 상태를 주기적으로 확인하는 Celery 작업"""
#     pass

# @shared_task(bind=True)
# def finalize_ai_job(self, job_id: str) -> None:
#     """완료된 AI 작업의 결과를 처리하는 Celery 작업"""
#     pass

# ===== FAL.ai 관련 작업들 - 주석 처리됨 (추후 확장 예정) =====
# 아래 코드는 FAL.ai 연동 시 사용할 코드이지만, 현재는 사용하지 않음

# @shared_task(bind=True, max_retries=10)
# def poll_fal_job(self, job_id: str) -> str:
#     """FAL.ai 작업 상태를 주기적으로 확인하는 Celery 작업"""
#     try:
#         job = Job.objects.get(id=job_id)
#         if not job.fal_request_id:
#             raise ValueError(f"Job {job_id}에 request_id가 없습니다")
# 
#         logger.debug(f"FAL 작업 상태 폴링: {job_id}")
# 
#         # 클라이언트 생성
#         client = get_fal_client()
# 
#         # 상태 조회
#         status_result = client.get_job_status(job.fal_request_id)
#         status = status_result['status']
# 
#         # 상태에 따른 처리
#         if status in ['IN_QUEUE', 'IN_PROGRESS']:
#             # 아직 진행 중 - 30초 후 다시 폴링
#             logger.debug(f"FAL 작업 진행 중: {job_id} ({status})")
#             job.status = status
#             job.save()
#             poll_fal_job.apply_async((job_id,), countdown=30)
# 
#         elif status == 'COMPLETED':
#             # 완료됨 - 결과 처리
#             logger.info(f"FAL 작업 완료: {job_id}")
#             job.status = 'COMPLETED'
#             job.save()
# 
#             # 결과 마무리 작업 실행
#             finalize_job.delay(job_id)
# 
#         else:
#             # 실패 또는 알 수 없는 상태
#             logger.error(f"FAL 작업 실패: {job_id} ({status})")
#             job.status = 'FAILED'
#             job.error = f"FAL.ai status: {status}"
#             job.save()
# 
#         return status
# 
#     except Exception as e:
#         logger.error(f"FAL 작업 상태 폴링 실패: {job_id} - {e}")
# 
#         # 재시도
#         if self.request.retries < self.max_retries:
#             raise self.retry(countdown=30, exc=e)
# 
#         # 최종 실패
#         try:
#             job = Job.objects.get(id=job_id)
#             job.status = 'FAILED'
#             job.error = str(e)
#             job.save()
#         except Exception:
#             pass  # Job 객체를 찾을 수 없는 경우
# 
#         raise
# 
# 
# @shared_task(bind=True, max_retries=3)
# def finalize_job(self, job_id: str) -> None:
#     """
#     완료된 FAL.ai 작업의 결과를 처리하는 Celery 작업
# 
#     - 결과 파일들을 다운로드하여 MinIO에 업로드
#     - Artifact 레코드 생성
#     - Presigned URL 생성
# 
#     Args:
#         job_id: Job 모델의 ID
#     """
#     try:
#         # Job 객체 조회
#         job = Job.objects.get(id=job_id)
# 
#         if not job.is_completed:
#             logger.warning(f"작업이 완료되지 않음: {job_id}")
#             return
# 
#         logger.info(f"FAL 작업 결과 마무리 시작: {job_id}")
# 
#         # 클라이언트 생성
#         client = get_fal_client()
# 
#         # 결과 조회
#         result = client.get_job_result(job.fal_request_id)
# 
#         # 결과에서 파일 URL 추출
#         output = result.get('output', {})
#         if isinstance(output, dict):
#             # 단일 파일인 경우
#             file_urls = [output] if 'url' in output else []
#         elif isinstance(output, list):
#             # 다중 파일인 경우
#             file_urls = output
#         else:
#             file_urls = []
# 
#         if not file_urls:
#             logger.warning(f"FAL 작업에 파일 URL 없음: {job_id}")
#             return
# 
#         # S3 스토리지 초기화
#         storage = S3Storage()
# 
#         # 각 파일 처리
#         for file_data in file_urls:
#             if not isinstance(file_data, dict) or 'url' not in file_data:
#                 continue
# 
#             file_url = file_data['url']
#             content_type = file_data.get('content_type', 'application/octet-stream')
# 
#             try:
#                 # 파일 다운로드
#                 logger.debug(f"파일 다운로드: {file_url}")
#                 file_content = client.download_file(file_url)
# 
#                 # 파일 종류 결정
#                 if content_type.startswith('image/'):
#                     kind = 'image'
#                 elif content_type.startswith('video/'):
#                     kind = 'video'
#                 else:
#                     kind = 'file'
# 
#                 # S3에 업로드
#                 s3_key = f"jobs/{job_id}/{kind}_{len(job.artifacts.all()) + 1}"
#                 storage.upload_file(
#                     file_content=file_content,
#                     key=s3_key,
#                     content_type=content_type
#                 )
# 
#                 # Presigned URL 생성
#                 presigned_url = storage.generate_presigned_url(s3_key)
# 
#                 # Artifact 생성
#                 artifact = Artifact.objects.create(
#                     job=job,
#                     kind=kind,
#                     s3_key=s3_key,
#                     mime_type=content_type,
#                     size_bytes=len(file_content),
#                     presigned_url=presigned_url,
#                     presigned_url_expires_at=timezone.now() + timezone.timedelta(hours=1)
#                 )
# 
#                 logger.info(f"아티팩트 생성됨: {artifact.id}")
# 
#             except Exception as e:
#                 logger.error(f"파일 처리 실패: {file_url} - {e}")
#                 continue
# 
#         logger.info(f"FAL 작업 결과 마무리 완료: {job_id}")
# 
#     except Exception as e:
#         logger.error(f"FAL 작업 결과 마무리 실패: {job_id} - {e}")
# 
#         # 재시도
#         if self.request.retries < self.max_retries:
#             raise self.retry(countdown=60, exc=e)
# 
#         # 최종 실패
#         try:
#             job = Job.objects.get(id=job_id)
#             job.status = 'FAILED'
#             job.error = f"Finalize failed: {str(e)}"
#             job.save()
#         except Exception:
#             pass


@shared_task
def cleanup_old_jobs(days: int = 30) -> int:
    """
    오래된 완료된 작업들을 정리하는 주기적 작업

    Args:
        days: 몇 일 이상 된 작업들을 삭제할지

    Returns:
        삭제된 작업 수
    """
    from django.utils import timezone
    from datetime import timedelta

    cutoff_date = timezone.now() - timedelta(days=days)

    # 오래된 완료된 작업들 조회
    old_jobs = Job.objects.filter(
        status__in=['COMPLETED', 'FAILED'],
        created_at__lt=cutoff_date
    )

    deleted_count = 0
    for job in old_jobs:
        try:
            # 관련 아티팩트들도 함께 삭제
            artifacts = job.artifacts.all()
            for artifact in artifacts:
                # S3에서 파일 삭제 (선택사항)
                try:
                    storage = S3Storage()
                    storage.delete_file(artifact.s3_key)
                except Exception as e:
                    logger.warning(f"S3 파일 삭제 실패: {artifact.s3_key} - {e}")

                artifact.delete()

            job.delete()
            deleted_count += 1

        except Exception as e:
            logger.error(f"작업 삭제 실패: {job.id} - {e}")

    logger.info(f"오래된 작업 정리 완료: {deleted_count}개 삭제됨")
    return deleted_count
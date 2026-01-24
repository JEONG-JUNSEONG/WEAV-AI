# WEAV AI Jobs 앱 뷰
# AI 작업 관리 API (OpenAI, Gemini 연동) — 비동기 + 사용자별 목록/조회

import logging
from rest_framework import status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from .models import Job
from .serializers import (
    JobCreateSerializer,
    JobDetailSerializer,
    JobListSerializer,
)
from .tasks import run_ai_job, MAX_CONCURRENT_JOBS_PER_USER

logger = logging.getLogger(__name__)

ACTIVE_STATUSES = ('PENDING', 'IN_QUEUE', 'IN_PROGRESS')


def _model_type_from_model_id(model_id: str) -> str:
    m = (model_id or '').lower()
    if 'image' in m or 'dall-e' in m or 'gpt-image' in m:
        return 'image'
    if 'video' in m or 'sora' in m or 'veo' in m:
        return 'video'
    return 'text'


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def list_or_create_jobs(request):
    """GET: 내 작업 목록. POST: 작업 생성(비동기)."""
    if request.method == 'GET':
        qs = Job.objects.filter(user=request.user).order_by('-created_at')
        serializer = JobListSerializer(qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    # POST
    serializer = JobCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    active_count = Job.objects.filter(
        user=request.user,
        status__in=ACTIVE_STATUSES
    ).count()
    if active_count >= MAX_CONCURRENT_JOBS_PER_USER:
        return Response(
            {
                'detail': f'동시에 진행 가능한 작업은 최대 {MAX_CONCURRENT_JOBS_PER_USER}개입니다. 완료된 작업을 기다려 주세요.',
                'max_concurrent': MAX_CONCURRENT_JOBS_PER_USER,
            },
            status=status.HTTP_429_TOO_MANY_REQUESTS
        )
    job = Job.objects.create(
        user=request.user,
        status='IN_QUEUE',
        **serializer.validated_data
    )
    logger.info(f"새 AI 작업 생성(비동기): {job.id} user={request.user.username}")
    run_ai_job.delay(str(job.id))
    return Response(
        {
            'id': str(job.id),
            'status': job.status,
            'message': '작업이 큐에 등록되었습니다. GET /api/v1/jobs/<id>/ 로 상태를 확인하세요.',
        },
        status=status.HTTP_202_ACCEPTED
    )


def _detail_payload(job):
    """상세 응답에 result 필드 추가 (폴링 시 프론트 호환)"""
    serializer = JobDetailSerializer(job)
    data = dict(serializer.data)
    if job.status == 'COMPLETED' and job.result_json:
        model_type = _model_type_from_model_id(job.model_id)
        data['result'] = {**job.result_json, 'type': model_type}
    return data


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def job_detail(request, pk):
    """작업 상세 (본인 작업만). COMPLETED 시 result 포함."""
    try:
        job = Job.objects.get(id=pk, user=request.user)
    except Job.DoesNotExist:
        return Response(
            {'detail': '작업을 찾을 수 없습니다.'},
            status=status.HTTP_404_NOT_FOUND
        )
    return Response(_detail_payload(job), status=status.HTTP_200_OK)

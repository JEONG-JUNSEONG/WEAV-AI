from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from apps.chats.models import Session, Message, Job, SESSION_KIND_CHAT, SESSION_KIND_IMAGE
from apps.chats.serializers import MessageSerializer, ImageRecordSerializer
from .schemas import TextGenerationRequest, ImageGenerationRequest
from .router import IMAGE_MODEL_GOOGLE
from . import tasks


@api_view(['POST'])
def complete_chat(request):
    try:
        body = TextGenerationRequest(**request.data)
    except Exception as e:
        return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    session_id = request.data.get('session_id')
    if not session_id:
        return Response({'detail': 'session_id required'}, status=status.HTTP_400_BAD_REQUEST)
    session = get_object_or_404(Session, pk=session_id)
    if session.kind != SESSION_KIND_CHAT:
        return Response({'detail': 'Not a chat session'}, status=status.HTTP_400_BAD_REQUEST)
    user_msg = Message.objects.create(session=session, role='user', content=body.prompt)
    # 첫 메시지면 세션 제목을 사용자 첫 문구로 설정 (DB 기준으로 카운트해 역참조 캐시 이슈 방지)
    if Message.objects.filter(session_id=session.pk).count() == 1:
        new_title = (body.prompt.strip() or session.title)[:255]
        session.title = new_title
        session.save(update_fields=['title', 'updated_at'])
    job = Job.objects.create(session=session, kind='chat', status='pending')
    task = tasks.task_chat.delay(
        job.id,
        prompt=body.prompt,
        model=body.model or 'google/gemini-2.5-flash',
        system_prompt=body.system_prompt,
    )
    job.task_id = task.id
    job.save(update_fields=['task_id'])
    return Response({
        'task_id': task.id,
        'job_id': job.id,
        'message_id': user_msg.id,
    }, status=status.HTTP_202_ACCEPTED)


@api_view(['POST'])
def complete_image(request):
    try:
        body = ImageGenerationRequest(**request.data)
    except Exception as e:
        return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    session_id = request.data.get('session_id')
    if not session_id:
        return Response({'detail': 'session_id required'}, status=status.HTTP_400_BAD_REQUEST)
    session = get_object_or_404(Session, pk=session_id)
    if session.kind != SESSION_KIND_IMAGE:
        return Response({'detail': 'Not an image session'}, status=status.HTTP_400_BAD_REQUEST)
    job = Job.objects.create(session=session, kind='image', status='pending')
    task = tasks.task_image.delay(
        job.id,
        prompt=body.prompt,
        model=body.model or IMAGE_MODEL_GOOGLE,
        aspect_ratio=body.aspect_ratio,
        num_images=body.num_images,
    )
    job.task_id = task.id
    job.save(update_fields=['task_id'])
    return Response({
        'task_id': task.id,
        'job_id': job.id,
    }, status=status.HTTP_202_ACCEPTED)


@api_view(['GET'])
def job_status(request, task_id):
    job = get_object_or_404(Job, task_id=task_id)
    payload = {'task_id': task_id, 'job_id': job.id, 'status': job.status}
    if job.status == 'success':
        if job.message_id:
            payload['message'] = MessageSerializer(job.message).data
        if job.image_record_id:
            payload['image'] = ImageRecordSerializer(job.image_record).data
    if job.status == 'failure':
        payload['error'] = job.error_message
    return Response(payload)

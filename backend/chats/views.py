# WEAV AI Chats 앱 뷰
# 폴더/채팅 세션 CRUD — 사용자별 DB 저장

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Folder, ChatSession
from .serializers import FolderSerializer, ChatSessionSerializer


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def folder_list_or_create(request):
    """GET: 내 폴더 목록. POST: 폴더 생성."""
    if request.method == 'GET':
        qs = Folder.objects.filter(user=request.user)
        serializer = FolderSerializer(qs, many=True)
        return Response(serializer.data)

    serializer = FolderSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    serializer.save(user=request.user)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def folder_detail(request, pk):
    """폴더 조회/수정/삭제."""
    try:
        folder = Folder.objects.get(id=pk, user=request.user)
    except Folder.DoesNotExist:
        return Response({'detail': '폴더를 찾을 수 없습니다.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        serializer = FolderSerializer(folder)
        return Response(serializer.data)
    if request.method == 'DELETE':
        folder.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    serializer = FolderSerializer(folder, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def chat_list_or_create(request):
    """GET: 내 채팅 목록 (?folder=uuid 옵션). POST: 채팅 생성."""
    if request.method == 'GET':
        qs = ChatSession.objects.filter(user=request.user)
        folder_id = request.query_params.get('folder')
        if folder_id:
            qs = qs.filter(folder_id=folder_id)
        else:
            qs = qs.filter(folder__isnull=True)
        serializer = ChatSessionSerializer(qs, many=True)
        return Response(serializer.data)

    data = {k: v for k, v in request.data.items()}
    folder_id = data.pop('folder_id', None) or data.pop('folder', None)
    folder = None
    if folder_id:
        try:
            folder = Folder.objects.get(id=folder_id, user=request.user)
        except (Folder.DoesNotExist, ValueError):
            return Response({'detail': '폴더를 찾을 수 없습니다.'}, status=status.HTTP_404_NOT_FOUND)
    data['folder'] = folder

    serializer = ChatSessionSerializer(data=data)
    serializer.is_valid(raise_exception=True)
    serializer.save(user=request.user, folder=folder)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def chat_detail(request, pk):
    """채팅 조회/수정/삭제."""
    try:
        chat = ChatSession.objects.get(id=pk, user=request.user)
    except ChatSession.DoesNotExist:
        return Response({'detail': '채팅을 찾을 수 없습니다.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        serializer = ChatSessionSerializer(chat)
        return Response(serializer.data)
    if request.method == 'DELETE':
        chat.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    serializer = ChatSessionSerializer(chat, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)

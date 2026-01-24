# WEAV AI Chats 앱 모델
# 폴더 및 채팅 세션 DB 저장 (로그아웃 후 유지)

import uuid
from django.conf import settings
from django.db import models


class Folder(models.Model):
    """사용자 폴더 (프로젝트/채팅 그룹)"""

    TYPE_CHOICES = [
        ('custom', 'custom'),
        ('shorts-workflow', 'shorts-workflow'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='chat_folders',
    )
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=32, choices=TYPE_CHOICES, default='custom')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['user'])]

    def __str__(self):
        return f"{self.name} ({self.user_id})"


class ChatSession(models.Model):
    """채팅 세션 (메시지 포함). 폴더에 속하거나 루트(최근 채팅)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='chat_sessions',
    )
    folder = models.ForeignKey(
        'Folder',
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='chats',
    )
    title = models.CharField(max_length=512)
    messages = models.JSONField(default=list)  # [{ id, role, content, type, ... }]
    model_id = models.CharField(max_length=128, default='gpt-5.2-instant')
    system_instruction = models.TextField(blank=True)
    recommended_prompts = models.JSONField(default=list, blank=True)  # AI 폴더용
    last_modified = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-last_modified']
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['user', 'folder']),
        ]

    def __str__(self):
        return f"{self.title[:30]} ({self.user_id})"

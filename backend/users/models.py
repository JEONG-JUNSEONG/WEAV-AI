# WEAV AI Users 앱 모델
# 사용자 프로필 및 멤버십 관리

from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone


class User(AbstractUser):
    """커스텀 User 모델 - 멤버십 및 API 키 관리"""

    # 멤버십 타입
    MEMBERSHIP_CHOICES = [
        ('free', '무료'),
        ('standard', '스탠다드'),
        ('premium', '프리미엄'),
    ]

    # Firebase UID (username으로 사용)
    # username = Firebase UID (AbstractUser 상속)

    # 멤버십 정보
    membership_type = models.CharField(
        max_length=20,
        choices=MEMBERSHIP_CHOICES,
        default='free',
        db_index=True,
        help_text='멤버십 타입'
    )
    membership_expires_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='멤버십 만료 시각 (null이면 무기한)'
    )

    # API 키 상태 (사용자가 직접 설정한 API 키)
    has_openai_key = models.BooleanField(
        default=False,
        help_text='OpenAI API 키 보유 여부'
    )
    has_gemini_key = models.BooleanField(
        default=False,
        help_text='Gemini API 키 보유 여부'
    )

    # 추가 메타데이터
    photo_url = models.URLField(
        blank=True,
        null=True,
        help_text='프로필 사진 URL'
    )
    last_login_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='마지막 로그인 시각'
    )

    class Meta:
        db_table = 'auth_user'
        verbose_name = '사용자'
        verbose_name_plural = '사용자들'
        indexes = [
            models.Index(fields=['membership_type', 'membership_expires_at']),
        ]

    def __str__(self):
        return f"{self.email or self.username} ({self.membership_type})"

    @property
    def is_membership_active(self):
        """멤버십이 활성화되어 있는지 확인"""
        if self.membership_type == 'free':
            return True  # 무료는 항상 활성
        if not self.membership_expires_at:
            return True  # 만료일 없으면 무기한
        return timezone.now() < self.membership_expires_at

    @property
    def can_use_premium_features(self):
        """프리미엄 기능 사용 가능 여부"""
        return self.is_membership_active and self.membership_type in ('standard', 'premium')

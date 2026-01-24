"""
사용자 인증 및 프로필 관리 뷰
Firebase ID Token 검증 및 JWT 발급
"""

import logging
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.conf import settings
from django.utils import timezone

# Firebase Admin SDK (설치 필요: pip install firebase-admin)
try:
    import firebase_admin
    from firebase_admin import credentials, auth
    from firebase_admin.exceptions import FirebaseError
    
    # Firebase Admin SDK 초기화 (환경변수 또는 서비스 계정 키 파일 사용)
    if not firebase_admin._apps:
        # 환경변수에서 Firebase 서비스 계정 키 경로 확인
        import os
        firebase_cred_path = os.getenv('FIREBASE_SERVICE_ACCOUNT_KEY_PATH')
        
        if firebase_cred_path and os.path.exists(firebase_cred_path):
            cred = credentials.Certificate(firebase_cred_path)
            firebase_admin.initialize_app(cred)
        else:
            # 환경변수에서 직접 키 정보 읽기 (JSON 문자열)
            firebase_cred_json = os.getenv('FIREBASE_SERVICE_ACCOUNT_KEY_JSON')
            if firebase_cred_json:
                import json
                cred_dict = json.loads(firebase_cred_json)
                cred = credentials.Certificate(cred_dict)
                firebase_admin.initialize_app(cred)
            else:
                logging.warning("Firebase Admin SDK not initialized. Firebase token verification will fail.")
                firebase_admin = None
except ImportError:
    logging.warning("firebase-admin not installed. Install with: pip install firebase-admin")
    firebase_admin = None
    auth = None

logger = logging.getLogger(__name__)
User = get_user_model()


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_firebase_token(request):
    """
    Firebase ID Token을 검증하고 JWT 토큰을 발급합니다.
    
    Request Body:
    {
        "id_token": "firebase_id_token_string"
    }
    
    Response:
    {
        "access": "jwt_access_token",
        "refresh": "jwt_refresh_token",
        "user": {
            "uid": "firebase_uid",
            "email": "user@example.com",
            "display_name": "User Name"
        }
    }
    """
    id_token = request.data.get('id_token')
    
    if not id_token:
        return Response(
            {'error': 'id_token이 필요합니다.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if not firebase_admin or not auth:
        return Response(
            {'error': 'Firebase Admin SDK가 설정되지 않았습니다.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    try:
        # Firebase ID Token 검증
        decoded_token = auth.verify_id_token(id_token)
        firebase_uid = decoded_token['uid']
        email = decoded_token.get('email')
        display_name = decoded_token.get('name')
        photo_url = decoded_token.get('picture')
        
        # Django User 모델에서 사용자 조회 또는 생성
        user, created = User.objects.get_or_create(
            username=firebase_uid,  # Firebase UID를 username으로 사용
            defaults={
                'email': email or '',
                'first_name': display_name or '',
                'membership_type': 'free',  # 기본값: 무료
            }
        )
        
        # 사용자 정보 업데이트 (최신 정보로)
        if email:
            user.email = email
        if display_name:
            user.first_name = display_name
        if photo_url:
            user.photo_url = photo_url
        user.last_login_at = timezone.now()
        user.save()
        
        # JWT 토큰 생성
        refresh = RefreshToken.for_user(user)
        
        logger.info(f"Firebase token verified for user: {firebase_uid} (created: {created})")
        
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': {
                'uid': firebase_uid,
                'email': email,
                'display_name': display_name,
                'photo_url': photo_url,
                'membership_type': user.membership_type,
                'membership_expires_at': user.membership_expires_at.isoformat() if user.membership_expires_at else None,
                'is_membership_active': user.is_membership_active,
                'can_use_premium_features': user.can_use_premium_features,
                'has_openai_key': user.has_openai_key,
                'has_gemini_key': user.has_gemini_key,
            }
        }, status=status.HTTP_200_OK)
        
    except FirebaseError as e:
        logger.error(f"Firebase token verification failed: {e}")
        return Response(
            {'error': '유효하지 않은 Firebase 토큰입니다.'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    except Exception as e:
        logger.error(f"Unexpected error in verify_firebase_token: {e}", exc_info=True)
        return Response(
            {'error': '서버 오류가 발생했습니다.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def user_profile(request):
    """
    사용자 프로필 조회 및 수정
    
    GET: 프로필 조회
    PUT: 프로필 수정
    """
    if request.method == 'GET':
        return Response({
            'id': request.user.id,
            'username': request.user.username,
            'email': request.user.email,
            'first_name': request.user.first_name,
            'last_name': request.user.last_name,
            'date_joined': request.user.date_joined,
            'membership_type': request.user.membership_type,
            'membership_expires_at': request.user.membership_expires_at.isoformat() if request.user.membership_expires_at else None,
            'is_membership_active': request.user.is_membership_active,
            'can_use_premium_features': request.user.can_use_premium_features,
            'has_openai_key': request.user.has_openai_key,
            'has_gemini_key': request.user.has_gemini_key,
        }, status=status.HTTP_200_OK)
    
    elif request.method == 'PUT':
        # 프로필 수정
        first_name = request.data.get('first_name')
        last_name = request.data.get('last_name')
        email = request.data.get('email')
        
        if first_name is not None:
            request.user.first_name = first_name
        if last_name is not None:
            request.user.last_name = last_name
        if email is not None:
            request.user.email = email
        
        request.user.save()
        
        return Response({
            'id': request.user.id,
            'username': request.user.username,
            'email': request.user.email,
            'first_name': request.user.first_name,
            'last_name': request.user.last_name,
        }, status=status.HTTP_200_OK)

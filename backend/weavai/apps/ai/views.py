# WEAV AI AI 서비스 뷰
# 텍스트 채팅 완료 엔드포인트 (Gateway)

import logging
from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .router import AIServiceRouter
from .schemas import TextGenerationRequest
from .errors import AIServiceError, AIProviderError, AIRequestError

logger = logging.getLogger(__name__)
router = AIServiceRouter()


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def complete_chat(request):
    """
    텍스트 채팅 완료 (Gateway)
    
    Request Body:
    {
        "provider": "fal",
        "model": "openai/gpt-4o-mini" | "google/gemini-flash-1.5" | "fal-ai/*",
        "input_text": "사용자 입력",
        "system_prompt": "시스템 프롬프트 (선택)",
        "history": [{"role": "user|assistant", "content": "..."}, ...],
        "temperature": 0.7,
        "max_output_tokens": 1024
    }
    
    Response:
    {
        "text": "AI 응답 텍스트",
        "provider": "fal",
        "model": "meta-llama/llama-4-maverick",
        "usage": {"prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30}
    }
    """
    try:
        provider = request.data.get('provider') or getattr(settings, 'AI_PROVIDER_DEFAULT', 'fal')
        model = request.data.get('model')
        input_text = request.data.get('input_text')
        system_prompt = request.data.get('system_prompt')
        history = request.data.get('history', [])
        temperature = request.data.get('temperature', 0.7)
        max_output_tokens = request.data.get('max_output_tokens', 1024)
        
        if not input_text:
            return Response(
                {'error': 'input_text가 필요합니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # provider는 fal 고정
        
        # 히스토리 처리: 시스템 프롬프트에 통합 (향후 개선 가능)
        if history:
            history_text = '\n'.join([
                f"{'User' if msg.get('role') == 'user' else 'Assistant'}: {msg.get('content', '')}"
                for msg in history[-5:]  # 최근 5개만
            ])
            if system_prompt:
                system_prompt = f"{system_prompt}\n\n이전 대화:\n{history_text}"
            else:
                system_prompt = f"이전 대화:\n{history_text}"
        
        # 라우터로 텍스트 생성
        arguments = {
            'input_text': input_text,
            'system_prompt': system_prompt,
            'temperature': temperature,
            'max_output_tokens': max_output_tokens,
            'model': model
        }
        
        result = router.generate_text(provider, arguments)
        if not isinstance(result, dict):
            logger.error(f"텍스트 생성 실패: provider={provider}, user={request.user.username}, result={result}")
            return Response(
                {'error': 'AI 응답이 비어있습니다. 잠시 후 다시 시도해주세요.'},
                status=status.HTTP_502_BAD_GATEWAY
            )

        usage = result.get('usage') or {}
        logger.info(
            f"텍스트 생성 완료: provider={provider}, user={request.user.username}, tokens={usage.get('total_tokens', 0)}"
        )
        
        return Response(result, status=status.HTTP_200_OK)
        
    except AIProviderError as e:
        logger.error(f"AI Provider Error: {e}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )
    except AIRequestError as e:
        logger.error(f"AI Request Error: {e}")
        return Response(
            {'error': str(e)},
            status=e.status_code if hasattr(e, 'status_code') else status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    except Exception as e:
        logger.error(f"Unexpected error in complete_chat: {e}", exc_info=True)
        return Response(
            {'error': '서버 오류가 발생했습니다.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

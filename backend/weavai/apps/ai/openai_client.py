# WEAV AI OpenAI 클라이언트
# OpenAI Responses API 기반 텍스트/이미지/비디오 생성

import os
from typing import Dict, Any, Optional
from openai import OpenAI
from .schemas import TextGenerationRequest, ImageGenerationRequest, VideoGenerationRequest
from .errors import AIProviderError, AIRequestError, AIQuotaExceededError


class OpenAIClient:
    """OpenAI API 클라이언트"""

    def __init__(self):
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            raise AIProviderError('openai', 'OPENAI_API_KEY 환경변수가 설정되지 않았습니다')

        self.client = OpenAI(api_key=api_key)
        self.default_text_model = os.getenv('OPENAI_TEXT_MODEL', 'gpt-4o-mini')

    def generate_text(self, request: TextGenerationRequest) -> Dict[str, Any]:
        """
        텍스트 생성 (OpenAI Responses API 사용)

        Args:
            request: 검증된 텍스트 생성 요청

        Returns:
            Dict: 표준화된 응답 데이터
        """
        try:
            # 메시지 구성
            messages = []

            # 시스템 프롬프트 추가
            if request.system_prompt:
                messages.append({
                    "role": "system",
                    "content": request.system_prompt
                })

            # 사용자 입력 추가
            messages.append({
                "role": "user",
                "content": request.input_text
            })

            # API 호출
            response = self.client.chat.completions.create(
                model=self.default_text_model,
                messages=messages,
                temperature=request.temperature,
                max_tokens=request.max_output_tokens,
                # Responses API에서는 response_format을 사용할 수 있음
            )

            # 응답 데이터 표준화
            choice = response.choices[0]
            message = choice.message

            result = {
                "provider": "openai",
                "model": response.model,
                "text": message.content,
                "usage": {
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens
                },
                "finish_reason": choice.finish_reason
            }

            return result

        except Exception as e:
            error_message = str(e)

            # 에러 타입에 따른 구분 처리
            if "insufficient_quota" in error_message.lower():
                raise AIQuotaExceededError("openai")
            elif "invalid_api_key" in error_message.lower():
                raise AIProviderError("openai", "API 키가 유효하지 않습니다")
            elif "model_not_found" in error_message.lower():
                raise AIRequestError("openai", f"모델 '{self.default_text_model}'을 찾을 수 없습니다", 400)
            else:
                raise AIRequestError("openai", f"텍스트 생성 실패: {error_message}", 500)

    def generate_image(self, request: ImageGenerationRequest) -> Dict[str, Any]:
        """
        이미지 생성 (DALL-E 사용)

        Args:
            request: 검증된 이미지 생성 요청

        Returns:
            Dict: 표준화된 응답 데이터
        """
        try:
            response = self.client.images.generate(
                model="dall-e-3",  # 최신 모델 사용
                prompt=request.prompt,
                size=request.size,
                quality=request.quality,
                n=1
            )

            # 응답 데이터 표준화
            image_data = response.data[0]
            result = {
                "provider": "openai",
                "model": "dall-e-3",
                "url": image_data.url,
                "revised_prompt": getattr(image_data, 'revised_prompt', None)
            }

            return result

        except Exception as e:
            error_message = str(e)

            if "insufficient_quota" in error_message.lower():
                raise AIQuotaExceededError("openai")
            else:
                raise AIRequestError("openai", f"이미지 생성 실패: {error_message}", 500)

    def generate_video(self, request: VideoGenerationRequest) -> Dict[str, Any]:
        """
        비디오 생성 (Sora 2 사용)
        
        참고: Sora API는 비동기 작업이므로 폴링이 필요합니다.
        현재는 동기식으로 구현되어 있으나, 실제 API가 공개되면 Celery를 통한 비동기 처리로 전환 권장.

        Args:
            request: 검증된 비디오 생성 요청

        Returns:
            Dict: 표준화된 응답 데이터
        """
        try:
            import requests
            import time
            
            api_key = os.getenv('OPENAI_API_KEY')
            if not api_key:
                raise AIProviderError('openai', 'OPENAI_API_KEY 환경변수가 설정되지 않았습니다')

            # Duration 파싱 (예: "8s" -> 8)
            raw_seconds = int(request.duration.replace('s', '')) if request.duration else 8
            
            # Sora 2는 4, 8, 12초만 지원
            if raw_seconds <= 6:
                seconds = 4
            elif raw_seconds <= 10:
                seconds = 8
            else:
                seconds = 12

            # Resolution & Aspect Ratio 처리
            # 지원 형식: '720x1280', '1280x720', '1024x1792', '1792x1024'
            is_portrait = request.aspect_ratio in ['9:16', '3:4']
            if request.resolution == '1080p':
                size = '1024x1792' if is_portrait else '1792x1024'
            elif request.resolution == '4K':
                size = '1024x1792' if is_portrait else '1792x1024'  # 4K는 최대 해상도
            else:  # 720p or default
                size = '720x1280' if is_portrait else '1280x720'

            # 1. 비디오 생성 작업 시작
            create_url = "https://api.openai.com/v1/videos/generations"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": "sora-2",
                "prompt": request.prompt,
                "size": size,
                "duration": seconds
            }

            create_response = requests.post(create_url, headers=headers, json=payload, timeout=30)
            
            if create_response.status_code == 401:
                raise AIProviderError('openai', 'OpenAI API 키가 유효하지 않습니다', status_code=401)
            elif create_response.status_code == 429:
                raise AIQuotaExceededError('openai', 'OpenAI 할당량을 초과했습니다', status_code=429)
            elif create_response.status_code == 404:
                # Sora API가 아직 공개되지 않은 경우
                raise AIRequestError('openai', 'Sora API는 아직 공개되지 않았습니다. OpenAI에서 공개되면 자동으로 사용 가능합니다.', status_code=404)
            
            create_response.raise_for_status()
            job_data = create_response.json()
            video_id = job_data.get('id')
            status = job_data.get('status', 'queued')

            # 2. 작업 완료 대기 (폴링)
            max_attempts = 120  # 최대 4분 (2초 간격)
            attempts = 0
            
            while status in ['queued', 'in_progress']:
                if attempts >= max_attempts:
                    raise AIRequestError('openai', '비디오 생성 시간 초과', 504)
                
                time.sleep(2)  # 2초 대기
                attempts += 1
                
                # 작업 상태 확인
                poll_url = f"https://api.openai.com/v1/videos/{video_id}"
                poll_response = requests.get(poll_url, headers=headers, timeout=30)
                poll_response.raise_for_status()
                job_data = poll_response.json()
                status = job_data.get('status', 'unknown')
                
                if status == 'failed':
                    error_msg = job_data.get('error', {}).get('message', 'Unknown error')
                    raise AIRequestError('openai', f'비디오 생성 실패: {error_msg}', 500)

            # 3. 완료된 비디오 URL 가져오기
            if status == 'completed':
                video_url = job_data.get('url') or job_data.get('video_url')
                if not video_url:
                    # content 엔드포인트에서 가져오기
                    content_url = f"https://api.openai.com/v1/videos/{video_id}/content"
                    content_response = requests.get(content_url, headers=headers, timeout=30, allow_redirects=True)
                    # 실제로는 presigned URL이 반환될 수 있음
                    video_url = content_response.url if content_response.status_code == 200 else None
                
                result = {
                    "provider": "openai",
                    "model": "sora-2",
                    "url": video_url,
                    "duration": seconds,
                    "size": size
                }
                return result
            else:
                raise AIRequestError('openai', f'예상치 못한 작업 상태: {status}', 500)

        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 404:
                raise AIRequestError("openai", "Sora API는 아직 공개되지 않았습니다", 404)
            elif e.response.status_code == 401:
                raise AIProviderError("openai", "API 키가 유효하지 않습니다", 401)
            elif e.response.status_code == 429:
                raise AIQuotaExceededError("openai")
            else:
                error_text = e.response.text if hasattr(e, 'response') else str(e)
                raise AIRequestError("openai", f"비디오 생성 실패: {error_text}", e.response.status_code if hasattr(e, 'response') else 500)
        except Exception as e:
            error_message = str(e)
            if "insufficient_quota" in error_message.lower():
                raise AIQuotaExceededError("openai")
            elif isinstance(e, (AIProviderError, AIRequestError, AIQuotaExceededError)):
                raise  # 이미 커스텀 에러인 경우 그대로 전파
            else:
                raise AIRequestError("openai", f"비디오 생성 실패: {error_message}", 500)
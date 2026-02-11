"""
fal.ai HTTP API: openrouter/router (chat), imagen4 (Google), flux-pro v1.1-ultra (FLUX), Kling.
참고: 00_docs/imagen4-preview.txt, 00_docs/flux-pro_v1.1-ultra.txt
"""
import base64
import os
import logging
from typing import Optional
from urllib.parse import urlparse, urlunparse
import ipaddress

import requests
from .errors import FALError

FAL_BASE = 'https://fal.run'
# 채팅: openrouter/router (any-llm deprecated 대체)
FAL_CHAT_ENDPOINT = 'openrouter/router'
# Imagen 4 (Google): aspect_ratio "1:1"|"16:9"|"9:16"|"4:3"|"3:4", resolution "1K"|"2K", output_format png|jpeg|webp
FAL_IMAGEN4 = 'fal-ai/imagen4/preview'
# FLUX Pro v1.1 Ultra: aspect_ratio "21:9"|"16:9"|"4:3"|"3:2"|"1:1"|"2:3"|"3:4"|"9:16"|"9:21", output_format jpeg|png
FAL_FLUX_ULTRA = 'fal-ai/flux-pro/v1.1-ultra'
# Kling (Placeholder endpoint)
FAL_KLING = 'kling-ai/kling-v1'
# Gemini 3 Pro Image Preview (Google, Nano Banana Pro): text-to-image
FAL_GEMINI3_PRO_IMAGE = 'fal-ai/gemini-3-pro-image-preview'
# Gemini 3 Pro Image Preview Edit: image_urls required, up to 2 ref images
FAL_GEMINI3_PRO_IMAGE_EDIT = 'fal-ai/gemini-3-pro-image-preview/edit'
# Nano Banana Pro
FAL_NANO_BANANA_PRO = 'fal-ai/nano-banana-pro'
FAL_NANO_BANANA_PRO_EDIT = 'fal-ai/nano-banana-pro/edit'

logger = logging.getLogger(__name__)


def _fal_headers():
    key = os.environ.get('FAL_KEY', '')
    if not key:
        raise FALError('FAL_KEY not set')
    return {'Authorization': f'Key {key}', 'Content-Type': 'application/json'}


def _is_private_or_local_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
        host = parsed.hostname
        if not host:
            return True
        if host in ('localhost', '127.0.0.1', '0.0.0.0', 'minio', 'api'):
            return True
        try:
            ip = ipaddress.ip_address(host)
            return ip.is_private or ip.is_loopback or ip.is_link_local
        except ValueError:
            return False
    except Exception:
        return True


def _is_ngrok_url(url: str) -> bool:
    """fal.ai 서버에서 접근 불가한 ngrok 터널 등은 백엔드에서 이미지를 받아 Data URI로 넘깁니다."""
    try:
        parsed = urlparse(url)
        host = (parsed.hostname or '').lower()
        return 'ngrok' in host or 'ngrok-free' in host
    except Exception:
        return False


def _fetch_image_as_data_uri(url: str, timeout: int = 30) -> str:
    """URL에서 이미지를 다운로드해 data:image/...;base64,... 형식으로 반환."""
    headers = {}
    if _is_ngrok_url(url):
        headers['Ngrok-Skip-Browser-Warning'] = '1'
    r = requests.get(url, headers=headers, timeout=timeout)
    r.raise_for_status()
    content_type = r.headers.get('Content-Type', 'image/png').split(';')[0].strip()
    if content_type not in ('image/png', 'image/jpeg', 'image/jpg', 'image/webp'):
        content_type = 'image/png'
    b64 = base64.b64encode(r.content).decode('ascii')
    return f'data:{content_type};base64,{b64}'


def _ensure_fal_reachable_image_url(url: str) -> str:
    """
    fal.ai가 접근할 수 없는 URL(ngrok, localhost 등)이면
    백엔드에서 이미지를 받아 Data URI로 변환해 반환. fal은 image_urls에 Data URI 지원.
    """
    if not url or not url.strip():
        return url
    if url.strip().lower().startswith('data:'):
        return url
    if _is_private_or_local_url(url) or _is_ngrok_url(url):
        try:
            return _fetch_image_as_data_uri(url)
        except Exception as e:
            logger.warning("Failed to fetch image for fal, passing URL as-is: %s", e)
    return url


def _require_public_urls(urls: list[str], label: str):
    for u in urls:
        if _is_private_or_local_url(u):
            raise FALError(
                f'{label} must be publicly accessible URLs. Got: {u}. '
                'Use a public object storage/CDN or presigned URL.'
            )


def _fal_debug_enabled() -> bool:
    return os.environ.get('FAL_DEBUG', '').strip().lower() in ('1', 'true', 'yes', 'on')


def _mask_url(url: str) -> str:
    try:
        parsed = urlparse(url)
        return urlunparse(parsed._replace(query='', fragment=''))
    except Exception:
        return url


def _sanitize_payload(payload: dict) -> dict:
    safe = dict(payload)
    prompt = safe.get('prompt')
    if isinstance(prompt, str) and len(prompt) > 300:
        safe['prompt'] = prompt[:300] + f'... (len={len(prompt)})'
    if isinstance(safe.get('image_urls'), list):
        safe['image_urls'] = [_mask_url(u) for u in safe['image_urls']]
    return safe


def chat_completion(prompt: str, model: str = 'google/gemini-2.5-flash', system_prompt: Optional[str] = None, temperature: float = 0.7, max_tokens: Optional[int] = None) -> str:
    payload = {'prompt': prompt, 'model': model, 'temperature': temperature}
    if system_prompt:
        payload['system_prompt'] = system_prompt
    if max_tokens is not None:
        payload['max_tokens'] = max_tokens
    r = requests.post(f'{FAL_BASE}/{FAL_CHAT_ENDPOINT}', headers=_fal_headers(), json=payload, timeout=120)
    r.raise_for_status()
    data = r.json()
    if 'output' not in data:
        raise FALError(data.get('error', 'No output'))
    return data['output']


def image_generation_fal(prompt: str, model: str = FAL_IMAGEN4, aspect_ratio: str = '1:1', num_images: int = 1, **kwargs) -> list[dict]:
    """
    fal.ai 이미지 생성.
    - Imagen 4: aspect_ratio "1:1"|"16:9"|"9:16"|"4:3"|"3:4", num_images 1~4
    - FLUX Pro v1.1 Ultra: aspect_ratio "21:9"|"16:9"|"4:3"|"3:2"|"1:1"|"2:3"|"3:4"|"9:16"|"9:21"
    - Kling: supports seed, reference_image_url, mask_url
    - Gemini 3 Pro Image Preview: text-to-image; reference_image_url 있으면 edit 엔드포인트(image_urls) 사용
    """
    num_images = max(1, min(4, num_images))

    if 'nano-banana-pro/edit' in model.lower():
        endpoint = FAL_NANO_BANANA_PRO_EDIT
        image_urls = kwargs.get('image_urls') or []
        if not image_urls:
            raise FALError('image_urls required for nano-banana-pro/edit')
        # ngrok/비공개 URL은 백엔드에서 받아 Data URI로 변환해 fal에 전달
        image_urls = [_ensure_fal_reachable_image_url(u) for u in image_urls]
        allowed_ratio = ('auto', '21:9', '16:9', '3:2', '4:3', '5:4', '1:1', '4:5', '3:4', '2:3', '9:16')
        res = kwargs.get('resolution') or '1K'
        res = res if res in ('1K', '2K', '4K') else '1K'
        out_fmt = kwargs.get('output_format') or 'png'
        out_fmt = out_fmt if out_fmt in ('png', 'jpeg', 'webp') else 'png'
        payload = {
            'prompt': prompt,
            'num_images': num_images,
            'image_urls': image_urls,
            'aspect_ratio': aspect_ratio if aspect_ratio in allowed_ratio else 'auto',
            'output_format': out_fmt,
            'resolution': res,
        }
        if kwargs.get('seed') is not None:
            payload['seed'] = kwargs['seed']
    elif 'gemini-3-pro-image-preview' in model.lower():
        ref_url = kwargs.get('reference_image_url')
        allowed_ratio = ('21:9', '16:9', '3:2', '4:3', '5:4', '1:1', '4:5', '3:4', '2:3', '9:16')
        res = kwargs.get('resolution') or '1K'
        res = res if res in ('1K', '2K', '4K') else '1K'
        out_fmt = kwargs.get('output_format') or 'png'
        out_fmt = out_fmt if out_fmt in ('png', 'jpeg', 'webp') else 'png'
        if ref_url:
            ref_url = _ensure_fal_reachable_image_url(ref_url)
            # 참조 이미지 있음 → edit API (이미지 기반 편집)
            endpoint = FAL_GEMINI3_PRO_IMAGE_EDIT
            payload = {
                'prompt': prompt,
                'num_images': num_images,
                'image_urls': [ref_url],
                'aspect_ratio': aspect_ratio if aspect_ratio in allowed_ratio else 'auto',
                'output_format': out_fmt,
                'resolution': res,
            }
            if kwargs.get('seed') is not None:
                payload['seed'] = kwargs['seed']
        else:
            # 참조 없음 → text-to-image
            endpoint = FAL_GEMINI3_PRO_IMAGE
            payload = {
                'prompt': prompt,
                'num_images': num_images,
                'aspect_ratio': aspect_ratio if aspect_ratio in allowed_ratio else '1:1',
                'output_format': out_fmt,
                'resolution': res,
            }
            if kwargs.get('seed') is not None:
                payload['seed'] = kwargs['seed']
    elif 'imagen' in model.lower():
        # Imagen4 Preview
        endpoint = FAL_IMAGEN4
        allowed_ratio = ('1:1', '16:9', '9:16', '4:3', '3:4')
        res = kwargs.get('resolution') or '1K'
        res = res if res in ('1K', '2K') else '1K'
        out_fmt = kwargs.get('output_format') or 'png'
        out_fmt = out_fmt if out_fmt in ('png', 'jpeg', 'webp') else 'png'
        payload = {
            'prompt': prompt,
            'num_images': num_images,
            'aspect_ratio': aspect_ratio if aspect_ratio in allowed_ratio else '1:1',
            'resolution': res,
            'output_format': out_fmt,
        }
    elif 'kling' in model.lower():
        # Kling (Visual Continuity)
        endpoint = FAL_KLING
        payload = {
            'prompt': prompt,
            'num_images': num_images,
            'aspect_ratio': aspect_ratio,
        }
        # Add visual continuity params
        if kwargs.get('seed'):
            payload['seed'] = kwargs['seed']
        if kwargs.get('reference_image_url'):
            payload['image_url'] = _ensure_fal_reachable_image_url(kwargs['reference_image_url'])
        if kwargs.get('mask_url'):
            payload['mask_url'] = kwargs['mask_url']

    elif 'flux' in model.lower() or 'sdxl' in model.lower() or 'nano-banana' in model.lower():
        # flux/dev, fast-sdxl, nano-banana: use model as endpoint with common payload
        endpoint = model
        allowed_ratio = ('21:9', '16:9', '4:3', '3:2', '1:1', '2:3', '3:4', '9:16', '9:21')
        if aspect_ratio not in allowed_ratio:
            aspect_ratio = '16:9'
        payload = {
            'prompt': prompt,
            'num_images': num_images,
            'aspect_ratio': aspect_ratio,
        }
        if kwargs.get('seed') is not None:
            payload['seed'] = kwargs['seed']

    else:
        # FLUX Pro v1.1 Ultra (default)
        endpoint = FAL_FLUX_ULTRA
        allowed_ratio = ('21:9', '16:9', '4:3', '3:2', '1:1', '2:3', '3:4', '9:16', '9:21')
        out_fmt = kwargs.get('output_format') or 'jpeg'
        out_fmt = out_fmt if out_fmt in ('jpeg', 'png') else 'jpeg'
        payload = {
            'prompt': prompt,
            'num_images': num_images,
            'aspect_ratio': aspect_ratio if aspect_ratio in allowed_ratio else '16:9',
            'output_format': out_fmt,
        }

    if _fal_debug_enabled():
        logger.info("fal request: endpoint=%s payload=%s", endpoint, _sanitize_payload(payload))
    r = requests.post(f'{FAL_BASE}/{endpoint}', headers=_fal_headers(), json=payload, timeout=180)
    if not r.ok:
        try:
            err = r.json()
        except Exception:
            err = r.text
        if _fal_debug_enabled():
            logger.error("fal error: endpoint=%s status=%s body=%s", endpoint, r.status_code, err)
        raise FALError(f'fal error {r.status_code}: {err}')
    data = r.json()
    images = data.get('images') or []

    # Return list of dict with url, content_type, etc.
    # Also return 'seed' if provided by API, but fal generic response usually just has url.
    # If Kling returns seed, we should capture it.
    # For now, we return what we get.

    result = []
    for img in images:
        if img.get('url'):
            res = {
                'url': img.get('url'),
                'content_type': img.get('content_type'),
                'file_name': img.get('file_name')
            }
            if 'seed' in img:
                res['seed'] = img['seed']
            elif 'seed' in data: # sometimes seed is top level
                res['seed'] = data['seed']
            result.append(res)

    return result


# MiniMax Speech 2.6 HD: Studio Step 5 TTS
FAL_TTS_MINIMAX = 'fal-ai/minimax/speech-2.6-hd'


def tts_minimax(
    text: str,
    voice_id: str = 'Wise_Woman',
    speed: float = 1.0,
    output_format: str = 'url',
) -> dict:
    """
    fal.ai MiniMax Speech 2.6 HD TTS.
    Returns dict with 'url' (audio URL) and 'duration_ms'.
    voice_id: preset e.g. Wise_Woman, or custom_voice_id from voice-clone.
    """
    payload = {
        'prompt': (text or '').strip(),
        'output_format': output_format if output_format in ('url', 'hex') else 'url',
        'voice_setting': {
            'voice_id': voice_id,
            'speed': max(0.5, min(2.0, speed)),
            'vol': 1,
            'pitch': 0,
        },
    }
    r = requests.post(f'{FAL_BASE}/{FAL_TTS_MINIMAX}', headers=_fal_headers(), json=payload, timeout=120)
    r.raise_for_status()
    data = r.json()
    audio = data.get('audio') or {}
    url = audio.get('url') or ''
    if not url:
        raise FALError(data.get('error', 'No audio URL'))
    return {'url': url, 'duration_ms': data.get('duration_ms', 0)}

# WEAV AI AI 서비스 요청 스키마
# 입력 데이터 검증 및 화이트리스트 처리

from typing import Optional
from pydantic import BaseModel, Field, field_validator
import os


class TextGenerationRequest(BaseModel):
    """텍스트 생성 요청 스키마"""

    input_text: str = Field(..., min_length=1, max_length=int(os.getenv('MAX_TEXT_CHARS', '8000')))
    system_prompt: Optional[str] = Field(None, max_length=2000)
    temperature: Optional[float] = Field(0.7, ge=0.0, le=2.0)
    max_output_tokens: Optional[int] = Field(
        int(os.getenv('MAX_OUTPUT_TOKENS', '1024')),
        ge=1,
        le=int(os.getenv('MAX_OUTPUT_TOKENS', '4096'))
    )

    @field_validator('input_text')
    @classmethod
    def validate_input_text(cls, v):
        if not v.strip():
            raise ValueError('input_text cannot be empty')
        return v.strip()

    @field_validator('system_prompt')
    @classmethod
    def validate_system_prompt(cls, v):
        if v is not None and not v.strip():
            return None  # 빈 문자열은 None으로 변환
        return v.strip() if v else None


class ImageGenerationRequest(BaseModel):
    """이미지 생성 요청 스키마 (추후 구현)"""

    prompt: str = Field(..., min_length=1, max_length=1000)
    size: Optional[str] = Field("1024x1024", pattern=r'^\d+x\d+$')
    quality: Optional[str] = Field("standard", pattern=r'^(standard|hd)$')


class VideoGenerationRequest(BaseModel):
    """비디오 생성 요청 스키마"""

    prompt: str = Field(..., min_length=1, max_length=1000)
    duration: Optional[str] = Field("8s", pattern=r'^\d+s$')
    resolution: Optional[str] = Field("720p", pattern=r'^(720p|1080p|4K)$')
    aspect_ratio: Optional[str] = Field("16:9", pattern=r'^(16:9|9:16|1:1|3:4)$')
    style: Optional[str] = Field("realistic", pattern=r'^(realistic|cinematic|animated|cartoon|anime)$')
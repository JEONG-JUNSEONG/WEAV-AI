# Generated manually for Job, Artifact + user FK

import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Job',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('status', models.CharField(choices=[('PENDING', '대기 중'), ('SUBMITTED', '제출됨'), ('IN_QUEUE', '큐 대기 중'), ('IN_PROGRESS', '진행 중'), ('COMPLETED', '완료됨'), ('FAILED', '실패함')], db_index=True, default='PENDING', max_length=20)),
                ('provider', models.CharField(choices=[('fal', 'FAL.ai'), ('openai', 'OpenAI'), ('gemini', 'Google Gemini')], default='openai', max_length=20)),
                ('model_id', models.CharField(help_text='AI 모델 ID (예: fal-ai/fast-sdxl)', max_length=100)),
                ('arguments', models.JSONField(help_text='AI 모델에 전달할 파라미터들')),
                ('store_result', models.BooleanField(default=True, help_text='결과 파일을 MinIO에 저장할지 여부')),
                ('external_job_id', models.CharField(blank=True, help_text='외부 AI 서비스의 작업 ID', max_length=200, null=True)),
                ('error', models.TextField(blank=True, help_text='작업 실패 시 오류 메시지', null=True)),
                ('result_json', models.JSONField(blank=True, help_text='AI API 결과 데이터 (텍스트, usage 등)', null=True)),
                ('user', models.ForeignKey(blank=True, help_text='작업을 생성한 사용자', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='jobs', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(fields=['status', 'created_at'], name='jobs_job_status_created_idx'),
                    models.Index(fields=['provider', 'status'], name='jobs_job_provider_status_idx'),
                    models.Index(fields=['user', 'status'], name='jobs_job_user_status_idx'),
                ],
            },
        ),
        migrations.CreateModel(
            name='Artifact',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('kind', models.CharField(choices=[('text', '텍스트'), ('image', '이미지'), ('video', '비디오'), ('file', '기타 파일')], default='file', max_length=20)),
                ('s3_key', models.CharField(blank=True, help_text='MinIO/S3 객체 키', max_length=500, null=True)),
                ('mime_type', models.CharField(blank=True, help_text='MIME 타입 (예: image/png)', max_length=100, null=True)),
                ('size_bytes', models.PositiveBigIntegerField(blank=True, help_text='파일 크기 (바이트)', null=True)),
                ('presigned_url', models.URLField(blank=True, help_text='임시 접근 URL (만료됨)', null=True)),
                ('text_content', models.TextField(blank=True, help_text='텍스트 결과 콘텐츠', null=True)),
                ('presigned_url_expires_at', models.DateTimeField(blank=True, help_text='Presigned URL 만료 시각', null=True)),
                ('job', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='artifacts', to='jobs.job')),
            ],
            options={
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(fields=['job', 'kind'], name='jobs_artifact_job_kind_idx'),
                    models.Index(fields=['created_at'], name='jobs_artifact_created_idx'),
                ],
            },
        ),
    ]

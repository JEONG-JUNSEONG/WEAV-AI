"""
세션 API 테스트.
Docker 환경에서만 실행합니다.
"""
from unittest.mock import patch
from django.test import TestCase, Client
from apps.chats.models import Session, Job, SESSION_KIND_CHAT, SESSION_KIND_IMAGE


class SessionAPITests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_create_chat_session(self):
        response = self.client.post(
            '/api/v1/sessions/',
            data={'kind': SESSION_KIND_CHAT, 'title': '테스트 채팅'},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data['kind'], SESSION_KIND_CHAT)
        self.assertEqual(data['title'], '테스트 채팅')
        self.assertIn('id', data)

    def test_create_image_session(self):
        response = self.client.post(
            '/api/v1/sessions/',
            data={'kind': SESSION_KIND_IMAGE},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data['kind'], SESSION_KIND_IMAGE)

    def test_list_sessions(self):
        Session.objects.create(kind=SESSION_KIND_CHAT, title='A')
        Session.objects.create(kind=SESSION_KIND_IMAGE, title='B')
        response = self.client.get('/api/v1/sessions/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data), 2)

    def test_list_sessions_filter_by_kind(self):
        Session.objects.create(kind=SESSION_KIND_CHAT, title='A')
        Session.objects.create(kind=SESSION_KIND_IMAGE, title='B')
        response = self.client.get('/api/v1/sessions/?kind=chat')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['kind'], SESSION_KIND_CHAT)


class ImageGenerationAPITests(TestCase):
    """이미지 생성 API 요청/검증 구조 테스트. fal 호출은 mock."""

    def setUp(self):
        self.client = Client()
        self.session = Session.objects.create(kind=SESSION_KIND_IMAGE, title='이미지 세션')

    def test_complete_image_requires_session_id(self):
        response = self.client.post(
            '/api/v1/chat/image/',
            data={'prompt': 'a cat'},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('session_id', response.json().get('detail', ''))

    def test_complete_image_accepts_chat_session(self):
        """채팅 세션에서도 이미지 생성 요청이 가능해야 함 (단일 채팅방 통합 UX)."""
        chat_session = Session.objects.create(kind=SESSION_KIND_CHAT, title='채팅')
        with patch('apps.ai.tasks.task_image.delay') as mock_delay:
            mock_delay.return_value.id = 'mock-task-id'
            response = self.client.post(
                '/api/v1/chat/image/',
                data={
                    'session_id': chat_session.id,
                    'prompt': 'a cat',
                },
                content_type='application/json',
            )
        self.assertEqual(response.status_code, 202)
        data = response.json()
        self.assertIn('task_id', data)
        self.assertIn('job_id', data)
        job = Job.objects.get(pk=data['job_id'])
        self.assertEqual(job.session_id, chat_session.id)
        self.assertEqual(job.kind, 'image')
        self.assertEqual(job.status, 'pending')

    def test_complete_image_accepts_valid_request_returns_202(self):
        with patch('apps.ai.tasks.task_image.delay') as mock_delay:
            mock_delay.return_value.id = 'mock-task-id'
            response = self.client.post(
                '/api/v1/chat/image/',
                data={
                    'session_id': self.session.id,
                    'prompt': 'a red apple',
                },
                content_type='application/json',
            )
        self.assertEqual(response.status_code, 202)
        data = response.json()
        self.assertIn('task_id', data)
        self.assertIn('job_id', data)
        job = Job.objects.get(pk=data['job_id'])
        self.assertEqual(job.session_id, self.session.id)
        self.assertEqual(job.kind, 'image')
        self.assertEqual(job.status, 'pending')

    def test_complete_image_validates_model_and_attachments(self):
        """이미지 첨부 시 Imagen/FLUX 등 비지원 모델이면 400."""
        with patch('apps.ai.tasks.task_image.delay'):
            response = self.client.post(
                '/api/v1/chat/image/',
                data={
                    'session_id': self.session.id,
                    'prompt': 'edit this',
                    'model': 'fal-ai/imagen4/preview',
                    'image_urls': ['https://example.com/img.png'],
                },
                content_type='application/json',
            )
        self.assertEqual(response.status_code, 400)
        self.assertIn('이 모델은 이미지 첨부를 지원하지 않습니다', response.json().get('detail', ''))

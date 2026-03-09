from celery import Celery
from kombu import Queue
import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
app = Celery('config')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.conf.task_default_queue = 'celery'
app.conf.task_queues = (
    Queue('celery', routing_key='celery'),
    Queue('documents', routing_key='documents'),
)
app.conf.task_routes = {
    'apps.chats.tasks.process_pdf_document': {'queue': 'documents', 'routing_key': 'documents'},
}
app.conf.broker_connection_retry_on_startup = True
app.autodiscover_tasks()

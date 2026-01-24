# WEAV AI Jobs 앱 URL 설정

from django.urls import path
from . import views

app_name = 'jobs'

urlpatterns = [
    path('', views.list_or_create_jobs, name='list-create'),
    path('<uuid:pk>/', views.job_detail, name='detail'),
]
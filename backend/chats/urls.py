from django.urls import path
from . import views

app_name = 'chats'

urlpatterns = [
    path('folders/', views.folder_list_or_create, name='folder-list-create'),
    path('folders/<uuid:pk>/', views.folder_detail, name='folder-detail'),
    path('chats/', views.chat_list_or_create, name='chat-list-create'),
    path('chats/<uuid:pk>/', views.chat_detail, name='chat-detail'),
]

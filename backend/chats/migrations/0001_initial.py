# Generated manually for Folder, ChatSession

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
            name='Folder',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=255)),
                ('type', models.CharField(choices=[('custom', 'custom'), ('shorts-workflow', 'shorts-workflow')], default='custom', max_length=32)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='chat_folders', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='ChatSession',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('title', models.CharField(max_length=512)),
                ('messages', models.JSONField(default=list)),
                ('model_id', models.CharField(default='gpt-5.2-instant', max_length=128)),
                ('system_instruction', models.TextField(blank=True)),
                ('recommended_prompts', models.JSONField(blank=True, default=list)),
                ('last_modified', models.DateTimeField(auto_now=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('folder', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='chats', to='chats.folder')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='chat_sessions', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-last_modified'],
            },
        ),
        migrations.AddIndex(
            model_name='folder',
            index=models.Index(fields=['user'], name='chats_folder_user_idx'),
        ),
        migrations.AddIndex(
            model_name='chatsession',
            index=models.Index(fields=['user'], name='chats_session_user_idx'),
        ),
        migrations.AddIndex(
            model_name='chatsession',
            index=models.Index(fields=['user', 'folder'], name='chats_session_uf_idx'),
        ),
    ]

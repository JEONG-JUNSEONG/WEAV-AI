from rest_framework import serializers
from .models import Folder, ChatSession


class FolderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Folder
        fields = ['id', 'name', 'type', 'created_at']
        read_only_fields = ['id', 'created_at']


class ChatSessionSerializer(serializers.ModelSerializer):
    folder_id = serializers.UUIDField(source='folder_id', read_only=True, allow_null=True)

    class Meta:
        model = ChatSession
        fields = [
            'id', 'folder', 'folder_id', 'title', 'messages', 'model_id',
            'system_instruction', 'recommended_prompts', 'last_modified', 'created_at',
        ]
        read_only_fields = ['id', 'last_modified', 'created_at', 'folder_id']

    def validate_messages(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError('messages must be a list.')
        return value

    def validate_recommended_prompts(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError('recommended_prompts must be a list.')
        return value

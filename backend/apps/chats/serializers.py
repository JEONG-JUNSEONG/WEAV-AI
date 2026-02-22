from rest_framework import serializers
from django.urls import reverse
from .models import Session, Message, ImageRecord, Document


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ('id', 'role', 'content', 'citations', 'created_at')


class DocumentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()
    original_name = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = ('id', 'original_name', 'status', 'file_url', 'error_message', 'created_at', 'updated_at')

    def get_original_name(self, obj):
        return obj.original_name or obj.file_name

    def get_file_url(self, obj):
        request = self.context.get('request') if hasattr(self, 'context') else None
        if request:
            try:
                url = reverse('session_document_file', args=[obj.session_id, obj.id])
                return request.build_absolute_uri(url)
            except Exception:
                pass
        try:
            from storage.s3 import minio_client
            if minio_client:
                key = obj.pdf_file_name or obj.file_name
                return minio_client.get_presigned_url(key)
        except Exception:
            pass
        return obj.file_url


class ImageRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImageRecord
        fields = ('id', 'prompt', 'image_url', 'model', 'metadata', 'created_at')


class SessionListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Session
        fields = ('id', 'kind', 'title', 'created_at', 'updated_at')


class SessionDetailSerializer(serializers.ModelSerializer):
    messages = MessageSerializer(many=True, read_only=True)
    image_records = ImageRecordSerializer(many=True, read_only=True)
    class Meta:
        model = Session
        fields = ('id', 'kind', 'title', 'created_at', 'updated_at', 'messages', 'image_records', 'reference_image_urls')
        # reference_image_urls: Session.reference_image_urls (JSONField list, 0~2 URLs)

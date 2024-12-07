from rest_framework import serializers
from .models import ChatMessage

class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ['id', 'order', 'sender_type', 'message', 'timestamp', 'is_read']
        read_only_fields = ['timestamp', 'is_read']

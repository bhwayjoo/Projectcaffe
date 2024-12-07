import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import ChatMessage
from orders.models import Order

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.order_id = self.scope['url_route']['kwargs']['order_id']
        self.room_group_name = f'chat_{self.order_id}'

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        text_data_json = json.loads(text_data)
        message = text_data_json['message']
        sender_type = text_data_json.get('sender_type', 'client')

        # Save message to database
        chat_message = await self.save_message(message, sender_type)

        # Send message to room group
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'message': message,
                'sender_type': sender_type,
                'timestamp': chat_message.timestamp.isoformat(),
                'is_read': chat_message.is_read
            }
        )

    async def chat_message(self, event):
        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            'message': event['message'],
            'sender_type': event['sender_type'],
            'timestamp': event['timestamp'],
            'is_read': event['is_read']
        }))

    @database_sync_to_async
    def save_message(self, message, sender_type):
        order = Order.objects.get(id=self.order_id)
        chat_message = ChatMessage.objects.create(
            order=order,
            message=message,
            sender_type=sender_type
        )
        return chat_message

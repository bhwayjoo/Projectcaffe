import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
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

        # Send chat history
        messages = await self.get_chat_history()
        if messages:
            await self.send(text_data=json.dumps({
                'type': 'chat_history',
                'messages': messages
            }))

    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        try:
            text_data_json = json.loads(text_data)
            message_type = text_data_json.get('type', 'chat_message')

            if message_type == 'ping':
                await self.send(text_data=json.dumps({
                    'type': 'pong'
                }))
                return

            if message_type == 'get_history':
                messages = await self.get_chat_history()
                await self.send(text_data=json.dumps({
                    'type': 'chat_history',
                    'messages': messages
                }))
                return

            if message_type == 'chat_message':
                message = text_data_json.get('message')
                sender_type = text_data_json.get('sender_type', 'client')
                
                if not message:
                    return

                # Save message to database
                saved_message = await self.save_message(message, sender_type)

                # Send message to room group
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'chat_message',
                        'message': message,
                        'sender_type': sender_type,
                        'timestamp': saved_message['timestamp'],
                        'is_read': False
                    }
                )

        except json.JSONDecodeError:
            print("Invalid JSON received")
        except Exception as e:
            print(f"Error processing message: {str(e)}")

    async def chat_message(self, event):
        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'message': event['message'],
            'sender_type': event['sender_type'],
            'timestamp': event['timestamp'],
            'is_read': event['is_read']
        }))

    @database_sync_to_async
    def get_chat_history(self):
        try:
            messages = ChatMessage.objects.filter(order_id=self.order_id).order_by('timestamp')
            return [{
                'message': msg.message,
                'sender_type': msg.sender_type,
                'timestamp': msg.timestamp.isoformat(),
                'is_read': msg.is_read
            } for msg in messages]
        except Exception as e:
            print(f"Error fetching chat history: {str(e)}")
            return []

    @database_sync_to_async
    def save_message(self, message, sender_type):
        try:
            order = Order.objects.get(id=self.order_id)
            chat_message = ChatMessage.objects.create(
                order=order,
                message=message,
                sender_type=sender_type,
                timestamp=timezone.now(),
                is_read=False
            )
            return {
                'message': chat_message.message,
                'sender_type': chat_message.sender_type,
                'timestamp': chat_message.timestamp.isoformat(),
                'is_read': chat_message.is_read
            }
        except Order.DoesNotExist:
            raise Exception(f"Order {self.order_id} does not exist")
        except Exception as e:
            raise Exception(f"Error saving message: {str(e)}")

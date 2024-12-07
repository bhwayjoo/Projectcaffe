import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.core.exceptions import ObjectDoesNotExist
from .models import Order
from chat.models import ChatMessage
from .serializers import OrderSerializer

logger = logging.getLogger(__name__)

class MenuOrdersConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        try:
            # Join the menu orders group
            await self.channel_layer.group_add("menu_orders", self.channel_name)
            await self.accept()
            logger.info("Client connected to menu orders WebSocket")
            
            # Send initial orders data
            orders = await self.get_all_orders()
            await self.send(text_data=json.dumps({
                'type': 'initial_orders',
                'orders': orders
            }))
        except Exception as e:
            logger.error(f"Error in menu connect: {str(e)}")
            await self.close()

    async def disconnect(self, close_code):
        try:
            await self.channel_layer.group_discard("menu_orders", self.channel_name)
            logger.info(f"Client disconnected from menu orders WebSocket with code: {close_code}")
        except Exception as e:
            logger.error(f"Error in menu disconnect: {str(e)}")

    async def receive(self, text_data):
        try:
            text_data_json = json.loads(text_data)
            message_type = text_data_json.get('type')
            
            if message_type == 'create_order':
                # Handle new order creation from menu
                order_data = text_data_json.get('order')
                new_order = await self.create_order(order_data)
                if new_order:
                    serialized_order = await self.serialize_order(new_order)
                    await self.broadcast_new_order(serialized_order)
            
        except json.JSONDecodeError:
            logger.error("Invalid JSON format received in menu")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Invalid JSON format'
            }))
        except Exception as e:
            logger.error(f"Error in menu receive: {str(e)}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': str(e)
            }))

    async def order_update(self, event):
        try:
            await self.send(text_data=json.dumps({
                'type': 'order_update',
                'order': event['order']
            }))
        except Exception as e:
            logger.error(f"Error in menu order_update: {str(e)}")

    async def new_order(self, event):
        try:
            await self.send(text_data=json.dumps({
                'type': 'new_order',
                'order': event['order']
            }))
        except Exception as e:
            logger.error(f"Error in menu new_order: {str(e)}")

    @database_sync_to_async
    def get_all_orders(self):
        try:
            orders = Order.objects.all().order_by('-created_at')[:50]
            return OrderSerializer(orders, many=True).data
        except Exception as e:
            logger.error(f"Error getting menu orders: {str(e)}")
            return []

    @database_sync_to_async
    def create_order(self, order_data):
        try:
            order = Order.objects.create(**order_data)
            return order
        except Exception as e:
            logger.error(f"Error creating order: {str(e)}")
            raise

    @database_sync_to_async
    def serialize_order(self, order):
        return OrderSerializer(order).data

    async def broadcast_new_order(self, order_data):
        await self.channel_layer.group_send(
            "menu_orders",
            {
                "type": "new_order",
                "order": order_data
            }
        )
        # Also broadcast to the orders group for admin
        await self.channel_layer.group_send(
            "orders",
            {
                "type": "new_order",
                "order": order_data
            }
        )

class OrderConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.channel_layer.group_add("orders", self.channel_name)
        await self.accept()
        
        # Send initial orders
        orders = await self.get_orders()
        await self.send(text_data=json.dumps({
            'type': 'initial_orders',
            'orders': orders
        }))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard("orders", self.channel_name)

    async def receive(self, text_data):
        text_data_json = json.loads(text_data)
        message_type = text_data_json.get('type')
        
        if message_type == 'new_order':
            # Handle new order
            order_data = text_data_json.get('order')
            await self.channel_layer.group_send(
                "orders",
                {
                    'type': 'order_message',
                    'message': {
                        'type': 'new_order',
                        'order': order_data
                    }
                }
            )
        elif message_type == 'order_update':
            # Handle order update
            order_data = text_data_json.get('order')
            await self.channel_layer.group_send(
                "orders",
                {
                    'type': 'order_message',
                    'message': {
                        'type': 'order_update',
                        'order': order_data
                    }
                }
            )

    async def order_message(self, event):
        message = event['message']
        await self.send(text_data=json.dumps(message))

    @database_sync_to_async
    def get_orders(self):
        orders = Order.objects.all().order_by('-created_at')
        serializer = OrderSerializer(orders, many=True)
        return serializer.data

    async def notify_new_order(self, order_data):
        await self.channel_layer.group_send(
            "orders",
            {
                'type': 'order_message',
                'message': {
                    'type': 'new_order',
                    'order': order_data
                }
            }
        )

    async def notify_order_update(self, order_data):
        await self.channel_layer.group_send(
            "orders",
            {
                'type': 'order_message',
                'message': {
                    'type': 'order_update',
                    'order': order_data
                }
            }
        )

class OrderTrackingConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        try:
            self.order_id = self.scope['url_route']['kwargs']['order_id']
            self.room_group_name = f'order_{self.order_id}'

            await self.channel_layer.group_add(
                self.room_group_name,
                self.channel_name
            )
            await self.accept()
            logger.info(f"Client connected to order tracking WebSocket for order {self.order_id}")
        except Exception as e:
            logger.error(f"Error in tracking connect: {str(e)}")
            await self.close()

    async def disconnect(self, close_code):
        try:
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )
            logger.info(f"Client disconnected from order tracking WebSocket with code: {close_code}")
        except Exception as e:
            logger.error(f"Error in tracking disconnect: {str(e)}")

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            message_type = data.get('type', '')
            
            if message_type == 'chat_message':
                message = data.get('message', '')
                sender_type = data.get('sender_type', 'client')
                
                # Save chat message to database
                order = await database_sync_to_async(Order.objects.get)(id=self.order_id)
                chat_message = await database_sync_to_async(ChatMessage.objects.create)(
                    order=order,
                    message=message,
                    sender_type=sender_type
                )
                
                # Broadcast the message to the group
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'chat_message',
                        'message': message,
                        'sender_type': sender_type,
                        'timestamp': chat_message.timestamp.isoformat()
                    }
                )
                
        except json.JSONDecodeError:
            logger.error("Invalid JSON format received in tracking")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Invalid JSON format'
            }))
        except Exception as e:
            logger.error(f"Error in tracking receive: {str(e)}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': str(e)
            }))

    async def chat_message(self, event):
        # Send chat message to WebSocket
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'message': event['message'],
            'sender_type': event['sender_type'],
            'timestamp': event['timestamp']
        }))

    async def order_update(self, event):
        # Send order update to WebSocket
        await self.send(text_data=json.dumps({
            'type': 'order_update',
            'order': event['order']
        }))

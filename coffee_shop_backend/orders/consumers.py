import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.core.exceptions import ObjectDoesNotExist
from .models import Order
from chat.models import ChatMessage
from .serializers import OrderSerializer
from django.db import transaction

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

    @database_sync_to_async
    def get_orders(self):
        orders = Order.objects.all().order_by('-created_at')
        return OrderSerializer(orders, many=True).data

    async def receive(self, text_data):
        try:
            text_data_json = json.loads(text_data)
            message_type = text_data_json.get('type')
            
            if message_type == 'order_update':
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
                
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Invalid JSON format'
            }))
        except Exception as e:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': str(e)
            }))

    async def order_message(self, event):
        message = event['message']
        await self.send(text_data=json.dumps(message))

class OrderTrackingConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.order_id = self.scope['url_route']['kwargs']['order_id']
        self.room_group_name = f'order_{self.order_id}'

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()
        
        # Send initial order data
        try:
            order = await database_sync_to_async(Order.objects.get)(id=self.order_id)
            
            @database_sync_to_async
            def serialize_order(order):
                return OrderSerializer(order).data
                
            order_data = await serialize_order(order)
            
            await self.send(text_data=json.dumps({
                'type': 'order_data',
                'order': order_data
            }))
        except Order.DoesNotExist:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Order not found'
            }))
            await self.close()

    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        try:
            text_data_json = json.loads(text_data)
            message_type = text_data_json.get('type')
            
            if message_type == 'status_update':
                new_status = text_data_json.get('status')
                if new_status:
                    try:
                        order = await database_sync_to_async(Order.objects.get)(id=self.order_id)
                        
                        @database_sync_to_async
                        def update_order(order, status):
                            order.status = status
                            order.save()
                            return OrderSerializer(order).data
                        
                        order_data = await update_order(order, new_status)
                        
                        # Broadcast the status update
                        await self.channel_layer.group_send(
                            self.room_group_name,
                            {
                                'type': 'order_status_update',
                                'order': order_data
                            }
                        )
                    except Order.DoesNotExist:
                        await self.send(text_data=json.dumps({
                            'type': 'error',
                            'message': 'Order not found'
                        }))
                        
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Invalid JSON format'
            }))
        except Exception as e:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': str(e)
            }))

    # Channel layer handlers
    async def order_status_update(self, event):
        """
        Handler for order status updates
        """
        await self.send(text_data=json.dumps({
            'type': 'order_update',
            'order': event['order']
        }))

    async def order_update(self, event):
        """
        Handler for general order updates
        """
        await self.send(text_data=json.dumps({
            'type': 'order_update',
            'order': event['order']
        }))

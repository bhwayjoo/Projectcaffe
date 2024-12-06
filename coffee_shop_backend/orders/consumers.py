import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.core.exceptions import ObjectDoesNotExist
from .models import Order
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
                    # Broadcast to both menu and admin channels
                    await self.broadcast_new_order(new_order)
            
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
            # Send order update to menu WebSocket
            await self.send(text_data=json.dumps({
                'type': 'order_update',
                'order': event['content']
            }))
        except Exception as e:
            logger.error(f"Error in menu order_update: {str(e)}")

    async def new_order(self, event):
        try:
            await self.send(text_data=json.dumps({
                'type': 'new_order',
                'order': event['content']
            }))
        except Exception as e:
            logger.error(f"Error in menu new_order: {str(e)}")

    @database_sync_to_async
    def get_all_orders(self):
        try:
            # Only get recent orders for the menu view
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

    async def broadcast_new_order(self, order):
        try:
            serialized_order = await self.serialize_order(order)
            # Broadcast to both menu and admin channels
            for group in ["menu_orders", "orders"]:
                await self.channel_layer.group_send(
                    group,
                    {
                        "type": "new_order",
                        "content": serialized_order
                    }
                )
        except Exception as e:
            logger.error(f"Error broadcasting new order: {str(e)}")

    @database_sync_to_async
    def serialize_order(self, order):
        try:
            return OrderSerializer(order).data
        except Exception as e:
            logger.error(f"Error serializing order: {str(e)}")
            return None

class OrdersConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        try:
            # Join the orders group
            await self.channel_layer.group_add("orders", self.channel_name)
            await self.accept()
            logger.info("Client connected to orders WebSocket")
            
            # Send initial orders data
            orders = await self.get_all_orders()
            await self.send(text_data=json.dumps({
                'type': 'initial_orders',
                'orders': orders
            }))
        except Exception as e:
            logger.error(f"Error in connect: {str(e)}")
            await self.close()

    async def disconnect(self, close_code):
        try:
            # Leave the orders group
            await self.channel_layer.group_discard("orders", self.channel_name)
            logger.info(f"Client disconnected from orders WebSocket with code: {close_code}")
        except Exception as e:
            logger.error(f"Error in disconnect: {str(e)}")

    async def receive(self, text_data):
        try:
            text_data_json = json.loads(text_data)
            message_type = text_data_json.get('type')
            
            if message_type == 'order_status_update':
                order_id = text_data_json.get('order_id')
                new_status = text_data_json.get('status')
                
                if not order_id or not new_status:
                    raise ValueError("Missing order_id or status")
                
                # Update order status in database
                order = await self.update_order_status(order_id, new_status)
                
                if order:
                    # Broadcast the update to all connected clients
                    await self.channel_layer.group_send(
                        "orders",
                        {
                            "type": "order_update",
                            "content": await self.serialize_order(order)
                        }
                    )
            else:
                logger.warning(f"Unknown message type: {message_type}")
                
        except json.JSONDecodeError:
            logger.error("Invalid JSON format received")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Invalid JSON format'
            }))
        except Exception as e:
            logger.error(f"Error in receive: {str(e)}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': str(e)
            }))

    async def order_update(self, event):
        try:
            # Send order update to WebSocket
            await self.send(text_data=json.dumps({
                'type': 'order_update',
                'order': event['content']
            }))
        except Exception as e:
            logger.error(f"Error in order_update: {str(e)}")

    async def new_order(self, event):
        try:
            # Send new order to WebSocket
            await self.send(text_data=json.dumps({
                'type': 'new_order',
                'order': event['content']
            }))
        except Exception as e:
            logger.error(f"Error in new_order: {str(e)}")

    async def broadcast_new_order(self, order):
        try:
            # Broadcast new order to all connected clients
            await self.channel_layer.group_send(
                "orders",
                {
                    "type": "new_order",
                    "content": await self.serialize_order(order)
                }
            )
        except Exception as e:
            logger.error(f"Error broadcasting new order: {str(e)}")

    @database_sync_to_async
    def get_all_orders(self):
        try:
            orders = Order.objects.all().order_by('-created_at')
            return OrderSerializer(orders, many=True).data
        except Exception as e:
            logger.error(f"Error getting all orders: {str(e)}")
            return []

    @database_sync_to_async
    def update_order_status(self, order_id, new_status):
        try:
            order = Order.objects.get(id=order_id)
            order.status = new_status
            order.save()
            return order
        except ObjectDoesNotExist:
            logger.error(f"Order not found: {order_id}")
            raise ValueError(f"Order not found: {order_id}")
        except Exception as e:
            logger.error(f"Error updating order status: {str(e)}")
            raise

    @database_sync_to_async
    def serialize_order(self, order):
        try:
            return OrderSerializer(order).data
        except Exception as e:
            logger.error(f"Error serializing order: {str(e)}")
            return None

class OrderTrackingConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.order_id = self.scope['url_route']['kwargs']['order_id']
        self.order_group_name = f'order_{self.order_id}'

        try:
            # Verify order exists and get initial data
            order = await self.get_order()
            if not order:
                await self.close()
                return

            # Join order group
            await self.channel_layer.group_add(
                self.order_group_name,
                self.channel_name
            )
            await self.accept()

            # Send initial order data
            serialized_order = await self.serialize_order(order)
            await self.send(text_data=json.dumps({
                'type': 'order_update',
                'order': serialized_order
            }))
            
            logger.info(f"Client connected to order tracking WebSocket for order {self.order_id}")
        except Exception as e:
            logger.error(f"Error in tracking connect: {str(e)}")
            await self.close()

    async def disconnect(self, close_code):
        try:
            # Leave room group
            await self.channel_layer.group_discard(
                self.order_group_name,
                self.channel_name
            )
            logger.info(f"Client disconnected from order tracking WebSocket for order {self.order_id}")
        except Exception as e:
            logger.error(f"Error in tracking disconnect: {str(e)}")

    @database_sync_to_async
    def get_order(self):
        try:
            return Order.objects.get(id=self.order_id)
        except Order.DoesNotExist:
            logger.error(f"Order {self.order_id} not found")
            return None
        except Exception as e:
            logger.error(f"Error getting order: {str(e)}")
            return None

    @database_sync_to_async
    def serialize_order(self, order):
        return OrderSerializer(order).data

    async def order_update(self, event):
        try:
            # Send order update to WebSocket
            await self.send(text_data=json.dumps({
                'type': 'order_update',
                'order': event['content']
            }))
            logger.info(f"Order update sent for order {self.order_id}")
        except Exception as e:
            logger.error(f"Error in tracking order_update: {str(e)}")

# orders/consumers.py

import json
from channels.generic.websocket import AsyncWebsocketConsumer

class OrderConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.channel_layer.group_add("orders", self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard("orders", self.channel_name)

    async def order_update(self, event):
        # Send the order update to WebSocket
        await self.send(text_data=json.dumps(event['content']))

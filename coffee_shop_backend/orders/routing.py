from django.urls import re_path
from . import consumers  # Import your WebSocket consumer

websocket_urlpatterns = [
    re_path(r"ws/orders/$", consumers.OrdersConsumer.as_asgi()),  # Adjust the path if needed
]

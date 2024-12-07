from channels.routing import ProtocolTypeRouter, URLRouter
from django.urls import re_path
from . import consumers
from channels.auth import AuthMiddlewareStack

websocket_urlpatterns = [
    re_path(r'ws/orders/$', consumers.OrderConsumer.as_asgi()),
    re_path(r'ws/order/(?P<order_id>\d+)/$', consumers.OrderTrackingConsumer.as_asgi()),
]

application = ProtocolTypeRouter({
    'websocket': AuthMiddlewareStack(
        URLRouter(websocket_urlpatterns)
    ),
})

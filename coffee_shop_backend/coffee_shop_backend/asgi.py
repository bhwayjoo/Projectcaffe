"""
ASGI config for coffee_shop_backend project.
"""

import os
import django
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from channels.security.websocket import AllowedHostsOriginValidator

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'coffee_shop_backend.settings')
django.setup()

from chat.routing import websocket_urlpatterns as chat_websocket_urlpatterns
from orders.routing import websocket_urlpatterns as orders_websocket_urlpatterns

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AllowedHostsOriginValidator(
        AuthMiddlewareStack(
            URLRouter(
                orders_websocket_urlpatterns +
                chat_websocket_urlpatterns
            )
        )
    ),
})

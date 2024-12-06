from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/orders/$', consumers.OrdersConsumer.as_asgi()),
    re_path(r'ws/menu-orders/$', consumers.MenuOrdersConsumer.as_asgi()),
    re_path(r'ws/order/(?P<order_id>\w+)/$', consumers.OrderTrackingConsumer.as_asgi()),
]

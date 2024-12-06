from django.db.models.signals import post_save
from django.dispatch import receiver
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import Order
from .serializers import OrderSerializer

@receiver(post_save, sender=Order)
def order_post_save(sender, instance, created, **kwargs):
    channel_layer = get_channel_layer()
    serialized_order = OrderSerializer(instance).data

    if created:
        # Broadcast new order
        async_to_sync(channel_layer.group_send)(
            "orders",
            {
                "type": "new_order",
                "content": serialized_order
            }
        )
    else:
        # Broadcast order update
        async_to_sync(channel_layer.group_send)(
            "orders",
            {
                "type": "order_update",
                "content": serialized_order
            }
        )

from django.db import models
from orders.models import Order

class ChatMessage(models.Model):
    SENDER_CHOICES = [
        ('client', 'Client'),
        ('admin', 'Admin'),
    ]
    
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='chat_messages')
    message = models.TextField()
    sender_type = models.CharField(max_length=10, choices=SENDER_CHOICES, default='client')
    timestamp = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    class Meta:
        ordering = ['timestamp']

    def __str__(self):
        return f"Order: {self.order.id}, Sender: {self.sender_type}, Time: {self.timestamp}"

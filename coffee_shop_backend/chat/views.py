from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from .models import ChatMessage
from .serializers import ChatMessageSerializer
from orders.models import Order

class ChatMessageViewSet(viewsets.ModelViewSet):
    serializer_class = ChatMessageSerializer
    queryset = ChatMessage.objects.all()

    def get_queryset(self):
        queryset = ChatMessage.objects.all()
        order_id = self.request.query_params.get('order_id', None)
        if order_id is not None:
            queryset = queryset.filter(order_id=order_id)
        return queryset.order_by('timestamp')

    @action(detail=False, methods=['post'])
    def mark_as_read(self, request):
        order_id = request.data.get('order_id')
        if order_id:
            messages = ChatMessage.objects.filter(order_id=order_id)
            messages.update(is_read=True)
            return Response({'status': 'messages marked as read'})
        return Response({'error': 'order_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def by_order(self, request):
        order_id = request.query_params.get('order_id')
        if not order_id:
            return Response({'error': 'order_id is required'}, status=400)
        
        messages = self.get_queryset().filter(order_id=order_id)
        serializer = self.get_serializer(messages, many=True)
        return Response(serializer.data)

    def perform_create(self, serializer):
        # Set sender_type based on user role (you'll need to implement the logic)
        sender_type = 'admin' if self.request.user.is_staff else 'client'
        serializer.save(sender_type=sender_type)

from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db.models import Sum
from datetime import datetime, timedelta
from rest_framework import permissions

from .models import BrokenItem, MenuItem, Order, Table
from .serializers import BrokenItemSerializer, MenuItemSerializer, OrderSerializer, TableSerializer

class MenuItemViewSet(viewsets.ModelViewSet):
    queryset = MenuItem.objects.all()
    serializer_class = MenuItemSerializer
    
    def get_queryset(self):
        queryset = MenuItem.objects.all()
        category = self.request.query_params.get('category', None)
        if category:
            queryset = queryset.filter(category__name=category)
        return queryset

class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.all()
    serializer_class = OrderSerializer
    
    @action(detail=False, methods=['get'])
    def analytics(self, request):
        today = datetime.now()
        thirty_days_ago = today - timedelta(days=30)
        
        daily_sales = Order.objects.filter(
            status='paid',
            created_at__date=today.date()
        ).aggregate(total=Sum('total_amount'))
        
        monthly_sales = Order.objects.filter(
            status='paid',
            created_at__gte=thirty_days_ago
        ).aggregate(total=Sum('total_amount'))
        
        return Response({
            'daily_sales': daily_sales['total'] or 0,
            'monthly_sales': monthly_sales['total'] or 0
        })
    
    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        order = self.get_object()
        new_status = request.data.get('status')
        if new_status in dict(Order.STATUS_CHOICES):
            order.status = new_status
            order.save()
            return Response({'status': 'Order status updated'})
        return Response(
            {'error': 'Invalid status'},
            status=status.HTTP_400_BAD_REQUEST
        )

class TableViewSet(viewsets.ModelViewSet):
    queryset = Table.objects.all()
    serializer_class = TableSerializer
    
    @action(detail=True, methods=['post'])
    def toggle_occupation(self, request, pk=None):
        table = self.get_object()
        table.is_occupied = not table.is_occupied
        table.save()
        return Response({'status': f'Table {table.table_number} occupation toggled'})

class BrokenItemViewSet(viewsets.ModelViewSet):
    queryset = BrokenItem.objects.all()
    serializer_class = BrokenItemSerializer
    
    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        broken_item = self.get_object()
        broken_item.mark_resolved()
        return Response({'status': 'Item marked as resolved'})
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Sum, Count, F
from datetime import datetime, timedelta
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.models import Group
from .models import BrokenItem, Category, MenuItem, Order, OrderItem, Table
from .serializers import (
    UserSerializer,
    BrokenItemSerializer,
    CategorySerializer,
    MenuItemSerializer,
    OrderSerializer,
    OrderItemSerializer,
    TableSerializer,
)
from django.contrib.auth import authenticate
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

# Category Management
class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]


# Menu Item Management
class MenuItemViewSet(viewsets.ModelViewSet):
    queryset = MenuItem.objects.all()
    serializer_class = MenuItemSerializer

    def get_queryset(self):
        queryset = MenuItem.objects.all()
        category = self.request.query_params.get('category', None)
        available = self.request.query_params.get('available', None)

        if category:
            queryset = queryset.filter(category__id=category)

        if available:
            queryset = queryset.filter(is_available=True)

        return queryset


# Table Management
class TableViewSet(viewsets.ModelViewSet):
    queryset = Table.objects.all()
    serializer_class = TableSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=['post'])
    def toggle_occupation(self, request, pk=None):
        table = self.get_object()
        table.is_occupied = not table.is_occupied
        table.save()
        serializer = self.get_serializer(table)
        return Response(serializer.data)


# Order Management
class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.all()
    serializer_class = OrderSerializer
    
    def get_permissions(self):
        """
        Instantiates and returns the list of permissions that this view requires.
        Allow POST without authentication, require authentication for all other actions.
        """
        if self.action == 'create':
            permission_classes = [AllowAny]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        queryset = Order.objects.all()
        table = self.request.query_params.get('table', None)
        status = self.request.query_params.get('status', None)
        date = self.request.query_params.get('date', None)

        if table:
            queryset = queryset.filter(table_id=table)

        if status:
            queryset = queryset.filter(status=status)

        if date:
            try:
                date = datetime.strptime(date, '%Y-%m-%d').date()
                queryset = queryset.filter(created_at__date=date)
            except ValueError:
                pass

        return queryset

    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        order = self.get_object()
        new_status = request.data.get('status')

        if new_status not in dict(Order.STATUS_CHOICES):
            return Response(
                {'error': 'Invalid status'},
                status=status.HTTP_400_BAD_REQUEST
            )

        order.status = new_status
        order.save()

        serializer = self.get_serializer(order)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def analytics(self, request):
        # Get date range from query params or default to last 30 days
        end_date = datetime.now().date()
        start_date = self.request.query_params.get('start_date', None)
        end_date_param = self.request.query_params.get('end_date', None)

        if start_date and end_date_param:
            try:
                start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
                end_date = datetime.strptime(end_date_param, '%Y-%m-%d').date()
            except ValueError:
                start_date = end_date - timedelta(days=30)
        else:
            start_date = end_date - timedelta(days=30)

        # Calculate analytics
        orders = Order.objects.filter(
            created_at__date__range=[start_date, end_date],
            status='paid'
        )

        daily_sales = orders.filter(
            created_at__date=end_date
        ).aggregate(
            total=Sum('total_amount'),
            count=Count('id')
        )

        period_sales = orders.aggregate(
            total=Sum('total_amount'),
            count=Count('id')
        )

        # Get top selling items
        top_items = OrderItem.objects.filter(
            order__created_at__date__range=[start_date, end_date],
            order__status='paid'
        ).values(
            'menu_item__name'
        ).annotate(
            total_quantity=Sum('quantity'),
            total_sales=Sum(F('quantity') * F('menu_item__price'))
        ).order_by('-total_quantity')[:5]

        return Response({
            'period': {
                'start_date': start_date,
                'end_date': end_date,
            },
            'daily_sales': {
                'amount': daily_sales['total'] or 0,
                'order_count': daily_sales['count'] or 0
            },
            'period_sales': {
                'amount': period_sales['total'] or 0,
                'order_count': period_sales['count'] or 0
            },
            'top_selling_items': list(top_items)
        })

# Broken Items Management
class BrokenItemViewSet(viewsets.ModelViewSet):
    queryset = BrokenItem.objects.all()
    serializer_class = BrokenItemSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        broken_item = self.get_object()
        broken_item.mark_resolved()
        serializer = self.get_serializer(broken_item)
        return Response(serializer.data)


# User Login API
class LoginAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        username = request.data.get("username")
        password = request.data.get("password")
        user = authenticate(username=username, password=password)

        if user is not None:
            tokens = RefreshToken.for_user(user)
            return Response({
                "refresh": str(tokens),
                "access": str(tokens.access_token),
                "user": UserSerializer(user).data,
            })

        return Response({"error": "Invalid Credentials"}, status=status.HTTP_400_BAD_REQUEST)




def broadcast_new_order(order):
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        'orders',  # Group name
        {
            'type': 'order_update',
            'content': {
                'id': order.id,
                'table': order.table.table_number,
                'status': order.status,
                'total_amount': str(order.total_amount),
                'created_at': order.created_at.isoformat(),
            }
        }
    )
def perform_create(self, serializer):
    order = serializer.save()
    broadcast_new_order(order)

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Sum, Count, F
from datetime import datetime, timedelta
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.models import Group
from .models import BrokenItem, Category, MenuItem, Order, OrderItem, Table, OrderReview
from .serializers import (
    UserSerializer,
    BrokenItemSerializer,
    CategorySerializer,
    MenuItemSerializer,
    OrderSerializer,
    OrderItemSerializer,
    TableSerializer,
    OrderReviewSerializer
)
from django.contrib.auth import authenticate
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
import logging

logger = logging.getLogger(__name__)

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
        if self.action in ['create', 'track', 'update_status', 'cancel', 'update_table', 'review', 'retrieve']:
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

    def create(self, request, *args, **kwargs):
        print("Received order data:", request.data)  # Debug log
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            order = serializer.save()
            print("Created order:", order.id)  # Debug log
            broadcast_new_order(order)  # Broadcast the new order
            response_data = {
                'id': order.id,
                'status': order.status,
                'message': 'Order created successfully'
            }
            print("Sending response:", response_data)  # Debug log
            return Response(response_data, status=status.HTTP_201_CREATED)
        print("Serializer errors:", serializer.errors)  # Debug log
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def perform_update(self, serializer):
        order = serializer.save()
        broadcast_order_update(order)

    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        try:
            order = self.get_object()
            new_status = request.data.get('status')
            
            if not new_status:
                return Response(
                    {'error': 'Status not provided'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Update order status
            order.status = new_status
            order.save()
            
            # Broadcast the update
            broadcast_order_update(order)
            
            return Response({
                'status': 'Order status updated',
                'order': OrderSerializer(order).data
            })
            
        except Exception as e:
            logger.error(f"Error updating order status: {str(e)}")
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['get'])
    def track(self, request, pk=None):
        """
        Endpoint for tracking a specific order
        """
        try:
            order = self.get_object()
            serializer = self.get_serializer(order)
            return Response(serializer.data)
        except Order.DoesNotExist:
            return Response(
                {'error': 'Order not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        try:
            order = self.get_object()
            order.status = 'cancelled'
            order.save()
            broadcast_order_update(order)
            return Response({'status': 'Order cancelled'})
        except Exception as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def review(self, request, pk=None):
        order = self.get_object()
        if order.status != 'delivered':
            return Response({'error': 'Can only review delivered orders'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if order already has a review
        if hasattr(order, 'review'):
            return Response({'error': 'Order already has a review'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Add order to request data
        review_data = request.data.copy()
        review_data['order'] = order.id
        
        serializer = OrderReviewSerializer(data=review_data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def update_table(self, request, pk=None):
        """
        Update the table of an order
        """
        try:
            order = self.get_object()
            table_id = request.data.get('table_id')
            
            # Log the incoming request data
            logger.info(f"Updating table for order {pk}. Data: {request.data}")
            
            if table_id is None:
                return Response(
                    {'error': 'Table ID is required'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            try:
                table = Table.objects.get(id=table_id)
                logger.info(f"Found table: {table}")
            except Table.DoesNotExist:
                logger.error(f"Table {table_id} not found")
                return Response(
                    {'error': f'Table {table_id} not found'}, 
                    status=status.HTTP_404_NOT_FOUND
                )
            except ValueError as e:
                logger.error(f"Invalid table ID format: {e}")
                return Response(
                    {'error': 'Invalid table ID format'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Update the order's table
            order.table = table
            order.save()
            
            # Get the updated order data
            serializer = OrderSerializer(order)
            
            # Broadcast the update
            broadcast_order_update(order)
            
            logger.info(f"Successfully updated table for order {pk}")
            
            return Response({
                'status': 'Table updated successfully',
                'order': serializer.data
            })
            
        except Order.DoesNotExist:
            logger.error(f"Order {pk} not found")
            return Response(
                {'error': 'Order not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error updating table for order {pk}: {str(e)}")
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )

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

def broadcast_order_update(order):
    """Broadcast order update to all connected WebSocket clients"""
    try:
        channel_layer = get_channel_layer()
        order_data = OrderSerializer(order).data
        
        # Broadcast to order-specific group
        async_to_sync(channel_layer.group_send)(
            f'order_{order.id}',
            {
                'type': 'order_update',
                'content': order_data
            }
        )
        
        # Also broadcast to menu orders group for general updates
        async_to_sync(channel_layer.group_send)(
            'menu_orders',
            {
                'type': 'order_update',
                'content': order_data
            }
        )
        
        logger.info(f"Order update broadcast for order {order.id}")
    except Exception as e:
        logger.error(f"Error broadcasting order update: {str(e)}")

def perform_create(self, serializer):
    order = serializer.save()
    broadcast_new_order(order)

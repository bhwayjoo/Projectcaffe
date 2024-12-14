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
        if self.action in ['create', 'track', 'update_status', 'cancel', 'update_table', 'review', 'retrieve', 'analytics']:
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
        try:
            start_date = request.query_params.get('start_date')
            end_date = request.query_params.get('end_date')
            period = request.query_params.get('period', 'daily')

            if not start_date or not end_date:
                return Response(
                    {'error': 'start_date and end_date are required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            try:
                start_date = datetime.strptime(start_date, '%Y-%m-%d').replace(hour=0, minute=0, second=0)
                end_date = datetime.strptime(end_date, '%Y-%m-%d').replace(hour=23, minute=59, second=59)
            except (ValueError, TypeError):
                return Response(
                    {'error': 'Invalid date format. Use YYYY-MM-DD'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Get daily sales for the current day
            today = datetime.now().date()
            daily_sales = Order.objects.filter(
                created_at__date=today,
                status='paid'
            ).aggregate(
                amount=Sum('total_amount'),
                order_count=Count('id')
            )

            # Get period sales
            period_sales = Order.objects.filter(
                created_at__range=(start_date, end_date),
                status='paid'
            ).aggregate(
                amount=Sum('total_amount'),
                order_count=Count('id')
            )

            # Ensure values are not None
            daily_sales['amount'] = float(daily_sales['amount'] or 0)
            daily_sales['order_count'] = int(daily_sales['order_count'] or 0)
            period_sales['amount'] = float(period_sales['amount'] or 0)
            period_sales['order_count'] = int(period_sales['order_count'] or 0)

            # Get top selling items
            top_items = OrderItem.objects.filter(
                order__created_at__range=(start_date, end_date),
                order__status='paid'
            ).values('menu_item__name').annotate(
                total_quantity=Sum('quantity'),
                total_sales=Sum(F('quantity') * F('menu_item__price'))
            ).order_by('-total_quantity')[:5]

            # Get time series data based on period
            time_series_data = []
            
            # Get all orders in the period
            orders = Order.objects.filter(
                created_at__range=(start_date, end_date),
                status='paid'
            ).order_by('created_at')

            # Group orders by period manually
            current_period = {}
            for order in orders:
                if period == 'hourly':
                    period_key = order.created_at.strftime('%Y-%m-%d %H:00:00')
                elif period == 'daily':
                    period_key = order.created_at.strftime('%Y-%m-%d')
                elif period == 'monthly':
                    period_key = order.created_at.strftime('%Y-%m')
                else:  # yearly
                    period_key = order.created_at.strftime('%Y')

                if period_key not in current_period:
                    current_period[period_key] = {
                        'amount': 0,
                        'order_count': 0
                    }
                
                current_period[period_key]['amount'] += float(order.total_amount or 0)
                current_period[period_key]['order_count'] += 1

            # Convert grouped data to time series format
            for period_key, data in sorted(current_period.items()):
                if period == 'hourly':
                    period_dt = datetime.strptime(period_key, '%Y-%m-%d %H:00:00')
                elif period == 'daily':
                    period_dt = datetime.strptime(period_key, '%Y-%m-%d')
                elif period == 'monthly':
                    period_dt = datetime.strptime(period_key, '%Y-%m')
                else:  # yearly
                    period_dt = datetime.strptime(period_key, '%Y')

                time_series_data.append({
                    'timestamp': period_dt.isoformat(),
                    'amount': data['amount'],
                    'order_count': data['order_count']
                })

            # Convert decimal values to float for JSON serialization
            top_items_list = []
            for item in top_items:
                if item['menu_item__name']:
                    top_items_list.append({
                        'menu_item__name': item['menu_item__name'],
                        'total_quantity': int(item['total_quantity'] or 0),
                        'total_sales': float(item['total_sales'] or 0)
                    })

            return Response({
                'period': {
                    'start_date': start_date.date().isoformat(),
                    'end_date': end_date.date().isoformat()
                },
                'daily_sales': daily_sales,
                'period_sales': period_sales,
                'top_selling_items': top_items_list,
                'time_series': time_series_data
            })

        except Exception as e:
            import traceback
            logger.error(f"Error in analytics endpoint: {str(e)}\n{traceback.format_exc()}")
            return Response(
                {'error': 'An error occurred while processing the analytics data'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


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


# Order Review Management
class OrderReviewViewSet(viewsets.ModelViewSet):
    queryset = OrderReview.objects.all().order_by('-created_at')
    serializer_class = OrderReviewSerializer
    permission_classes = [AllowAny]


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

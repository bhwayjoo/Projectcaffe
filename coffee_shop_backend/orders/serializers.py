from rest_framework import serializers
from .models import Category, MenuItem, Table, Order, OrderItem, BrokenItem

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'description', 'created_at']
        read_only_fields = ['created_at']

class MenuItemSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    
    class Meta:
        model = MenuItem
        fields = ['id', 'name', 'description', 'price', 'category', 
                 'category_name', 'image', 'is_available', 
                 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']

class TableSerializer(serializers.ModelSerializer):
    class Meta:
        model = Table
        fields = ['id', 'table_number', 'qr_code', 'is_occupied']

class OrderItemCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ['menu_item', 'quantity', 'notes']
        
    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("Quantity must be greater than 0")
        return value

class OrderItemSerializer(serializers.ModelSerializer):
    menu_item_name = serializers.CharField(source='menu_item.name', read_only=True)
    menu_item_price = serializers.DecimalField(source='menu_item.price', read_only=True,
                                             max_digits=6, decimal_places=2)
    subtotal = serializers.DecimalField(read_only=True, max_digits=8, decimal_places=2)
    
    class Meta:
        model = OrderItem
        fields = ['id', 'menu_item', 'menu_item_name', 'menu_item_price',
                 'quantity', 'notes', 'subtotal']

class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemCreateSerializer(many=True, write_only=True)
    order_items = OrderItemSerializer(source='orderitem_set', many=True, read_only=True)
    table_number = serializers.IntegerField(source='table.table_number', read_only=True)
     
    class Meta:
        model = Order
        fields = ['id', 'table', 'table_number', 'status', 'items', 
                 'order_items', 'total_amount', 'created_at', 'updated_at']
        read_only_fields = ['total_amount', 'created_at', 'updated_at']

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("At least one item is required")
        
        for item in value:
            menu_item = item['menu_item']
            if not menu_item.is_available:
                raise serializers.ValidationError(f"{menu_item.name} is currently not available")
        
        return value

    def validate_table(self, value):
        if not value.is_occupied:
            raise serializers.ValidationError("Cannot create order for unoccupied table")
        return value

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        
        # Create order without force_insert
        order = Order.objects.create(**validated_data)
        
        # Create order items
        for item_data in items_data:
            OrderItem.objects.create(order=order, **item_data)
        
        # Recalculate total
        order.save()
        return order

    def update(self, instance, validated_data):
        if 'items' in validated_data:
            items_data = validated_data.pop('items')
            instance.orderitem_set.all().delete()
            
            for item_data in items_data:
                OrderItem.objects.create(order=instance, **item_data)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        instance.save()
        return instance

class BrokenItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = BrokenItem
        fields = ['id', 'item_name', 'description', 'reported_by', 
                 'reported_at', 'resolved', 'resolved_at']
        read_only_fields = ['reported_at', 'resolved', 'resolved_at']

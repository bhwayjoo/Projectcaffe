from django.contrib import admin
from .models import Category, MenuItem, Table, Order, OrderItem, BrokenItem

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'created_at')
    search_fields = ('name',)

@admin.register(MenuItem)
class MenuItemAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'price', 'is_available')
    list_filter = ('category', 'is_available')
    search_fields = ('name', 'description')

@admin.register(Table)
class TableAdmin(admin.ModelAdmin):
    list_display = ('table_number', 'is_occupied')
    list_filter = ('is_occupied',)

class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 1

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'table', 'status', 'total_amount', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('id',)
    inlines = [OrderItemInline]

@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ('order', 'menu_item', 'quantity')
    list_filter = ('order', 'menu_item')

@admin.register(BrokenItem)
class BrokenItemAdmin(admin.ModelAdmin):
    list_display = ('item_name', 'reported_by', 'resolved', 'reported_at')
    list_filter = ('resolved', 'reported_at')
    search_fields = ('item_name', 'reported_by')

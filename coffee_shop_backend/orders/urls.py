from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CategoryViewSet,
    MenuItemViewSet,
    TableViewSet,
    OrderViewSet,
    BrokenItemViewSet,
    LoginAPIView,
)
from .consumers import OrderConsumer


# Define the Default Router for ViewSets
router = DefaultRouter()
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'menu-items', MenuItemViewSet, basename='menuitem')
router.register(r'tables', TableViewSet, basename='table')
router.register(r'orders', OrderViewSet, basename='order')
router.register(r'broken-items', BrokenItemViewSet, basename='brokenitem')

# Define urlpatterns
urlpatterns = [
    # Include the router's URLs
    path('', include(router.urls)),
    path('login/', LoginAPIView.as_view(), name='login'),
]
websocket_urlpatterns = [
    path("order/", OrderConsumer.as_asgi()),
]
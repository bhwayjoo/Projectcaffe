from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CategoryViewSet,
    MenuItemViewSet,
    OrderViewSet,
    TableViewSet,
    BrokenItemViewSet,
    LoginAPIView,
    OrderReviewViewSet
)


# Define the Default Router for ViewSets
router = DefaultRouter()
router.register(r'categories', CategoryViewSet)
router.register(r'menu-items', MenuItemViewSet)
router.register(r'orders', OrderViewSet)
router.register(r'tables', TableViewSet)
router.register(r'broken-items', BrokenItemViewSet)
router.register(r'reviews', OrderReviewViewSet)

# Define urlpatterns
urlpatterns = [
    # Include the router's URLs
    path('', include(router.urls)),
    path('login/', LoginAPIView.as_view(), name='login'),
]

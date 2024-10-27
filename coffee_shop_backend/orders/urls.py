from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'menu-items', views.MenuItemViewSet)
router.register(r'tables', views.TableViewSet)
router.register(r'orders', views.OrderViewSet)
router.register(r'broken-items', views.BrokenItemViewSet)

urlpatterns = [
    path('', include(router.urls)),
]

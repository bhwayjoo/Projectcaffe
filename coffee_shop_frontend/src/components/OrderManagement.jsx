import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "react-query";
import {
  Card,
  CardContent,
} from "../components/ui/card";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { Loader2 } from "lucide-react";
import { api } from "../api/customAcios";
import { webSocketService } from "../services/websocket";
import { menuWebSocketService } from '../services/menuWebSocket';

const OrderManagement = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  const { data: orders = [], isLoading, error } = useQuery(
    "orders",
    async () => {
      const response = await api.get("/orders/");
      return response.data || [];
    },
    {
      retry: 3,
      retryDelay: 1000,
      onError: (error) => {
        console.error("Error fetching orders:", error);
      },
    }
  );

  useEffect(() => {
    const handleWebSocketMessage = (data) => {
      if (data.type === 'connection_error') {
        setConnectionError(data.message);
        setIsConnected(false);
      } else {
        // Refresh orders when we receive updates
        queryClient.invalidateQueries('orders');
      }
    };

    const connectWebSockets = () => {
      try {
        webSocketService.connect();
        menuWebSocketService.connect();

        const adminUnsubscribe = webSocketService.subscribe((data) => {
          handleWebSocketMessage(data);
          setIsConnected(true);
          setConnectionError(null);
        });

        const menuUnsubscribe = menuWebSocketService.subscribe((data) => {
          handleWebSocketMessage(data);
          setIsConnected(true);
          setConnectionError(null);
        });

        return () => {
          adminUnsubscribe();
          menuUnsubscribe();
          webSocketService.disconnect();
          menuWebSocketService.disconnect();
        };
      } catch (error) {
        console.error('Error setting up WebSocket connections:', error);
        setConnectionError('Failed to connect to order system');
        setIsConnected(false);
      }
    };

    const cleanup = connectWebSockets();
    return () => cleanup && cleanup();
  }, [queryClient]);

  const handleWebSocketMessage = (data, source) => {
    if (data.type === 'initial_orders') {
      queryClient.setQueryData('orders', data.orders);
    } else if (data.type === 'new_order') {
      queryClient.setQueryData('orders', (oldOrders) => {
        if (!oldOrders) return [data.order];
        return [data.order, ...oldOrders];
      });
    } else if (data.type === 'order_update') {
      queryClient.setQueryData('orders', (oldOrders) => {
        if (!oldOrders) return oldOrders;
        return oldOrders.map(order => 
          order.id === data.order.id ? data.order : order
        );
      });
    } else if (data.type === 'order_update') {
      // Update existing order
      queryClient.setQueryData("orders", (oldOrders) => {
        if (!oldOrders) return oldOrders;
        return oldOrders.map(order => 
          order.id === data.order.id ? data.order : order
        );
      });
    } else if (data.type === 'new_order') {
      // Add new order to the list
      queryClient.setQueryData("orders", (oldOrders) => {
        if (!oldOrders) return [data.order];
        return [data.order, ...oldOrders];
      });
      // Show notification for new order
      // You can add a toast notification here if needed
    } else if (data.type === 'connection_error') {
      console.error('WebSocket connection error:', data.message);
    }
  };

  const updateOrderStatus = useMutation(
    async ({ orderId, status }) => {
      try {
        webSocketService.updateOrderStatus(orderId, status);
        const response = await api.post(`/orders/${orderId}/update_status/`, { status });
        return response.data;
      } catch (error) {
        console.error('Error updating order status:', error);
        throw error;
      }
    },
    {
      onSuccess: () => queryClient.invalidateQueries("orders"),
      onError: (error) => {
        console.error('Mutation error:', error);
      },
    }
  );

  const getStatusColor = (status) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-800",
      confirmed: "bg-blue-100 text-blue-800",
      preparing: "bg-purple-100 text-purple-800",
      ready: "bg-green-100 text-green-800",
      delivered: "bg-gray-100 text-gray-800",
      paid: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const getNextStatus = (currentStatus) => {
    const statusFlow = {
      pending: { next: 'confirmed', label: 'Confirm Order', color: 'bg-blue-500 hover:bg-blue-600' },
      confirmed: { next: 'preparing', label: 'Start Preparing', color: 'bg-purple-500 hover:bg-purple-600' },
      preparing: { next: 'ready', label: 'Mark Ready', color: 'bg-green-500 hover:bg-green-600' },
      ready: { next: 'delivered', label: 'Mark Delivered', color: 'bg-gray-500 hover:bg-gray-600' },
      delivered: { next: 'paid', label: 'Mark Paid', color: 'bg-green-500 hover:bg-green-600' },
    };
    return statusFlow[currentStatus] || null;
  };

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid Date';
    }
  };

  const calculateTotal = (items = []) => {
    try {
      return items.reduce(
        (sum, item) => sum + (item?.product?.price || 0) * (item?.quantity || 0),
        0
      );
    } catch (error) {
      console.error('Error calculating total:', error);
      return 0;
    }
  };

  const ordersByStatus = {
    all: orders,
    pending: orders.filter((order) => order?.status === "pending"),
    confirmed: orders.filter((order) => order?.status === "confirmed"),
    preparing: orders.filter((order) => order?.status === "preparing"),
    ready: orders.filter((order) => order?.status === "ready"),
    delivered: orders.filter((order) => order?.status === "delivered"),
    paid: orders.filter((order) => order?.status === "paid"),
    cancelled: orders.filter((order) => order?.status === "cancelled"),
  };

  const OrderCard = ({ order }) => {
    if (!order) return null;
    
    const nextStatus = getNextStatus(order.status);

    return (
      <Card className="p-4 bg-white shadow-sm hover:shadow-md transition-shadow">
        <div className="space-y-4">
          {/* Header Section */}
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold text-lg text-gray-900">
                Order #{order.id}
              </h3>
              <div className="space-y-1">
                <p className="text-sm text-gray-600">
                  Table: {order.table_number}
                </p>
                <p className="text-sm text-gray-600">
                  Created: {formatDate(order.created_at)}
                </p>
                <p className="text-sm text-gray-600">
                  Updated: {formatDate(order.updated_at)}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <span
                className={`px-3 py-1 rounded-full text-xs ${getStatusColor(
                  order.status
                )}`}
              >
                {order.status.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Order Items Section */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium mb-2">Order Items</h4>
            {order.order_items && order.order_items.length > 0 ? (
              <div className="space-y-2">
                {order.order_items.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-center py-2 border-b border-gray-200 last:border-0"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {item.menu_item_name}
                      </p>
                      <p className="text-sm text-gray-600">
                        Quantity: {item.quantity} × ${item.menu_item_price}
                      </p>
                      {item.notes && (
                        <p className="text-sm text-gray-500">
                        Notes: {item.notes}
                      </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">
                        ${parseFloat(item.subtotal).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
                <div className="mt-4 pt-2 border-t border-gray-200">
                  <div className="flex justify-between font-semibold">
                    <span>Total:</span>
                    <span>${parseFloat(order.total_amount || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No items in this order</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end">
            {nextStatus && order.status !== 'cancelled' && order.status !== 'paid' && (
              <Button
                className={`${nextStatus.color} text-white`}
                onClick={() => updateOrderStatus.mutate({ 
                  orderId: order.id, 
                  status: nextStatus.next 
                })}
                disabled={updateOrderStatus.isLoading}
              >
                {nextStatus.label}
              </Button>
            )}
            {order.status !== 'cancelled' && order.status !== 'paid' && (
              <Button
                className="bg-red-500 hover:bg-red-600 text-white"
                onClick={() => updateOrderStatus.mutate({ 
                  orderId: order.id, 
                  status: 'cancelled' 
                })}
                disabled={updateOrderStatus.isLoading}
              >
                Cancel Order
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-500">
        Error loading orders: {error.message}
      </div>
    );
  }

  if (!isConnected && connectionError) {
    return (
      <div className="p-4 text-amber-500">
        {connectionError}. Attempting to reconnect...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Orders Management</h2>
        <div className={`px-3 py-1 rounded ${isConnected ? 'bg-green-500' : 'bg-red-500'} text-white`}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">
            All ({ordersByStatus.all?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pending ({ordersByStatus.pending?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="confirmed">
            Confirmed ({ordersByStatus.confirmed?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="preparing">
            Preparing ({ordersByStatus.preparing?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="ready">
            Ready ({ordersByStatus.ready?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="delivered">
            Delivered ({ordersByStatus.delivered?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="paid">
            Paid ({ordersByStatus.paid?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="cancelled">
            Cancelled ({ordersByStatus.cancelled?.length || 0})
          </TabsTrigger>
        </TabsList>

        {Object.entries(ordersByStatus).map(([status, filteredOrders]) => (
          <TabsContent key={status} value={status}>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {(filteredOrders || []).map((order) => (
                <OrderCard key={order?.id} order={order} />
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default OrderManagement;

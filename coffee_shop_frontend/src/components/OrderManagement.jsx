import React, { useState, useEffect, useRef } from "react";
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
import { Loader2, MessageCircle } from "lucide-react";
import { api } from "../api/customAcios";
import { webSocketService } from "../services/websocket";
import { menuWebSocketService } from '../services/menuWebSocket';
import { chatWebSocketService } from '../services/chatWebSocket';
import ChatModal from './ChatModal';
import { useToast } from "./ui/use-toast";

const OrderManagement = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("all");
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState({});
  const [localOrders, setLocalOrders] = useState([]);
  const audioRef = useRef(new Audio('/notification.mp3'));

  useEffect(() => {
    const handleWebSocketMessage = (data) => {
      console.log('WebSocket message received:', data);
      
      if (data.type === 'connection_error') {
        setConnectionError(data.message);
        setIsConnected(false);
        return;
      }
      
      setIsConnected(true);
      setConnectionError(null);

      switch (data.type) {
        case 'initial_orders':
          setLocalOrders(data.orders);
          break;

        case 'new_order':
          setLocalOrders(prevOrders => {
            const exists = prevOrders.some(order => order.id === data.order.id);
            if (!exists) {
              audioRef.current.play().catch(e => console.log('Audio play failed:', e));
              
              toast({
                title: "New Order",
                description: `📝 New order #${data.order.id} received!`,
                variant: "default",
              });
              return [...prevOrders, data.order];
            }
            return prevOrders;
          });
          break;

        case 'order_update':
          setLocalOrders(prevOrders => {
            return prevOrders.map(order => {
              if (order.id === data.order.id) {
                if (order.status !== data.order.status) {
                  const statusEmoji = {
                    'pending': '⏳',
                    'preparing': '👨‍🍳',
                    'ready': '✅',
                    'delivered': '🚚',
                    'completed': '🎉',
                    'cancelled': '❌',
                    'paid': '💰'
                  }[data.order.status] || '📋';

                  audioRef.current.play().catch(e => console.log('Audio play failed:', e));

                  toast({
                    title: "Order Status Updated",
                    description: `${statusEmoji} Order #${order.id} status: ${data.order.status.toUpperCase()}`,
                    variant: "default",
                  });
                }
                return { ...order, ...data.order };
              }
              return order;
            });
          });
          break;

        case 'chat_message':
          if (data.sender_type === 'customer') {
            const orderId = data.order_id;
            if (!chatOpen || selectedOrder?.id !== orderId) {
              setUnreadMessages(prev => ({
                ...prev,
                [orderId]: (prev[orderId] || 0) + 1
              }));
              audioRef.current.play().catch(e => console.log('Audio play failed:', e));
              
              toast({
                title: "New Message",
                description: `💬 New message from Order #${orderId}`,
                variant: "default",
              });
            }
          }
          break;

        case 'order_deleted':
          setLocalOrders(prevOrders => {
            return prevOrders.filter(order => order.id !== data.order_id);
          });
          toast({
            title: "Order Removed",
            description: `🗑️ Order #${data.order_id} has been removed`,
            variant: "default",
          });
          break;
      }
    };

    const setupWebSockets = () => {
      try {
        webSocketService.connect();
        const adminUnsubscribe = webSocketService.subscribe(handleWebSocketMessage);

        setIsConnected(true);
        setConnectionError(null);

        return () => {
          adminUnsubscribe();
          webSocketService.disconnect();
        };
      } catch (error) {
        console.error('WebSocket connection error:', error);
        setConnectionError('Failed to connect to order system');
        setIsConnected(false);
        return () => {};
      }
    };

    const cleanup = setupWebSockets();
    return () => cleanup();
  }, [chatOpen, selectedOrder, toast]);

  useEffect(() => {
    let reconnectTimeout;

    const handleReconnect = () => {
      if (!isConnected) {
        console.log('Attempting to reconnect...');
        webSocketService.connect();
      }
    };

    if (!isConnected) {
      reconnectTimeout = setTimeout(handleReconnect, 5000);
    }

    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [isConnected]);

  const handleChatOpen = (order) => {
    setSelectedOrder(order);
    setChatOpen(true);
    // Clear unread count for this order
    setUnreadMessages(prev => ({
      ...prev,
      [order.id]: 0
    }));
  };

  const handleChatClose = () => {
    setChatOpen(false);
    setSelectedOrder(null);
  };

  const updateOrderStatus = useMutation(
    async ({ orderId, status }) => {
      try {
        const response = await api.post(`/orders/${orderId}/update_status/`, {
          status: status
        });
        return response.data;
      } catch (error) {
        console.error('Error updating order status:', error);
        toast({
          title: "Error",
          description: "Failed to update order status",
          variant: "destructive",
        });
        throw error;
      }
    },
    {
      onSuccess: (data) => {
        if (data) {
          toast({
            title: "Status Updated",
            description: `Order #${data.order.id} status updated to ${data.order.status}`,
            variant: "default",
          });
          // No need to invalidate queries since we're using WebSocket for real-time updates
        }
      }
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
    all: [...localOrders].sort((a, b) => a.id - b.id),
    pending: localOrders.filter((order) => order?.status === "pending")
      .sort((a, b) => a.id - b.id),
    confirmed: localOrders.filter((order) => order?.status === "confirmed")
      .sort((a, b) => a.id - b.id),
    preparing: localOrders.filter((order) => order?.status === "preparing")
      .sort((a, b) => a.id - b.id),
    ready: localOrders.filter((order) => order?.status === "ready")
      .sort((a, b) => a.id - b.id),
    delivered: localOrders.filter((order) => order?.status === "delivered")
      .sort((a, b) => a.id - b.id),
    paid: localOrders.filter((order) => order?.status === "paid")
      .sort((a, b) => a.id - b.id),
    cancelled: localOrders.filter((order) => order?.status === "cancelled")
      .sort((a, b) => a.id - b.id),
  };

  const OrderCard = ({ order }) => {
    if (!order) return null;
    
    const nextStatus = getNextStatus(order.status);
    const unreadCount = unreadMessages[order.id] || 0;

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
              <div className="relative inline-block">
                <Button 
                  onClick={() => handleChatOpen(order)}
                  className="bg-gray-500 hover:bg-gray-600 text-white"
                  size="sm"
                >
                  <MessageCircle className="h-4 w-4 mr-1" />
                  Chat
                  {unreadCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
                      {unreadCount}
                    </span>
                  )}
                </Button>
              </div>
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

  if (localOrders.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (connectionError) {
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

      {/* Chat Modal */}
      {selectedOrder && (
        <ChatModal
          orderId={selectedOrder.id}
          isOpen={chatOpen}
          onClose={handleChatClose}
        />
      )}
    </div>
  );
};

export default OrderManagement;

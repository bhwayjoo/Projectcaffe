import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "react-query";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../components/ui/tabs";
import { Loader2 } from "lucide-react";
import { api } from "../api/customAcios";

const OrderManagement = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
  const [socket, setSocket] = useState(null);

  const { data: orders = [], isLoading } = useQuery("orders", async () => {
    const response = await api.get("/orders/");
    return response.data;
  });

  const updateOrderStatus = useMutation(
    ({ orderId, status }) =>
      api.post(`/orders/${orderId}/update_status/`, { status }),
    {
      onSuccess: () => queryClient.invalidateQueries("orders"),
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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const ordersByStatus = {
    all: orders,
    pending: orders.filter((order) => order.status === "pending"),
    confirmed: orders.filter((order) => order.status === "confirmed"),
    preparing: orders.filter((order) => order.status === "preparing"),
    ready: orders.filter((order) => order.status === "ready"),
    delivered: orders.filter((order) => order.status === "delivered"),
    paid: orders.filter((order) => order.status === "paid"),
    cancelled: orders.filter((order) => order.status === "cancelled"),
  };

  const OrderCard = ({ order }) => (
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
              {order.status}
            </span>
            <Select
              value={order.status}
              onValueChange={(value) =>
                updateOrderStatus.mutate({
                  orderId: order.id,
                  status: value,
                })
              }
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Update Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="preparing">Preparing</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
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
            </div>
          ) : (
            <p className="text-sm text-gray-500">No items in this order</p>
          )}
        </div>

        {/* Total Section */}
        <div className="flex justify-end border-t pt-4">
          <div className="text-right">
            <p className="text-lg font-bold text-gray-900">
              Total: ${parseFloat(order.total_amount).toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );

  useEffect(() => {
    const socket = new WebSocket("ws://127.0.0.1:8000/ws/orders/");
    socket.onmessage = (event) => {
      const newOrder = JSON.parse(event.data);
      queryClient.setQueryData("orders", (oldData) => [newOrder, ...oldData]);
    };
    setSocket(socket);
    return () => {
      socket.close();
    };
  }, [queryClient]);

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Order Management</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
            </div>
          ) : (
            <div className="space-y-6">
              <Tabs
                defaultValue="all"
                className="w-full"
                onValueChange={setActiveTab}
              >
                <TabsList className="grid grid-cols-4 lg:grid-cols-8 gap-2">
                  {Object.entries(ordersByStatus).map(
                    ([status, statusOrders]) => (
                      <TabsTrigger
                        key={status}
                        value={status}
                        className="text-sm font-medium hover:bg-gray-200 rounded-lg transition-all"
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1)} (
                        {statusOrders.length})
                      </TabsTrigger>
                    )
                  )}
                </TabsList>

                {Object.entries(ordersByStatus).map(
                  ([status, statusOrders]) => (
                    <TabsContent key={status} value={status}>
                      <div className="grid gap-4">
                        {statusOrders.length > 0 ? (
                          statusOrders.map((order) => (
                            <OrderCard key={order.id} order={order} />
                          ))
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            No {status !== "all" ? status : ""} orders found
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  )
                )}
              </Tabs>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OrderManagement;

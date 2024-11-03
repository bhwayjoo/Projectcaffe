import React from "react";
import { useQuery, useMutation, useQueryClient } from "react-query";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Loader2 } from "lucide-react";
import { api } from "../api/customAcios"; // import Axios instance

const OrderManagement = () => {
  const queryClient = useQueryClient();

  // Use Axios instance for fetching orders
  const { data: orders, isLoading } = useQuery("orders", async () => {
    const response = await api.get("/orders/");
    return response.data;
  });

  // Update order status using Axios
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

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Order Management</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="grid gap-4">
              {orders?.map((order) => (
                <Card key={order.id} className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold">Order #{order.id}</h3>
                      <p className="text-sm text-gray-600">
                        Table: {order.table}
                      </p>
                      <p className="text-sm">Total: ${order.total_amount}</p>
                      <div className="mt-2">
                        {order.items?.map((item) => (
                          <p key={item.id} className="text-sm">
                            {item.quantity}x {item.menu_item.name}
                          </p>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${getStatusColor(
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
                        <SelectTrigger>
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
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OrderManagement;

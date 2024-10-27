import React, { useState, useEffect } from "react";
import axios from "axios";

function Dashboard() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    axios
      .get("/api/orders/")
      .then((response) => setOrders(response.data))
      .catch((error) => console.error(error));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
      <div className="space-y-4">
        {orders.map((order) => (
          <div key={order.id} className="p-4 bg-white shadow-md rounded">
            <h2 className="font-semibold">Order #{order.id}</h2>
            <p>Status: {order.status}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;

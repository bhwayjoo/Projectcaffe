import React from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Utensils, ClipboardList, Package } from "lucide-react";
import MenuManagement from "../components/MenuManagement";
import OrderManagement from "../components/OrderManagement";
import Inventory from "../components/Inventory";

const AdminPage = () => {
  const location = useLocation();

  const navigationItems = [
    {
      path: "/admin/menu-management",
      label: "Menu Management",
      icon: <Utensils className="h-4 w-4 mr-2" />,
    },
    {
      path: "/admin/orders",
      label: "Orders",
      icon: <ClipboardList className="h-4 w-4 mr-2" />,
    },
    {
      path: "/admin/inventory",
      label: "Inventory",
      icon: <Package className="h-4 w-4 mr-2" />,
    },
  ];

  const isActivePath = (path) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 min-h-screen bg-white shadow-md">
          <div className="p-4">
            <h1 className="text-xl font-bold mb-6">Admin Panel</h1>
            <nav className="space-y-2">
              {navigationItems.map((item) => (
                <Link key={item.path} to={item.path}>
                  <Button
                    variant={isActivePath(item.path) ? "default" : "ghost"}
                    className="w-full justify-start"
                  >
                    {item.icon}
                    {item.label}
                  </Button>
                </Link>
              ))}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <Card>
          <CardContent className="p-6">
            <Routes>
              <Route path="/menu-management" element={<MenuManagement />} />
              <Route path="/orders" element={<OrderManagement />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route
                path="/"
                element={
                  <div className="text-center py-12">
                    <h2 className="text-2xl font-bold mb-4">
                      Welcome to the Admin Panel
                    </h2>
                    <p className="text-gray-600">
                      Select a section from the sidebar to get started
                    </p>
                  </div>
                }
              />
            </Routes>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminPage;

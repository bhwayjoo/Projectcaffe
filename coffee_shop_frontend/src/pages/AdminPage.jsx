import React from "react";
import { Routes, Route, Link, useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Utensils, ClipboardList, Package, LogOut, BarChart2, MessageSquare } from "lucide-react";
import MenuManagement from "../components/MenuManagement";
import OrderManagement from "../components/OrderManagement";
import Inventory from "../components/Inventory";
import Reviews from "../components/Reviews";
import SalesAnalytics from "../components/SalesAnalytics";
import toast from "react-hot-toast";

const AdminPage = () => {
  const location = useLocation();
  const navigate = useNavigate();

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
    {
      path: "/admin/analytics",
      label: "Analytics",
      icon: <BarChart2 className="h-4 w-4 mr-2" />,
    },
    {
      path: "/admin/reviews",
      label: "Reviews",
      icon: <MessageSquare className="h-4 w-4 mr-2" />,
    },
  ];

  const isActivePath = (path) => location.pathname === path;

  const handleLogout = () => {
    try {
      localStorage.removeItem('token');
      navigate('/login');
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Error during logout');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 min-h-screen bg-white shadow-lg sticky top-0 hidden lg:block">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold mb-8 text-green-600">Coffee Shop Admin</h1>
              <Button
                variant="outline"
                onClick={handleLogout}
                className="flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
            <nav className="space-y-3">
              {navigationItems.map((item) => (
                <Link key={item.path} to={item.path}>
                  <Button
                    variant={isActivePath(item.path) ? "default" : "ghost"}
                    className={`w-full justify-start transition-colors duration-200 ${
                      isActivePath(item.path)
                        ? "bg-green-500 text-white hover:bg-green-600"
                        : "hover:bg-gray-100"
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </Button>
                </Link>
              ))}
            </nav>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white shadow-lg z-50">
          <div className="flex justify-around p-4">
            {navigationItems.map((item) => (
              <Link key={item.path} to={item.path}>
                <Button
                  variant={isActivePath(item.path) ? "default" : "ghost"}
                  className={`flex flex-col items-center p-2 ${
                    isActivePath(item.path)
                      ? "text-green-500"
                      : "text-gray-500"
                  }`}
                >
                  {item.icon}
                  <span className="text-xs mt-1">{item.label}</span>
                </Button>
              </Link>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8">
          <Routes>
            <Route path="/menu-management" element={<MenuManagement />} />
            <Route path="/orders" element={<OrderManagement />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/analytics" element={<SalesAnalytics />} />
            <Route path="/reviews" element={<Reviews />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;

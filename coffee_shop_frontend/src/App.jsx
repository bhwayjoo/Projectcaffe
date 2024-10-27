import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "react-query";
import { Toaster } from "react-hot-toast";
import { MenuList } from "./components/MenuList";
import { Cart } from "./components/Cart";

const queryClient = new QueryClient();

const App = () => {
  const [cartItems, setCartItems] = useState([]);

  const handleAddToCart = (item) => {
    setCartItems((prev) => {
      const existingItem = prev.find((i) => i.item.id === item.id);
      if (existingItem) {
        return prev.map((i) =>
          i.item.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { item, quantity: 1 }];
    });
  };

  const handleUpdateQuantity = (item, quantity) => {
    if (quantity <= 0) {
      handleRemoveItem(item);
      return;
    }
    setCartItems((prev) =>
      prev.map((i) => (i.item.id === item.id ? { ...i, quantity } : i))
    );
  };

  const handleRemoveItem = (item) => {
    setCartItems((prev) => prev.filter((i) => i.item.id !== item.id));
  };

  const handleCheckout = () => {
    // Implement checkout logic
    console.log("Checkout:", cartItems);
  };
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gray-100">
        <header className="bg-white shadow-md">
          <div className="container mx-auto px-4 py-6">
            <h1 className="text-2xl font-bold">Coffee Shop</h1>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <MenuList onAddToCart={handleAddToCart} />
            </div>
            <div className="lg:col-span-1">
              <Cart
                items={cartItems}
                onUpdateQuantity={handleUpdateQuantity}
                onRemoveItem={handleRemoveItem}
                onCheckout={handleCheckout}
              />
            </div>
          </div>
        </main>
      </div>
      <Toaster position="bottom-right" />
    </QueryClientProvider>
  );
};

export default App;

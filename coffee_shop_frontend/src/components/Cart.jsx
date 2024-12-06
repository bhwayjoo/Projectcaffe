import React, { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";

export const Cart = ({ items, onUpdateQuantity, onRemoveItem, onCheckout }) => {
  const [lastOrderId, setLastOrderId] = useState(null);
  const [showTrackingLink, setShowTrackingLink] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const total = items.reduce(
    (sum, { item, quantity }) =>
      sum + (Number(item.price) || 0) * (Number(quantity) || 1),
    0
  );

  const handleCheckout = async () => {
    if (isCheckingOut) return;
    setIsCheckingOut(true);
    try {
      const orderId = await onCheckout();
      if (orderId) {
        setLastOrderId(orderId);
        setShowTrackingLink(true);
        // Clear cart items handled by parent component
      } else {
        toast.error("Failed to create order. Please try again.");
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error("An error occurred during checkout. Please try again.");
    } finally {
      setIsCheckingOut(false);
    }
  };

  const TrackingLink = () => (
    <div className="mt-4 p-4 bg-green-100 rounded-lg">
      <p className="text-green-800 mb-2">Order placed successfully!</p>
      <Link
        to={`/track-order/${lastOrderId}`}
        className="text-blue-600 hover:text-blue-800 underline"
      >
        Track your order here
      </Link>
    </div>
  );

  return (
    <div
      className="bg-white rounded-lg shadow-md p-6"
      style={{ backgroundColor: "#ffffff", color: "#000000" }}
    >
      <h2 className="text-xl font-bold mb-4">Your Cart</h2>
      {items.length === 0 ? (
        <>
          <p>Your cart is empty</p>
          {showTrackingLink && lastOrderId && <TrackingLink />}
        </>
      ) : (
        <>
          {items.map(({ item, quantity }) => (
            <div
              key={item.id}
              className="flex justify-between items-center py-2 border-b"
              style={{ borderBottomColor: "#93C572" }}
            >
              <div>
                <h3 className="font-semibold">{item.name}</h3>
                <p className="text-sm text-gray-600">${item.price}</p>
              </div>
              <div className="flex items-center">
                <button
                  onClick={() => onUpdateQuantity(item, Math.max(0, quantity - 1))}
                  className="px-2 py-1 bg-gray-200 rounded-l"
                >
                  -
                </button>
                <span className="px-4 py-1 bg-gray-100">{quantity}</span>
                <button
                  onClick={() => onUpdateQuantity(item, quantity + 1)}
                  className="px-2 py-1 bg-gray-200 rounded-r"
                >
                  +
                </button>
                <button
                  onClick={() => onRemoveItem(item)}
                  className="ml-4 text-red-600"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          <div className="mt-4">
            <div className="flex justify-between mb-4">
              <span className="font-semibold">Total:</span>
              <span className="font-bold">${total.toFixed(2)}</span>
            </div>
            <button
              onClick={handleCheckout}
              disabled={isCheckingOut}
              className={`w-full py-2 px-4 rounded ${
                isCheckingOut
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-green-600 hover:bg-green-700"
              } text-white font-semibold`}
            >
              {isCheckingOut ? "Processing..." : "Checkout"}
            </button>
          </div>
          {showTrackingLink && lastOrderId && <TrackingLink />}
        </>
      )}
    </div>
  );
};

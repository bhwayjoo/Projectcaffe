import React from "react";

export const Cart = ({ items, onUpdateQuantity, onRemoveItem, onCheckout }) => {
  const total = items.reduce(
    (sum, { item, quantity }) =>
      sum + (Number(item.price) || 0) * (Number(quantity) || 1),
    0
  );

  return (
    <div
      className="bg-white rounded-lg shadow-md p-6"
      style={{ backgroundColor: "#ffffff", color: "#000000" }}
    >
      <h2 className="text-xl font-bold mb-4">Your Cart</h2>
      {items.length === 0 ? (
        <p>Your cart is empty</p>
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
                <p style={{ color: "#93C572" }}>
                  ${(Number(item.price) || 0).toFixed(2)}
                </p>
              </div>
              <div className="flex items-center">
                <button
                  onClick={() => onUpdateQuantity(item, quantity - 1)}
                  className="px-2 py-1 rounded-l"
                  style={{ backgroundColor: "#93C572", color: "#000000" }}
                >
                  -
                </button>
                <span
                  className="px-4 py-1"
                  style={{ backgroundColor: "#ffffff", color: "#000000" }}
                >
                  {quantity}
                </span>
                <button
                  onClick={() => onUpdateQuantity(item, quantity + 1)}
                  className="px-2 py-1 rounded-r"
                  style={{ backgroundColor: "#93C572", color: "#000000" }}
                >
                  +
                </button>
                <button
                  onClick={() => onRemoveItem(item)}
                  className="ml-2"
                  style={{ color: "#93C572" }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          <div className="mt-4">
            <div className="flex justify-between font-bold">
              <span>Total:</span>
              <span>${total.toFixed(2)}</span>
            </div>
            <button
              onClick={onCheckout}
              className="w-full mt-4 py-2 rounded-md"
              style={{ backgroundColor: "#93C572", color: "#000000" }}
            >
              Checkout
            </button>
          </div>
        </>
      )}
    </div>
  );
};

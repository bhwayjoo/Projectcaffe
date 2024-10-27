import React from "react";

export const MenuItemCard = ({ item, onAddToCart }) => (
  <div
    className="rounded-lg shadow-md overflow-hidden"
    style={{ backgroundColor: "#ffffff", color: "#000000" }}
  >
    {item.image && (
      <img
        src={item.image}
        alt={item.name}
        className="w-full h-48 object-cover"
      />
    )}
    <div className="p-4">
      <h3 className="text-lg font-semibold">{item.name}</h3>
      <p className="text-sm mt-1">{item.description}</p>
      <div className="mt-4 flex justify-between items-center">
        <span className="text-lg font-bold">
          ${(Number(item.price) || 0).toFixed(2)}
        </span>
        <button
          onClick={() => onAddToCart(item)}
          className="px-4 py-2 rounded-md"
          style={{ backgroundColor: "#93C572", color: "#000000" }}
        >
          Add to Cart
        </button>
      </div>
    </div>
  </div>
);

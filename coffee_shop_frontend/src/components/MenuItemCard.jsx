import React from "react";

export const MenuItemCard = ({ item, onAddToCart }) => (
  <div
    className="rounded-lg shadow-lg overflow-hidden transform transition-all duration-300 hover:scale-105 bg-white"
  >
    {item.image && (
      <div className="relative h-48 overflow-hidden">
        <img
          src={item.image}
          alt={item.name}
          className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
        />
        {!item.is_available && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <span className="text-white font-semibold px-3 py-1 bg-red-500 rounded">
              Out of Stock
            </span>
          </div>
        )}
      </div>
    )}
    <div className="p-4">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-lg font-semibold text-gray-800">{item.name}</h3>
        <span className="text-lg font-bold text-green-600">
          ${(Number(item.price) || 0).toFixed(2)}
        </span>
      </div>
      <p className="text-sm text-gray-600 mb-4">{item.description}</p>
      <button
        onClick={() => onAddToCart(item)}
        disabled={!item.is_available}
        className={`w-full px-4 py-2 rounded-md transition-colors duration-300 ${
          item.is_available
            ? "bg-green-500 hover:bg-green-600 text-white"
            : "bg-gray-300 cursor-not-allowed text-gray-600"
        }`}
      >
        {item.is_available ? "Add to Cart" : "Out of Stock"}
      </button>
    </div>
  </div>
);

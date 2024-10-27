import React from "react";
import { useQuery } from "react-query";
import { MenuItemCard } from "./MenuItemCard";
import { getMenuItems } from "../api/customAcios";

export const MenuList = ({ onAddToCart }) => {
  const {
    data: menuItems,
    isLoading,
    error,
  } = useQuery("menuItems", getMenuItems);

  if (isLoading) return <div style={{ color: "#93C572" }}>Loading...</div>;
  if (error)
    return <div style={{ color: "#93C572" }}>Error loading menu items</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
      {menuItems.map((item) => (
        <MenuItemCard key={item.id} item={item} onAddToCart={onAddToCart} />
      ))}
    </div>
  );
};

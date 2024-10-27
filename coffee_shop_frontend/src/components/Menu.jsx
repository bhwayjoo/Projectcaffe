import React, { useState, useEffect } from "react";
import customAxios from "../api/customAxios";

function Menu() {
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMenuItems = async () => {
      try {
        const response = await customAxios.get("/api/menu-items/");
        setMenuItems(response.data);
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };
    fetchMenuItems();
  }, []);

  if (loading) return <div className="text-center">Loading menu items...</div>;
  if (error)
    return <div className="text-red-500 text-center">Error: {error}</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Menu</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {menuItems.map((item) => (
          <div key={item.id} className="p-4 bg-white shadow-md rounded">
            <h2 className="text-lg font-semibold">{item.name}</h2>
            <p>{item.description}</p>
            {item.image && (
              <img
                src={item.image}
                alt={item.name}
                className="h-32 w-full object-cover rounded mb-2"
              />
            )}
            <p className="font-bold text-lg">Price: ${item.price}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Menu;

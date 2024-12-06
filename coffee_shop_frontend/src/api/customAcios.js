import axios from "axios";

// Base API configuration
export const api = axios.create({
  baseURL: "http://127.0.0.1:8000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Add a request interceptor to include the token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add a response interceptor for handling errors like 401 (unauthorized)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Optional: Handle token expiration (e.g., clear token and redirect)
      localStorage.removeItem("access");
      window.location.href = "/login"; // Redirect to login page
    }
    return Promise.reject(error);
  }
);

// Helper function to create FormData from an object
const createFormData = (data) => {
  const formData = new FormData();
  Object.keys(data).forEach((key) => {
    if (data[key] !== null && data[key] !== undefined) {
      formData.append(key, data[key]);
    }
  });
  return formData;
};

// Authentication API
export const loginAdmin = async (credentials) => {
  try {
    const response = await api.post("/login/", credentials);
    return response.data;
  } catch (error) {
    console.error("Error during login:", error);
    throw error;
  }
};

// Menu Items API
export const getMenuItems = async (page = 1, pageSize = 10) => {
  try {
    const response = await api.get("/menu-items/", {
      params: { page, pageSize },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching menu items:", error);
    throw error;
  }
};

export const createMenuItem = async (menuItemData) => {
  try {
    const formData = createFormData(menuItemData);
    const response = await api.post("/menu-items/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  } catch (error) {
    console.error("Error creating menu item:", error);
    throw error;
  }
};

export const updateMenuItem = async (itemId, updatedData) => {
  try {
    const formData = createFormData(updatedData);
    const response = await api.patch(`/menu-items/${itemId}/`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  } catch (error) {
    console.error("Error updating menu item:", error);
    throw error;
  }
};

export const deleteMenuItem = async (itemId) => {
  try {
    const response = await api.delete(`/menu-items/${itemId}/`);
    return response.data;
  } catch (error) {
    console.error("Error deleting menu item:", error);
    throw error;
  }
};

// Categories API
export const getCategories = async () => {
  try {
    const response = await api.get("/categories/");
    return response.data;
  } catch (error) {
    console.error("Error fetching categories:", error);
    throw error;
  }
};

// Orders API
export const createOrder = async (orderData) => {
  try {
    console.log('Sending order data:', orderData); // Debug log
    const response = await api.post("/orders/", orderData);
    console.log('Server response:', response); // Debug log
    return response;
  } catch (error) {
    console.error("Error creating order:", error.response || error);
    throw error;
  }
};

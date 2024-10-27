import axios from "axios";

const API_URL = "http://192.168.11.117:8000/api";

export const api = axios.create({
  baseURL: API_URL,
});

export const getMenuItems = async () => {
  const response = await api.get("/menu-items/");
  return response.data;
};

export const getCategories = async () => {
  const response = await api.get("/categories/");
  return response.data;
};

export const createOrder = async (orderData) => {
  const response = await api.post("/orders/", orderData);
  return response.data;
};

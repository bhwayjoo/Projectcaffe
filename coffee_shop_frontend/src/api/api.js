// api.js
import axios from "axios";

export const api = axios.create({
  baseURL: "192.168.137.1:8000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

export const fetchMenuItems = () =>
  api.get("/menuitems").then((res) => res.data);
export const placeOrder = (order) =>
  api.post("/orders", order).then((res) => res.data);

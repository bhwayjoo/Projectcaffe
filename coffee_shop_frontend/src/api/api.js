// api.js
import axios from "axios";

export const api = axios.create({
  baseURL: "https://projectcaffe.onrender.com/api",
  headers: {
    "Content-Type": "application/json",
  },
});

export const fetchMenuItems = () =>
  api.get("/menuitems").then((res) => res.data);
export const placeOrder = (order) =>
  api.post("/orders", order).then((res) => res.data);

export const formatPrice = (price) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);
};

export const generateOrderSummary = (items) => {
  const total = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  return {
    items: items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      subtotal: item.price * item.quantity,
    })),
    total,
  };
};

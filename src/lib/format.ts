/** ₹ formatting with Indian digit grouping, e.g. ₹1,84,500. */
export const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

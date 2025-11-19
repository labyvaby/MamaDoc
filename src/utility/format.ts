export const formatKGS = (value: number | string | null | undefined): string => {
  const num = Number(value ?? 0);
  // Use Russian locale with KGS currency, no fractional part typically displayed
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "KGS",
    maximumFractionDigits: 0,
  }).format(num);
};

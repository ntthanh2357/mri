export const formatDate = (date: Date | string): string => {
  return new Date(date).toLocaleDateString('vi-VN');
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

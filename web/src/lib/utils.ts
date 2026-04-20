export const formatCurrency = (val: number | string | null | undefined) => {
  if (!val && val !== 0) return 'R -';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num as number)) return 'R -';
  return `R${(num as number).toLocaleString('en-ZA')}`;
};

export const formatCurrency = (val: number | string | null | undefined) => {
  if (!val && val !== 0) return 'R -';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num as number)) return 'R -';
  return `R${(num as number).toLocaleString('en-ZA')}`;
};

export const formatListingDate = (dateVal?: string | number | null): string => {
  if (!dateVal) return 'Recent';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return String(dateVal);
  }
};


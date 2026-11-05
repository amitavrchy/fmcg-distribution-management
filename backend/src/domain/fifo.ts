export function fifo(
  amount: number,
  invoices: { id: string; totalMinor: number; paidMinor: number }[],
) {
  let remaining = amount;
  const allocations: { invoiceId: string; amountMinor: number }[] = [];
  for (const invoice of invoices) {
    const value = Math.min(remaining, invoice.totalMinor - invoice.paidMinor);
    if (value > 0) {
      allocations.push({ invoiceId: invoice.id, amountMinor: value });
      remaining -= value;
    }
  }
  return { allocations, remaining };
}

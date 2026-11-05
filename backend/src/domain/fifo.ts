export function fifo(
  amount: number,
  invoices: {
    id: string;
    totalMinor: number;
    paidMinor: number;
    creditedMinor?: number;
  }[],
) {
  let remaining = amount;
  const allocations: { invoiceId: string; amountMinor: number }[] = [];
  for (const invoice of invoices) {
    const value = Math.min(
      remaining,
      invoice.totalMinor - invoice.paidMinor - (invoice.creditedMinor || 0),
    );
    if (value > 0) {
      allocations.push({ invoiceId: invoice.id, amountMinor: value });
      remaining -= value;
    }
  }
  return { allocations, remaining };
}

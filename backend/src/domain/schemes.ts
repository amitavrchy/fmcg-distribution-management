export type CartLine = { skuId: string; qty: number; unitPriceMinor: number };
export type SchemeRule = { type: 'PERCENT' | 'AMOUNT' | 'FREE' | 'COMBO'; value?: number; minMinor?: number; skuId?: string; buyQty?: number; freeQty?: number; requires?: string[] };
export type Promotion = { id: string; name: string; priority: number; startsOn: Date; endsOn: Date; active: boolean; rules: unknown };
export function preview(cart: CartLine[], schemes: Promotion[], orderedAt: Date) {
  const goodsMinor = cart.reduce((sum, line) => sum + line.qty * line.unitPriceMinor, 0);
  let discountMinor = 0;
  const free: Record<string, number> = {};
  const applied: string[] = [];
  for (const scheme of [...schemes].sort((a,b) => a.priority-b.priority || a.id.localeCompare(b.id))) {
    if (!scheme.active || orderedAt < scheme.startsOn || orderedAt > scheme.endsOn) continue;
    const r = scheme.rules as SchemeRule;
    if (goodsMinor < (r.minMinor || 0)) continue;
    let appliedRule = false;
    if (r.type === 'PERCENT') { discountMinor += Math.floor((goodsMinor-discountMinor) * Math.min(100, r.value || 0) / 100); appliedRule = true; }
    if (r.type === 'AMOUNT') { discountMinor += Math.min(goodsMinor-discountMinor, r.value || 0); appliedRule = true; }
    if (r.type === 'FREE' && r.skuId && r.buyQty) {
      const qty = cart.find(l => l.skuId === r.skuId)?.qty || 0;
      const bonus = Math.floor(qty / r.buyQty) * (r.freeQty || 0);
      if (bonus) { free[r.skuId] = (free[r.skuId] || 0) + bonus; appliedRule = true; }
    }
    if (r.type === 'COMBO' && r.requires?.every(id => cart.some(l => l.skuId === id))) { discountMinor += Math.min(goodsMinor-discountMinor,r.value || 0); appliedRule = true; }
    if (appliedRule) applied.push(scheme.name);
  }
  return { goodsMinor, discountMinor, totalMinor: goodsMinor-discountMinor, free, applied };
}

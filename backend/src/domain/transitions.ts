export const transitions: Record<string, string[]> = {
  SUBMITTED: ["CONFIRMED", "CANCELLED"],
  PENDING_APPROVAL: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["ALLOCATED", "CANCELLED"],
  ALLOCATED: ["DISPATCHED", "CANCELLED"],
  DISPATCHED: ["DELIVERED"],
};
export function canTransition(from: string, to: string) {
  return !!transitions[from]?.includes(to);
}

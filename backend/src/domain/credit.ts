export function exceedsCredit(limit: number, outstanding: number, reserved: number, proposed: number) { return outstanding + reserved + proposed > limit; }

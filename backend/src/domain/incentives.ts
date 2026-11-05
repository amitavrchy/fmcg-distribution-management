export function calculateIncentive(
  salesMinor: number,
  targetMinor: number,
  productive: number,
  focusMinor = 0,
) {
  const achievementBps = targetMinor
    ? Math.floor((salesMinor * 10000) / targetMinor)
    : 0;
  const rateBps =
    achievementBps >= 12000
      ? 250
      : achievementBps >= 10000
        ? 200
        : achievementBps >= 8000
          ? 100
          : 0;
  const salesBonus = Math.floor((salesMinor * rateBps) / 10000);
  const productiveCallBonus = productive * 500;
  const focusBonus = Math.floor(focusMinor / 100);
  return {
    achievementBps,
    incentiveMinor: salesBonus + productiveCallBonus + focusBonus,
    breakdown: { rateBps, salesBonus, productiveCallBonus, focusBonus },
  };
}

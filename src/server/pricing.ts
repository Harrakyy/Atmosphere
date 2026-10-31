export interface PricingSettings {
  markupBps?: number;
  roundingUnit?: number;
}

// R-P1: onlinePrice(base) = ceilDiv(base × (10000 + markupBps), 10000 × roundingUnit) × roundingUnit
export function onlinePrice(
  base: number,
  settings: { markupBps?: number; roundingUnit?: number } = {}
): number {
  const markupBps = settings.markupBps ?? 0;
  const roundingUnit = settings.roundingUnit ?? 500;

  const numerator = base * (10000 + markupBps);
  const denominator = 10000 * roundingUnit;
  // integer ceil division
  const ceilDiv = Math.floor((numerator + denominator - 1) / denominator);
  return ceilDiv * roundingUnit;
}


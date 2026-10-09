export interface PricingSettings {
  markupBps?: number;
  roundingUnit?: number;
  vaMinTotal?: number;
}

// R-P1: onlinePrice(base) = ceilDiv(base × (10000 + markupBps), 10000 × roundingUnit) × roundingUnit
export function onlinePrice(
  base: number,
  settings: { markupBps?: number; roundingUnit?: number } = {}
): number {
  const markupBps = settings.markupBps ?? 300;
  const roundingUnit = settings.roundingUnit ?? 500;

  const numerator = base * (10000 + markupBps);
  const denominator = 10000 * roundingUnit;
  // integer ceil division
  const ceilDiv = Math.floor((numerator + denominator - 1) / denominator);
  return ceilDiv * roundingUnit;
}

// R-P4: enabledPayments
export function enabledPayments(
  total: number,
  settings: { vaMinTotal?: number } = {}
): string[] {
  const base = ["other_qris", "gopay", "shopeepay"];
  const vaMinTotal = settings.vaMinTotal ?? 150000;

  if (total >= vaMinTotal) {
    return [
      ...base,
      "bca_va",
      "bni_va",
      "bri_va",
      "permata_va",
      "cimb_va",
      "echannel",
    ];
  }
  return base;
}

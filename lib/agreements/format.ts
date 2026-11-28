// Price labels for agreements ("$146/month", "$65/visit"). Pure, unit tested in format.test.ts.

/** Whole dollars without cents ("$1,170"), otherwise two decimals ("$65.50"). */
export function formatMoney(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export type PricedAgreement = {
  billing_type: string;
  monthly_price: number | null;
  /** On-call agreements only. */
  price_per_visit: number | null;
  /** Prices of the schedule parts. */
  partPrices: readonly number[];
};

/** "$146/month", "$65/visit", "$60–$80/visit" (parts priced differently) or "$65/visit, on call". */
export function agreementPriceLabel(a: PricedAgreement): string {
  if (a.billing_type === "flat_monthly") {
    return a.monthly_price === null ? "No price yet" : `${formatMoney(Number(a.monthly_price))}/month`;
  }
  if (a.partPrices.length === 0) {
    return a.price_per_visit === null
      ? "No price yet"
      : `${formatMoney(Number(a.price_per_visit))}/visit, on call`;
  }
  const prices = a.partPrices.map(Number);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max
    ? `${formatMoney(min)}/visit`
    : `${formatMoney(min)}–${formatMoney(max)}/visit`;
}

/**
 * The clients list cell: one agreement shows just its price; several are each
 * prefixed with their service type ("Lawn care $146/month · Leaf cleanup $65/visit").
 */
export function agreementsSummary(agreements: readonly { typeName: string; label: string }[]): string {
  if (agreements.length === 1) return agreements[0].label;
  return agreements.map((a) => `${a.typeName} ${a.label}`).join(" · ");
}

type Dated = { typeId: string; start_date: string; end_date: string };

/**
 * For the clients list: one agreement per service type, so this year's agreement and
 * its activated renewal don't both show. Per type: the one running today; if none,
 * the next to start; if none, the one that ended last. Keeps the input order.
 */
export function currentPerType<T extends Dated>(agreements: readonly T[], today: string): T[] {
  const rank = (a: T) =>
    a.start_date <= today && today <= a.end_date ? 0 : a.start_date > today ? 1 : 2;
  const better = (a: T, b: T) => {
    if (rank(a) !== rank(b)) return rank(a) < rank(b);
    if (rank(a) === 0) return a.start_date > b.start_date; // latest start among running
    if (rank(a) === 1) return a.start_date < b.start_date; // soonest upcoming
    return a.end_date > b.end_date; // most recently ended
  };
  const best = new Map<string, T>();
  for (const a of agreements) {
    const current = best.get(a.typeId);
    if (!current || better(a, current)) best.set(a.typeId, a);
  }
  const chosen = new Set(best.values());
  return agreements.filter((a) => chosen.has(a));
}

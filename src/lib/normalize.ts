const ALIASES: Record<string, string> = {
  MCD: "McDonald's",
  "MCDONALD'S": "McDonald's",
  MCDONALDS: "McDonald's",
};

export function normalizeMerchant(name?: string | null) {
  if (!name) return null;
  const trimmed = name.trim();
  const key = trimmed.toUpperCase();
  return ALIASES[key] ?? trimmed;
}

export function normalizeCurrency(cur?: string | null) {
  return cur?.toUpperCase?.() || 'USD';
}


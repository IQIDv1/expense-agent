export const CATEGORY_MAP: Record<string, string[]> = {
  meals: ['restaurant', 'mcdonald', 'burger', 'grill', 'cafe', 'food'],
  lodging: ['hotel', 'inn', 'motel', 'marriott', 'hilton', 'airbnb'],
  transport: ['uber', 'lyft', 'taxi', 'metro', 'bus', 'train', 'delta', 'united'],
};

export function guessCategory(merchant: string): string | undefined {
  const lower = merchant.toLowerCase();
  for (const [category, tokens] of Object.entries(CATEGORY_MAP)) {
    if (tokens.some((token) => lower.includes(token))) {
      return category;
    }
  }
  return undefined;
}


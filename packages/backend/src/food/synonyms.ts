/**
 * Words that mean the same food, so a search in one spelling or dialect
 * finds foods named in another: a UK "courgette" finds USDA's "zucchini",
 * and "yoghurt" finds "yogurt". Single words only, all as searchKey()
 * writes them (lowercase, no accents), and only pairs that are never
 * ambiguous (no "chips", "biscuit" or "jelly", which mean different foods
 * in the UK and the US).
 */
const GROUPS: readonly string[][] = [
  ['yoghurt', 'yogurt', 'yoghourt'],
  ['courgette', 'zucchini'],
  ['aubergine', 'eggplant', 'brinjal'],
  ['coriander', 'cilantro'],
  ['rocket', 'arugula'],
  ['prawn', 'shrimp'],
  ['porridge', 'oatmeal'],
  ['beetroot', 'beet'],
  ['swede', 'rutabaga'],
  ['chickpea', 'garbanzo'],
  ['cornflour', 'cornstarch'],
  ['coley', 'pollock', 'pollack'],
  ['mandarin', 'tangerine'],
];

const BY_WORD = new Map<string, string[]>();
for (const group of GROUPS) {
  for (const word of group) {
    BY_WORD.set(
      word,
      group.filter((w) => w !== word),
    );
  }
}

/** The other words for the same food, or none. */
export function synonymsOf(word: string): string[] {
  return BY_WORD.get(word) ?? [];
}

// Real Open Food Facts products (© Open Food Facts contributors, ODbL),
// trimmed to the fields GRIT reads
import offFixtures from './__fixtures__/off-products.json';
import {
  barcodeCandidates,
  checkDigitOk,
  expandUpcE,
  normaliseBarcode,
  searchKey,
  searchTextOf,
} from './food-text';
import { cleanRecord, foodIdOf, rankOf, type FoodRecord } from './food-record';
import {
  offCountries,
  offNutrients,
  offRecord,
  servingLabel,
} from './off-product';
import { queryWords, wordForms } from './food-db.service';

describe('search text', () => {
  it('drops case, accents and punctuation', () => {
    expect(searchKey('Crème Fraîche, 30% fat')).toBe('creme fraiche 30 fat');
    expect(searchKey('Straße  Müsli')).toBe('strasse musli');
    expect(searchKey('  ')).toBe('');
  });

  it('joins name, brand and other names once each', () => {
    expect(
      searchTextOf('Eggplant, raw', 'Acme', ['Aubergine', 'eggplant raw']),
    ).toBe('eggplant raw acme aubergine');
  });

  it('searches other words for the same food', () => {
    expect(wordForms('yoghurt')).toEqual(['yoghurt', 'yogurt', 'yoghourt']);
    expect(wordForms('zucchini')).toEqual(['zucchini', 'courgette']);
    // Plurals are stemmed first, so "prawns" finds shrimp too
    expect(queryWords('prawns').flatMap(wordForms)).toEqual([
      'prawn',
      'shrimp',
    ]);
    expect(wordForms('apple')).toEqual(['apple']);
  });

  it('matches plurals by a stem the singular also has', () => {
    expect(queryWords('eggs')).toEqual(['egg']);
    expect(queryWords('tomatoes potatoes')).toEqual(['tomato', 'potato']);
    expect(queryWords('berries sandwiches')).toEqual(['berr', 'sandwich']);
    // Short words are left to the ranking
    expect(queryWords('2 oz ham')).toEqual(['ham']);
    expect(queryWords('hummus glass')).toEqual(['hummus', 'glass']);
  });
});

describe('barcodes', () => {
  it('writes every barcode as GTIN-13', () => {
    expect(normaliseBarcode('049000028911')).toBe('0049000028911'); // UPC-A
    expect(normaliseBarcode('0049000028911')).toBe('0049000028911');
    expect(normaliseBarcode('00049000028911')).toBe('0049000028911'); // GTIN-14
    expect(normaliseBarcode('12345670')).toBe('0000012345670'); // EAN-8
    expect(normaliseBarcode('10049000028918')).toBe('10049000028918'); // a case
    expect(normaliseBarcode('1234')).toBeNull();
    expect(normaliseBarcode(null)).toBeNull();
  });

  it('checks check digits', () => {
    expect(checkDigitOk('3017620422003')).toBe(true);
    expect(checkDigitOk('3017620422004')).toBe(false);
    expect(checkDigitOk('031200000644')).toBe(true);
  });

  it('expands UPC-E codes, which US products often carry', () => {
    // Ocean Spray, from USDA's branded data
    expect(expandUpcE('03106424')).toBe('031200000644');
    expect(expandUpcE('04252614')).toBe('042100005264');
    expect(expandUpcE('93106424')).toBeNull(); // number system 0 or 1 only
    // An 8-digit scan is looked up as EAN-8 and as UPC-E
    expect(barcodeCandidates('03106424')).toEqual([
      '0000003106424',
      '0031200000644',
    ]);
    expect(barcodeCandidates('3017620422003')).toEqual(['3017620422003']);
  });
});

const record = (over: Partial<FoodRecord> = {}): FoodRecord => ({
  source: 'fdc',
  externalId: 'ndb:9003',
  fetchedAt: new Date('2019-04-01'),
  name: '  Apples, raw,   with skin ',
  kind: 'generic',
  countries: ['us', 'US', 'world'],
  servings: [
    { label: '1 medium (182 g)', grams: 182, typical: true },
    { label: '1 medium', grams: 180 },
    { label: '1 cup, sliced', grams: 109, typical: true },
    { label: 'bad', grams: 0 },
  ],
  nutrients: { kcal: 52, protein_g: 0.26, carbs_g: 13.81, fat_g: 0.17 },
  basis: 'measured',
  quality: 1,
  verified: true,
  ...over,
});

describe('cleaning records', () => {
  it('tidies names, countries and servings', () => {
    const clean = cleanRecord(record())!;
    expect(clean).toMatchObject({
      id: 'fdc_ndb-9003',
      name: 'Apples, raw, with skin',
      countries: ['us'],
      searchText: 'apples raw with skin',
      rank: 3,
      // Labels lose their weight; duplicates and zero grams are dropped;
      // only one serving stays typical
      servings: [
        { label: '1 medium', grams: 182, typical: true },
        { label: '1 cup, sliced', grams: 109, typical: false },
      ],
    });
  });

  it("drops what can't be right, and keeps what can", () => {
    expect(cleanRecord(record({ name: ' ' }))).toBeNull();
    expect(cleanRecord(record({ nutrients: { protein_g: 3 } }))).toBeNull();
    // More than 100 g of macros in 100 g
    expect(
      cleanRecord(
        record({
          nutrients: { kcal: 400, protein_g: 60, carbs_g: 50, fat_g: 20 },
        }),
      ),
    ).toBeNull();
    const clean = cleanRecord(
      record({
        nutrients: {
          kcal: 52,
          carbs_g: 10,
          sugars_g: 40, // more sugar than carbs
          iron_mg: 2700, // grams read as mg
          calcium_mg: 7364, // baking powder really is this high
        },
      }),
    )!;
    expect(clean.nutrients).toEqual({
      kcal: 52,
      carbs_g: 10,
      calcium_mg: 7364,
    });
  });

  it('ranks government tables over manufacturers over Open Food Facts', () => {
    expect(rankOf('cofid', 'generic')).toBe(3);
    expect(rankOf('fdc', 'branded')).toBe(2);
    expect(rankOf('off', 'branded')).toBe(1);
    expect(foodIdOf('off', '3017620422003')).toBe('off_3017620422003');
  });
});

describe('Open Food Facts products', () => {
  it("converts OFF's grams to GRIT's units", () => {
    // Nutella's label, as OFF stores it
    expect(
      offNutrients({
        'energy-kcal_100g': '540',
        proteins_100g: 6.3,
        sodium_100g: '0.04054',
        iron_100g: '0.0027',
        'vitamin-a_100g': '0.00000031239',
        'vitamin-pp_100g': 0.0025,
        'vitamin-b9_100g': 0.00004,
        calcium_100g: '0.10811',
        caffeine_100g: 0.012,
        alcohol_100g: 12.5,
      }),
    ).toEqual({
      kcal: 540,
      protein_g: 6.3,
      sodium_mg: 40.54,
      iron_mg: 2.7,
      vit_a_ug: expect.closeTo(0.31239, 5) as number,
      b3_mg: 2.5,
      folate_ug: 40,
      calcium_mg: 108.11,
      caffeine_mg: 12,
      alcohol_g: expect.closeTo(9.8625, 4) as number,
    });
  });

  it('falls back to kJ for energy and salt for sodium', () => {
    expect(offNutrients({ 'energy-kj_100g': 418.4, salt_100g: 1 })).toEqual({
      kcal: expect.closeTo(100, 6) as number,
      sodium_mg: 400,
    });
  });

  it("reads OFF's country tags", () => {
    expect(
      offCountries('en:france,en:united-kingdom,en:world,fr:allemagne'),
    ).toEqual(['fr', 'gb']);
    expect(
      offCountries(['en:czech-republic', 'en:hong-kong', 'en:vietnam']),
    ).toEqual(['cz', 'hk', 'vn']);
  });

  it('labels servings without their weight', () => {
    expect(servingLabel('2 tbsp (37 g)')).toBe('2 tbsp');
    expect(servingLabel('1 bar (40g)')).toBe('1 bar');
    expect(servingLabel('37 g')).toBe('1 serving');
    expect(servingLabel(undefined)).toBe('1 serving');
  });

  it('builds a record from a product', () => {
    expect(
      offRecord({
        code: '3017620422003',
        product_name: 'Nutella',
        product_name_fr: 'Nutella pâte à tartiner',
        brands: 'Ferrero, Nutella',
        countries_tags: ['en:france'],
        serving_size: '15 g',
        serving_quantity: '15',
        nutriments: { 'energy-kcal_100g': 539 },
        states_tags: ['en:nutrition-facts-completed'],
        completeness: 0.5,
        unique_scans_n: 900,
        last_modified_t: 1780000000,
      }),
    ).toMatchObject({
      source: 'off',
      externalId: '3017620422003',
      name: 'Nutella',
      brand: 'Ferrero',
      kind: 'branded',
      basis: 'label',
      verified: false,
      countries: ['fr'],
      barcodes: ['3017620422003'],
      names: [{ name: 'Nutella pâte à tartiner', lang: 'fr' }],
      servings: [{ label: '1 serving', grams: 15, typical: true }],
      quality: 0.7,
      fetchedAt: new Date(1780000000 * 1000),
    });
    // Internal shop codes and obsolete products aren't foods to import
    expect(
      offRecord({ code: '2001', product_name: 'Loose apples' }),
    ).toBeNull();
    expect(offRecord({ code: '3017620422003', obsolete: 'on' })).toBeNull();
  });
});

describe('Open Food Facts products, as OFF really sends them', () => {
  const byCode = (code: string, shape?: string) =>
    (offFixtures as Record<string, unknown>[]).find(
      (p) => p.code === code && (!shape || p._shape === shape),
    ) as Record<string, unknown>;

  it('reads both shapes the same way', () => {
    const legacy = offRecord(byCode('3017620422003', 'v2'))!;
    const current = offRecord(byCode('3017620422003', 'v3.6'))!;
    expect(current.nutrients).toEqual(legacy.nutrients);
    expect(current.imageUrl).toBe(
      'https://images.openfoodfacts.org/images/products/301/762/042/2003/front_en.879.200.jpg',
    );
    expect(cleanRecord(current)?.nutrients).toMatchObject({
      kcal: 539,
      sugars_g: 56.3,
      sodium_mg: 42.8,
    });
  });

  it("keeps label values and leaves out OFF's estimates from ingredients", () => {
    // Tuna in tomato sauce: macros from the maker, iron and calcium estimated
    const tuna = cleanRecord(offRecord(byCode('3596710437771'))!)!;
    expect(tuna.nutrients).toMatchObject({ kcal: 147, protein_g: 14 });
    expect(tuna.nutrients.iron_mg).toBeUndefined();
    expect(tuna.nutrients.calcium_mg).toBeUndefined();
    expect(tuna.imageUrl).toBe(
      'https://images.openfoodfacts.org/images/products/359/671/043/7771/front_fr.102.200.jpg',
    );
  });

  it('trusts the printed salt when sodium was entered in the wrong unit', () => {
    const pudding = offRecord(byCode('4000521034436'))!;
    expect(pudding.nutrients.sodium_mg).toBeCloseTo(120); // 0.3 g salt
  });

  it("imports a product whose barcode can't be scanned, without the barcode", () => {
    const record = offRecord(byCode('0474029601099'))!;
    expect(record.barcodes).toEqual([]);
    expect(cleanRecord(record)).not.toBeNull();
  });

  it('skips values for the product as prepared, and turns % vol into grams', () => {
    // Instant noodles with only "as prepared" values: nothing to import
    expect(cleanRecord(offRecord(byCode('4807770273704'))!)).toBeNull();
    // A 4.3% beer
    const beer = offRecord(byCode('5056025475861'))!;
    expect(beer.nutrients.alcohol_g).toBeCloseTo(3.39, 2);
  });
});

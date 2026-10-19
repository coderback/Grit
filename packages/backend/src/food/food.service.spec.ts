import { BadGatewayException, NotFoundException } from '@nestjs/common';
import { AxiosError, AxiosHeaders } from 'axios';
import { FoodService } from './food.service';
import type { PrismaService } from '../prisma/prisma.service';

// Each axios.create() call in food.service gets a client routed by host, so a
// test can make the full-text search and the legacy API behave differently.
type Get = (
  url: string,
  config?: { params?: Record<string, unknown> },
) => Promise<{ data: unknown }>;
const mockSearchGet = jest.fn<ReturnType<Get>, Parameters<Get>>();
const mockOffGet = jest.fn<ReturnType<Get>, Parameters<Get>>();

jest.mock('axios', () => {
  const actual = jest.requireActual<typeof import('axios')>('axios');
  const create = ({ baseURL }: { baseURL: string }) => ({
    get: (...args: Parameters<Get>) =>
      baseURL.includes('search.openfoodfacts.org')
        ? mockSearchGet(...args)
        : mockOffGet(...args),
  });
  return {
    ...actual,
    __esModule: true,
    default: { create, isAxiosError: (e: unknown) => actual.isAxiosError(e) },
  };
});

const paramsOf = (mock: typeof mockSearchGet) => mock.mock.calls[0][1]?.params;

function httpError(status: number) {
  const headers = new AxiosHeaders();
  return new AxiosError('Request failed', String(status), undefined, null, {
    status,
    statusText: '',
    headers,
    config: { headers },
    data: null,
  });
}

const nutella = {
  code: '3017620422003',
  product_name: 'Nutella',
  brands: ['ferrero'],
  nutriments: {
    'energy-kcal_100g': 539,
    proteins_100g: 6.3,
    carbohydrates_100g: 57.5,
    fat_100g: 30.9,
  },
  serving_quantity: 15,
  serving_quantity_unit: 'g',
  image_small_url: 'https://images.openfoodfacts.org/nutella.200.jpg',
};

describe('FoodService', () => {
  let service: FoodService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new FoodService({} as PrismaService);
  });

  describe('searchFoods', () => {
    it('skips the network for queries shorter than two characters', async () => {
      await expect(service.searchFoods(' a ')).resolves.toEqual([]);
      expect(mockSearchGet).not.toHaveBeenCalled();
      expect(mockOffGet).not.toHaveBeenCalled();
    });

    it('searches search-a-licious and normalizes the hits', async () => {
      mockSearchGet.mockResolvedValue({
        data: { hits: [nutella, { code: '123', brands: ['x'] }] },
      });

      const results = await service.searchFoods('nutella');

      expect(mockSearchGet.mock.calls[0][0]).toBe('/search');
      expect(paramsOf(mockSearchGet)).toMatchObject({
        q: 'nutella',
        page_size: 20,
      });
      expect(mockOffGet).not.toHaveBeenCalled();
      // The hit without a name is dropped
      expect(results).toEqual([
        {
          offId: '3017620422003',
          name: 'Nutella',
          brand: 'ferrero',
          barcode: '3017620422003',
          calories: 539,
          proteinG: 6.3,
          carbsG: 57.5,
          fatG: 30.9,
          servingQty: 15,
          servingUnit: 'g',
          imageUrl: 'https://images.openfoodfacts.org/nutella.200.jpg',
        },
      ]);
    });

    it('accepts brands as a string and strips taxonomy language prefixes', async () => {
      mockSearchGet.mockResolvedValue({
        data: {
          hits: [
            { ...nutella, brands: 'Ferrero' },
            { ...nutella, code: '2', brands: ['xx:ben-jerry-s'] },
            { ...nutella, code: '3', brands: [] },
          ],
        },
      });

      const results = await service.searchFoods('nutella');

      expect(results.map((r) => r.brand)).toEqual([
        'Ferrero',
        'ben-jerry-s',
        null,
      ]);
    });

    it('reduces Lucene syntax in the query to plain words', async () => {
      mockSearchGet.mockResolvedValue({ data: { hits: [] } });

      await service.searchFoods('Ben & Jerry\'s: "Cookie" -Dough AND (mint)');

      expect(paramsOf(mockSearchGet)?.q).toBe(
        "ben jerry's cookie dough and mint",
      );
    });

    it('returns no results when nothing searchable is left', async () => {
      await expect(service.searchFoods('%%**')).resolves.toEqual([]);
      expect(mockSearchGet).not.toHaveBeenCalled();
      expect(mockOffGet).not.toHaveBeenCalled();
    });

    it('falls back to the legacy search when search-a-licious fails', async () => {
      mockSearchGet.mockRejectedValue(httpError(503));
      mockOffGet.mockResolvedValue({
        data: { products: [{ ...nutella, id: 'off-1', brands: 'Ferrero' }] },
      });

      const results = await service.searchFoods('nutella');

      expect(mockOffGet.mock.calls[0][0]).toBe('/cgi/search.pl');
      expect(paramsOf(mockOffGet)).toMatchObject({
        search_terms: 'nutella',
        json: 1,
        page_size: 20,
      });
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        offId: 'off-1',
        name: 'Nutella',
        brand: 'Ferrero',
      });
    });

    it('falls back when search-a-licious answers without hits', async () => {
      mockSearchGet.mockResolvedValue({
        data: { errors: [{ title: 'bad query' }] },
      });
      mockOffGet.mockResolvedValue({ data: { products: [] } });

      await expect(service.searchFoods('nutella')).resolves.toEqual([]);
      expect(mockOffGet).toHaveBeenCalled();
    });

    it('returns 502 when both searches fail', async () => {
      mockSearchGet.mockRejectedValue(httpError(503));
      mockOffGet.mockRejectedValue(httpError(503));

      await expect(service.searchFoods('nutella')).rejects.toBeInstanceOf(
        BadGatewayException,
      );
    });

    it('serves repeat searches from the cache, ignoring case', async () => {
      mockSearchGet.mockResolvedValue({ data: { hits: [nutella] } });

      const first = await service.searchFoods('Nutella');
      const second = await service.searchFoods('  nutella ');

      expect(second).toEqual(first);
      expect(mockSearchGet).toHaveBeenCalledTimes(1);
    });

    it('does not cache failures', async () => {
      mockSearchGet.mockRejectedValueOnce(httpError(503));
      mockOffGet.mockRejectedValueOnce(httpError(503));
      await expect(service.searchFoods('nutella')).rejects.toThrow();

      mockSearchGet.mockResolvedValue({ data: { hits: [nutella] } });
      await expect(service.searchFoods('nutella')).resolves.toHaveLength(1);
    });

    it('fills in defaults for missing or string-typed values', async () => {
      mockSearchGet.mockResolvedValue({
        data: {
          hits: [
            {
              code: '1',
              product_name: 'Apple',
              nutriments: {
                'energy-kcal': '52',
                proteins_100g: '0.3',
                fat_100g: 'n/a',
              },
              serving_quantity: '0',
            },
          ],
        },
      });

      const [apple] = await service.searchFoods('apple');

      expect(apple).toMatchObject({
        brand: null,
        calories: 52,
        proteinG: 0.3,
        carbsG: 0,
        fatG: 0,
        servingQty: 100,
        servingUnit: 'g',
        imageUrl: null,
      });
    });
  });

  describe('lookupBarcode', () => {
    it('returns the normalized product', async () => {
      mockOffGet.mockResolvedValue({
        data: { status: 1, product: { ...nutella, brands: 'Ferrero' } },
      });

      const food = await service.lookupBarcode('3017620422003');

      expect(mockOffGet).toHaveBeenCalledWith(
        '/api/v0/product/3017620422003.json',
      );
      expect(food).toMatchObject({
        barcode: '3017620422003',
        name: 'Nutella',
        calories: 539,
      });
    });

    it('throws 404 when OFF has no such product', async () => {
      mockOffGet.mockResolvedValue({ data: { status: 0 } });
      await expect(service.lookupBarcode('123456')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('treats an HTTP 404 from OFF as not found', async () => {
      mockOffGet.mockRejectedValue(httpError(404));
      await expect(service.lookupBarcode('123456')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns 502 when OFF is down', async () => {
      mockOffGet.mockRejectedValue(httpError(503));
      await expect(service.lookupBarcode('123456')).rejects.toBeInstanceOf(
        BadGatewayException,
      );
    });
  });
});

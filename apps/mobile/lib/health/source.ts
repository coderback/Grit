import type { HealthSource } from './types';

/** Web (and anywhere without a health store): nothing to read. */
export const healthSource: HealthSource = {
  id: null,
  name: 'Health data',
  isAvailable: async () => false,
  requestAccess: async () => false,
  read: async () => ({ workouts: [], steps: [], sleep: [], weights: [] }),
};

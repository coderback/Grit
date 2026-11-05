/**
 * The app's colours, for a dark and a light theme.
 *
 * Screens read `Colors.x` while rendering, so `Colors` always answers from
 * the current palette. When the theme changes, the root layout redraws the
 * screens (see components/ThemeRoot.tsx). Don't copy a colour into a value
 * computed once at module load; read it during render instead.
 */

const DARK = {
  orange: '#FF5C2B',
  /** Page background */
  dark: '#0F0F0F',
  surface: '#1A1A1C',
  surface2: '#242428',
  surface3: '#2E2E33',
  text: '#F5F0EB',
  muted: '#9A9498',
  teal: '#00C8A0',
  success: '#00C8A0',
  blue: '#4B9FFF',
  border: '#2B2B30',
  error: '#FF453A',
};

export type Palette = typeof DARK;
export type ColorScheme = 'light' | 'dark';

// Same roles, tuned for a light background: deeper accents keep text and
// icons readable (muted text is 5:1 on white)
const LIGHT: Palette = {
  orange: '#EC5020',
  dark: '#F6F4F1',
  surface: '#FFFFFF',
  surface2: '#F1EEEA',
  surface3: '#E5E1DC',
  text: '#1A1714',
  muted: '#68625D',
  teal: '#00957A',
  success: '#00957A',
  blue: '#2C75D6',
  border: '#E2DDD7',
  error: '#D93025',
};

let current: Palette = DARK;
let currentScheme: ColorScheme = 'dark';

export const Colors: Palette = new Proxy({} as Palette, {
  get: (_target, key: string) => current[key as keyof Palette],
  ownKeys: () => Reflect.ownKeys(current),
  getOwnPropertyDescriptor: (_target, key) => ({
    enumerable: true,
    configurable: true,
    value: current[key as keyof Palette],
  }),
});

export function applyColorScheme(scheme: ColorScheme) {
  current = scheme === 'light' ? LIGHT : DARK;
  currentScheme = scheme;
}

export function colorScheme(): ColorScheme {
  return currentScheme;
}

export const PALETTES = { dark: DARK, light: LIGHT } as const;

import { validateEnv } from './env';

const good = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/grit',
  SUPABASE_URL: 'https://abc.supabase.co/',
  SUPABASE_ANON_KEY: 'key',
  AZURE_OPENAI_ENDPOINT: 'https://res.openai.azure.com',
  AZURE_OPENAI_API_KEY: 'key',
};

describe('validateEnv', () => {
  it('accepts a complete environment and trims the Supabase URL', () => {
    expect(validateEnv(good).SUPABASE_URL).toBe('https://abc.supabase.co');
  });

  it('lists every problem at once', () => {
    expect(() =>
      validateEnv({
        ...good,
        SUPABASE_ANON_KEY: '',
        AZURE_OPENAI_API_KEY: undefined,
        PORT: 'abc',
      }),
    ).toThrow(
      /SUPABASE_ANON_KEY is missing[\s\S]*AZURE_OPENAI_API_KEY is missing[\s\S]*PORT must be/,
    );
  });

  it('rejects malformed URLs and connection strings', () => {
    expect(() => validateEnv({ ...good, SUPABASE_URL: 'not a url' })).toThrow(
      /SUPABASE_URL is not a valid URL/,
    );
    expect(() =>
      validateEnv({
        ...good,
        AZURE_OPENAI_ENDPOINT: 'http://res.openai.azure.com',
      }),
    ).toThrow(/must be an https URL/);
    expect(() => validateEnv({ ...good, DATABASE_URL: 'mysql://x' })).toThrow(
      /postgres/,
    );
  });
});

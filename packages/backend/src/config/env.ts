/**
 * Checks the environment once at boot, so a missing or malformed setting
 * stops the server with one clear message instead of failing on the first
 * request that needs it.
 */

const REQUIRED = [
  'DATABASE_URL',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'AZURE_OPENAI_ENDPOINT',
  'AZURE_OPENAI_API_KEY',
] as const;

const URLS = ['SUPABASE_URL', 'AZURE_OPENAI_ENDPOINT'] as const;

export function validateEnv(
  env: Record<string, unknown>,
): Record<string, unknown> {
  const problems: string[] = [];

  for (const key of REQUIRED) {
    const value = env[key];
    if (typeof value !== 'string' || value.trim() === '') {
      problems.push(`${key} is missing`);
    }
  }
  for (const key of URLS) {
    const value = env[key];
    if (typeof value !== 'string' || value === '') continue;
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
        problems.push(`${key} must be an https URL`);
      }
    } catch {
      problems.push(`${key} is not a valid URL`);
    }
  }
  const db = env.DATABASE_URL;
  if (typeof db === 'string' && db && !/^postgres(ql)?:\/\//.test(db)) {
    problems.push('DATABASE_URL must be a postgres:// connection string');
  }
  if (env.PORT !== undefined && env.PORT !== '') {
    const port = Number(env.PORT);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      problems.push('PORT must be a number between 1 and 65535');
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `Invalid environment:\n  - ${problems.join('\n  - ')}\nSee packages/backend/.env.example.`,
    );
  }
  // Without a trailing slash, so URLs built from it are predictable
  return {
    ...env,
    SUPABASE_URL: String(env.SUPABASE_URL).replace(/\/+$/, ''),
  };
}

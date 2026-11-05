import { ConfigService } from '@nestjs/config';
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type KeyLike,
} from 'jose';
import { TokenVerifier } from './token-verifier';

const URL_ = 'https://proj.supabase.co';
const ISS = `${URL_}/auth/v1`;

describe('TokenVerifier', () => {
  let privateKey: KeyLike;
  let otherKey: KeyLike;
  let verifier: TokenVerifier;
  let getUser: jest.Mock;

  beforeAll(async () => {
    const pair = await generateKeyPair('ES256');
    privateKey = pair.privateKey;
    otherKey = (await generateKeyPair('ES256')).privateKey;
    const jwk = {
      ...(await exportJWK(pair.publicKey)),
      kid: 'k1',
      alg: 'ES256',
    };
    const config = new ConfigService({
      SUPABASE_URL: URL_,
      SUPABASE_ANON_KEY: 'anon',
    });
    verifier = new TokenVerifier(config);
    verifier.keys = createLocalJWKSet({ keys: [jwk] });
  });

  beforeEach(() => {
    getUser = jest.fn();
    verifier.supabase = { auth: { getUser } } as never;
  });

  const sign = (
    claims: Record<string, unknown>,
    key = privateKey,
    opts: { exp?: string; iss?: string; aud?: string } = {},
  ) =>
    new SignJWT({ role: 'authenticated', email: 'a@b.co', ...claims })
      .setProtectedHeader({ alg: 'ES256', kid: 'k1' })
      .setSubject('user-1')
      .setIssuer(opts.iss ?? ISS)
      .setAudience(opts.aud ?? 'authenticated')
      .setIssuedAt()
      .setExpirationTime(opts.exp ?? '1h')
      .sign(key);

  it('verifies a valid token locally, without calling Supabase', async () => {
    expect(await verifier.verify(await sign({}))).toEqual({
      supabaseId: 'user-1',
      email: 'a@b.co',
    });
    expect(getUser).not.toHaveBeenCalled();
  });

  it('rejects expired, forged, wrong-issuer and wrong-audience tokens', async () => {
    const past = Math.floor(Date.now() / 1000) - 60;
    const expired = await new SignJWT({ role: 'authenticated' })
      .setProtectedHeader({ alg: 'ES256', kid: 'k1' })
      .setSubject('user-1')
      .setIssuer(ISS)
      .setAudience('authenticated')
      .setIssuedAt(past - 3600)
      .setExpirationTime(past)
      .sign(privateKey);
    expect(await verifier.verify(expired)).toBeNull();
    expect(await verifier.verify(await sign({}, otherKey))).toBeNull();
    expect(
      await verifier.verify(
        await sign({}, privateKey, { iss: 'https://evil.co/auth/v1' }),
      ),
    ).toBeNull();
    expect(
      await verifier.verify(await sign({}, privateKey, { aud: 'anon' })),
    ).toBeNull();
    expect(await verifier.verify(await sign({ role: 'anon' }))).toBeNull();
    expect(await verifier.verify('not-a-jwt')).toBeNull();
    expect(getUser).not.toHaveBeenCalled();
  });

  it('asks Supabase about older HS256 tokens', async () => {
    const hs = await new SignJWT({ role: 'authenticated' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-2')
      .sign(new TextEncoder().encode('secret-secret-secret-secret-secret'));
    getUser.mockResolvedValue({
      data: { user: { id: 'user-2', email: 'c@d.co' } },
      error: null,
    });
    expect(await verifier.verify(hs)).toEqual({
      supabaseId: 'user-2',
      email: 'c@d.co',
    });
    getUser.mockResolvedValue({
      data: { user: null },
      error: new Error('bad'),
    });
    expect(await verifier.verify(hs)).toBeNull();
  });
});

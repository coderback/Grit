import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

const DEFAULT_DEPLOYMENT = 'gpt-6-luna';

// Accepts the resource endpoint as shown in the Foundry portal and points it at
// Azure's OpenAI-compatible v1 API, which the standard OpenAI client can call directly.
export function toV1BaseUrl(endpoint: string): string {
  const base = endpoint.replace(/\/+$/, '');
  return base.endsWith('/openai/v1') ? `${base}/` : `${base}/openai/v1/`;
}

/** Token for the model name; on Azure it's the deployment name, not the catalog model ID. */
export const AI_MODEL = 'AI_MODEL';

/** One Azure OpenAI client for the coach and the workout planner. */
export const azureOpenAIProviders: Provider[] = [
  {
    provide: OpenAI,
    inject: [ConfigService],
    useFactory: (config: ConfigService) =>
      new OpenAI({
        apiKey: config.getOrThrow<string>('AZURE_OPENAI_API_KEY'),
        baseURL: toV1BaseUrl(
          config.getOrThrow<string>('AZURE_OPENAI_ENDPOINT'),
        ),
        // The SDK default is 10 minutes; nobody waits that long on a phone
        timeout: 60_000,
        maxRetries: 1,
      }),
  },
  {
    provide: AI_MODEL,
    inject: [ConfigService],
    useFactory: (config: ConfigService) =>
      config.get<string>('AZURE_OPENAI_DEPLOYMENT') ?? DEFAULT_DEPLOYMENT,
  },
];

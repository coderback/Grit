import { ForbiddenException } from '@nestjs/common';

/** The error code the app looks for to show the AI consent screen. */
export const AI_CONSENT_REQUIRED = 'ai_consent_required';

/**
 * Meal photos, descriptions and coach chats go to Azure OpenAI only after
 * the user agreed (Apple guideline 5.1.2(i)).
 */
export function assertAiConsent(user: { aiConsentAt: Date | null }) {
  if (!user.aiConsentAt) {
    throw new ForbiddenException({
      statusCode: 403,
      code: AI_CONSENT_REQUIRED,
      message:
        'Allow GRIT to send this to its AI provider (Microsoft Azure OpenAI) first.',
    });
  }
}

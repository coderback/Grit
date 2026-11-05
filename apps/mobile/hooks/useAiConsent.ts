import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useMe, type Me } from '@/hooks/useMe';
import { useAiConsentStore } from '@/stores/aiConsentStore';

/** Allows or withdraws sending meals and chats to Azure OpenAI. */
export function useSetAiConsent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (granted: boolean) =>
      (granted ? api.post<Me>('/users/me/ai-consent') : api.delete<Me>('/users/me/ai-consent')).then((r) => r.data),
    onSuccess: (me) => qc.setQueryData(['me'], me),
  });
}

/**
 * Resolves true if the user has allowed AI features, asking them first if
 * they haven't. Call it before any feature that sends data to the AI.
 */
export function useEnsureAiConsent() {
  const { data: me } = useMe();
  const ask = useAiConsentStore((s) => s.ask);
  return useCallback(async () => {
    if (me?.aiConsentAt) return true;
    return ask();
  }, [me?.aiConsentAt, ask]);
}

import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
// React Native's global fetch can't stream response bodies; Expo's can
import { fetch } from 'expo/fetch';
import { api, authHeaders } from '@/lib/api';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

/** Pull the `message` out of a Nest JSON error body, if that's what we got. */
function errorMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as { message?: string | string[] };
    return Array.isArray(parsed.message) ? parsed.message.join(', ') : parsed.message ?? body;
  } catch {
    return body;
  }
}

export function useAIMessages() {
  return useQuery<AIMessage[]>({
    queryKey: ['ai-messages'],
    queryFn: async () => {
      const { data } = await api.get('/ai/messages');
      return data;
    },
  });
}

export function useAINudge() {
  return useQuery<{ nudge: string }>({
    queryKey: ['ai-nudge'],
    queryFn: async () => {
      const { data } = await api.get('/ai/nudge');
      return data;
    },
    staleTime: 1000 * 60 * 60 * 6,
    retry: false,
  });
}

export function useStreamMessage() {
  const [isStreaming, setIsStreaming] = useState(false);
  const qc = useQueryClient();

  const sendMessage = useCallback(
    async (
      message: string,
      onChunk: (text: string) => void,
      onDone: () => void,
      onError: (err: string) => void,
      /** Notes the coach took from this message, to remember next time */
      onRemembered?: (items: string[]) => void,
    ) => {
      setIsStreaming(true);

      const headers = await authHeaders();
      if (!headers.Authorization) {
        onError('Not authenticated');
        setIsStreaming(false);
        return;
      }

      const baseUrl = process.env.EXPO_PUBLIC_API_URL;

      try {
        const response = await fetch(`${baseUrl}/ai/message`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ message }),
        });

        if (!response.ok) {
          const errText = await response.text();
          onError(errorMessage(errText) || `HTTP ${response.status}`);
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          onError('Stream not available');
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (!raw) continue;

            try {
              const chunk = JSON.parse(raw) as { type: string; text?: string; error?: string; items?: string[] };
              if (chunk.type === 'delta' && chunk.text) {
                onChunk(chunk.text);
              } else if (chunk.type === 'remembered' && chunk.items?.length) {
                qc.invalidateQueries({ queryKey: ['coach-memories'] });
                onRemembered?.(chunk.items);
              } else if (chunk.type === 'done') {
                onDone();
              } else if (chunk.type === 'error') {
                onError(chunk.error ?? 'Unknown error');
              }
            } catch {
              // malformed chunk, skip
            }
          }
        }

      } catch (err: any) {
        onError(err.message ?? 'Network error');
      } finally {
        // The server saves both sides of the exchange, even on partial failures
        qc.invalidateQueries({ queryKey: ['ai-messages'] });
        setIsStreaming(false);
      }
    },
    [qc],
  );

  return { sendMessage, isStreaming };
}

export interface CoachMemory {
  id: string;
  text: string;
  source: 'chat' | 'user';
  createdAt: string;
}

export function useCoachMemories() {
  return useQuery<CoachMemory[]>({
    queryKey: ['coach-memories'],
    queryFn: () => api.get('/ai/memories').then((r) => r.data),
  });
}

export function useAddCoachMemory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => api.post<CoachMemory>('/ai/memories', { text }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coach-memories'] }),
  });
}

export function useDeleteCoachMemory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/ai/memories/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coach-memories'] }),
  });
}

export function useClearCoachMemories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete('/ai/memories').then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coach-memories'] }),
  });
}

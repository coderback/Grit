import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
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
    ) => {
      setIsStreaming(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        onError('Not authenticated');
        setIsStreaming(false);
        return;
      }

      const baseUrl = process.env.EXPO_PUBLIC_API_URL;

      try {
        const response = await fetch(`${baseUrl}/ai/message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ message }),
        });

        if (!response.ok) {
          const errText = await response.text();
          onError(errText || `HTTP ${response.status}`);
          setIsStreaming(false);
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          onError('Stream not available');
          setIsStreaming(false);
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
              const chunk = JSON.parse(raw) as { type: string; text?: string; error?: string };
              if (chunk.type === 'delta' && chunk.text) {
                onChunk(chunk.text);
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

        // Refresh message history after stream completes
        qc.invalidateQueries({ queryKey: ['ai-messages'] });
      } catch (err: any) {
        onError(err.message ?? 'Network error');
      } finally {
        setIsStreaming(false);
      }
    },
    [qc],
  );

  return { sendMessage, isStreaming };
}

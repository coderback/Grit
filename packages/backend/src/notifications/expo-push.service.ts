import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  badge?: number;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
// Expo accepts up to 100 messages per request
const BATCH = 100;

/**
 * Sends push alerts through Expo's push service. Returns the tokens Expo
 * says are no longer registered (the app was deleted or signed out), so the
 * caller can forget them. Never throws: a failed push shouldn't fail the
 * action that caused it.
 */
@Injectable()
export class ExpoPushService {
  private readonly logger = new Logger(ExpoPushService.name);

  constructor(private config: ConfigService) {}

  async send(messages: PushMessage[]): Promise<string[]> {
    if (messages.length === 0) return [];
    if (this.config.get('PUSH_DISABLED') === 'true') return [];

    const accessToken = this.config.get<string>('EXPO_ACCESS_TOKEN');
    const dead: string[] = [];

    for (let i = 0; i < messages.length; i += BATCH) {
      const batch = messages
        .slice(i, i + BATCH)
        .map((m) => ({ ...m, sound: 'default', channelId: 'default' }));
      try {
        const res = await axios.post<{
          data: { status: 'ok' | 'error'; details?: { error?: string } }[];
        }>(EXPO_PUSH_URL, batch, {
          timeout: 10_000,
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
        });
        res.data.data.forEach((ticket, j) => {
          if (ticket.details?.error === 'DeviceNotRegistered') {
            dead.push(batch[j].to);
          }
        });
      } catch (err) {
        this.logger.warn(`Push send failed: ${(err as Error).message}`);
      }
    }
    return dead;
  }
}

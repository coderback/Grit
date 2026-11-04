import type { Href } from 'expo-router';

/** Where tapping an alert (in the inbox or as a push) takes you. */
export function notificationRoute(type: string | undefined, data: Record<string, unknown> = {}): Href {
  const userId = typeof data.userId === 'string' ? data.userId : undefined;
  const challengeId = typeof data.challengeId === 'string' ? data.challengeId : undefined;
  switch (type) {
    case 'follow_request':
      return { pathname: '/friends', params: { tab: 'requests' } };
    case 'follow':
    case 'follow_accepted':
    case 'kudos':
      return userId ? { pathname: '/profile/[id]', params: { id: userId } } : '/notifications';
    case 'challenge_joined':
    case 'challenge_ended':
      return challengeId ? { pathname: '/challenge/[id]', params: { id: challengeId } } : '/(tabs)/social';
    case 'streak_at_risk':
      return '/(tabs)/habits';
    case 'weekly_progress':
      return '/(tabs)/activity';
    default:
      return '/notifications';
  }
}

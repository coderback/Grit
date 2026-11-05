import { notificationRoute } from '@/lib/notificationRoute';

describe('where an alert opens', () => {
  it('sends each type to its screen', () => {
    expect(notificationRoute('follow_request')).toEqual({ pathname: '/friends', params: { tab: 'requests' } });
    expect(notificationRoute('kudos', { userId: 'u1' })).toEqual({ pathname: '/profile/[id]', params: { id: 'u1' } });
    expect(notificationRoute('challenge_ended', { challengeId: 'c1' })).toEqual({ pathname: '/challenge/[id]', params: { id: 'c1' } });
    expect(notificationRoute('streak_at_risk')).toBe('/(tabs)/habits');
    expect(notificationRoute('weekly_progress')).toBe('/(tabs)/activity');
    expect(notificationRoute('coach_checkin', { screen: 'food' })).toBe('/(tabs)/food');
    expect(notificationRoute('coach_checkin', { screen: 'stats' })).toBe('/(tabs)/activity');
    expect(notificationRoute('coach_checkin', {})).toBe('/coach');
  });
  it('falls back to the inbox when ids are missing or the type is unknown', () => {
    expect(notificationRoute('follow')).toBe('/notifications');
    expect(notificationRoute('challenge_joined')).toBe('/(tabs)/social');
    expect(notificationRoute('something_new')).toBe('/notifications');
    expect(notificationRoute(undefined)).toBe('/notifications');
  });
});

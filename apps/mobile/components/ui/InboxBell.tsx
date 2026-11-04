import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useUnreadCount } from '@/hooks/useNotifications';
import { Colors } from '@/constants/colors';

/** Opens the notification inbox; shows how many are unread. */
export function InboxBell() {
  const { data } = useUnreadCount();
  const unread = data?.unread ?? 0;
  return (
    <Pressable
      onPress={() => router.push('/notifications')}
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
      style={({ pressed }) => ({
        opacity: pressed ? 0.7 : 1, width: 40, height: 40, borderRadius: 20,
        backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
        alignItems: 'center', justifyContent: 'center',
      })}
    >
      <Text style={{ fontSize: 17 }}>🔔</Text>
      {unread > 0 && (
        <View style={{ position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: Colors.orange, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
          <Text style={{ color: '#fff', fontFamily: 'DMSans-Bold', fontSize: 10 }}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      )}
    </Pressable>
  );
}

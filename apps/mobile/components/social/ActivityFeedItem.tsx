import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { KudosButton } from './KudosButton';
import { Colors } from '@/constants/colors';
import type { FeedItem } from '@/hooks/useSocialFeed';

const ACTIVITY_LABELS: Record<string, string> = {
  running: '🏃 Running', cycling: '🚴 Cycling', walking: '🚶 Walking',
  swimming: '🏊 Swimming', strength_training: '🏋️ Strength', yoga: '🧘 Yoga',
  hiit: '⚡ HIIT', hiking: '⛰️ Hiking', other: '✨ Activity',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  return (
    <View style={{
      width: 38, height: 38, borderRadius: 19,
      backgroundColor: Colors.surface2,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1.5, borderColor: Colors.border,
    }}>
      <Text style={{ fontFamily: 'DMSans-Bold', color: Colors.orange, fontSize: 16 }}>
        {name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

function FeedContent({ item }: { item: FeedItem }) {
  const d = item.data;
  if (item.type === 'food_log') {
    return (
      <View style={{ flex: 1 }}>
        <Text style={{ color: Colors.text, fontFamily: 'DMSans-Medium', fontSize: 14 }}>
          <Text style={{ color: Colors.orange }}>{item.user.displayName}</Text>
          {' '}logged {d.name as string}
          {d.mealType ? ` for ${d.mealType as string}` : ''}
        </Text>
        <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 12, marginTop: 2 }}>
          {Math.round(d.calories as number)} kcal
        </Text>
      </View>
    );
  }
  if (item.type === 'activity_log') {
    const label = ACTIVITY_LABELS[d.activityType as string] ?? `✨ ${d.activityType}`;
    return (
      <View style={{ flex: 1 }}>
        <Text style={{ color: Colors.text, fontFamily: 'DMSans-Medium', fontSize: 14 }}>
          <Text style={{ color: Colors.orange }}>{item.user.displayName}</Text>
          {' '}completed {label}
        </Text>
        <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 12, marginTop: 2 }}>
          {d.durationMin as number} min
          {d.caloriesBurned ? ` · ${Math.round(d.caloriesBurned as number)} kcal` : ''}
          {d.steps ? ` · ${(d.steps as number).toLocaleString()} steps` : ''}
        </Text>
      </View>
    );
  }
  // habit_log
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: Colors.text, fontFamily: 'DMSans-Medium', fontSize: 14 }}>
        <Text style={{ color: Colors.orange }}>{item.user.displayName}</Text>
        {' '}completed {d.habitEmoji as string} {d.habitName as string}
      </Text>
    </View>
  );
}

interface ActivityFeedItemProps {
  item: FeedItem;
}

export function ActivityFeedItem({ item }: ActivityFeedItemProps) {
  return (
    <View style={{
      backgroundColor: Colors.surface,
      borderRadius: 16,
      padding: 14,
      gap: 10,
      borderWidth: 1,
      borderColor: Colors.border,
    }}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
        {/* Avatar */}
        <Pressable onPress={() => router.push(`/profile/${item.user.id}` as never)}>
          <Avatar name={item.user.displayName} url={item.user.avatarUrl} />
        </Pressable>

        {/* Content */}
        <FeedContent item={item} />

        {/* Time */}
        <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 11 }}>
          {timeAgo(item.loggedAt)}
        </Text>
      </View>

      {/* Kudos — only on activity logs */}
      {item.type === 'activity_log' && (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <KudosButton
            logId={item.id}
            initialCount={(item.data.kudosCount as number) ?? 0}
          />
        </View>
      )}
    </View>
  );
}

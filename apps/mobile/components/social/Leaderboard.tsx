import React from 'react';
import { View, Text } from 'react-native';
import { Colors } from '@/constants/colors';
import type { LeaderboardEntry } from '@/hooks/useSocialFeed';

const MEDALS = ['🥇', '🥈', '🥉'];

interface LeaderboardProps {
  entries: LeaderboardEntry[];
}

export function Leaderboard({ entries }: LeaderboardProps) {
  return (
    <View style={{ gap: 8 }}>
      {entries.map((entry, i) => (
        <View
          key={entry.user.id}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: entry.isMe ? `${Colors.orange}18` : Colors.surface,
            borderRadius: 16,
            padding: 12,
            gap: 12,
            borderWidth: 1.5,
            borderColor: entry.isMe ? Colors.orange : Colors.border,
          }}
        >
          {/* Rank */}
          <Text style={{ fontSize: 18, width: 28, textAlign: 'center' }}>
            {i < 3 ? MEDALS[i] : `${i + 1}`}
          </Text>

          {/* Avatar initials */}
          <View style={{
            width: 34, height: 34, borderRadius: 17,
            backgroundColor: Colors.surface2,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ color: Colors.orange, fontFamily: 'DMSans-Bold', fontSize: 14 }}>
              {entry.user.displayName.charAt(0).toUpperCase()}
            </Text>
          </View>

          {/* Name */}
          <Text style={{
            flex: 1,
            color: entry.isMe ? Colors.orange : Colors.text,
            fontFamily: entry.isMe ? 'DMSans-Bold' : 'DMSans-Medium',
            fontSize: 14,
          }}>
            {entry.isMe ? 'You' : entry.user.displayName}
          </Text>

          {/* Minutes */}
          <Text style={{
            color: Colors.muted,
            fontFamily: 'JetBrainsMono-Regular',
            fontSize: 13,
          }}>
            {entry.activeMinutes}m
          </Text>
        </View>
      ))}
    </View>
  );
}

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Avatar } from '@/components/ui/Avatar';
import { FollowButton } from './FollowButton';
import { Colors } from '@/constants/colors';
import type { FeedUser, Relationship } from '@/hooks/useSocialFeed';

/** A person in a list: photo, name and username, opening their profile, plus an action. */
export function PersonRow({
  user,
  relationship,
  isMe,
  right,
}: {
  user: FeedUser;
  relationship?: Relationship | null;
  isMe?: boolean;
  /** Replaces the follow button */
  right?: React.ReactNode;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Pressable
        onPress={() => router.push(`/profile/${user.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`${user.displayName}, @${user.username}`}
        style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.7 : 1 })}
      >
        <Avatar name={user.displayName} url={user.avatarUrl} size={42} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 15 }}>
            {user.displayName}{isMe ? ' (you)' : ''}
          </Text>
          <Text numberOfLines={1} style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 12 }}>
            @{user.username}
            {relationship?.followsYou === 'accepted' && relationship.following !== 'accepted' ? ' · Follows you' : ''}
          </Text>
        </View>
      </Pressable>
      {right ?? (!isMe && relationship && (
        <FollowButton userId={user.id} name={user.displayName} relationship={relationship} />
      ))}
    </View>
  );
}

import React from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  usePublicProfile, useFollow, useUnfollow, useFollowing,
} from '@/hooks/useSocialFeed';
import { useAuthStore } from '@/stores/authStore';
import { Colors } from '@/constants/colors';

const GOAL_LABELS: Record<string, string> = {
  lose_weight: 'Lose weight',
  build_strength: 'Build strength',
  build_habits: 'Build habits',
  just_track: 'Just tracking',
};

export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const currentUser = useAuthStore((s) => s.user);
  const { data: profile, isLoading } = usePublicProfile(id);
  const { data: following } = useFollowing();
  const { mutate: follow, isPending: followPending } = useFollow();
  const { mutate: unfollow, isPending: unfollowPending } = useUnfollow();

  const isMe = currentUser?.id === id;
  const isFollowing = (following ?? []).some(
    (f: { following: { id: string } }) => f.following.id === id,
  );

  function handleFollowToggle() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isFollowing) unfollow(id);
    else follow(id);
  }

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.dark, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Colors.orange} />
      </SafeAreaView>
    );
  }

  if (!profile) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.dark }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 24 }}>
        {/* Back */}
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 15 }}>
            ← Back
          </Text>
        </Pressable>

        {/* Avatar + name */}
        <View style={{ alignItems: 'center', gap: 12 }}>
          <View style={{
            width: 80, height: 80, borderRadius: 40,
            backgroundColor: Colors.surface2,
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 2, borderColor: Colors.orange,
          }}>
            <Text style={{ color: Colors.orange, fontFamily: 'DMSans-Bold', fontSize: 32 }}>
              {profile.displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 22 }}>
              {profile.displayName}
            </Text>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14 }}>
              @{profile.username}
            </Text>
            {profile.primaryGoal && (
              <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13 }}>
                🎯 {GOAL_LABELS[profile.primaryGoal] ?? profile.primaryGoal}
              </Text>
            )}
          </View>
        </View>

        {/* Stats */}
        <View style={{
          flexDirection: 'row',
          backgroundColor: Colors.surface,
          borderRadius: 20,
          padding: 16,
          justifyContent: 'space-around',
          borderWidth: 1,
          borderColor: Colors.border,
        }}>
          {[
            { label: 'Following', value: profile._count.following },
            { label: 'Followers', value: profile._count.followers },
          ].map((s) => (
            <View key={s.label} style={{ alignItems: 'center', gap: 4 }}>
              <Text style={{ color: Colors.text, fontFamily: 'JetBrainsMono-Regular', fontSize: 22 }}>
                {s.value}
              </Text>
              <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13 }}>
                {s.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Follow / unfollow button */}
        {!isMe && (
          <Pressable
            onPress={handleFollowToggle}
            disabled={followPending || unfollowPending}
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
              backgroundColor: isFollowing ? Colors.surface2 : Colors.orange,
              borderRadius: 999,
              paddingVertical: 14,
              alignItems: 'center',
              borderWidth: 1.5,
              borderColor: isFollowing ? Colors.border : Colors.orange,
            })}
          >
            <Text style={{
              color: isFollowing ? Colors.muted : '#fff',
              fontFamily: 'DMSans-Bold',
              fontSize: 15,
            }}>
              {isFollowing ? 'Unfollow' : 'Follow'}
            </Text>
          </Pressable>
        )}

        {isMe && (
          <View style={{
            backgroundColor: Colors.surface2, borderRadius: 16, padding: 14, alignItems: 'center',
          }}>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13 }}>
              This is your profile — edit it in Settings.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

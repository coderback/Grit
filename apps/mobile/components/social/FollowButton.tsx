import React from 'react';
import { Pressable, Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useFollow, useUnfollow, type Relationship } from '@/hooks/useSocialFeed';
import { confirmAction } from '@/lib/confirm';
import { showToast } from '@/stores/toastStore';
import { Colors } from '@/constants/colors';

/**
 * Follow / Requested / Following, depending on where things stand. Private
 * accounts turn a follow into a request they approve.
 */
export function FollowButton({
  userId,
  name,
  relationship,
  large = false,
}: {
  userId: string;
  name: string;
  relationship: Relationship;
  large?: boolean;
}) {
  const { mutateAsync: follow, isPending: following } = useFollow();
  const { mutate: unfollow, isPending: unfollowing } = useUnfollow();
  const busy = following || unfollowing;

  const state = relationship.following;
  const label =
    state === 'accepted' ? 'Following'
    : state === 'pending' ? 'Requested'
    : relationship.followsYou === 'accepted' ? 'Follow back'
    : 'Follow';
  const filled = state === 'none';

  async function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (state === 'none') {
      const { status } = await follow(userId);
      if (status === 'pending') showToast(`Request sent. ${name} will see it.`);
      return;
    }
    const ok = await confirmAction(
      state === 'pending'
        ? { title: 'Cancel request?', message: `Withdraw your follow request to ${name}?`, confirmLabel: 'Withdraw' }
        : { title: `Unfollow ${name}?`, message: 'Their activity will leave your feed.', confirmLabel: 'Unfollow', destructive: true },
    );
    if (ok) unfollow(userId);
  }

  return (
    <Pressable
      onPress={() => handlePress().catch(() => {})}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${name}`}
      style={({ pressed }) => ({
        opacity: busy ? 0.5 : pressed ? 0.7 : 1,
        backgroundColor: filled ? Colors.orange : Colors.surface2,
        borderRadius: 999,
        paddingVertical: large ? 14 : 7,
        paddingHorizontal: large ? 0 : 14,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: filled ? Colors.orange : Colors.border,
        ...(large ? { alignSelf: 'stretch' as const } : {}),
      })}
    >
      <Text style={{ color: filled ? '#fff' : Colors.muted, fontFamily: 'DMSans-Bold', fontSize: large ? 15 : 13 }}>
        {label}
      </Text>
    </Pressable>
  );
}

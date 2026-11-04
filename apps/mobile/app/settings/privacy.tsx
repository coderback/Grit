import React from 'react';
import { ScrollView, Text, ActivityIndicator, Pressable } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { showToast } from '@/stores/toastStore';
import { useMe, useUpdateMe } from '@/hooks/useMe';
import { useBlocked, useUnblock } from '@/hooks/useSocialFeed';
import { PersonRow } from '@/components/social/PersonRow';
import { ErrorNotice } from '@/components/ui/QueryStatus';
import { confirmAction } from '@/lib/confirm';
import { NavRow, ScreenHeader, Section, ToggleRow } from '@/components/settings/SettingsUI';

export default function PrivacyScreen() {
  const { data: me } = useMe();
  const { mutate: save } = useUpdateMe();
  const blocked = useBlocked();
  const { mutate: unblock, isPending: unblocking } = useUnblock();

  async function setPrivate(value: boolean) {
    if (!value) {
      const ok = await confirmAction({
        title: 'Make your account public?',
        message: 'Anyone can follow you and see your activity. Pending follow requests will be approved.',
        confirmLabel: 'Make public',
      });
      if (!ok) return;
    }
    save({ isPrivate: value }, { onError: () => showToast("Couldn't save that setting.") });
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.dark }}>
      <ScreenHeader title="Privacy" />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 22, paddingBottom: 48 }}>
        {!me ? (
          <ActivityIndicator color={Colors.orange} />
        ) : (
          <Section
            footer={me.isPrivate
              ? 'You approve each follower. Only approved followers see your workouts, meals and habits.'
              : 'Anyone can follow you and see your workouts, meals and habits.'}
          >
            <ToggleRow label="Private account" value={me.isPrivate} onChange={setPrivate} />
          </Section>
        )}

        <Section>
          <NavRow icon="📨" label="Follow requests" sub="Approve who can follow you" onPress={() => router.push({ pathname: '/friends', params: { tab: 'requests' } })} />
        </Section>

        <Section title="Blocked accounts" footer="Blocked people can't find you, follow you or see your activity. They aren't told.">
          {blocked.isLoading ? (
            <ActivityIndicator color={Colors.orange} />
          ) : blocked.isError ? (
            <ErrorNotice compact onRetry={() => blocked.refetch()} />
          ) : (blocked.data ?? []).length === 0 ? (
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14 }}>You haven't blocked anyone.</Text>
          ) : (
            blocked.data!.map((b) => (
              <PersonRow
                key={b.user.id}
                user={b.user}
                right={
                  <Pressable
                    disabled={unblocking}
                    onPress={async () => {
                      if (await confirmAction({ title: `Unblock ${b.user.displayName}?`, message: 'They’ll be able to find and follow you again.', confirmLabel: 'Unblock' })) {
                        unblock(b.user.id);
                      }
                    }}
                    accessibilityRole="button"
                    style={{ backgroundColor: Colors.surface2, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1.5, borderColor: Colors.border }}
                  >
                    <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 13 }}>Unblock</Text>
                  </Pressable>
                }
              />
            ))
          )}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

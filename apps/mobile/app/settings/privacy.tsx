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
import { ChipGroup, NavRow, ScreenHeader, Section, ToggleRow } from '@/components/settings/SettingsUI';
import { useSetAiConsent } from '@/hooks/useAiConsent';

export default function PrivacyScreen() {
  const { data: me } = useMe();
  const { mutate: save } = useUpdateMe();
  const blocked = useBlocked();
  const { mutate: setAiConsent, isPending: savingAi } = useSetAiConsent();

  async function toggleAi(value: boolean) {
    if (!value) {
      const ok = await confirmAction({
        title: 'Turn off AI features?',
        message: 'Smart log, the AI coach and workout plan building stop working until you turn this back on. Nothing else changes.',
        confirmLabel: 'Turn off',
      });
      if (!ok) return;
    }
    setAiConsent(value, { onError: () => showToast("Couldn't save that setting.") });
  }

  const saveSetting = (data: Parameters<typeof save>[0]) =>
    save(data, { onError: (err: any) => showToast(err?.response?.data?.message?.toString() ?? "Couldn't save that setting.") });
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

        {me && (
          <Section
            title="AI features"
            footer="When on, Smart log, the AI coach and workout plans send what you type, say or photograph, plus a summary of your logs for coach replies, to Microsoft's Azure OpenAI service. Microsoft doesn't use it to train its models."
          >
            <ToggleRow label="Allow AI features" value={!!me.aiConsentAt} onChange={toggleAi} disabled={savingAi} />
          </Section>
        )}

        {me && (
          <Section
            title="How your data is used"
            footer="All off unless you turn them on. Turning one off stops future use."
          >
            <ToggleRow label="Improve GRIT's food data" hint="Use my food searches, logs and corrections" value={me.consentFoodData} onChange={(v) => saveSetting({ consentFoodData: v })} />
            <ToggleRow label="Improve GRIT's models with my health data" hint="Steps, sleep, heart rate and weight from my health app" value={me.consentHealthTraining} onChange={(v) => saveSetting({ consentHealthTraining: v })} />
            <ToggleRow label="Improve workout estimates" hint="Use my workouts for progression and calorie estimates" value={me.consentWorkoutTraining} onChange={(v) => saveSetting({ consentWorkoutTraining: v })} />
            <ToggleRow label="Share products I add with Open Food Facts" hint="The free, public food database GRIT uses" value={me.consentOffSharing} onChange={(v) => saveSetting({ consentOffSharing: v })} />
          </Section>
        )}

        {me && (
          <Section
            title="Wellbeing"
            footer={me.edScreen === 'yes'
              ? "GRIT doesn't set weight-loss targets or suggest eating less, and your coach focuses on regular meals, training and how you feel."
              : 'Have you ever been diagnosed with, or treated for, an eating disorder? Only you see this answer.'}
          >
            <ChipGroup
              options={[
                { value: 'no', label: 'No' },
                { value: 'yes', label: 'Yes' },
                { value: 'prefer_not', label: 'Rather not say' },
              ]}
              value={me.edScreen}
              onChange={(v) => saveSetting({ edScreen: v })}
            />
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

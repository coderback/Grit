import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import {
  todayWeekday, useGeneratePlan, useWorkoutPlan, WEEKDAY_NAMES,
  type PlanDay, type WorkoutPlan,
} from '@/hooks/useWorkoutPlan';
import { useLogActivity } from '@/hooks/useActivityLog';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { ACTIVITY_LABELS } from '@/components/activity/LogActivitySheet';
import { EditPlanDaySheet } from '@/components/plan/EditPlanDaySheet';
import { ChipGroup, FieldLabel, PrimaryButton, ScreenHeader, Section } from '@/components/settings/SettingsUI';
import { notify } from '@/lib/confirm';

const DAY_COUNTS = [2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: `${n} days` }));
const LOCATIONS = [
  { value: 'home', label: 'At home' },
  { value: 'gym', label: 'At a gym' },
] as const;

function errorMessage(err: any) {
  return err?.response?.data?.message?.toString() ?? 'Check your connection and try again.';
}

/** The coach-built weekly plan: view it, log a session, edit a day or rebuild it. */
export default function PlanScreen() {
  const { data: plan, isLoading, isError, refetch } = useWorkoutPlan();
  const { refreshing, onRefresh } = usePullToRefresh([['workout-plan']]);
  const [editing, setEditing] = useState<PlanDay | null>(null);

  useFocusEffect(React.useCallback(() => () => setEditing(null), []));

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.dark }}>
      <ScreenHeader title="Workout plan" />
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.orange} />}
      >
        {isLoading ? (
          <ActivityIndicator color={Colors.orange} style={{ marginTop: 40 }} />
        ) : isError ? (
          <Section>
            <Text style={{ color: Colors.text, fontFamily: 'DMSans-Medium', fontSize: 15 }}>Couldn't load your plan.</Text>
            <Pressable onPress={() => refetch()} accessibilityRole="button">
              <Text style={{ color: Colors.orange, fontFamily: 'DMSans-Bold', fontSize: 14 }}>Try again</Text>
            </Pressable>
          </Section>
        ) : plan ? (
          <PlanWeek plan={plan} onEdit={setEditing} />
        ) : null}

        {/* Keyed so its defaults follow the plan after a day is edited or rebuilt */}
        {!isLoading && !isError && (
          <BuildPlan key={`${plan?.daysPerWeek}-${plan?.location}`} plan={plan ?? null} />
        )}
      </ScrollView>

      {editing && <EditPlanDaySheet key={editing.day} day={editing} onClose={() => setEditing(null)} />}
    </SafeAreaView>
  );
}

function PlanWeek({ plan, onEdit }: { plan: WorkoutPlan; onEdit: (day: PlanDay) => void }) {
  const today = todayWeekday();
  const { mutateAsync: logActivity } = useLogActivity();
  const [logged, setLogged] = useState<string | null>(null);

  async function logSession(day: PlanDay) {
    try {
      await logActivity({ activityType: day.activityType, durationMin: day.durationMin });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLogged(day.day);
    } catch (err) {
      notify("Couldn't log the workout", errorMessage(err));
    }
  }

  return (
    <>
      {!!plan.summary && (
        <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14, lineHeight: 20 }}>{plan.summary}</Text>
      )}
      {plan.days.map((day) => {
        const isToday = day.day === today;
        return (
          <View
            key={day.day}
            style={{
              backgroundColor: Colors.surface,
              borderRadius: 18,
              borderWidth: 1.5,
              borderColor: isToday ? Colors.orange : Colors.border,
              padding: 16,
              gap: 10,
              opacity: day.rest && !isToday ? 0.7 : 1,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: isToday ? Colors.orange : Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  {WEEKDAY_NAMES[day.day]}{isToday ? ' · Today' : ''}
                </Text>
                <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 17, marginTop: 2 }}>{day.title}</Text>
                {!day.rest && (
                  <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 12, marginTop: 2 }}>
                    {ACTIVITY_LABELS[day.activityType] ?? day.activityType} · {day.durationMin} min
                  </Text>
                )}
              </View>
              <Pressable onPress={() => onEdit(day)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Edit ${WEEKDAY_NAMES[day.day]}`}>
                <Text style={{ color: Colors.orange, fontFamily: 'DMSans-Bold', fontSize: 13 }}>Edit</Text>
              </Pressable>
            </View>

            {day.exercises.map((e, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
                <Text style={{ color: Colors.text, fontFamily: 'DMSans-Regular', fontSize: 14, flex: 1 }}>{e.name}</Text>
                {!!e.detail && <Text style={{ color: Colors.muted, fontFamily: 'JetBrainsMono-Regular', fontSize: 12 }}>{e.detail}</Text>}
              </View>
            ))}

            {!day.rest && isToday && (
              <Pressable
                onPress={() => logSession(day)}
                disabled={logged === day.day}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  marginTop: 4,
                  borderRadius: 999,
                  paddingVertical: 12,
                  alignItems: 'center',
                  backgroundColor: logged === day.day ? `${Colors.teal}22` : Colors.orange,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text style={{ color: logged === day.day ? Colors.teal : '#fff', fontFamily: 'DMSans-Bold', fontSize: 15 }}>
                  {logged === day.day ? '✓ Logged' : 'Log this workout'}
                </Text>
              </Pressable>
            )}
          </View>
        );
      })}
    </>
  );
}

/** Builds the first plan, or rebuilds it with new settings or a request for the coach. */
function BuildPlan({ plan }: { plan: WorkoutPlan | null }) {
  const { mutateAsync: generate, isPending } = useGeneratePlan();
  const [days, setDays] = useState(String(plan?.daysPerWeek ?? 3));
  const [location, setLocation] = useState<'home' | 'gym'>(plan?.location ?? 'home');
  const [feedback, setFeedback] = useState('');

  async function handleBuild() {
    try {
      await generate({ daysPerWeek: Number(days), location, feedback: feedback.trim() || undefined });
      setFeedback('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      notify("Couldn't build a plan", errorMessage(err));
    }
  }

  return (
    <Section
      title={plan ? 'Change the plan' : undefined}
      footer={plan ? 'Rebuilding replaces the whole week. You can rebuild up to 5 times a day.' : undefined}
    >
      {!plan && (
        <View style={{ gap: 4 }}>
          <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 18 }}>Get a plan from your coach</Text>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13, lineHeight: 18 }}>
            Built from your goal, activity level and what usually gets in your way.
          </Text>
        </View>
      )}
      <View style={{ gap: 8 }}>
        <FieldLabel>Training days per week</FieldLabel>
        <ChipGroup options={DAY_COUNTS} value={days} onChange={setDays} />
      </View>
      <View style={{ gap: 8 }}>
        <FieldLabel>Where you'll train</FieldLabel>
        <ChipGroup options={[...LOCATIONS]} value={location} onChange={setLocation} />
      </View>
      <View style={{ gap: 8 }}>
        <FieldLabel hint='e.g. "no running, my knees are sore" or "shorter sessions"'>Anything the coach should know?</FieldLabel>
        <TextInput
          value={feedback}
          onChangeText={setFeedback}
          maxLength={300}
          multiline
          placeholder="Optional"
          placeholderTextColor={Colors.muted}
          accessibilityLabel="Request for the coach"
          style={{ minHeight: 60, backgroundColor: Colors.surface2, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 12, color: Colors.text, fontFamily: 'DMSans-Regular', fontSize: 14, textAlignVertical: 'top' }}
        />
      </View>
      {isPending && (
        <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13 }}>The coach is building your week. This takes about 10 seconds…</Text>
      )}
      <PrimaryButton label={plan ? 'Rebuild plan' : 'Build my plan'} onPress={handleBuild} loading={isPending} />
    </Section>
  );
}

import React, { useRef, useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  TextInput,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Colors } from '../../constants/colors';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

interface BackendUser {
  id: string;
  displayName: string;
  calorieGoal: number;
  weightKg: number | null;
  primaryGoal: string | null;
}

function useMe() {
  return useQuery<BackendUser>({
    queryKey: ['me'],
    queryFn: () => api.get('/users/me').then((r) => r.data),
    staleTime: 1000 * 60 * 5,
  });
}

function labelCase(s: string | null | undefined) {
  if (!s) return '—';
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function EditSheet({ user, onClose }: { user: BackendUser; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(user.displayName ?? '');
  const [calorieGoal, setCalorieGoal] = useState(user.calorieGoal ? String(user.calorieGoal) : '');
  const [weightKg, setWeightKg] = useState(user.weightKg ? String(user.weightKg) : '');

  useEffect(() => {
    setDisplayName(user.displayName ?? '');
    setCalorieGoal(user.calorieGoal ? String(user.calorieGoal) : '');
    setWeightKg(user.weightKg ? String(user.weightKg) : '');
  }, [user]);

  const { mutate: save, isPending } = useMutation({
    mutationFn: (payload: Partial<BackendUser>) =>
      api.put('/users/me', payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      onClose();
    },
    onError: (err: any) => {
      Alert.alert('Could not save', err?.response?.data?.message ?? err.message);
    },
  });

  function handleSave() {
    const payload: Record<string, unknown> = {};
    if (displayName.trim()) payload.displayName = displayName.trim();
    const cal = parseInt(calorieGoal, 10);
    if (!isNaN(cal) && cal > 0) payload.calorieGoal = cal;
    const wt = parseFloat(weightKg);
    if (!isNaN(wt) && wt > 0) payload.weightKg = wt;
    save(payload as Partial<BackendUser>);
  }

  const inputStyle = {
    backgroundColor: Colors.surface2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Colors.text,
    fontFamily: 'DMSans-Regular',
    fontSize: 16,
  };

  return (
    <BottomSheetScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 18 }}>Edit Profile</Text>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={{ color: Colors.muted, fontSize: 20 }}>✕</Text>
        </Pressable>
      </View>
      <View style={{ gap: 8 }}>
        <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>Display Name</Text>
        <TextInput value={displayName} onChangeText={setDisplayName} placeholder="Your name" placeholderTextColor={Colors.muted} autoCapitalize="words" style={inputStyle} />
      </View>
      <View style={{ gap: 8 }}>
        <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>Calorie Goal (kcal)</Text>
        <TextInput value={calorieGoal} onChangeText={setCalorieGoal} placeholder="2000" placeholderTextColor={Colors.muted} keyboardType="numeric" style={inputStyle} />
      </View>
      <View style={{ gap: 8 }}>
        <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>Weight (kg)</Text>
        <TextInput value={weightKg} onChangeText={setWeightKg} placeholder="75" placeholderTextColor={Colors.muted} keyboardType="decimal-pad" style={inputStyle} />
      </View>
      <Pressable
        onPress={handleSave}
        disabled={isPending}
        style={({ pressed }) => ({
          backgroundColor: Colors.orange,
          borderRadius: 999,
          paddingVertical: 16,
          alignItems: 'center',
          opacity: isPending ? 0.6 : pressed ? 0.85 : 1,
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 8,
          marginTop: 4,
        })}
      >
        {isPending && <ActivityIndicator size="small" color="#fff" />}
        <Text style={{ color: '#fff', fontFamily: 'DMSans-Bold', fontSize: 16 }}>{isPending ? 'Saving…' : 'Save'}</Text>
      </Pressable>
    </BottomSheetScrollView>
  );
}

const SETTINGS_ROWS = [
  { icon: '🔔', color: Colors.blue, label: 'Notifications', sub: '3 reminders active', action: 'settings' as const },
  { icon: '🎯', color: Colors.orange, label: 'Goals & Targets', sub: 'Manage your targets', action: 'settings' as const },
  { icon: '📊', color: Colors.teal, label: 'My Progress', sub: 'View full history', action: 'settings' as const },
  { icon: '💬', color: Colors.muted, label: 'Help & Feedback', sub: 'Get support', action: 'mail' as const },
];

export default function ProfileScreen() {
  const { data: me, isLoading } = useMe();
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const sheetRef = useRef<BottomSheet>(null);
  const [showEdit, setShowEdit] = useState(false);

  useFocusEffect(
    useCallback(() => {
      return () => {
        sheetRef.current?.close();
        setShowEdit(false);
      };
    }, []),
  );

  const email = user?.email ?? '—';
  const initials = me?.displayName
    ? me.displayName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : email[0]?.toUpperCase() ?? '?';
  const displayName = isLoading ? '—' : (me?.displayName || 'No name set');

  function handleLogout() {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          clearSession();
        },
      },
    ]);
  }

  function openEdit() {
    setShowEdit(true);
    sheetRef.current?.expand();
  }

  const statChips = [
    { label: 'Goal', value: isLoading ? '—' : String(me?.calorieGoal ?? '—'), unit: 'kcal', color: Colors.orange },
    { label: 'Weight', value: isLoading ? '—' : (me?.weightKg ? String(me.weightKg) : '—'), unit: 'kg', color: Colors.blue },
    { label: 'Phase', value: isLoading ? '—' : labelCase(me?.primaryGoal).split(' ')[0], unit: '', color: Colors.teal },
  ];

  const weekDots = [true, true, true, false, true, true, false];

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.dark }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 140 }} showsVerticalScrollIndicator={false}>

        {/* Gradient banner */}
        <View style={{
          borderRadius: 20,
          backgroundColor: Colors.surface,
          borderWidth: 1,
          borderColor: Colors.border,
          padding: 20,
          overflow: 'hidden',
          position: 'relative',
        }}>
          {/* Decorative rings */}
          <View style={{ position: 'absolute', right: -30, top: -30, width: 120, height: 120, borderRadius: 60, borderWidth: 1, borderColor: 'rgba(255,92,43,0.1)' }} />
          <View style={{ position: 'absolute', right: -10, top: -10, width: 80, height: 80, borderRadius: 40, borderWidth: 1, borderColor: 'rgba(255,92,43,0.1)' }} />

          {/* Avatar row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <View style={{
              width: 64, height: 64, borderRadius: 32,
              backgroundColor: 'rgba(255,92,43,0.15)',
              borderWidth: 2.5, borderColor: 'rgba(255,92,43,0.4)',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Text style={{ color: Colors.orange, fontFamily: 'DMSans-Bold', fontSize: 22 }}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 20, letterSpacing: -0.3 }}>{displayName}</Text>
              <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13, marginTop: 2 }}>{email}</Text>
              <View style={{ backgroundColor: 'rgba(255,92,43,0.15)', borderWidth: 1, borderColor: 'rgba(255,92,43,0.3)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 6 }}>
                <Text style={{ fontSize: 11, fontFamily: 'DMSans-Bold', color: Colors.orange }}>🔥 21 day streak</Text>
              </View>
            </View>
            <Pressable
              onPress={openEdit}
              style={({ pressed }) => ({
                backgroundColor: Colors.surface2,
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderWidth: 1,
                borderColor: Colors.border,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 13 }}>Edit</Text>
            </Pressable>
          </View>

          {/* Stat chips */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {statChips.map(s => (
              <View
                key={s.label}
                style={{
                  flex: 1,
                  backgroundColor: `${s.color}12`,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: `${s.color}30`,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  alignItems: 'center',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2, justifyContent: 'center' }}>
                  <Text style={{ fontSize: 18, fontFamily: 'JetBrainsMono-Regular', color: s.color }}>{s.value}</Text>
                  {!!s.unit && <Text style={{ fontSize: 10, color: s.color, fontFamily: 'DMSans-Regular' }}>{s.unit}</Text>}
                </View>
                <Text style={{ fontSize: 10, color: Colors.muted, fontFamily: 'DMSans-Regular', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>
                  {s.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* This week */}
        <View style={{ backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, padding: 18 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 15, fontFamily: 'DMSans-Bold', color: Colors.text }}>This week</Text>
            <Text style={{ fontSize: 12, color: Colors.orange, fontFamily: 'DMSans-Bold' }}>Details →</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: weekDots[i] ? Colors.teal : Colors.surface2 }} />
                <Text style={{ fontSize: 10, color: Colors.muted, fontFamily: 'DMSans-Regular' }}>{d}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Settings rows */}
        <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 4 }}>
          Account
        </Text>
        {SETTINGS_ROWS.map(row => (
          <Pressable
            key={row.label}
            onPress={() => {
              if (row.action === 'mail') Linking.openURL('mailto:support@gritapp.io');
              else Linking.openSettings();
            }}
            style={({ pressed }) => ({
              backgroundColor: pressed ? Colors.surface3 : Colors.surface,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: Colors.border,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
            })}
          >
            <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: `${row.color}18`, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Text style={{ fontSize: 20 }}>{row.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontFamily: 'DMSans-Bold', color: Colors.text }}>{row.label}</Text>
              {!!row.sub && <Text style={{ fontSize: 12, color: Colors.muted, fontFamily: 'DMSans-Regular', marginTop: 1 }}>{row.sub}</Text>}
            </View>
            <Text style={{ color: Colors.muted, fontSize: 16 }}>›</Text>
          </Pressable>
        ))}

        {/* Log out */}
        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            backgroundColor: pressed ? `${Colors.error}30` : `${Colors.error}18`,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: `${Colors.error}40`,
            paddingVertical: 16,
          })}
        >
          <Text style={{ fontSize: 18 }}>🚪</Text>
          <Text style={{ color: Colors.error, fontFamily: 'DMSans-Bold', fontSize: 16 }}>Log out</Text>
        </Pressable>

        <Text style={{ color: Colors.border, fontFamily: 'DMSans-Regular', fontSize: 12, textAlign: 'center' }}>
          GRIT · v2.0
        </Text>
      </ScrollView>

      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={['55%']}
        enablePanDownToClose
        onClose={() => setShowEdit(false)}
        backgroundStyle={{ backgroundColor: Colors.surface }}
        handleIndicatorStyle={{ backgroundColor: Colors.muted }}
      >
        {showEdit && me && (
          <EditSheet user={me} onClose={() => { sheetRef.current?.close(); setShowEdit(false); }} />
        )}
      </BottomSheet>
    </SafeAreaView>
  );
}

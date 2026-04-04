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
import { Ionicons } from '@expo/vector-icons';
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

// ── Edit Sheet ───────────────────────────────────────────────────────────────

interface EditSheetProps {
  user: BackendUser;
  onClose: () => void;
}

function EditSheet({ user, onClose }: EditSheetProps) {
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(user.displayName ?? '');
  const [calorieGoal, setCalorieGoal] = useState(
    user.calorieGoal ? String(user.calorieGoal) : '',
  );
  const [weightKg, setWeightKg] = useState(
    user.weightKg ? String(user.weightKg) : '',
  );

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
      {/* Handle area title */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 18 }}>
          Edit Profile
        </Text>
        <Pressable onPress={onClose} hitSlop={12}>
          <Ionicons name="close" size={22} color={Colors.muted} />
        </Pressable>
      </View>

      {/* Display name */}
      <View style={{ gap: 8 }}>
        <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Display Name
        </Text>
        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Your name"
          placeholderTextColor={Colors.muted}
          autoCapitalize="words"
          style={inputStyle}
        />
      </View>

      {/* Calorie goal */}
      <View style={{ gap: 8 }}>
        <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Calorie Goal (kcal)
        </Text>
        <TextInput
          value={calorieGoal}
          onChangeText={setCalorieGoal}
          placeholder="2000"
          placeholderTextColor={Colors.muted}
          keyboardType="numeric"
          style={inputStyle}
        />
      </View>

      {/* Weight */}
      <View style={{ gap: 8 }}>
        <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Weight (kg)
        </Text>
        <TextInput
          value={weightKg}
          onChangeText={setWeightKg}
          placeholder="75"
          placeholderTextColor={Colors.muted}
          keyboardType="decimal-pad"
          style={inputStyle}
        />
      </View>

      {/* Save */}
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
        <Text style={{ color: '#fff', fontFamily: 'DMSans-Bold', fontSize: 16 }}>
          {isPending ? 'Saving…' : 'Save'}
        </Text>
      </Pressable>
    </BottomSheetScrollView>
  );
}

// ── Settings Row ─────────────────────────────────────────────────────────────

function SettingsRow({
  icon,
  iconColor,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: pressed ? Colors.surface3 : Colors.surface2,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingHorizontal: 16,
        paddingVertical: 16,
        gap: 14,
      })}
    >
      <View style={{
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: `${iconColor}20`,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <Text style={{
        flex: 1,
        color: Colors.text,
        fontFamily: 'DMSans-Medium',
        fontSize: 15,
        marginRight: 8,
      }}>
        {label}
      </Text>
      <View style={{
        width: 28, height: 28, borderRadius: 8,
        backgroundColor: Colors.surface3,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name="chevron-forward" size={14} color={Colors.muted} />
      </View>
    </Pressable>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────

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

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.dark }}>
      <ScrollView
        contentContainerStyle={{ padding: 24, gap: 20, paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 30, letterSpacing: -0.5 }}>
          Profile
        </Text>

        {/* Identity card */}
        <View style={{ backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' }}>
          <View style={{ padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            {/* Avatar */}
            <View style={{
              width: 60, height: 60, borderRadius: 30,
              backgroundColor: `${Colors.orange}18`,
              borderWidth: 2, borderColor: `${Colors.orange}55`,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ color: Colors.orange, fontFamily: 'DMSans-Bold', fontSize: 22 }}>
                {isLoading ? '…' : initials}
              </Text>
            </View>

            {/* Name + email */}
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 18 }}>
                {isLoading ? '—' : (me?.displayName || 'No name set')}
              </Text>
              <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14 }}>
                {email}
              </Text>
            </View>

            {/* Edit pill */}
            <Pressable
              onPress={openEdit}
              style={({ pressed }) => ({
                backgroundColor: Colors.surface2,
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderWidth: 1,
                borderColor: Colors.border,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 12 }}>Edit</Text>
            </Pressable>
          </View>

          {/* Stats row */}
          <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.border, paddingVertical: 16 }}>
            {[
              { label: 'Goal', value: isLoading ? '—' : `${me?.calorieGoal ?? '—'} kcal` },
              { label: 'Weight', value: isLoading ? '—' : (me?.weightKg ? `${me.weightKg} kg` : '—') },
              { label: 'Target', value: isLoading ? '—' : labelCase(me?.primaryGoal) },
            ].map((stat, i) => (
              <View
                key={stat.label}
                style={{
                  flex: 1, alignItems: 'center', gap: 2,
                  borderLeftWidth: i > 0 ? 1 : 0,
                  borderLeftColor: Colors.border,
                }}
              >
                <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 15 }}>
                  {stat.value}
                </Text>
                <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Account */}
        <View style={{ gap: 10 }}>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 4 }}>
            Account
          </Text>
          <SettingsRow
            icon="notifications-outline"
            iconColor={Colors.blue}
            label="Notifications"
            onPress={() => Linking.openSettings()}
          />
          <SettingsRow
            icon="chatbubble-ellipses-outline"
            iconColor={Colors.teal}
            label="Help & Feedback"
            onPress={() => Linking.openURL('mailto:support@gritapp.io')}
          />
          <SettingsRow
            icon="document-text-outline"
            iconColor={Colors.muted}
            label="Privacy Policy"
            onPress={() => Linking.openURL('https://gritapp.io/privacy')}
          />
        </View>

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
          <Ionicons name="log-out-outline" size={20} color={Colors.error} />
          <Text style={{ color: Colors.error, fontFamily: 'DMSans-Bold', fontSize: 16 }}>
            Log out
          </Text>
        </Pressable>

        <Text style={{ color: Colors.border, fontFamily: 'DMSans-Regular', fontSize: 12, textAlign: 'center' }}>
          GRIT · v1.0.0
        </Text>
      </ScrollView>

      {/* Edit sheet */}
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
          <EditSheet
            user={me}
            onClose={() => {
              sheetRef.current?.close();
              setShowEdit(false);
            }}
          />
        )}
      </BottomSheet>
    </SafeAreaView>
  );
}

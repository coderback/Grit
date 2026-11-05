import React, { useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader, ChipGroup } from '@/components/settings/SettingsUI';
import { ErrorNotice } from '@/components/ui/QueryStatus';
import { ExerciseSheet } from '@/components/exercises/ExerciseSheet';
import { useExerciseSearch, type Exercise } from '@/hooks/useExercises';
import { Colors } from '@/constants/colors';

const EQUIPMENT = [
  { value: '', label: 'Any' },
  { value: 'bodyweight', label: 'Bodyweight' },
  { value: 'dumbbell', label: 'Dumbbell' },
  { value: 'barbell', label: 'Barbell' },
  { value: 'kettlebell', label: 'Kettlebell' },
  { value: 'machine', label: 'Machine' },
  { value: 'cable', label: 'Cable' },
  { value: 'band', label: 'Band' },
];

/** The exercise library: search by name and filter by equipment. */
export default function ExercisesScreen() {
  const [q, setQ] = useState('');
  const [equipment, setEquipment] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const { data, isLoading, isError, refetch } = useExerciseSearch(q, { equipment: equipment || undefined });

  const renderItem = ({ item }: { item: Exercise }) => (
    <Pressable
      onPress={() => setOpen(item.id)}
      accessibilityRole="button"
      accessibilityLabel={item.name}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border }}
    >
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={{ width: 52, height: 52, borderRadius: 10, backgroundColor: Colors.surface2 }} />
      ) : (
        <View style={{ width: 52, height: 52, borderRadius: 10, backgroundColor: Colors.surface2 }} />
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 15 }}>{item.name}</Text>
        <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 12, textTransform: 'capitalize' }}>
          {item.primary.join(', ')} · {item.equipment.join(', ')}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.dark }}>
      <ScreenHeader title="Exercise library" />
      <View style={{ paddingHorizontal: 20, gap: 12, flex: 1 }}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search exercises"
          placeholderTextColor={Colors.muted}
          accessibilityLabel="Search exercises"
          style={{ backgroundColor: Colors.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, color: Colors.text, fontFamily: 'DMSans-Regular', fontSize: 15, borderWidth: 1, borderColor: Colors.border }}
        />
        <ChipGroup options={EQUIPMENT} value={equipment} onChange={setEquipment} />
        {isError && !data ? (
          <ErrorNotice what="the exercise library" onRetry={() => refetch()} />
        ) : isLoading ? (
          <ActivityIndicator color={Colors.orange} style={{ marginTop: 20 }} />
        ) : (
          <FlatList
            data={data ?? []}
            keyExtractor={(e) => e.id}
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 40 }}
            ListEmptyComponent={<Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14, marginTop: 20 }}>No exercises match.</Text>}
          />
        )}
      </View>
      <ExerciseSheet id={open} onClose={() => setOpen(null)} />
    </SafeAreaView>
  );
}

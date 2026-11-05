import React, { useState } from 'react';
import { Modal, View, Text, Pressable, TextInput, FlatList, ActivityIndicator } from 'react-native';
import { Colors } from '@/constants/colors';
import { useExerciseSearch, type Exercise } from '@/hooks/useExercises';
import { useAlternatives } from '@/hooks/useWorkouts';

/**
 * Picks an exercise from the library: to add one, or to swap one for
 * another on the same movement (which keeps its progression history).
 */
export function ExercisePicker({ mode, pattern, onPick, onClose }: {
  mode: 'add' | 'swap' | null;
  pattern?: string | null;
  onPick: (e: Exercise) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const swapping = mode === 'swap' && !!pattern;
  const search = useExerciseSearch(swapping ? '' : q);
  const alternatives = useAlternatives(swapping ? pattern! : null, q);
  const { data, isLoading } = swapping ? alternatives : search;

  return (
    <Modal visible={!!mode} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: Colors.dark, paddingTop: 54 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 12 }}>
          <Text style={{ flex: 1, color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 20 }} accessibilityRole="header">
            {swapping ? 'Swap for' : 'Add an exercise'}
          </Text>
          <Pressable onPress={onClose} accessibilityRole="button" hitSlop={10}>
            <Text style={{ color: Colors.orange, fontFamily: 'DMSans-Bold', fontSize: 15 }}>Cancel</Text>
          </Pressable>
        </View>
        {swapping && (
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13, paddingHorizontal: 20, marginTop: 4 }}>
            Same movement, so your progress carries over.
          </Text>
        )}
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search exercises"
          placeholderTextColor={Colors.muted}
          accessibilityLabel="Search exercises"
          autoFocus={!swapping}
          style={{ margin: 20, marginBottom: 8, height: 44, borderRadius: 12, backgroundColor: Colors.surface2, color: Colors.text, paddingHorizontal: 14, fontFamily: 'DMSans-Regular', fontSize: 15 }}
        />
        {isLoading ? (
          <ActivityIndicator color={Colors.orange} style={{ marginTop: 30 }} />
        ) : (
          <FlatList
            data={data ?? []}
            keyExtractor={(e) => e.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => onPick(item)}
                accessibilityRole="button"
                style={({ pressed }) => ({ paddingVertical: 12, borderBottomWidth: 1, borderColor: Colors.border, opacity: pressed ? 0.6 : 1 })}
              >
                <Text style={{ color: Colors.text, fontFamily: 'DMSans-Medium', fontSize: 15 }}>{item.name}</Text>
                <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 12, textTransform: 'capitalize' }}>
                  {[...item.equipment, ...item.primary].join(' · ')}
                </Text>
              </Pressable>
            )}
            ListEmptyComponent={<Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14, marginTop: 20 }}>Nothing found.</Text>}
          />
        )}
      </View>
    </Modal>
  );
}

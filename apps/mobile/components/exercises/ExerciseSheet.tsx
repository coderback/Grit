import React from 'react';
import { Modal, View, Text, Pressable, ScrollView, Image, ActivityIndicator } from 'react-native';
import { useExercise } from '@/hooks/useExercises';
import { Colors } from '@/constants/colors';

const words = (s: string) => s.replace(/_/g, ' ');

/** One exercise from the library: picture, muscles, equipment and how to do it. */
export function ExerciseSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data: e, isLoading } = useExercise(id);
  return (
    <Modal visible={!!id} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
        <View style={{ backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '86%' }}>
          <ScrollView contentContainerStyle={{ padding: 22, gap: 14, paddingBottom: 36 }}>
            {isLoading || !e ? (
              <ActivityIndicator color={Colors.orange} />
            ) : (
              <>
                {!!e.imageUrl && (
                  <Image
                    source={{ uri: e.imageUrl }}
                    style={{ width: '100%', height: 200, borderRadius: 16, backgroundColor: Colors.surface2 }}
                    resizeMode="cover"
                    accessibilityLabel={e.name}
                  />
                )}
                <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 20 }} accessibilityRole="header">
                  {e.name}
                </Text>
                <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13, textTransform: 'capitalize' }}>
                  {[...e.primary, ...e.secondary].map(words).join(', ')}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {[...e.equipment, e.level, e.mechanics].filter((t): t is string => !!t).map((t) => (
                    <View key={t} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: Colors.surface2 }}>
                      <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 12, textTransform: 'capitalize' }}>{words(t)}</Text>
                    </View>
                  ))}
                </View>
                {!!e.instructions && (
                  <View style={{ gap: 8 }}>
                    {e.instructions.split('\n').map((step, i) => (
                      <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
                        <Text style={{ color: Colors.orange, fontFamily: 'JetBrainsMono-Regular', fontSize: 13 }}>{i + 1}.</Text>
                        <Text style={{ flex: 1, color: Colors.text, fontFamily: 'DMSans-Regular', fontSize: 14, lineHeight: 21 }}>{step}</Text>
                      </View>
                    ))}
                  </View>
                )}
                <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 11 }}>From free-exercise-db (public domain).</Text>
              </>
            )}
            <Pressable onPress={onClose} accessibilityRole="button" style={{ alignItems: 'center', paddingVertical: 10 }}>
              <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 15 }}>Close</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

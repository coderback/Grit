import React from 'react';
import { Modal, View, Text, Pressable } from 'react-native';
import { Colors } from '@/constants/colors';

export interface MenuItem {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

/** A list of actions sliding up from the bottom. */
export function MenuSheet({ title, items, onClose }: { title: string | null; items: MenuItem[]; onClose: () => void }) {
  return (
    <Modal visible={!!title} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} accessibilityLabel="Close" />
      <View style={{ backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 34, gap: 4 }}>
        <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 13, paddingBottom: 6 }}>{title}</Text>
        {items.filter((i) => !i.disabled).map((i) => (
          <Pressable
            key={i.label}
            onPress={() => {
              onClose();
              i.onPress();
            }}
            accessibilityRole="button"
            style={({ pressed }) => ({ paddingVertical: 13, opacity: pressed ? 0.6 : 1 })}
          >
            <Text style={{ color: i.destructive ? Colors.error : Colors.text, fontFamily: 'DMSans-Medium', fontSize: 16 }}>{i.label}</Text>
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

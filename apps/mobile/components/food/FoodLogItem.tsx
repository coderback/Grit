import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Colors } from '@/constants/colors';
import type { FoodLog } from '@/hooks/useFoodLog';

interface FoodLogItemProps {
  item: FoodLog;
  onDelete: (id: string) => void;
}

export function FoodLogItem({ item, onDelete }: FoodLogItemProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: Colors.surface,
        borderRadius: 16,
        gap: 12,
        borderWidth: 1,
        borderColor: Colors.border,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: Colors.text,
            fontFamily: 'DMSans-Medium',
            fontSize: 15,
          }}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        {item.brand && (
          <Text
            style={{
              color: Colors.muted,
              fontFamily: 'DMSans-Regular',
              fontSize: 12,
              marginTop: 1,
            }}
          >
            {item.brand}
          </Text>
        )}
        <Text
          style={{
            color: Colors.muted,
            fontFamily: 'DMSans-Regular',
            fontSize: 12,
            marginTop: 2,
          }}
        >
          {item.servingQty} {item.servingUnit} · P {Math.round(item.proteinG)}g · C {Math.round(item.carbsG)}g · F {Math.round(item.fatG)}g
        </Text>
      </View>

      <Text
        style={{
          color: Colors.text,
          fontFamily: 'JetBrainsMono-Regular',
          fontSize: 15,
          minWidth: 50,
          textAlign: 'right',
        }}
      >
        {Math.round(item.calories)}
      </Text>

      <Pressable
        onPress={() => onDelete(item.id)}
        hitSlop={12}
        style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
      >
        <Text style={{ color: Colors.muted, fontSize: 18, lineHeight: 20 }}>×</Text>
      </Pressable>
    </View>
  );
}

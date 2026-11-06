import React from 'react';
import { View, Text } from 'react-native';
import { Colors } from '@/constants/colors';

/** "✓ Verified": the numbers come from a government food table or the manufacturer's own data. */
export function VerifiedPill({ size = 'small' }: { size?: 'small' | 'medium' }) {
  return (
    <View style={{ backgroundColor: `${Colors.teal}20`, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={{ color: Colors.teal, fontFamily: 'DMSans-Bold', fontSize: size === 'small' ? 10 : 11 }}>✓ Verified</Text>
    </View>
  );
}

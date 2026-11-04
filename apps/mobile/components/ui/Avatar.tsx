import React, { useState } from 'react';
import { View, Text, Image } from 'react-native';
import { Colors } from '@/constants/colors';

/** A round profile photo, or the first letter of the name when there isn't one. */
export function Avatar({
  name,
  url,
  size = 38,
  ring = Colors.border,
}: {
  name: string;
  url?: string | null;
  size?: number;
  ring?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showPhoto = !!url && !failed;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: Colors.surface2,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: size >= 60 ? 2 : 1.5,
        borderColor: ring,
        overflow: 'hidden',
      }}
    >
      {showPhoto ? (
        <Image
          source={{ uri: url }}
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%' }}
          accessibilityLabel={`${name}'s photo`}
        />
      ) : (
        <Text style={{ fontFamily: 'DMSans-Bold', color: Colors.orange, fontSize: Math.round(size * 0.42) }}>
          {(name.trim().charAt(0) || '?').toUpperCase()}
        </Text>
      )}
    </View>
  );
}

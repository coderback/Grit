import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<string, [IoniconsName, IoniconsName]> = {
  index: ['home-outline', 'home'],
  food: ['nutrition-outline', 'nutrition'],
  activity: ['barbell-outline', 'barbell'],
  habits: ['checkmark-circle-outline', 'checkmark-circle'],
  social: ['people-outline', 'people'],
};

const TAB_LABELS: Record<string, string> = {
  index: 'Home',
  food: 'Food',
  activity: 'Activity',
  habits: 'Habits',
  social: 'Social',
};

function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <View
      style={{
        position: 'absolute',
        bottom: 20,
        left: 16,
        right: 16,
      }}
      pointerEvents="box-none"
    >
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: Colors.surface,
          borderRadius: 999,
          paddingVertical: 10,
          paddingHorizontal: 6,
          borderWidth: 1,
          borderColor: Colors.border,
          elevation: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.35,
          shadowRadius: 12,
        }}
      >
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const icons = TAB_ICONS[route.name];
          const label = TAB_LABELS[route.name] ?? route.name;
          const color = isFocused ? Colors.orange : Colors.muted;

          return (
            <Pressable
              key={route.key}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              }}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 4, gap: 3 }}
            >
              <Ionicons
                name={isFocused && icons ? icons[1] : icons?.[0]}
                size={22}
                color={color}
              />
              <Text
                style={{
                  color,
                  fontSize: 10,
                  fontFamily: 'DMSans-Medium',
                }}
              >
                {label}
              </Text>
              {isFocused && (
                <View
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: Colors.orange,
                  }}
                />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="food" />
      <Tabs.Screen name="activity" />
      <Tabs.Screen name="habits" />
      <Tabs.Screen name="social" />
    </Tabs>
  );
}

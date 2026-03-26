import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import type { WeekDay } from '@/hooks/useActivityLog';

interface WeeklyBarChartProps {
  days: WeekDay[];
}

const CHART_HEIGHT = 120;
const BAR_WIDTH = 28;
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function WeeklyBarChart({ days }: WeeklyBarChartProps) {
  const maxMinutes = Math.max(...days.map((d) => d.activeMinutes), 1);
  const today = new Date().toISOString().split('T')[0];

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        {days.map((day, i) => {
          const barH = Math.max((day.activeMinutes / maxMinutes) * CHART_HEIGHT, 4);
          const isToday = day.date === today;
          const hasActivity = day.activeMinutes > 0;

          return (
            <View key={day.date} style={{ alignItems: 'center', gap: 6 }}>
              {/* Minute label on top of bar */}
              {hasActivity && (
                <Text style={{
                  color: Colors.muted,
                  fontFamily: 'DMSans-Regular',
                  fontSize: 10,
                }}>
                  {day.activeMinutes}m
                </Text>
              )}
              {/* Bar */}
              <View style={{
                width: BAR_WIDTH,
                height: CHART_HEIGHT,
                justifyContent: 'flex-end',
              }}>
                <View style={{
                  width: BAR_WIDTH,
                  height: barH,
                  backgroundColor: isToday ? Colors.orange : hasActivity ? Colors.blue : Colors.surface2,
                  borderRadius: 6,
                }} />
              </View>
              {/* Day label */}
              <Text style={{
                color: isToday ? Colors.orange : Colors.muted,
                fontFamily: isToday ? 'DMSans-Bold' : 'DMSans-Regular',
                fontSize: 12,
              }}>
                {DAY_LABELS[i]}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

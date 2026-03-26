import React from 'react';
import { View, Text } from 'react-native';
import { Colors } from '@/constants/colors';
import type { StreakDay } from '@/hooks/useHabits';

interface HabitStreakProps {
  grid: StreakDay[];
  streakCount: number;
}

const CELL_SIZE = 14;
const CELL_GAP = 3;
const DAYS_PER_ROW = 10; // 30 days = 3 rows of 10

export function HabitStreak({ grid, streakCount }: HabitStreakProps) {
  // Chunk into rows
  const rows: StreakDay[][] = [];
  for (let i = 0; i < grid.length; i += DAYS_PER_ROW) {
    rows.push(grid.slice(i, i + DAYS_PER_ROW));
  }

  const today = new Date().toISOString().split('T')[0];

  return (
    <View style={{ gap: 8 }}>
      {/* Grid */}
      <View style={{ gap: CELL_GAP }}>
        {rows.map((row, ri) => (
          <View key={ri} style={{ flexDirection: 'row', gap: CELL_GAP }}>
            {row.map((day) => {
              const isToday = day.date === today;
              return (
                <View
                  key={day.date}
                  style={{
                    width: CELL_SIZE,
                    height: CELL_SIZE,
                    borderRadius: 3,
                    backgroundColor: day.completed
                      ? Colors.success
                      : Colors.surface2,
                    borderWidth: isToday ? 1.5 : 0,
                    borderColor: isToday ? Colors.orange : 'transparent',
                  }}
                />
              );
            })}
          </View>
        ))}
      </View>

      {/* Streak count */}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
        <Text style={{
          color: Colors.success,
          fontFamily: 'JetBrainsMono-Regular',
          fontSize: 18,
        }}>
          {streakCount}
        </Text>
        <Text style={{
          color: Colors.muted,
          fontFamily: 'DMSans-Regular',
          fontSize: 13,
        }}>
          day streak
        </Text>
      </View>
    </View>
  );
}

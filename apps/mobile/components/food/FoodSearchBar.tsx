import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useFoodSearch, type NormalizedFood } from '@/hooks/useFoodLog';
import { Colors } from '@/constants/colors';

interface FoodSearchBarProps {
  onSelect: (food: NormalizedFood) => void;
}

export function FoodSearchBar({ onSelect }: FoodSearchBarProps) {
  const [query, setQuery] = useState('');
  const { data: results, isLoading } = useFoodSearch(query);

  const renderItem = useCallback(
    ({ item }: { item: NormalizedFood }) => (
      <Pressable
        onPress={() => {
          onSelect(item);
          setQuery('');
        }}
        style={({ pressed }) => ({
          paddingVertical: 12,
          paddingHorizontal: 16,
          backgroundColor: pressed ? Colors.surface2 : 'transparent',
          borderBottomWidth: 1,
          borderBottomColor: Colors.border,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        })}
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
              }}
            >
              {item.brand}
            </Text>
          )}
        </View>
        <Text
          style={{
            color: Colors.muted,
            fontFamily: 'JetBrainsMono-Regular',
            fontSize: 13,
            marginLeft: 8,
          }}
        >
          {Math.round(item.calories)} kcal
        </Text>
      </Pressable>
    ),
    [onSelect],
  );

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: Colors.surface2,
          borderRadius: 16,
          paddingHorizontal: 14,
          height: 48,
          borderWidth: 1.5,
          borderColor: Colors.border,
          gap: 8,
        }}
      >
        <Text style={{ color: Colors.muted, fontSize: 16 }}>🔍</Text>
        <TextInput
          style={{
            flex: 1,
            color: Colors.text,
            fontFamily: 'DMSans-Regular',
            fontSize: 15,
          }}
          placeholder="Search foods..."
          placeholderTextColor={Colors.muted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {isLoading && <ActivityIndicator size="small" color={Colors.muted} />}
        {query.length > 0 && !isLoading && (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Text style={{ color: Colors.muted, fontSize: 16 }}>×</Text>
          </Pressable>
        )}
      </View>

      {query.length >= 2 && results && results.length > 0 && (
        <View
          style={{
            backgroundColor: Colors.surface,
            borderRadius: 16,
            marginTop: 6,
            maxHeight: 300,
            overflow: 'hidden',
          }}
        >
          <FlatList
            data={results}
            keyExtractor={(item, i) => `${item.offId}-${i}`}
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
          />
        </View>
      )}

      {query.length >= 2 && !isLoading && results?.length === 0 && (
        <View
          style={{
            backgroundColor: Colors.surface,
            borderRadius: 16,
            marginTop: 6,
            padding: 16,
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular' }}>
            No results for "{query}"
          </Text>
          <Pressable onPress={() => onSelect({ offId: '', name: query, brand: null, barcode: null, calories: 0, proteinG: 0, carbsG: 0, fatG: 0, servingQty: 1, servingUnit: 'serving', imageUrl: null })}>
            <Text style={{ color: Colors.orange, fontFamily: 'DMSans-Bold' }}>
              Log "{query}" manually →
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

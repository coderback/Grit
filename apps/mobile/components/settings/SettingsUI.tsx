import React from 'react';
import { View, Text, Pressable, Switch, TextInput, type TextInputProps } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';

/** Title bar with a back button, for screens pushed from Profile. */
export function ScreenHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={8}
        style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ color: Colors.text, fontSize: 20, marginTop: -2 }}>‹</Text>
      </Pressable>
      <Text style={{ flex: 1, color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 22, letterSpacing: -0.3 }}>{title}</Text>
      {right}
    </View>
  );
}

/** A titled group of rows on a card. */
export function Section({ title, footer, children }: { title?: string; footer?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      {!!title && (
        <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 4 }}>
          {title}
        </Text>
      )}
      <View style={{ backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 16 }}>
        {children}
      </View>
      {!!footer && (
        <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 12, lineHeight: 17, paddingHorizontal: 4 }}>{footer}</Text>
      )}
    </View>
  );
}

export function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ color: Colors.text, fontFamily: 'DMSans-Medium', fontSize: 14 }}>{children}</Text>
      {!!hint && <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 12, lineHeight: 16 }}>{hint}</Text>}
    </View>
  );
}

/** Single-choice pills. */
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T | null | undefined;
  onChange: (v: T) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => {
              Haptics.selectionAsync();
              onChange(o.value);
            }}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 9,
              borderRadius: 999,
              backgroundColor: selected ? Colors.orange : Colors.surface2,
              borderWidth: 1,
              borderColor: selected ? Colors.orange : Colors.border,
            }}
          >
            <Text style={{ color: selected ? '#fff' : Colors.muted, fontFamily: selected ? 'DMSans-Bold' : 'DMSans-Medium', fontSize: 13 }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ToggleRow({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, opacity: disabled ? 0.5 : 1 }}>
      <View style={{ flex: 1 }}>
        <FieldLabel hint={hint}>{label}</FieldLabel>
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ false: Colors.surface3, true: Colors.orange }}
        thumbColor="#fff"
      />
    </View>
  );
}

/** A numeric input with a unit suffix. Reports the parsed number, or null when empty or invalid. */
export function NumberField({
  value,
  onChange,
  unit,
  placeholder,
  decimals = false,
  ...rest
}: {
  value: string;
  onChange: (text: string) => void;
  unit?: string;
  placeholder?: string;
  decimals?: boolean;
} & Omit<TextInputProps, 'value' | 'onChangeText' | 'onChange'>) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface2, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14 }}>
      <TextInput
        value={value}
        onChangeText={(t) => onChange(t.replace(decimals ? /[^0-9.]/g : /[^0-9]/g, ''))}
        keyboardType={decimals ? 'decimal-pad' : 'number-pad'}
        placeholder={placeholder}
        placeholderTextColor={Colors.muted}
        style={{ flex: 1, color: Colors.text, fontFamily: 'JetBrainsMono-Regular', fontSize: 16, paddingVertical: 12 }}
        {...rest}
      />
      {!!unit && <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14 }}>{unit}</Text>}
    </View>
  );
}

/** A tappable row that opens another screen or runs an action. */
export function NavRow({
  icon,
  label,
  sub,
  onPress,
  destructive,
}: {
  icon?: string;
  label: string;
  sub?: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const color = destructive ? Colors.error : Colors.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.6 : 1 })}
    >
      {!!icon && <Text style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{icon}</Text>}
      <View style={{ flex: 1 }}>
        <Text style={{ color, fontFamily: 'DMSans-Bold', fontSize: 15 }}>{label}</Text>
        {!!sub && <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 12, marginTop: 1 }}>{sub}</Text>}
      </View>
      {!destructive && <Text style={{ color: Colors.muted, fontSize: 16 }}>›</Text>}
    </Pressable>
  );
}

/** Full-width primary button. */
export function PrimaryButton({ label, onPress, disabled, loading }: { label: string; onPress: () => void; disabled?: boolean; loading?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      style={({ pressed }) => ({
        backgroundColor: Colors.orange,
        borderRadius: 999,
        paddingVertical: 16,
        alignItems: 'center',
        opacity: disabled || loading ? 0.5 : pressed ? 0.85 : 1,
      })}
    >
      <Text style={{ color: '#fff', fontFamily: 'DMSans-Bold', fontSize: 16 }}>{loading ? 'Saving…' : label}</Text>
    </Pressable>
  );
}

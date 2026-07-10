import { useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { CalendarDays } from 'lucide-react-native';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { colors, radius } from '@/constants/colors';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';

export function TransactionDateInput({ value, onChange }: { value: Date; onChange: (date: Date) => void }) {
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const handleValueChange = (_event: unknown, selectedDate: Date) => {
    if (Platform.OS === 'android') setIsPickerVisible(false);
    onChange(selectedDate);
  };

  return <View style={styles.group}><Text variant="label">DATE</Text><Pressable accessibilityRole="button" accessibilityLabel="Choose transaction date" onPress={() => setIsPickerVisible(true)} style={({ pressed }) => [styles.field, pressed && styles.pressed]}><CalendarDays size={19} color={colors.primary} /><Text>{new Intl.DateTimeFormat('en-TN', { month: 'long', day: 'numeric', year: 'numeric' }).format(value)}</Text></Pressable>{isPickerVisible && <View style={styles.picker}><DateTimePicker value={value} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} maximumDate={new Date()} onValueChange={handleValueChange} onDismiss={() => setIsPickerVisible(false)} />{Platform.OS === 'ios' && <Button size="sm" onPress={() => setIsPickerVisible(false)}>Done</Button>}</View>}</View>;
}

const styles = StyleSheet.create({ group: { gap: 7 }, field: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.sm, paddingHorizontal: 14 }, picker: { gap: 10, padding: 8, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted }, pressed: { opacity: .75 } });

import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { CategoryChip } from '@/components/finance/CategoryChip';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { MAX_CATEGORY_NAME_LENGTH, categoryOptionsFor, customCategoryEmojis } from '@/constants/categories';
import { colors, radius } from '@/constants/colors';
import { useTransactions } from '@/features/transactions/transaction-store';
import type { CategoryKind } from '@/types/category';
import type { TransactionCategory } from '@/types/transaction';

type CategoryPickerProps = {
  kind: CategoryKind;
  value: TransactionCategory;
  onChange: (category: TransactionCategory) => void;
};

/**
 * Category chips for income/expense forms, plus a "+ New" chip that lets the
 * user name their own category. A new category is saved and selected right away.
 */
export function CategoryPicker({ kind, value, onChange }: CategoryPickerProps) {
  const { customCategories, addCustomCategory } = useTransactions();
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(customCategoryEmojis[0]);
  const [error, setError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);

  const closeForm = () => {
    setIsCreating(false);
    setName('');
    setEmoji(customCategoryEmojis[0]);
    setError(undefined);
  };

  const createCategory = async () => {
    setIsSaving(true);
    try {
      const created = await addCustomCategory({ name, emoji, kind });
      onChange(created.id);
      closeForm();
    } catch (creationError) {
      setError(creationError instanceof Error ? creationError.message : 'Category could not be saved.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.section}>
      <Text variant="label">CATEGORY</Text>
      <View style={styles.chips}>
        {categoryOptionsFor(kind, customCategories).map((item) => (
          <CategoryChip
            key={item.id}
            label={item.label}
            emoji={item.emoji}
            selected={value === item.id}
            onPress={() => onChange(item.id)}
          />
        ))}
        {!isCreating && <CategoryChip label="New" emoji="＋" onPress={() => setIsCreating(true)} />}
      </View>

      {isCreating && (
        <View style={styles.form}>
          <Input
            label={`New ${kind} category`}
            placeholder={kind === 'income' ? 'e.g. Freelance' : 'e.g. Gym'}
            value={name}
            maxLength={MAX_CATEGORY_NAME_LENGTH}
            autoFocus
            returnKeyType="done"
            onChangeText={(text) => {
              setName(text);
              setError(undefined);
            }}
            onSubmitEditing={() => void createCategory()}
            error={error}
          />
          <View style={styles.emojis}>
            {customCategoryEmojis.map((item) => (
              <Pressable
                key={item}
                accessibilityRole="button"
                accessibilityLabel={`Icon ${item}`}
                accessibilityState={{ selected: emoji === item }}
                onPress={() => setEmoji(item)}
                style={({ pressed }) => [styles.emoji, emoji === item && styles.emojiSelected, pressed && styles.pressed]}
              >
                <Text style={styles.emojiText}>{item}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.actions}>
            <Button variant="secondary" size="sm" disabled={isSaving} onPress={closeForm}>
              Cancel
            </Button>
            <Button size="sm" loading={isSaving} disabled={!name.trim()} onPress={() => void createCategory()}>
              Add category
            </Button>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  form: {
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  emojis: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  emoji: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emojiSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  emojiText: { fontSize: 18 },
  pressed: { opacity: 0.75 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});

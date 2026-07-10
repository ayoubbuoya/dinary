import { parseTndToMillimes } from '@/lib/parse-money';
import type { TransactionCategory, TransactionType } from '@/types/transaction';

export type VoiceTransactionDraft = {
  transcript: string;
  amount?: string;
  amountMillimes?: number;
  type?: Extract<TransactionType, 'income' | 'expense'>;
  category?: TransactionCategory;
  needsReview: string[];
};

const arabicDigits: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5',
  '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

function normalize(transcript: string) {
  return transcript.toLowerCase().replace(/[٠-٩]/g, (digit) => arabicDigits[digit] ?? digit);
}

function includesAny(value: string, phrases: string[]) {
  return phrases.some((phrase) => value.includes(phrase));
}

export function parseVoiceTransaction(transcript: string): VoiceTransactionDraft {
  const normalized = normalize(transcript);
  const isIncome = includesAny(normalized, ['salary', 'income', 'received', 'got paid', 'خلصت', 'راتب', 'salaire']);
  const isExpense = includesAny(normalized, ['spent', 'paid', 'bought', 'purchase', 'sraft', 'srafft', 'صرف', 'دفعت', 'اشتريت', 'خلصت']);
  const type = isIncome === isExpense ? undefined : isIncome ? 'income' : isExpense ? 'expense' : undefined;
  const category = includesAny(normalized, ['coffee', 'café', 'cafe', 'قهوة']) ? 'coffee'
    : includesAny(normalized, ['mlawi', 'food', 'restaurant', 'meal', 'eating', 'أكل', 'مطعم']) ? 'food'
      : includesAny(normalized, ['grocery', 'groceries', 'supermarket', 'market', 'بقالة']) ? 'groceries'
        : includesAny(normalized, ['taxi', 'transport', 'metro', 'bus', 'uber', 'نقل']) ? 'transport'
          : includesAny(normalized, ['bill', 'electricity', 'internet', 'phone', 'فاتورة']) ? 'bills'
            : includesAny(normalized, ['doctor', 'pharmacy', 'health', 'طبيب', 'دواء']) ? 'health'
              : includesAny(normalized, ['salary', 'salaire', 'راتب']) ? 'salary'
                : undefined;

  // A bare number can describe a quantity (for example, "three coffees"), so
  // only turn it into money when the user also says a currency unit.
  const amountMatch = /\b(\d+(?:[.,]\d{1,3})?)\s*(?:tnd|dt|dinar(?:s)?|دينار)\b/.exec(normalized);
  const amount = amountMatch?.[1];
  const amountMillimes = amount ? parseTndToMillimes(amount) ?? undefined : undefined;
  const needsReview = [
    !amountMillimes && 'Add the amount.',
    !type && 'Choose income or expense.',
    !category && 'Choose a category.',
  ].filter(Boolean) as string[];

  return { transcript, amount, amountMillimes, type, category, needsReview };
}

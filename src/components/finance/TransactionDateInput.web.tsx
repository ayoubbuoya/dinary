import { useState } from 'react';
import { Input } from '@/components/ui/Input';

function toDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function TransactionDateInput({ value, onChange }: { value: Date; onChange: (date: Date) => void }) {
  const [dateValue, setDateValue] = useState(toDateValue(value));
  return <Input label="Date" value={dateValue} placeholder="YYYY-MM-DD" onChangeText={(nextValue) => { setDateValue(nextValue); const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(nextValue); if (!match) return; const nextDate = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])); if (nextDate <= new Date() && nextDate.getFullYear() === Number(match[1]) && nextDate.getMonth() === Number(match[2]) - 1 && nextDate.getDate() === Number(match[3])) onChange(nextDate); }} />;
}

import type { AccountType } from '@/types/account';

export type AccountConfig = {
  id: string;
  name: string;
  type: AccountType;
  emoji: string;
  defaultOpeningBalanceMillimes?: number;
};

export const defaultAccounts: AccountConfig[] = [
  { id: 'cash', name: 'Cash (Espèces)', type: 'cash', emoji: '💵' },
  { id: 'bank_card', name: 'Bank Card (Carte)', type: 'bank_card', emoji: '💳' },
  { id: 'e_dinar', name: 'e-Dinar / D17', type: 'e_wallet', emoji: '📮' },
  { id: 'flouci', name: 'Flouci Wallet', type: 'e_wallet', emoji: '📱' },
];

export function accountConfigFor(id: string): AccountConfig {
  return defaultAccounts.find((account) => account.id === id) ?? {
    id,
    name: id,
    type: 'other',
    emoji: '👛',
  };
}

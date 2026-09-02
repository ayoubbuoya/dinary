export type AccountType = 'cash' | 'bank_card' | 'bank_account' | 'e_wallet' | 'other';

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  openingBalanceMillimes: number;
  isArchived: boolean;
  emoji: string;
};

export type RecurringType = 'income' | 'expense';

export type RecurringRule = {
  id: string;
  type: RecurringType;
  amountMillimes: number;
  accountId: string;
  dayOfMonth: number; // 1 to 31
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SalaryRuleInput = {
  amountMillimes: number;
  accountId: string;
  dayOfMonth: number;
  description?: string;
  isActive?: boolean;
};

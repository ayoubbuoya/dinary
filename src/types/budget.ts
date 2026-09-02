import type { TransactionCategory } from './transaction';

export type CategoryBudget = {
  id: string;
  category: TransactionCategory;
  amountMillimes: number;
  monthKey?: string; // e.g. "2026-09" or null for perpetual monthly default
  createdAt: string;
  updatedAt: string;
};

export type CategoryBudgetStatus = {
  category: TransactionCategory;
  budgetMillimes: number;
  spentMillimes: number;
  remainingMillimes: number;
  percentageUsed: number;
  isOverBudget: boolean;
};

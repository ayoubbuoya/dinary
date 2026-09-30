import { categories } from '@/constants/categories';
import type { TransactionCategory } from '@/types/transaction';
import { HttpError } from './http';

/**
 * Tiny validators for request bodies and imported backups.
 * They throw an HttpError(400) with a short, readable message on the first problem found.
 */

export type Input = Record<string, unknown>;

const builtInIds = new Set<string>(categories.map((category) => category.id));

export function fail(message: string): never {
  throw new HttpError(400, message);
}

export function asObject(value: unknown, label = 'Request body'): Input {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object.`);
  return value as Input;
}

export function asString(value: unknown, label: string, maxLength = 200): string {
  if (typeof value !== 'string') fail(`${label} must be text.`);
  const trimmed = value.trim();
  if (!trimmed) fail(`${label} is required.`);
  if (trimmed.length > maxLength) fail(`${label} is too long (max ${maxLength} characters).`);
  return trimmed;
}

export function asOptionalString(value: unknown, label: string, maxLength = 500): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') fail(`${label} must be text.`);
  const trimmed = value.trim();
  if (trimmed.length > maxLength) fail(`${label} is too long (max ${maxLength} characters).`);
  return trimmed || null;
}

export function asEnum<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) fail(`${label} must be one of: ${allowed.join(', ')}.`);
  return value as T;
}

/** Whole millimes only. Floats such as 20.5 are rejected so money is never stored as a fraction. */
export function asMillimes(value: unknown, label: string, { allowZero = false, allowNegative = false } = {}): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) fail(`${label} must be a whole number of millimes.`);
  if (!allowNegative && value < 0) fail(`${label} cannot be negative.`);
  if (!allowZero && value === 0) fail(`${label} must be more than zero.`);
  return value;
}

export function asInteger(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    fail(`${label} must be a whole number between ${min} and ${max}.`);
  }
  return value;
}

export function asBoolean(value: unknown, label: string, fallback?: boolean): boolean {
  if (value === undefined && fallback !== undefined) return fallback;
  // The old SQLite backup stores booleans as 0/1.
  if (value === 0 || value === 1) return value === 1;
  if (typeof value !== 'boolean') fail(`${label} must be true or false.`);
  return value;
}

/** A full ISO-8601 timestamp, normalised to UTC (`…Z`) so string sorting matches time order. */
export function asIsoDate(value: unknown, label: string): string {
  if (typeof value !== 'string') fail(`${label} must be a date.`);
  const time = Date.parse(value);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value) || Number.isNaN(time)) fail(`${label} must be an ISO date.`);
  return new Date(time).toISOString();
}

export function asMonthKey(value: unknown, label: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) fail(`${label} must look like 2026-09.`);
  return value;
}

export function asCategory(value: unknown, label = 'Category'): TransactionCategory {
  if (typeof value !== 'string' || !(builtInIds.has(value) || /^custom_[\w-]{1,80}$/.test(value))) {
    fail(`${label} is not a known category.`);
  }
  return value as TransactionCategory;
}

export function asId(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^[\w-]{1,120}$/.test(value)) fail(`${label} is not a valid ID.`);
  return value;
}

import { categories as builtInCategories } from '@/constants/categories';
import { getLocalMonthKey, shiftMonthKey } from './date';
import type { CustomCategory } from '@/types/category';
import type { TransactionCategory } from '@/types/transaction';

/**
 * Deterministic understanding of a Hsebli question: which period, which
 * category, which amount, and what the user wants. No model is involved.
 * Supports English, French, and Tunisian Derja (Latin script, with digits like 3/7/9).
 */

export type HsebliPeriod =
  | { kind: 'month'; monthKey: string }
  | { kind: 'year'; year: number }
  | { kind: 'range'; startMonthKey: string; endMonthKey: string }
  | { kind: 'all' };

export type HsebliIntent =
  | 'help'
  | 'greeting'
  | 'afford'
  | 'balance'
  | 'compare'
  | 'trend'
  | 'breakdown'
  | 'spend'
  | 'income'
  | 'savings'
  | 'largest'
  | 'forecast'
  | 'budget'
  | 'insights'
  | 'recurring'
  | 'weekday'
  | 'average'
  | 'goal'
  | 'count'
  | 'summary';

export type ParsedQuery = {
  normalized: string;
  intent?: HsebliIntent;
  period?: HsebliPeriod;
  /** A second period, used by comparisons such as "compare september and august". */
  comparePeriod?: HsebliPeriod;
  category?: TransactionCategory;
  amountMillimes?: number;
  /** Free-text term for searching notes, e.g. "mlawi" in "how much on mlawi". */
  searchTerm?: string;
};

/** Lowercase, strip accents and apostrophes so "Dépensé" and "depense" match. */
export function normalizeQuery(query: string) {
  return query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’'`]/g, ' ')
    .replace(/[?!.,;:]+(?=\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** True when `text` contains `term` as whole word(s). */
export function hasWord(text: string, term: string) {
  return new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(term)}(?:$|[^a-z0-9])`).test(text);
}

const hasAny = (text: string, terms: string[]) => terms.some((term) => hasWord(text, term));

// ---------------------------------------------------------------------------
// Periods
// ---------------------------------------------------------------------------

const monthNames: { month: number; names: string[] }[] = [
  { month: 0, names: ['january', 'janvier', 'janfi', 'jan'] },
  { month: 1, names: ['february', 'fevrier', 'fivri', 'feb', 'fev'] },
  { month: 2, names: ['march', 'mars', 'mar'] },
  { month: 3, names: ['april', 'avril', 'apr', 'avr'] },
  // "may" is also an English verb, so it is only accepted with a preposition or a year (see below).
  { month: 4, names: ['mai'] },
  { month: 5, names: ['june', 'juin', 'juan', 'jun'] },
  { month: 6, names: ['july', 'juillet', 'jwilia', 'jul'] },
  { month: 7, names: ['august', 'aout', 'out', 'aug'] },
  { month: 8, names: ['september', 'septembre', 'sept', 'sep'] },
  { month: 9, names: ['october', 'octobre', 'oct'] },
  { month: 10, names: ['november', 'novembre', 'nov'] },
  { month: 11, names: ['december', 'decembre', 'dec'] },
];

const CURRENCY = '(?:dt|tnd|dinars?|d|millimes?|mill?)';

type MonthMention = { month: number; index: number; year?: number };

function findMonthMentions(text: string): MonthMention[] {
  const mentions: MonthMention[] = [];
  for (const { month, names } of monthNames) {
    for (const name of names) {
      // "out" (Derja for August) is a common English word: only accept it next to a year.
      const needsContext = name === 'out';
      const regex = new RegExp(`(?:^|[^a-z0-9])(${name})(?:\\s+(20\\d{2}))?(?=$|[^a-z0-9])`, 'g');
      for (const match of text.matchAll(regex)) {
        if (needsContext && !match[2]) continue;
        mentions.push({ month, index: match.index ?? 0, year: match[2] ? Number(match[2]) : undefined });
      }
    }
  }
  // English "may" only with a preposition before it or a year after it.
  for (const match of text.matchAll(/(?:\b(?:in|of|during|for|since|en|fi)\s+may\b|\bmay\s+(20\d{2})\b)/g)) {
    mentions.push({ month: 4, index: match.index ?? 0, year: match[1] ? Number(match[1]) : undefined });
  }
  // Keep one mention per position (a long name and its short form can both match).
  const unique = new Map<string, MonthMention>();
  for (const mention of mentions.sort((a, b) => a.index - b.index)) {
    const key = `${mention.month}-${mention.year ?? ''}`;
    if (!unique.has(key)) unique.set(key, mention);
  }
  return Array.from(unique.values()).sort((a, b) => a.index - b.index);
}

/** Most recent month with this number that is not in the future. */
function resolveMonth(month: number, year: number | undefined, now: Date): string {
  if (year !== undefined) return `${year}-${String(month + 1).padStart(2, '0')}`;
  const resolvedYear = month > now.getMonth() ? now.getFullYear() - 1 : now.getFullYear();
  return `${resolvedYear}-${String(month + 1).padStart(2, '0')}`;
}

/** Four-digit years that are not amounts (e.g. "2025" but not "2000 dt"). */
function findYears(text: string, now: Date): number[] {
  const years: number[] = [];
  const regex = new RegExp(`(?:^|[^0-9.,])(20\\d{2})(?!\\s*${CURRENCY}(?:$|[^a-z]))(?![0-9])(?![.,]\\d)`, 'g');
  for (const match of text.matchAll(regex)) {
    const year = Number(match[1]);
    if (year >= 2000 && year <= now.getFullYear() + 1) years.push(year);
  }
  return years;
}

export function parsePeriods(text: string, now = new Date()): HsebliPeriod[] {
  const currentMonthKey = getLocalMonthKey(now);
  const periods: HsebliPeriod[] = [];

  const lastN = /\b(?:last|past|previous|derniers?|akher|e5er)\s+(\d{1,2})\s+(?:months?|mois|chhour|ash?hor)\b/.exec(text);
  if (lastN) {
    const count = Math.min(24, Math.max(1, Number(lastN[1])));
    periods.push({ kind: 'range', startMonthKey: shiftMonthKey(currentMonthKey, -(count - 1)), endMonthKey: currentMonthKey });
  }

  const monthMentions = findMonthMentions(text);
  const monthYears = new Set(monthMentions.map((mention) => mention.year).filter((year): year is number => year !== undefined));
  for (const mention of monthMentions) {
    periods.push({ kind: 'month', monthKey: resolveMonth(mention.month, mention.year, now) });
  }

  for (const year of findYears(text, now)) {
    if (!monthYears.has(year)) periods.push({ kind: 'year', year });
  }

  if (hasAny(text, ['last month', 'previous month', 'mois dernier', 'mois passe', 'chhar elli fet', 'chhar li fet', 'chhar elli t3ada', 'echhar elli fet'])) {
    periods.push({ kind: 'month', monthKey: shiftMonthKey(currentMonthKey, -1) });
  }
  if (hasAny(text, ['this month', 'current month', 'ce mois', 'mois ci', 'had chhar', 'hal chhar', 'echhar hedha', 'chhar hedha', 'el chhar hedha'])) {
    periods.push({ kind: 'month', monthKey: currentMonthKey });
  }
  if (hasAny(text, ['last year', 'previous year', 'annee derniere', 'annee passee', 'l annee derniere', 'el 3am elli fet', '3am elli fet', 'el am elli fet'])) {
    periods.push({ kind: 'year', year: now.getFullYear() - 1 });
  }
  if (hasAny(text, ['this year', 'current year', 'cette annee', 'el 3am hedha', '3am hedha', 'hal 3am', 'year to date', 'ytd'])) {
    periods.push({ kind: 'year', year: now.getFullYear() });
  }
  if (hasAny(text, ['all time', 'ever', 'since the beginning', 'since i started', 'depuis le debut', 'mel bdeya', 'men lowel'])) {
    periods.push({ kind: 'all' });
  }

  // Remove duplicates while keeping the order of appearance.
  const seen = new Set<string>();
  return periods.filter((period) => {
    const key = JSON.stringify(period);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

const categoryKeywords: Record<string, string[]> = {
  food: ['food', 'foods', 'eating', 'restaurant', 'restaurants', 'resto', 'dining', 'lunch', 'dinner', 'breakfast', 'mekla', 'makla', 'nourriture', 'manger', 'repas', 'ftour', 'fte9', 'mlawi', 'sandwich', 'pizza', 'lablebi', 'kafteji'],
  groceries: ['groceries', 'grocery', 'supermarket', 'courses', 'epicerie', 'hanout', 'carrefour', 'monoprix', 'aziza', 'geant', 'marche', 'souk', 'khodhra'],
  transport: ['transport', 'transportation', 'taxi', 'louage', 'metro', 'bus', 'train', 'fuel', 'gas', 'petrol', 'essence', 'carburant', 'uber', 'bolt', 'yassir', 'parking', 'car', 'karhba'],
  coffee: ['coffee', 'coffees', 'cafe', 'kahwa', 'qahwa', '9ahwa', 'kahoua', 'capucin', 'express', 'direct', 'the', 'tea'],
  family: ['family', 'famille', '3ayla', 'ayla', 'kids', 'children', 'enfants', 'sghar', 'parents', 'wife', 'husband'],
  bills: ['bill', 'bills', 'facture', 'factures', 'steg', 'sonede', 'internet', 'wifi', 'phone', 'mobile', 'ooredoo', 'orange', 'telecom', 'tt', 'rent', 'loyer', 'kra', 'electricity', 'water', 'electricite', 'eau'],
  health: ['health', 'sante', 'pharmacy', 'pharmacie', 'doctor', 'medecin', 'tbib', 'medicine', 'medicament', 'dwe', 'dentist', 'dentiste', 'hospital', 'clinique'],
  shopping: ['shopping', 'clothes', 'clothing', 'vetements', 'hwayej', 'shoes', 'chaussures', 'zara', 'amazon', 'temu', 'shein'],
  salary: ['salary', 'salaire', 'paycheck', 'pay', 'chehriya', 'khlas', 'paie'],
  other: ['other', 'others', 'misc', 'autre', 'autres'],
};

export function detectCategory(text: string, customCategories: CustomCategory[] = []): TransactionCategory | undefined {
  // Custom names first: they are the user's own words and are more specific.
  const custom = [...customCategories]
    .sort((a, b) => b.name.length - a.name.length)
    .find((category) => hasWord(text, normalizeQuery(category.name)));
  if (custom) return custom.id;

  for (const category of builtInCategories) {
    if (hasWord(text, category.label.toLowerCase())) return category.id;
  }
  for (const [id, keywords] of Object.entries(categoryKeywords)) {
    // "the"/"direct"/"express"/"car"/"pay" are too common alone; require a spending word nearby.
    const strict = ['the', 'direct', 'express', 'car', 'pay', 'tt', 'gas'];
    const matched = keywords.find((keyword) => hasWord(text, keyword));
    if (!matched) continue;
    if (strict.includes(matched) && !hasAny(text, ['spend', 'spent', 'on', 'sur', '3la', 'fi'])) continue;
    return id as TransactionCategory;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Amounts
// ---------------------------------------------------------------------------

/** Converts "1.5k", "2 000", "20,500" style text to integer millimes without float maths. */
function toMillimes(raw: string, isThousands: boolean): number | null {
  const compact = raw.replace(/\s/g, '');
  const match = /^(\d+)(?:[.,](\d{1,3}))?$/.exec(compact);
  if (!match) return null;
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? '').padEnd(3, '0'));
  const millimes = isThousands ? whole * 1_000_000 + fraction * 1000 : whole * 1000 + fraction;
  return Number.isSafeInteger(millimes) && millimes > 0 ? millimes : null;
}

export function extractAmountMillimes(text: string, now = new Date()): number | undefined {
  const years = new Set(findYears(text, now).map(String));
  // Prefer a number written with a currency or "k".
  const withUnit = new RegExp(`(\\d+(?:[.,]\\d{1,3})?)\\s*(k|${CURRENCY})(?=$|[^a-z])`).exec(text);
  if (withUnit) {
    const value = toMillimes(withUnit[1], withUnit[2] === 'k');
    if (value) return value;
  }
  for (const match of text.matchAll(/(\d+(?:[.,]\d{1,3})?)/g)) {
    const raw = match[1];
    if (years.has(raw)) continue;
    const after = text.slice((match.index ?? 0) + raw.length).trimStart();
    if (/^(?:months?|mois|chhour|days?|jours?|weeks?)\b/.test(after)) continue;
    const value = toMillimes(raw, false);
    if (value) return value;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Intents
// ---------------------------------------------------------------------------

const intentKeywords: { intent: HsebliIntent; terms: string[]; weight?: number }[] = [
  { intent: 'help', terms: ['help', 'what can you do', 'what can i ask', 'aide', 'commands', 'chnowa tnajem', 'chnajem nes2el', 'how do you work'] },
  { intent: 'greeting', terms: ['hi', 'hello', 'hey', 'salut', 'bonjour', 'aslema', 'ahla', 'salam', 'bonsoir', 'labes'] },
  { intent: 'afford', terms: ['can i spend', 'can i afford', 'afford', 'can i buy', 'should i buy', 'najjem nosref', 'najem nosref', 'nosref', 'najjem nechri', 'nechri', 'puis je depenser', 'je peux depenser', 'puis je acheter', 'je peux acheter'], weight: 3 },
  { intent: 'goal', terms: ['how long', 'how many months', 'goal', 'objectif', 'reach', 'combien de temps', 'kadech men chhar', 'to save', 'save up', 'n7ot', 'nlem'], weight: 2 },
  { intent: 'forecast', terms: ['forecast', 'projection', 'project', 'predict', 'end of month', 'end of the month', 'fin du mois', 'akher chhar', 'on track', 'will i', 'expected', 'prevision', 'estimate'], weight: 2 },
  { intent: 'compare', terms: ['compare', 'comparison', 'compared', 'vs', 'versus', 'than', 'difference', 'comparer', 'par rapport', 'kif kif', 'akther men', 'a9al men'], weight: 2 },
  { intent: 'trend', terms: ['trend', 'trends', 'evolution', 'over time', 'history', 'each month', 'every month', 'month by month', 'per month', 'monthly', 'progress', 'tendance', 'chaque mois', 'kol chhar'], weight: 2 },
  { intent: 'recurring', terms: ['subscription', 'subscriptions', 'recurring', 'abonnement', 'abonnements', 'repeat', 'repeated', 'regular', 'fixed costs', 'charges fixes'], weight: 3 },
  { intent: 'weekday', terms: ['which day', 'what day', 'weekday', 'weekdays', 'weekend', 'day of the week', 'quel jour', 'jour de la semaine', 'ama nhar', 'anahou nhar'], weight: 2 },
  { intent: 'average', terms: ['average', 'avg', 'per day', 'daily', 'a day', 'moyenne', 'par jour', 'fel nhar', 'kol nhar', 'typical'], weight: 1 },
  { intent: 'budget', terms: ['budget', 'budgets', 'limit', 'limits', 'plafond', 'mizania'], weight: 3 },
  { intent: 'insights', terms: ['insight', 'insights', 'unusual', 'anomaly', 'strange', 'advice', 'tips', 'tip', 'analyze', 'analyse', 'analysis', 'review', 'how am i doing', 'health', 'score', 'conseil', 'conseils', 'nasi7a', 'chnowa ra2yek', 'report', 'rapport', 'check up', 'checkup'], weight: 2 },
  { intent: 'largest', terms: ['largest', 'biggest expense', 'biggest expenses', 'most expensive', 'top expenses', 'big expenses', 'akber masrouf', 'plus grosse', 'plus grosses', 'plus grande depense', 'expensive'], weight: 2 },
  { intent: 'breakdown', terms: ['where', 'breakdown', 'categories', 'category', 'win yemchi', 'win mchet', 'win mche', 'ou va', 'ou est passe', 'repartition', 'spent on what', 'top category', 'biggest category', 'distribution'], weight: 2 },
  { intent: 'savings', terms: ['save', 'saved', 'saving', 'savings', 'epargne', 'economise', 'economies', 'net', 'left over', 'leftover', 'waffart', 'wafart', 'tawfir', 'surplus', 'deficit'], weight: 2 },
  { intent: 'income', terms: ['income', 'incomes', 'earn', 'earned', 'earning', 'earnings', 'revenu', 'revenus', 'gagne', 'dkhali', 'dkhal', 'dakhel', 'received', 'salary', 'salaire'], weight: 2 },
  { intent: 'balance', terms: ['balance', 'balances', 'account', 'accounts', 'solde', 'compte', 'comptes', 'wallet', 'how much do i have', 'how much money do i have', 'kadech andi', 'kadeh 3andi', 'flousi', 'flouci', 'd17', 'bank', 'banque', 'cash'], weight: 2 },
  { intent: 'count', terms: ['how many transactions', 'number of transactions', 'how many expenses', 'combien de transactions', 'kadech men transaction', 'how many times'], weight: 3 },
  { intent: 'spend', terms: ['spend', 'spent', 'spending', 'expense', 'expenses', 'cost', 'costs', 'paid', 'depense', 'depenses', 'depenser', 'sraft', 'masrouf', 'masarif', 'how much', 'combien', 'kadech', 'kadeh'], weight: 1 },
  { intent: 'summary', terms: ['summary', 'overview', 'snapshot', 'resume', 'bilan', 'status', 'situation'], weight: 2 },
];

export function detectIntent(text: string): HsebliIntent | undefined {
  let best: { intent: HsebliIntent; score: number } | undefined;
  for (const { intent, terms, weight = 1 } of intentKeywords) {
    const hits = terms.filter((term) => hasWord(text, term));
    if (hits.length === 0) continue;
    // Longer phrases are more specific than single words.
    const score = hits.reduce((total, term) => total + weight * (1 + term.split(' ').length), 0);
    if (!best || score > best.score) best = { intent, score };
  }
  return best?.intent;
}

const stopWords = new Set([
  'the', 'a', 'an', 'my', 'this', 'that', 'last', 'month', 'year', 'on', 'for', 'in', 'of', 'me', 'i', 'did', 'do', 'how', 'much',
  'spend', 'spent', 'sur', 'pour', 'le', 'la', 'les', 'du', 'des', 'de', 'mon', 'ma', 'mes', 'fi', '3la', 'ala', 'total', 'all', 'time',
]);

/** "how much did I spend on mlawi" → "mlawi". Only used when no category was found. */
function extractSearchTerm(text: string): string | undefined {
  const match = /\b(?:on|for|sur|pour|fi|3la|ala)\s+([a-z0-9][a-z0-9 ]{1,30})$/.exec(text);
  if (!match) return undefined;
  const words = match[1].split(' ').filter((word) => !stopWords.has(word) && !/^\d+$/.test(word));
  const term = words.slice(0, 3).join(' ').trim();
  return term.length >= 3 ? term : undefined;
}

export function parseHsebliQuery(query: string, customCategories: CustomCategory[] = [], now = new Date()): ParsedQuery {
  const normalized = normalizeQuery(query);
  const periods = parsePeriods(normalized, now);
  const category = detectCategory(normalized, customCategories);
  let intent = detectIntent(normalized);

  // Two periods (e.g. "september vs august") always mean a comparison.
  if (periods.length >= 2 && intent !== 'afford') intent = 'compare';

  const amountMillimes = extractAmountMillimes(normalized, now);
  // "spend 50 dt" alone reads as an affordability check.
  if (amountMillimes && (intent === 'spend' || intent === undefined) && hasAny(normalized, ['spend', 'buy', 'nosref', 'nechri', 'depenser', 'acheter'])) {
    intent = 'afford';
  }

  return {
    normalized,
    intent,
    period: periods[0],
    comparePeriod: periods[1],
    category,
    amountMillimes,
    searchTerm: extractSearchTerm(normalized),
  };
}

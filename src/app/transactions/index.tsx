import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Download, HardDriveUpload, Search, X } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { CategoryChip } from '@/components/finance/CategoryChip';
import { TransactionItem } from '@/components/finance/TransactionItem';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { categories } from '@/constants/categories';
import { formatTransactionDate } from '@/lib/format-date';
import { useTransactions } from '@/features/transactions/transaction-store';
import { colors, radius } from '@/constants/colors';
import { getLocalMonthKey, formatMonthYear } from '@/lib/date';
import { formatMoney } from '@/lib/format-money';
import { EmptyState } from '@/components/ui/EmptyState';
import type { TransactionCategory } from '@/types/transaction';

type PeriodFilter = 'this_month' | 'last_month' | 'all';
type TypeFilter = 'all' | 'expense' | 'income' | 'transfer';

export default function TransactionsScreen() {
  const router = useRouter();
  const { transactions, exportCsv, backupData, isLoading } = useTransactions();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TransactionCategory | 'all'>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodFilter>('this_month');
  const [selectedType, setSelectedType] = useState<TypeFilter>('all');

  const today = new Date();
  const currentMonthKey = getLocalMonthKey(today);
  const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevMonthKey = getLocalMonthKey(lastMonthDate);

  const filteredTransactions = transactions.filter((transaction) => {
    // Period filter
    if (selectedPeriod === 'this_month') {
      if (getLocalMonthKey(new Date(transaction.occurredAt)) !== currentMonthKey) return false;
    } else if (selectedPeriod === 'last_month') {
      if (getLocalMonthKey(new Date(transaction.occurredAt)) !== prevMonthKey) return false;
    }

    // Type filter
    if (selectedType !== 'all' && transaction.type !== selectedType) {
      return false;
    }

    // Category filter
    if (selectedCategory !== 'all' && transaction.category !== selectedCategory) {
      return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      const titleMatch = transaction.title.toLowerCase().includes(query);
      const noteMatch = transaction.note?.toLowerCase().includes(query) ?? false;
      if (!titleMatch && !noteMatch) return false;
    }

    return true;
  });

  const groupedTransactions = Object.values(
    filteredTransactions.reduce<Record<string, typeof filteredTransactions>>((groups, transaction) => {
      const key = new Date(transaction.occurredAt).toDateString();
      groups[key] = [...(groups[key] ?? []), transaction];
      return groups;
    }, {}),
  );

  const filteredExpenseSum = filteredTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amountMillimes, 0);

  const filteredIncomeSum = filteredTransactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amountMillimes, 0);


  const isFilterActive = searchQuery.trim() !== '' || selectedCategory !== 'all' || selectedPeriod !== 'this_month' || selectedType !== 'all';

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedPeriod('this_month');
    setSelectedType('all');
  };

  const share = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (error) {
      Alert.alert('Export unavailable', error instanceof Error ? error.message : 'Please try again on your device.');
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text variant="title">Transactions</Text>
          <Text variant="caption">
            {selectedPeriod === 'this_month'
              ? formatMonthYear(today)
              : selectedPeriod === 'last_month'
              ? formatMonthYear(lastMonthDate)
              : 'All recorded time'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <ExportAction label="CSV" Icon={Download} onPress={() => void share(exportCsv)} />
          <ExportAction label="Backup" Icon={HardDriveUpload} onPress={() => void share(backupData)} />
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Search size={18} color={colors.textSoft} style={styles.searchIcon} />
        <TextInput
          accessibilityLabel="Search transactions"
          placeholder="Search by title or note…"
          placeholderTextColor={colors.textSoft}
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
        />
        {searchQuery.length > 0 && (
          <Pressable accessibilityLabel="Clear search" onPress={() => setSearchQuery('')} style={styles.clearSearch}>
            <X size={16} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Period Filter Tabs */}
      <View style={styles.periodTabs}>
        <FilterTab label="This month" active={selectedPeriod === 'this_month'} onPress={() => setSelectedPeriod('this_month')} />
        <FilterTab label="Last month" active={selectedPeriod === 'last_month'} onPress={() => setSelectedPeriod('last_month')} />
        <FilterTab label="All time" active={selectedPeriod === 'all'} onPress={() => setSelectedPeriod('all')} />
      </View>

      {/* Type Filter Tabs */}
      <View style={styles.typeTabs}>
        <TypeFilterTab label="All" active={selectedType === 'all'} onPress={() => setSelectedType('all')} />
        <TypeFilterTab label="Expenses" active={selectedType === 'expense'} onPress={() => setSelectedType('expense')} />
        <TypeFilterTab label="Incomes" active={selectedType === 'income'} onPress={() => setSelectedType('income')} />
        <TypeFilterTab label="Transfers" active={selectedType === 'transfer'} onPress={() => setSelectedType('transfer')} />
      </View>

      {/* Category Chips Filter */}
      <View style={styles.filterSection}>
        <View style={styles.filterHeader}>
          <Text variant="label">CATEGORY</Text>
          {isFilterActive && (
            <Pressable onPress={resetFilters}>
              <Text style={styles.resetText}>Reset filters</Text>
            </Pressable>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
          <CategoryChip
            label="All"
            emoji="✨"
            selected={selectedCategory === 'all'}
            onPress={() => setSelectedCategory('all')}
          />
          {categories.map((category) => (
            <CategoryChip
              key={category.id}
              label={category.label}
              emoji={category.emoji}
              selected={selectedCategory === category.id}
              onPress={() => setSelectedCategory(selectedCategory === category.id ? 'all' : category.id)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Results Summary Bar */}
      <View style={styles.summaryBar}>
        <Text variant="caption" style={styles.matchCount}>
          {filteredTransactions.length} {filteredTransactions.length === 1 ? 'transaction' : 'transactions'}
        </Text>
        <View style={styles.summaryAmounts}>
          {filteredExpenseSum > 0 && (
            <Text style={styles.expenseSummary}>-{formatMoney(filteredExpenseSum)}</Text>
          )}
          {filteredIncomeSum > 0 && (
            <Text style={styles.incomeSummary}>+{formatMoney(filteredIncomeSum)}</Text>
          )}
        </View>
      </View>

      {/* Transactions List */}
      {isLoading ? (
        <Text variant="caption">Loading your local data…</Text>
      ) : transactions.length === 0 ? (
        <EmptyState
          title="No transactions yet"
          description="Your local database is ready. Add an expense or income to begin."
        />
      ) : filteredTransactions.length === 0 ? (
        <View style={styles.emptyFilterContainer}>
          <EmptyState
            title="No matching transactions"
            description="Try changing your search query or adjusting your filters."
            action={<Button variant="secondary" size="sm" onPress={resetFilters}>Clear filters</Button>}
          />
        </View>
      ) : (
        groupedTransactions.map((group) => (
          <View key={group[0].id} style={styles.group}>
            <Text variant="label">{formatTransactionDate(group[0].occurredAt).toUpperCase()}</Text>
            <Card style={styles.list}>
              {group.map((transaction) => (
                <Pressable
                  key={transaction.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${transaction.title}`}
                  onPress={() => router.navigate({ pathname: '/transactions/[id]', params: { id: transaction.id } })}
                  style={({ pressed }) => pressed && styles.transactionPressed}
                >
                  <TransactionItem transaction={transaction} />
                </Pressable>
              ))}
            </Card>
          </View>
        ))
      )}
    </Screen>
  );
}

function ExportAction({ label, Icon, onPress }: { label: string; Icon: typeof Download; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Export ${label}`} onPress={onPress} style={({ pressed }) => [styles.exportAction, pressed && styles.pressed]}>
      <Icon size={17} color={colors.primary} />
      <Text variant="caption" style={styles.exportLabel}>{label}</Text>
    </Pressable>
  );
}

function FilterTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.filterTab, active && styles.filterTabActive]}>
      <Text style={[styles.filterTabText, active && styles.filterTabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function TypeFilterTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.typeTab, active && styles.typeTabActive]}>
      <Text style={[styles.typeTabText, active && styles.typeTabTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  headerActions: { flexDirection: 'row', gap: 7 },
  exportAction: { minHeight: 40, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 10, borderRadius: radius.sm, backgroundColor: colors.primarySoft },
  exportLabel: { fontSize: 11, color: colors.primary, fontWeight: '700' },
  pressed: { opacity: 0.7 },
  transactionPressed: { opacity: 0.65 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    minHeight: 46,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, paddingVertical: 8 },
  clearSearch: { padding: 4 },
  periodTabs: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    padding: 3,
    gap: 4,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: radius.sm - 2,
  },
  filterTabActive: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  filterTabTextActive: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  typeTabs: {
    flexDirection: 'row',
    gap: 6,
  },
  typeTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  typeTabTextActive: {
    color: colors.white,
    fontWeight: '700',
  },
  filterSection: { gap: 8 },
  filterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resetText: { fontSize: 12, color: colors.primary, fontWeight: '700' },
  chipsScroll: { gap: 8, paddingRight: 16 },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  matchCount: { fontWeight: '700', color: colors.textMuted },
  summaryAmounts: { flexDirection: 'row', gap: 10 },
  expenseSummary: { fontSize: 12, fontWeight: '700', color: colors.expense },
  incomeSummary: { fontSize: 12, fontWeight: '700', color: colors.income },
  emptyFilterContainer: { paddingVertical: 12 },
  group: { gap: 8 },
  list: { paddingVertical: 3 },
});


import { useCallback, useState, useRef } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Bot, Plus, Send, ShieldCheck, Sparkles, Target } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { BudgetProgressBar } from '@/components/finance/BudgetProgressBar';
import { HsebliChatBubble, type ChatMessage } from '@/components/finance/HsebliChatBubble';
import { colors, radius } from '@/constants/colors';
import { categories } from '@/constants/categories';
import { formatMoney } from '@/lib/format-money';
import { parseTndToMillimes } from '@/lib/parse-money';
import { useTransactions } from '@/features/transactions/transaction-store';
import { extractFinancialFacts } from '@/lib/financial-facts';
import { processHsebliQuery } from '@/lib/hsebli-engine';
import type { TransactionCategory } from '@/types/transaction';

const quickPrompts = [
  { label: '📊 Where did my money go?', query: 'Where did my money go this month?' },
  { label: '⚡ Can I spend 50 TND today?', query: 'Can I spend 50 TND today?' },
  { label: '🍔 Food & Dining spend', query: 'How much did I spend on food this month?' },
  { label: '📈 Compare to last month', query: 'Compare my spending to last month' },
  { label: '💳 Account balances', query: 'What are my account balances?' },
  { label: '☕ Café & snacks', query: 'How much did I spend on coffee and snacks?' },
];

export default function AssistantScreen() {
  const {
    transactions,
    accounts,
    accountBalances,
    salaryRule,
    categoryBudgets,
    setCategoryBudget,
  } = useTransactions();

  const [inputQuery, setInputQuery] = useState('');
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [selectedBudgetCat, setSelectedBudgetCat] = useState<TransactionCategory>('food');
  const [budgetAmountInput, setBudgetAmountInput] = useState('');
  const [isSettingBudget, setIsSettingBudget] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  // Compute live deterministic financial facts
  const facts = extractFinancialFacts(
    transactions,
    accounts,
    accountBalances,
    salaryRule,
    categoryBudgets,
  );

  // Initial welcome message
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg_welcome',
      sender: 'assistant',
      text: 'Aslama! I’m Hsebli, your private financial assistant. Ask me anything about your spending, accounts, or safe daily pace in English, French, or Derja.',
      response: {
        id: 'resp_welcome',
        title: 'Hsebli Money Companion',
        body: 'Aslama! I’m Hsebli, your private financial assistant. Ask me anything about your spending, accounts, or safe daily pace in English, French, or Derja.',
        factsCard: {
          title: 'Wallet Status',
          items: [
            { label: 'Total Balance', value: formatMoney(facts.totalBalanceMillimes), isHighlight: true },
            { label: 'Spent This Month', value: formatMoney(facts.thisMonthExpenseMillimes) },
            { label: 'Daily Safe Pace', value: facts.safeDailySpendRateMillimes > 0 ? `${formatMoney(facts.safeDailySpendRateMillimes)} / day` : 'Configure salary' },
          ],
        },
      },
      timestamp: 'initial',
    },
  ]);

  const handleSend = useCallback((textToSend?: string) => {
    const query = (textToSend ?? inputQuery).trim();
    if (!query) return;

    const timestamp = new Date().toISOString();
    const userMessage: ChatMessage = {
      id: `user_${Math.random().toString(36).slice(2, 10)}`,
      sender: 'user',
      text: query,
      timestamp,
    };

    const hsebliResp = processHsebliQuery(query, facts);
    const botMessage: ChatMessage = {
      id: `bot_${Math.random().toString(36).slice(2, 10)}`,
      sender: 'assistant',
      text: hsebliResp.body,
      response: hsebliResp,
      timestamp,
    };

    setMessages((prev) => [...prev, userMessage, botMessage]);
    setInputQuery('');

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [facts, inputQuery]);

  const handleSaveBudget = useCallback(async () => {
    const millimes = parseTndToMillimes(budgetAmountInput);
    if (!millimes || millimes <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid budget amount in TND.');
      return;
    }

    setIsSettingBudget(true);
    try {
      await setCategoryBudget(selectedBudgetCat, millimes);
      setShowBudgetModal(false);
      setBudgetAmountInput('');
      Alert.alert('Budget Set', `Monthly budget for ${selectedBudgetCat} set to ${formatMoney(millimes)}.`);
    } finally {
      setIsSettingBudget(false);
    }
  }, [budgetAmountInput, selectedBudgetCat, setCategoryBudget]);


  return (
    <Screen style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <HsebliChatBubble message={item} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.headerComponent}>
              <View style={styles.hero}>
                <View style={styles.botAvatar}>
                  <Bot color={colors.primary} size={28} />
                </View>
                <View style={styles.heroCopy}>
                  <View style={styles.heroBadgeRow}>
                    <Text variant="title">Hsebli</Text>
                    <View style={styles.privateBadge}>
                      <ShieldCheck size={12} color={colors.primaryDark} />
                      <Text style={styles.privateBadgeText}>100% PRIVATE</Text>
                    </View>
                  </View>
                  <Text variant="caption">Offline grounded financial intelligence</Text>
                </View>
              </View>

              {/* Category Budgets Section */}
              <View style={styles.budgetsSection}>
                <View style={styles.budgetsHeader}>
                  <View style={styles.budgetsTitleRow}>
                    <Target size={16} color={colors.primary} />
                    <Text variant="subtitle">Category Budgets</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Set category budget"
                    onPress={() => setShowBudgetModal((prev) => !prev)}
                    style={styles.addBudgetBtn}
                  >
                    <Plus size={14} color={colors.primary} />
                    <Text style={styles.addBudgetBtnText}>
                      {showBudgetModal ? 'Close' : 'Set budget'}
                    </Text>
                  </Pressable>
                </View>

                {showBudgetModal && (
                  <Card variant="default" style={styles.budgetFormCard}>
                    <Text style={styles.budgetFormTitle}>Set Monthly Category Limit</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catChips}>
                      {categories.filter((c) => c.id !== 'salary').map((cat) => (
                        <Pressable
                          key={cat.id}
                          onPress={() => setSelectedBudgetCat(cat.id)}
                          style={[
                            styles.catChip,
                            selectedBudgetCat === cat.id && styles.catChipSelected,
                          ]}
                        >
                          <Text style={[styles.catChipText, selectedBudgetCat === cat.id && styles.catChipTextSelected]}>
                            {cat.label}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                    <View style={styles.budgetInputRow}>
                      <TextInput
                        placeholder="Limit in TND (e.g. 350)"
                        placeholderTextColor={colors.textSoft}
                        keyboardType="decimal-pad"
                        value={budgetAmountInput}
                        onChangeText={setBudgetAmountInput}
                        style={styles.budgetTextInput}
                      />
                      <Button size="sm" loading={isSettingBudget} onPress={() => void handleSaveBudget()}>
                        Save
                      </Button>
                    </View>
                  </Card>
                )}

                {facts.budgetStatuses.length > 0 ? (
                  <Card variant="default" style={styles.budgetsListCard}>
                    {facts.budgetStatuses.map((b) => (
                      <BudgetProgressBar
                        key={b.category}
                        category={b.category}
                        spentMillimes={b.spentMillimes}
                        budgetMillimes={b.budgetMillimes}
                      />
                    ))}
                  </Card>
                ) : (
                  !showBudgetModal && (
                    <Card variant="muted" style={styles.noBudgetsCard}>
                      <Text variant="caption">
                        No category limits set yet. Tap &ldquo;Set budget&rdquo; to set monthly targets (e.g. Food, Transport, Bills).
                      </Text>
                    </Card>
                  )
                )}
              </View>

              {/* Quick Prompts */}
              <View style={styles.promptsSection}>
                <View style={styles.promptsHeader}>
                  <Sparkles size={14} color={colors.accent} />
                  <Text variant="label">ASK HSEBLI</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.promptsScroll}>
                  {quickPrompts.map((p) => (
                    <Pressable
                      key={p.label}
                      accessibilityRole="button"
                      accessibilityLabel={p.label}
                      onPress={() => handleSend(p.query)}
                      style={({ pressed }) => [styles.promptPill, pressed && styles.promptPillPressed]}
                    >
                      <Text style={styles.promptPillText}>{p.label}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>
          }
        />

        {/* Ask Bar */}
        <View style={styles.inputBar}>
          <TextInput
            placeholder="Ask Hsebli in English, French, or Derja…"
            placeholderTextColor={colors.textSoft}
            value={inputQuery}
            onChangeText={setInputQuery}
            onSubmitEditing={() => handleSend()}
            returnKeyType="send"
            style={styles.chatInput}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send question to Hsebli"
            onPress={() => handleSend()}
            disabled={!inputQuery.trim()}
            style={({ pressed }) => [
              styles.sendButton,
              !inputQuery.trim() && styles.sendButtonDisabled,
              pressed && styles.pressed,
            ]}
          >
            <Send size={18} color={colors.white} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingBottom: 0,
  },
  keyboardContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  listContent: {
    paddingBottom: 20,
    gap: 8,
  },
  headerComponent: {
    gap: 16,
    marginBottom: 8,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  botAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroCopy: {
    gap: 2,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  privateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  privateBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.primaryDark,
    letterSpacing: 0.5,
  },
  budgetsSection: {
    gap: 8,
  },
  budgetsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addBudgetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  addBudgetBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  budgetFormCard: {
    gap: 10,
    padding: 12,
  },
  budgetFormTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  catChips: {
    flexDirection: 'row',
    gap: 6,
    paddingRight: 16,
  },
  catChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catChipSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  catChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  catChipTextSelected: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  budgetInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  budgetTextInput: {
    flex: 1,
    height: 40,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    fontSize: 13,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  budgetsListCard: {
    padding: 12,
    gap: 10,
  },
  noBudgetsCard: {
    padding: 10,
  },
  promptsSection: {
    gap: 8,
  },
  promptsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  promptsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
  },
  promptPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.pill,
  },
  promptPillPressed: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  promptPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  chatInput: {
    flex: 1,
    height: 46,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.text,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.border,
  },
  pressed: {
    opacity: 0.8,
  },
});

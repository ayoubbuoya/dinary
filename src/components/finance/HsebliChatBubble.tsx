import { StyleSheet, View } from 'react-native';
import { Bot, User } from 'lucide-react-native';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { colors, radius } from '@/constants/colors';
import { formatMoney } from '@/lib/format-money';
import type { HsebliResponse } from '@/lib/hsebli-engine';

export type ChatMessage = {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  response?: HsebliResponse;
  timestamp: string;
};

type HsebliChatBubbleProps = {
  message: ChatMessage;
};

export function HsebliChatBubble({ message }: HsebliChatBubbleProps) {
  const isUser = message.sender === 'user';

  if (isUser) {
    return (
      <View style={styles.userContainer}>
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{message.text}</Text>
        </View>
        <View style={styles.userAvatar}>
          <User size={14} color={colors.white} />
        </View>
      </View>
    );
  }

  const response = message.response;

  return (
    <View style={styles.assistantContainer}>
      <View style={styles.botAvatar}>
        <Bot size={16} color={colors.primary} />
      </View>

      <View style={styles.assistantContent}>
        <View style={styles.assistantBubble}>
          {response?.title && (
            <Text style={styles.responseTitle}>{response.title}</Text>
          )}
          <Text style={styles.assistantText}>{response?.body ?? message.text}</Text>

          {/* Embedded Fact Card */}
          {response?.factsCard && (
            <Card variant="muted" style={styles.factsCard}>
              <Text style={styles.factsCardTitle}>{response.factsCard.title}</Text>
              <View style={styles.factItems}>
                {response.factsCard.items.map((item, idx) => (
                  <View key={idx} style={styles.factRow}>
                    <Text variant="caption" style={styles.factLabel}>{item.label}</Text>
                    <Text style={[styles.factValue, item.isHighlight && styles.factValueHighlight]}>
                      {item.value}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          )}

          {/* Embedded Category Breakdown */}
          {response?.categories && response.categories.length > 0 && (
            <View style={styles.categoriesSection}>
              {response.categories.slice(0, 4).map((cat) => (
                <View key={cat.category} style={styles.categoryRow}>
                  <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                  <View style={styles.categoryNameCol}>
                    <Text style={styles.categoryName}>{cat.label}</Text>
                    <Text variant="caption">{cat.percentage}% of spending</Text>
                  </View>
                  <Text style={styles.categoryAmount}>{formatMoney(cat.amountMillimes)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  userContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    gap: 8,
    marginVertical: 4,
  },
  userBubble: {
    maxWidth: '78%',
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.lg,
    borderBottomRightRadius: 4,
  },
  userText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  userAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assistantContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginVertical: 6,
  },
  botAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  assistantContent: {
    flex: 1,
    maxWidth: '85%',
  },
  assistantBubble: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    padding: 14,
    borderRadius: radius.lg,
    borderTopLeftRadius: 4,
    gap: 8,
  },
  responseTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primaryDark,
    letterSpacing: 0.2,
  },
  assistantText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  factsCard: {
    gap: 6,
    padding: 10,
    backgroundColor: colors.surfaceMuted,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    marginTop: 4,
  },
  factsCardTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  factItems: {
    gap: 4,
  },
  factRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  factLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  factValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  factValueHighlight: {
    color: colors.primaryDark,
    fontWeight: '800',
  },
  categoriesSection: {
    gap: 6,
    marginTop: 4,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  categoryEmoji: {
    fontSize: 16,
  },
  categoryNameCol: {
    flex: 1,
  },
  categoryName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  categoryAmount: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
  },
});

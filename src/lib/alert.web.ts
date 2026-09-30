import type { AlertButton } from 'react-native';

/**
 * React Native Web's `Alert.alert` does nothing, so errors and confirmations would be silent on the website.
 * This version uses the browser dialogs: one action → `alert`, a cancel + action pair → `confirm`.
 */
export function showAlert(title: string, message?: string, buttons?: AlertButton[]) {
  const text = message ? `${title}\n\n${message}` : title;
  const actions = (buttons ?? []).filter((button) => button.style !== 'cancel');
  const cancel = buttons?.find((button) => button.style === 'cancel');

  if (cancel && actions.length > 0) {
    if (window.confirm(text)) actions[0].onPress?.();
    else cancel.onPress?.();
    return;
  }

  window.alert(text);
  actions[0]?.onPress?.();
}

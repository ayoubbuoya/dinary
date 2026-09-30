import { Alert, type AlertButton } from 'react-native';

/** Same API as React Native's `Alert.alert`. The `.web.ts` version makes it work in the browser too. */
export function showAlert(title: string, message?: string, buttons?: AlertButton[]) {
  Alert.alert(title, message, buttons);
}

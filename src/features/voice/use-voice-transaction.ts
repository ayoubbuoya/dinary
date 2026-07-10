import { useCallback, useState } from 'react';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { parseVoiceTransaction, type VoiceTransactionDraft } from './parse-voice-transaction';

const recognitionContext = ['TND', 'dinar', 'dinar tunisien', 'expense', 'income', 'salary', 'mlawi', 'coffee', 'taxi', 'food'];

export function useVoiceTransaction(onDraft: (draft: VoiceTransactionDraft) => void) {
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [error, setError] = useState<string>();

  useSpeechRecognitionEvent('start', () => setIsListening(true));
  useSpeechRecognitionEvent('end', () => setIsListening(false));
  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript?.trim();
    if (!transcript) return;
    setLiveTranscript(transcript);
    if (event.isFinal) onDraft(parseVoiceTransaction(transcript));
  });
  useSpeechRecognitionEvent('error', (event) => {
    setIsListening(false);
    if (event.error !== 'aborted') setError(event.message || 'Speech recognition could not start.');
  });

  const start = useCallback(async () => {
    setError(undefined);
    setLiveTranscript('');
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      setError('Microphone and speech recognition permission are needed for voice entry.');
      return;
    }
    ExpoSpeechRecognitionModule.start({
      lang: 'ar-TN',
      interimResults: true,
      contextualStrings: recognitionContext,
      iosTaskHint: 'dictation',
    });
  }, []);

  const stop = useCallback(() => ExpoSpeechRecognitionModule.stop(), []);
  const toggle = useCallback(() => isListening ? stop() : void start(), [isListening, start, stop]);

  return { isListening, liveTranscript, error, toggle };
}

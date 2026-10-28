import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, useWindowDimensions } from 'react-native';
import {
  ThemedSafeAreaView as SafeAreaView,
  ThemedStatusBar as StatusBar,
  ThemedText as Text,
  ThemedTouchableOpacity as TouchableOpacity,
  ThemedView as View,
  useTheme,
} from '@/context/ThemeContext';
import { useAppNotifications } from '@/context/AppNotificationsContext';
import { cleanupService } from '@/services/cleanupService';
import { ONBOARDING_COMPLETE_KEY } from './index';

const pages = [
  {
    icon: '✦',
    title: 'Welcome to Cleaner',
    description: 'A simple, private way to find clutter and make room on your device.',
  },
  {
    icon: '⌕',
    title: 'Scan with confidence',
    description: 'Cleaner reviews files on your device. Your data stays local and is never sent to a backend.',
  },
  {
    icon: '✓',
    title: 'One-time permissions',
    description: 'Allow access now so your first scan can start without interruptions.',
  },
] as const;

export default function WelcomeGuide() {
  const router = useRouter();
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const { setEnabled } = useAppNotifications();
  const [page, setPage] = useState(0);
  const [isRequesting, setIsRequesting] = useState(false);
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null);
  const currentPage = pages[page];

  const finishOnboarding = async () => {
    await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    router.replace('/home');
  };

  const requestPermissions = async () => {
    setIsRequesting(true);
    setPermissionMessage(null);
    try {
      const result = await cleanupService.requestPermissions({
        requireSharedStorage: true,
        requireMediaAccess: true,
        requireUsageAccess: true,
      });

      if (!result.granted) {
        setPermissionMessage(result.message ?? 'Some permissions still need to be enabled in Settings.');
        return;
      }

      try {
        await setEnabled(true);
      } catch (error) {
        console.warn('Notification permission was not enabled during onboarding:', error);
      }
      await finishOnboarding();
    } catch (error) {
      console.error('Failed to request onboarding permissions:', error);
      Alert.alert(
        'Permissions',
        error instanceof Error ? error.message : 'Some permissions could not be requested.',
      );
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <Text style={styles.brand}>CLEANER</Text>
        <Text style={styles.pageCount}>{page + 1} / {pages.length}</Text>
      </View>

      <View style={[styles.content, { paddingHorizontal: Math.max(24, Math.min(42, width * 0.1)) }]}>
        <View style={styles.iconCircle}>
          <Text style={styles.icon}>{currentPage.icon}</Text>
        </View>
        <Text style={styles.title}>{currentPage.title}</Text>
        <Text style={styles.description}>{currentPage.description}</Text>

        <View style={styles.dots}>
          {pages.map((item, index) => (
            <View key={item.title} style={[styles.dot, index === page && styles.dotActive]} />
          ))}
        </View>

        {permissionMessage && <Text style={styles.permissionMessage}>{permissionMessage}</Text>}
      </View>

      <View style={styles.footer}>
        {page < pages.length - 1 ? (
          <>
            <TouchableOpacity style={styles.primaryButton} onPress={() => setPage((value) => value + 1)}>
              <Text style={styles.primaryButtonText}>Continue</Text>
              <Text style={styles.arrow}>→</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.skipButton} onPress={finishOnboarding}>
              <Text style={styles.skipText}>Skip for now</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.primaryButton, isRequesting && styles.primaryButtonDisabled]}
              onPress={requestPermissions}
              disabled={isRequesting}
            >
              {isRequesting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>Allow permissions</Text>
                  <Text style={styles.arrow}>→</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.skipButton} onPress={finishOnboarding} disabled={isRequesting}>
              <Text style={styles.skipText}>Continue with limited access</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 16,
  },
  brand: { color: '#2563EB', fontSize: 13, fontWeight: '900', letterSpacing: 2 },
  pageCount: { color: '#64748B', fontSize: 12, fontWeight: '700' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconCircle: {
    width: 116,
    height: 116,
    borderRadius: 58,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F1FF',
    marginBottom: 30,
  },
  icon: { color: '#2563EB', fontSize: 50, fontWeight: '700' },
  title: { color: '#0F172A', fontSize: 29, lineHeight: 36, fontWeight: '900', textAlign: 'center' },
  description: {
    maxWidth: 350,
    marginTop: 14,
    color: '#64748B',
    fontSize: 16,
    lineHeight: 25,
    textAlign: 'center',
  },
  dots: { flexDirection: 'row', gap: 8, marginTop: 32 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#CBD5E1' },
  dotActive: { width: 26, backgroundColor: '#3B82F6' },
  permissionMessage: { marginTop: 18, color: '#B45309', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  footer: { paddingHorizontal: 22, paddingBottom: 12 },
  primaryButton: {
    minHeight: 56,
    borderRadius: 17,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  primaryButtonDisabled: { opacity: 0.7 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  arrow: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  skipButton: { alignItems: 'center', paddingVertical: 16 },
  skipText: { color: '#64748B', fontSize: 13, fontWeight: '600' },
});

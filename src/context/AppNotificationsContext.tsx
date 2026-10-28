import AsyncStorage from '@react-native-async-storage/async-storage';
import { isRunningInExpoGo } from 'expo';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useLocalProfile } from '@/context/LocalProfileContext';
import { useLanguage } from '@/context/LanguageContext';

const NOTIFICATIONS_KEY = '@cleaner_app_notifications_enabled';
const SCAN_REMINDER_DAYS_KEY = '@cleaner_app_scan_reminder_days';
const SCAN_REMINDER_ID_KEY = '@cleaner_app_scan_reminder_id';
type NotificationsModule = typeof import('expo-notifications');
type NotificationRuntime = Pick<
  NotificationsModule,
  | 'getPermissionsAsync'
  | 'requestPermissionsAsync'
  | 'setNotificationChannelAsync'
  | 'scheduleNotificationAsync'
  | 'cancelScheduledNotificationAsync'
  | 'setNotificationHandler'
> & {
  AndroidImportance: NotificationsModule['AndroidImportance'];
  SchedulableTriggerInputTypes: NotificationsModule['SchedulableTriggerInputTypes'];
};

const isExpoGo = isRunningInExpoGo;
let notificationsModulePromise: Promise<NotificationRuntime> | undefined;
const getNotifications = () => {
  notificationsModulePromise ??= (async () => {
    if (isExpoGo()) {
      const [permissions, scheduler, cancellation, handler, channels, channelTypes, notificationTypes] = await Promise.all([
        import('expo-notifications/build/NotificationPermissions'),
        import('expo-notifications/build/scheduleNotificationAsync'),
        import('expo-notifications/build/cancelScheduledNotificationAsync'),
        import('expo-notifications/build/NotificationsHandler'),
        import('expo-notifications/build/setNotificationChannelAsync'),
        import('expo-notifications/build/NotificationChannelManager.types'),
        import('expo-notifications/build/Notifications.types'),
      ]);
      return {
        ...permissions,
        ...scheduler,
        ...cancellation,
        ...handler,
        ...channels,
        AndroidImportance: channelTypes.AndroidImportance,
        SchedulableTriggerInputTypes: notificationTypes.SchedulableTriggerInputTypes,
      };
    }
    return import('expo-notifications');
  })();
  return notificationsModulePromise;
};

interface AppNotificationsContextValue {
  enabled: boolean;
  isReady: boolean;
  scanReminderDays: number | null;
  setEnabled: (enabled: boolean) => Promise<void>;
  setScanReminderDays: (days: number | null) => Promise<void>;
  notifyCleanupComplete: () => Promise<void>;
}

const AppNotificationsContext = createContext<AppNotificationsContextValue | undefined>(undefined);

export function AppNotificationsProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [localLoaded, setLocalLoaded] = useState(false);
  const [scanReminderDays, setScanReminderDaysState] = useState<number | null>(null);
  const { profile, isLoading: isProfileLoading, updatePreferences } = useLocalProfile();
  const { translate } = useLanguage();
  const enabledRef = useRef(enabled);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(NOTIFICATIONS_KEY),
      AsyncStorage.getItem(SCAN_REMINDER_DAYS_KEY),
    ])
      .then(([storedValue, storedDays]) => {
        setEnabledState(storedValue === 'true');
        const days = Number(storedDays);
        if ([1, 7, 30].includes(days)) setScanReminderDaysState(days);
      })
      .catch((error: unknown) => console.error('Failed to load notification preference:', error))
      .finally(() => setLocalLoaded(true));
  }, []);

  useEffect(() => {
    const savedPreference = profile?.preferences.notifications;
    if (isProfileLoading || typeof savedPreference !== 'boolean') return;
    AsyncStorage.setItem(NOTIFICATIONS_KEY, String(savedPreference))
      .then(() => setEnabledState(savedPreference))
      .catch((error: unknown) => console.error('Failed to save notification preference:', error));
  }, [profile?.preferences.notifications, isProfileLoading]);

  useEffect(() => {
    if (isExpoGo()) return;

    let mounted = true;
    getNotifications()
      .then((notifications) => {
        if (!mounted) return;
        if (typeof notifications.setNotificationHandler !== 'function') {
          console.warn('Notification foreground handling is unavailable in this runtime.');
          return;
        }
        notifications.setNotificationHandler({
          handleNotification: async () => {
            const showNotification = enabledRef.current;
            return {
              shouldShowBanner: showNotification,
              shouldShowList: showNotification,
              shouldPlaySound: showNotification,
              shouldSetBadge: showNotification,
            };
          },
        });
      })
      .catch((error: unknown) => console.error('Failed to initialize notification handling:', error));
    return () => {
      mounted = false;
    };
  }, []);

  const isReady = localLoaded && !isProfileLoading;

  useEffect(() => {
    if (!isReady) return;
    const synchronizeScanReminder = async () => {
      try {
        const scheduledId = await AsyncStorage.getItem(SCAN_REMINDER_ID_KEY);
        if (!enabled || !scanReminderDays) {
          if (scheduledId) {
            const notifications = await getNotifications();
            await notifications.cancelScheduledNotificationAsync(scheduledId);
            await AsyncStorage.removeItem(SCAN_REMINDER_ID_KEY);
          }
          return;
        }
        if (scheduledId) return;

        const notifications = await getNotifications();
        const nextId = await notifications.scheduleNotificationAsync({
          content: {
            title: 'Time for a Cleaner scan',
            body: 'Run a scan to review files and storage usage on your device.',
            sound: 'default',
          },
          trigger: {
            type: notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: scanReminderDays * 24 * 60 * 60,
            repeats: true,
          },
        });
        await AsyncStorage.setItem(SCAN_REMINDER_ID_KEY, nextId);
      } catch (error) {
        console.error('Failed to synchronize scan reminder:', error);
      }
    };
    void synchronizeScanReminder();
  }, [enabled, isReady, scanReminderDays]);

  const setEnabled = useCallback(async (nextEnabled: boolean) => {
    if (nextEnabled) {
      if (Platform.OS === 'web') {
        throw new Error('Notifications are available on Android and iOS only.');
      }

      const notifications = await getNotifications();
      if (
        typeof notifications.getPermissionsAsync !== 'function' ||
        typeof notifications.requestPermissionsAsync !== 'function'
      ) {
        throw new Error('System notifications are unavailable in this app runtime. Use an installed development build.');
      }
      let permission = await notifications.getPermissionsAsync();
      if (!permission.granted) permission = await notifications.requestPermissionsAsync();
      if (!permission.granted) throw new Error('Allow notifications in system settings to enable alerts.');

      if (Platform.OS === 'android') {
        await notifications.setNotificationChannelAsync('default', {
          name: 'Cleaner notifications',
          importance: notifications.AndroidImportance.HIGH,
          sound: 'default',
        });
      }

    }

    await AsyncStorage.setItem(NOTIFICATIONS_KEY, String(nextEnabled));
    setEnabledState(nextEnabled);
    if (!nextEnabled) {
      const scheduledId = await AsyncStorage.getItem(SCAN_REMINDER_ID_KEY);
      if (scheduledId) {
        const notifications = await getNotifications();
        await notifications.cancelScheduledNotificationAsync(scheduledId);
        await AsyncStorage.removeItem(SCAN_REMINDER_ID_KEY);
      }
    }
    if (profile) await updatePreferences({ notifications: nextEnabled });
  }, [profile, updatePreferences]);

  const setScanReminderDays = useCallback(async (days: number | null) => {
    if (days !== null && ![1, 7, 30].includes(days)) {
      throw new Error('Choose a daily, weekly, or monthly reminder interval.');
    }
    if (days !== null && !enabled) {
      throw new Error('Enable notifications before scheduling scan reminders.');
    }

    const previousId = await AsyncStorage.getItem(SCAN_REMINDER_ID_KEY);
    let nextId: string | null = null;
    if (days !== null) {
      const notifications = await getNotifications();
      if (typeof notifications.scheduleNotificationAsync !== 'function') {
        throw new Error('Scheduled notifications are unavailable in this app runtime.');
      }
      nextId = await notifications.scheduleNotificationAsync({
        content: {
          title: 'Time for a Cleaner scan',
          body: 'Run a scan to review files and storage usage on your device.',
          sound: 'default',
        },
        trigger: {
          type: notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: days * 24 * 60 * 60,
          repeats: true,
        },
      });
    }

    if (previousId) {
      const notifications = await getNotifications();
      await notifications.cancelScheduledNotificationAsync(previousId);
    }
    if (nextId) await AsyncStorage.setItem(SCAN_REMINDER_ID_KEY, nextId);
    else await AsyncStorage.removeItem(SCAN_REMINDER_ID_KEY);
    await AsyncStorage.setItem(SCAN_REMINDER_DAYS_KEY, days === null ? '' : String(days));
    setScanReminderDaysState(days);
  }, [enabled]);

  const notifyCleanupComplete = useCallback(async () => {
    if (!isReady || !enabled) return;
    const notifications = await getNotifications();
    if (typeof notifications.scheduleNotificationAsync !== 'function') {
      throw new Error('Local notifications are unavailable in this app runtime.');
    }
    await notifications.scheduleNotificationAsync({
      content: {
        title: translate('Cleanup complete'),
        body: translate('Your cleanup finished successfully.'),
        sound: 'default',
      },
      trigger: null,
    });
  }, [enabled, isReady, translate]);

  const value = useMemo(
    () => ({ enabled, isReady, scanReminderDays, setEnabled, setScanReminderDays, notifyCleanupComplete }),
    [enabled, isReady, scanReminderDays, setEnabled, setScanReminderDays, notifyCleanupComplete]
  );

  return (
    <AppNotificationsContext.Provider value={value}>
      {children}
    </AppNotificationsContext.Provider>
  );
}

export function useAppNotifications(): AppNotificationsContextValue {
  const context = useContext(AppNotificationsContext);
  if (!context) throw new Error('useAppNotifications must be used within AppNotificationsProvider');
  return context;
}

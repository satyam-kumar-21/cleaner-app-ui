import BottomNav from '@/components/common/BottomNav';
import { APP_LANGUAGES, LocalizedText as Text, useLanguage } from '@/context/LanguageContext';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, StyleSheet } from 'react-native';
import { useAppNotifications } from '@/context/AppNotificationsContext';
import {
  ThemedScrollView as ScrollView,
  ThemedStatusBar as StatusBar,
  ThemedSwitch as Switch,
  ThemedTouchableOpacity as TouchableOpacity,
  ThemedView as View,
  ThemedSafeAreaView as SafeAreaView,
  useTheme,
} from '@/context/ThemeContext';

export default function SettingsScreen() {
  const router = useRouter();
  const {
    enabled: notifications,
    setEnabled: setNotifications,
    scanReminderDays,
    setScanReminderDays,
  } = useAppNotifications();
  const { language, setLanguage } = useLanguage();
  const { theme } = useTheme();
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  const selectedLanguage = APP_LANGUAGES.find((item) => item.code === language) ?? APP_LANGUAGES[0];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* General Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>APP</Text>

          <View style={styles.settingCard}>
            <Text style={styles.settingLabel}>Notifications</Text>
            <Switch
              value={notifications}
              onValueChange={(value) => {
                setNotifications(value).catch((error: unknown) => {
                  console.error('Failed to update notification preference:', error);
                  Alert.alert('Notifications', error instanceof Error ? error.message : 'Could not update notification settings.');
                });
              }}
              trackColor={{ false: '#E5E7EB', true: '#3B82F6' }}
              thumbColor={'#FFFFFF'}
            />
          </View>

          <View style={styles.reminderCard}>
            <Text style={styles.settingLabel}>Scheduled scan reminders</Text>
            <View style={styles.reminderOptions}>
              {[{ label: 'Off', days: null }, { label: 'Daily', days: 1 }, { label: 'Weekly', days: 7 }, { label: 'Monthly', days: 30 }].map((option) => (
                <TouchableOpacity
                  key={option.label}
                  style={[
                    styles.reminderOption,
                    scanReminderDays === option.days && styles.reminderOptionSelected,
                  ]}
                  onPress={() => {
                    setScanReminderDays(option.days).catch((error: unknown) => {
                      console.error('Failed to update scan reminder:', error);
                      Alert.alert('Scan reminders', error instanceof Error ? error.message : 'Could not update scan reminders.');
                    });
                  }}
                  disabled={option.days !== null && !notifications}
                >
                  <Text style={[
                    styles.reminderOptionText,
                    scanReminderDays === option.days && styles.reminderOptionTextSelected,
                  ]}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {!notifications && (
              <Text style={styles.reminderHint}>Enable notifications above to schedule reminders.</Text>
            )}
          </View>

          <TouchableOpacity
            style={styles.linkCard}
            onPress={() => setLanguagePickerVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Select app language"
          >
            <View>
              <Text style={styles.linkLabel}>App Language</Text>
              <Text style={styles.linkHint}>{selectedLanguage.name}</Text>
            </View>
            <Text style={styles.linkArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkCard}
            onPress={() => router.push('/priority-support' as any)}
          >
            <Text style={styles.linkLabel}>Support</Text>
            <Text style={styles.linkArrow}>→</Text>
          </TouchableOpacity>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ABOUT</Text>

          <TouchableOpacity
            style={styles.linkCard}
            onPress={() => router.push('/about')}
          >
            <Text style={styles.linkLabel}>About App</Text>
            <Text style={styles.linkArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkCard}
            onPress={() => router.push('/privacy-policy')}
          >
            <Text style={styles.linkLabel}>Privacy Policy</Text>
            <Text style={styles.linkArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkCard}
            onPress={() => router.push('/terms-of-service')}
          >
            <Text style={styles.linkLabel}>Terms of Service</Text>
            <Text style={styles.linkArrow}>→</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      <BottomNav />

      <Modal
        visible={languagePickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLanguagePickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setLanguagePickerVisible(false)}
        >
          <View style={styles.languageSheet}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Choose language</Text>
                <Text style={styles.sheetSubtitle}>English is selected by default.</Text>
              </View>
              <TouchableOpacity onPress={() => setLanguagePickerVisible(false)}>
                <Text style={styles.closeButton}>×</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.languageGrid}>
              {APP_LANGUAGES.map((item) => (
                <TouchableOpacity
                  key={item.code}
                  style={[styles.languageOption, item.code === language && styles.languageOptionSelected]}
                  onPress={() => {
                    setLanguage(item.code)
                      .catch((error: unknown) => {
                        console.error('Failed to update language:', error);
                        Alert.alert('Language', 'Could not update the language preference.');
                      })
                      .finally(() => setLanguagePickerVisible(false));
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: item.code === language }}
                >
                  <Text style={[styles.languageName, item.code === language && styles.languageNameSelected]}>
                    {item.name}
                  </Text>
                  {item.code === language && <Text style={styles.languageCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  settingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  reminderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reminderOptions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  reminderOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  reminderOptionSelected: {
    borderColor: '#1976D2',
    backgroundColor: '#EAF3FF',
  },
  reminderOptionText: { color: '#64748B', fontSize: 12, fontWeight: '600' },
  reminderOptionTextSelected: { color: '#155A9C' },
  reminderHint: { color: '#64748B', fontSize: 12, marginTop: 10 },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  linkLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  linkHint: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 3,
  },
  linkArrow: {
    fontSize: 18,
    color: '#9CA3AF',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  languageSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  sheetTitle: {
    color: '#0F172A',
    fontSize: 20,
    fontWeight: '800',
  },
  sheetSubtitle: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
  },
  closeButton: {
    color: '#64748B',
    fontSize: 30,
    lineHeight: 28,
  },
  languageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  languageOption: {
    width: '48%',
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  languageOptionSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  languageName: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
  },
  languageNameSelected: {
    color: '#1D4ED8',
  },
  languageCheck: {
    color: '#2563EB',
    fontSize: 18,
    fontWeight: '800',
  },
});

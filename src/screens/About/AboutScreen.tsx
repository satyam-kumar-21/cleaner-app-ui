import BottomNav from '@/components/common/BottomNav';
import { LocalizedText as Text } from '@/context/LanguageContext';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import {
  ThemedScrollView as ScrollView,
  ThemedStatusBar as StatusBar,
  ThemedTouchableOpacity as TouchableOpacity,
  ThemedView as View,
  ThemedSafeAreaView as SafeAreaView,
} from '@/context/ThemeContext';

export default function AboutScreen() {
  const router = useRouter();
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoSection}>
          <View style={styles.logoBox}>
            <Text style={styles.logoIcon}>🧹</Text>
          </View>
          <Text style={styles.appName}>Cleaner</Text>
          <Text style={styles.version}>Version {appVersion}</Text>
        </View>

        <View style={styles.descriptionCard}>
          <Text style={styles.description}>
            A modern device cleaning and storage management application built for Android, iOS, Windows, and macOS.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PLATFORMS</Text>

          <View style={styles.platformCard}>
            <Text style={styles.platformIcon}>✓</Text>
            <Text style={styles.platformText}>Android</Text>
          </View>

          <View style={styles.platformCard}>
            <Text style={styles.platformIcon}>✓</Text>
            <Text style={styles.platformText}>iOS</Text>
          </View>

          <View style={styles.platformCard}>
            <Text style={styles.platformIcon}>✓</Text>
            <Text style={styles.platformText}>Windows</Text>
          </View>

          <View style={styles.platformCard}>
            <Text style={styles.platformIcon}>✓</Text>
            <Text style={styles.platformText}>macOS</Text>
          </View>
        </View>

        <View style={styles.privacyCard}>
          <Text style={styles.privacyTitle}>🛡️ Privacy First</Text>
          <Text style={styles.privacyText}>
            Your files remain on your device. We don&apos;t collect, upload, or share your personal data.
          </Text>
        </View>

        <Text style={styles.copyright}>© 2026 Cleaner App. All rights reserved.</Text>

        <View style={{ height: 20 }} />
      </ScrollView>

      <BottomNav />
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  logoSection: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoIcon: {
    fontSize: 40,
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  version: {
    fontSize: 14,
    color: '#6B7280',
  },
  descriptionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: '#4B5563',
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  platformCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  platformIcon: {
    fontSize: 18,
    color: '#10B981',
    marginRight: 12,
  },
  platformText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  privacyCard: {
    backgroundColor: '#EBF5FF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  privacyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  privacyText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4B5563',
    textAlign: 'center',
  },
  copyright: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 16,
  },
});

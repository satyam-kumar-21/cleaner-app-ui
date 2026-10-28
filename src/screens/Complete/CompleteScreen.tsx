import BottomNav from '@/components/common/BottomNav';
import { LocalizedText as Text } from '@/context/LanguageContext';
import {
  ThemedScrollView as ScrollView,
  ThemedStatusBar as StatusBar,
  ThemedTouchableOpacity as TouchableOpacity,
  ThemedView as View,
  ThemedSafeAreaView as SafeAreaView,
} from '@/context/ThemeContext';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet,
} from 'react-native';
import { deviceInfoService } from '@/services/deviceInfoService';
import type { ScanItem } from '@/services/scanner/types';
import type { CleanupResult } from '@/services/cleanupService';
import { useAppNotifications } from '@/context/AppNotificationsContext';

export default function CompleteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { enabled: notificationsEnabled, isReady: notificationsReady, notifyCleanupComplete } = useAppNotifications();
  const didNotifyRef = useRef(false);

  const { cleanedItems, bytesFreed, itemsProcessed, itemsCleaned, itemsSkipped, cleanupErrors } = useMemo(() => {
    let items: ScanItem[] = [];
    let freed = 0;
    let processed = 0;
    let cleaned = 0;
    let skipped = 0;
    let errors: string[] = [];

    try {
      if (params.cleanedItems && typeof params.cleanedItems === 'string') {
        items = JSON.parse(params.cleanedItems);
      }
      if (params.cleanupResult && typeof params.cleanupResult === 'string') {
        const res: CleanupResult = JSON.parse(params.cleanupResult);
        freed = res.bytesFreed;
        processed = res.itemsProcessed;
        cleaned = res.itemsCleaned;
        skipped = res.itemsSkipped;
        errors = res.errors;
      } else if (params.totalBytesFreed && typeof params.totalBytesFreed === 'string') {
        freed = Number(params.totalBytesFreed);
        processed = items.length;
        cleaned = items.length;
      }
    } catch (e) {
      console.error('Failed to parse cleanup complete params:', e);
    }

    return {
      cleanedItems: items,
      bytesFreed: freed,
      itemsProcessed: processed,
      itemsCleaned: cleaned,
      itemsSkipped: skipped,
      cleanupErrors: errors,
    };
  }, [params.cleanedItems, params.cleanupResult, params.totalBytesFreed]);

  useEffect(() => {
    if (!notificationsReady || !notificationsEnabled || didNotifyRef.current) return;
    didNotifyRef.current = true;
    notifyCleanupComplete().catch((error: unknown) => {
      console.error('Failed to show cleanup notification:', error);
    });
  }, [notificationsEnabled, notificationsReady, notifyCleanupComplete]);

  const getCategoryStats = () => {
    if (cleanedItems.length === 0) {
      return [
        { category: 'ALL', name: 'Cleaned Items', icon: '🧹', bg: '#EEF5FC', size: bytesFreed, count: itemsCleaned },
      ];
    }
    const grouped: Record<string, { size: number; count: number }> = {};
    cleanedItems.forEach((item) => {
      const cat = item.category || 'OTHER';
      if (!grouped[cat]) {
        grouped[cat] = { size: 0, count: 0 };
      }
      grouped[cat].size += item.fileSizeBytes || 0;
      grouped[cat].count += 1;
    });

    const categoryIcons: Record<string, { icon: string; bg: string; label: string }> = {
      TEMPORARY: { icon: '📄', bg: '#EEF5FC', label: 'Temporary Files' },
      TRASH: { icon: '🗑️', bg: '#EBF7F6', label: 'Trash Files' },
      CACHE: { icon: '💾', bg: '#F8EEFC', label: 'System Cache' },
      LARGE_FILE: { icon: '📁', bg: '#FFF6EB', label: 'Large Files' },
      DUPLICATE: { icon: '📋', bg: '#F8EEFC', label: 'Duplicate Files' },
      SUSPICIOUS: { icon: '⚠️', bg: '#FEE2E2', label: 'Suspicious Files' },
      POTENTIALLY_CORRUPTED: { icon: '❌', bg: '#FEE2E2', label: 'Corrupted Files' },
      UNUSED_APP: { icon: '📱', bg: '#EEF5FC', label: 'Unused Apps' },
    };

    return Object.entries(grouped).map(([category, data]) => {
      const meta = categoryIcons[category] || {
        icon: '📁',
        bg: '#F1F5F9',
        label: category.replace(/_/g, ' '),
      };
      return {
        category,
        name: meta.label,
        icon: meta.icon,
        bg: meta.bg,
        size: data.size,
        count: data.count,
      };
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Ambient Background Accents */}
      <View style={styles.topBlob} />
      <View style={styles.bottomBlob} />

      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoBox}>
            <Text style={styles.logoIcon}>🧹</Text>
          </View>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>
              {itemsSkipped > 0 ? 'Cleanup Partially Complete' : 'Cleaning Complete!'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {itemsSkipped > 0
                ? `${itemsCleaned} cleaned · ${itemsSkipped} could not be removed`
                : 'Your device has been successfully cleaned'}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Stats Card */}
        <View style={styles.mainStatsCard}>
          <View style={styles.successBadge}>
            <Text style={styles.successIcon}>✓</Text>
          </View>
          <View style={styles.freedSpace}>
            <Text style={styles.freedLabel}>TOTAL SPACE FREED</Text>
            <Text style={styles.freedValue}>
              {deviceInfoService.formatBytes(bytesFreed)}
            </Text>
          </View>
        </View>

        {/* Summary Stats */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <View style={[styles.summaryIconBox, { backgroundColor: '#EEF5FC' }]}>
                <Text style={styles.summaryIcon}>📦</Text>
              </View>
              <View style={styles.summaryTextContainer}>
                <Text style={styles.summaryLabel}>Items Processed</Text>
                <Text style={styles.summaryValue}>
                  {itemsProcessed}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <View style={[styles.summaryIconBox, { backgroundColor: '#DCFCE7' }]}>
                <Text style={styles.summaryIcon}>✓</Text>
              </View>
              <View style={styles.summaryTextContainer}>
                <Text style={styles.summaryLabel}>Successfully Cleaned</Text>
                <Text style={[styles.summaryValue, { color: '#16A34A' }]}>
                  {itemsCleaned}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <View style={[styles.summaryIconBox, { backgroundColor: '#FEF3C7' }]}>
                <Text style={styles.summaryIcon}>⊘</Text>
              </View>
              <View style={styles.summaryTextContainer}>
                <Text style={styles.summaryLabel}>Skipped</Text>
                <Text style={[styles.summaryValue, { color: '#F59E0B' }]}>
                  {itemsSkipped}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {cleanupErrors.length > 0 && (
          <View style={styles.cleanupErrorCard}>
            <Text style={styles.cleanupErrorTitle}>Some files could not be cleaned</Text>
            {cleanupErrors.slice(0, 5).map((error, index) => (
              <Text key={`${index}-${error}`} style={styles.cleanupErrorText} numberOfLines={2}>
                {error}
              </Text>
            ))}
            {cleanupErrors.length > 5 && (
              <Text style={styles.cleanupErrorText}>And {cleanupErrors.length - 5} more.</Text>
            )}
          </View>
        )}

        {/* Categories Cleaned */}
        <View style={styles.categoriesSection}>
          <Text style={styles.sectionTitle}>Categories Cleaned</Text>

          {getCategoryStats().map((cat, idx) => (
            <View key={cat.category || idx} style={styles.categoryItem}>
              <View style={[styles.categoryIconBox, { backgroundColor: cat.bg }]}>
                <Text style={styles.categoryIcon}>{cat.icon}</Text>
              </View>
              <View style={styles.categoryInfo}>
                <Text style={styles.categoryName}>{cat.name}</Text>
                <Text style={styles.categorySize}>
                  {deviceInfoService.formatBytes(cat.size)} cleaned ({cat.count} file{cat.count !== 1 ? 's' : ''})
                </Text>
              </View>
              <Text style={styles.categoryCheck}>✓</Text>
            </View>
          ))}
        </View>

        {/* Tips Card */}
        <View style={styles.tipsCard}>
          <Text style={styles.tipsIcon}>💡</Text>
          <View style={styles.tipsContent}>
            <Text style={styles.tipsTitle}>Keep Your Device Clean</Text>
            <Text style={styles.tipsText}>
              Regular cleaning helps maintain optimal performance. We recommend scanning weekly.
            </Text>
          </View>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.doneButton}
          onPress={() => router.push('/home' as any)}
          activeOpacity={0.85}
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>

      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9FC',
  },
  topBlob: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: '#EBF3FB',
  },
  bottomBlob: {
    position: 'absolute',
    bottom: -80,
    left: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#EBF3FB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 2,
  },
  logoIcon: {
    fontSize: 20,
  },
  headerTextWrap: {
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0A192F',
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
    fontWeight: '400',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  mainStatsCard: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  successBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  successIcon: {
    fontSize: 28,
    color: '#16A34A',
    fontWeight: '800',
  },
  freedSpace: {
    alignItems: 'center',
  },
  freedLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  freedValue: {
    fontSize: 36,
    fontWeight: '800',
    color: '#0A192F',
    letterSpacing: -0.5,
  },
  summaryCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cleanupErrorCard: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FFF7ED',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  cleanupErrorTitle: {
    color: '#9A3412',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 5,
  },
  cleanupErrorText: {
    color: '#7C2D12',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  summaryRow: {
    paddingVertical: 10,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  summaryIcon: {
    fontSize: 18,
  },
  summaryTextContainer: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 1,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0A192F',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  categoriesSection: {
    paddingHorizontal: 16,
    marginTop: 18,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0A192F',
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  categoryIcon: {
    fontSize: 16,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0A192F',
    marginBottom: 1,
  },
  categorySize: {
    fontSize: 11,
    color: '#64748B',
  },
  categoryCheck: {
    fontSize: 16,
    color: '#16A34A',
    fontWeight: '800',
    marginRight: 4,
  },
  tipsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#EEF5FC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tipsIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  tipsContent: {
    flex: 1,
  },
  tipsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0A192F',
    marginBottom: 1,
  },
  tipsText: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 10,
  },
  doneButton: {
    flex: 1,
    backgroundColor: '#2196F3',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 2,
  },
  doneButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
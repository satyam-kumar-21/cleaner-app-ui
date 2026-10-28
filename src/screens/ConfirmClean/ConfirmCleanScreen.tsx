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
import { useMemo } from 'react';
import {
  StyleSheet,
  Alert,
} from 'react-native';
import type { ScanItem } from '@/services/scanner/types';
import { deviceInfoService } from '@/services/deviceInfoService';

export default function ConfirmCleanScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const { selectedItems, totalSize } = useMemo(() => {
    try {
      if (params.selectedItems && typeof params.selectedItems === 'string') {
        const items: ScanItem[] = JSON.parse(params.selectedItems);
        const parsedSize = typeof params.totalSize === 'string' ? Number(params.totalSize) : 0;
        return {
          selectedItems: items,
          totalSize: Number.isFinite(parsedSize) ? parsedSize : 0,
        };
      }
    } catch (error) {
      console.error('Failed to parse params:', error);
    }
    return { selectedItems: [], totalSize: 0 };
  }, [params.selectedItems, params.totalSize]);

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      TEMPORARY: '📄',
      TRASH: '🗑️',
      CACHE: '💾',
      LARGE_FILE: '📁',
      DUPLICATE: '📋',
      SUSPICIOUS: '⚠️',
      POTENTIALLY_CORRUPTED: '❌',
      UNUSED_APP: '📱',
    };
    return icons[category] || '❓';
  };

  const getCategoryBg = (category: string) => {
    const colors: Record<string, string> = {
      TEMPORARY: '#EEF5FC',
      TRASH: '#EBF7F6',
      CACHE: '#F8EEFC',
      LARGE_FILE: '#FFF6EB',
      DUPLICATE: '#F8EEFC',
      SUSPICIOUS: '#FEE2E2',
      POTENTIALLY_CORRUPTED: '#FEE2E2',
      UNUSED_APP: '#EEF5FC',
    };
    return colors[category] || '#F1F5F9';
  };

  const navigateToCleaning = () => {
    router.push({
      pathname: '/cleaning' as any,
      params: {
        selectedItems: JSON.stringify(selectedItems),
        totalSize: String(totalSize),
        scanResults: typeof params.scanResults === 'string' ? params.scanResults : '',
      },
    });
  };

  const handleConfirmClean = () => {
    if (selectedItems.length === 0) {
      Alert.alert('No Items', 'No items selected for cleaning.');
      return;
    }

    navigateToCleaning();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
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
            <Text style={styles.headerTitle}>Clean Confirmation</Text>
            <Text style={styles.headerSubtitle}>
              {selectedItems.some((item) => item.category === 'UNUSED_APP')
                ? 'Android will ask you to confirm each selected app uninstall.'
                : 'Review your selection before cleaning'}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Ready to Clean Card */}
        <View style={styles.readyCard}>
          <View style={styles.illustrationContainer}>
            <View style={styles.phoneCircle}>
              <View style={styles.phoneBox}>
                <Text style={styles.phoneIcon}>📱</Text>
                <Text style={styles.cleanBadgeIcon}>🧹</Text>
              </View>
              <View style={styles.checkBadge}>
                <Text style={styles.checkIcon}>✓</Text>
              </View>
            </View>
          </View>

          <View style={styles.readyContent}>
            <Text style={styles.readyTitle}>Ready to Clean</Text>
            <Text style={styles.readySubtitle}>
              You have selected the following items for cleaning.
            </Text>

            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <View style={styles.statIconBox}>
                  <Text style={styles.statIcon}>💾</Text>
                </View>
                <Text style={styles.statValue}>{deviceInfoService.formatBytes(totalSize)}</Text>
                <Text style={styles.statLabel}>Selected Size</Text>
              </View>

              <View style={styles.statBox}>
                <View style={styles.statIconBox}>
                  <Text style={styles.statIcon}>📄</Text>
                </View>
                <Text style={styles.statValue}>{selectedItems.length}</Text>
                <Text style={styles.statLabel}>Files Selected</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Warning Box */}
        <View style={styles.warningBox}>
          <Text style={styles.warningIcon}>💡</Text>
          <View style={styles.warningContent}>
            <Text style={styles.warningTitle}>
              {selectedItems.some((item) => item.requiresReview)
                ? 'Review selected files before cleaning'
                : 'Some files may be permanently removed'}
            </Text>
            <Text style={styles.warningText}>
              {selectedItems.some((item) => item.requiresReview)
                ? 'You selected files marked for review. Confirm that each one is safe to remove.'
                : 'Make sure you have backed up important data.'}
            </Text>
          </View>
        </View>

        {/* Selected Items List */}
        <View style={styles.categoriesSection}>
          <View style={styles.categoriesHeader}>
            <Text style={styles.categoriesTitle}>Selected Items</Text>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
              <Text style={styles.viewDetailsLink}>View Details →</Text>
            </TouchableOpacity>
          </View>

          {selectedItems.map((item) => (
            <View key={item.itemId} style={styles.categoryCard}>
              <View style={[styles.categoryIconBox, { backgroundColor: getCategoryBg(item.category) }]}>
                <Text style={styles.categoryIcon}>{getCategoryIcon(item.category)}</Text>
              </View>

              <View style={styles.categoryInfo}>
                <Text style={styles.categoryName}>{item.displayName}</Text>
                <Text style={styles.categorySubtitle} numberOfLines={1}>
                  {item.reason}
                </Text>
                {item.requiresReview && (
                  <Text style={styles.reviewItemLabel}>Needs review before cleaning</Text>
                )}
              </View>

              <View style={styles.categoryRight}>
                <Text style={styles.categorySize}>
                  {deviceInfoService.formatBytes(item.fileSizeBytes || 0)}
                </Text>
                <Text style={styles.categoryFiles}>{item.category.replace(/_/g, ' ')}</Text>
              </View>

              <View style={styles.checkboxSelected}>
                <Text style={styles.checkmark}>✓</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Footer Action Buttons */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cleanButton}
          onPress={handleConfirmClean}
          activeOpacity={0.85}
        >
          <Text style={styles.cleanButtonIcon}>🧹</Text>
          <View style={styles.cleanButtonContent}>
            <Text style={styles.cleanButtonText}>Confirm & Clean</Text>
            <Text style={styles.cleanButtonSubtext}>
              {deviceInfoService.formatBytes(totalSize)} · {selectedItems.length} file{selectedItems.length !== 1 ? 's' : ''}
            </Text>
          </View>
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
  readyCard: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  illustrationContainer: {
    alignItems: 'center',
    marginBottom: 14,
  },
  phoneCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#EEF5FC',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  phoneBox: {
    width: 52,
    height: 64,
    backgroundColor: '#2196F3',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  phoneIcon: {
    fontSize: 24,
  },
  cleanBadgeIcon: {
    fontSize: 14,
    position: 'absolute',
    bottom: 4,
  },
  checkBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  checkIcon: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  readyContent: {
    alignItems: 'center',
  },
  readyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0A192F',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  readySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#EEF5FC',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statIcon: {
    fontSize: 15,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0A192F',
    marginBottom: 1,
  },
  statLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '500',
  },
  warningBox: {
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
  warningIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0A192F',
    marginBottom: 1,
  },
  warningText: {
    fontSize: 11,
    color: '#64748B',
  },
  categoriesSection: {
    paddingHorizontal: 16,
    marginTop: 18,
  },
  categoriesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoriesTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0A192F',
    letterSpacing: -0.3,
  },
  viewDetailsLink: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '600',
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  categoryIcon: {
    fontSize: 18,
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
  categorySubtitle: {
    fontSize: 10,
    color: '#64748B',
  },
  reviewItemLabel: {
    marginTop: 3,
    fontSize: 10,
    color: '#C77700',
    fontWeight: '600',
  },
  categoryRight: {
    alignItems: 'flex-end',
    marginRight: 10,
  },
  categorySize: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0A192F',
    marginBottom: 1,
  },
  categoryFiles: {
    fontSize: 10,
    color: '#64748B',
  },
  checkboxSelected: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '800',
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
  cancelButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent  : 'center',
    borderWidth: 1.5,
    borderColor: '#2196F3',
    backgroundColor: '#FFFFFF',
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2196F3',
  },
  cleanButton: {
    flex: 1.4,
    flexDirection: 'row',
    backgroundColor: '#2196F3',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent  : 'center',
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 2,
  },
  cleanButtonIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  cleanButtonContent: {
    alignItems: 'flex-start',
  },
  cleanButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cleanButtonSubtext: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.85)',
  },
});
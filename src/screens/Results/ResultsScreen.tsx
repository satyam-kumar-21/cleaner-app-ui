import BottomNav from '@/components/common/BottomNav';
import { LocalizedText as Text } from '@/context/LanguageContext';
import {
  ThemedScrollView as ScrollView,
  ThemedStatusBar as StatusBar,
  ThemedTouchableOpacity as TouchableOpacity,
  ThemedView as View,
  ThemedSafeAreaView as SafeAreaView,
} from '@/context/ThemeContext';
import { restoreTrashedAssets } from '@/services/scanner/trashMediaStore';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useMemo } from 'react';
import {
  Alert,
  Platform,
  StyleSheet,
} from 'react-native';
import type { ScanResult, ScanItem } from '@/services/scanner/types';
import { deviceInfoService } from '@/services/deviceInfoService';
import { scannerService } from '@/services/scanner/ScannerService';

export default function ResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const scanResult = useMemo(() => {
    try {
      if (params.scanResults && typeof params.scanResults === 'string') {
        return JSON.parse(params.scanResults) as ScanResult;
      }
    } catch (error) {
      console.error('Failed to parse scan results:', error);
    }
    return null;
  }, [params.scanResults]);
  const [items, setItems] = useState<ScanItem[]>(() => scanResult?.items ?? []);
  const [deviceName, setDeviceName] = useState('My Device');

  useEffect(() => {
    let isMounted = true;
    const loadDeviceName = async () => {
      try {
        const info = await deviceInfoService.getDeviceInfo();
        if (isMounted) setDeviceName(info.deviceName || `${info.platform} Device`);
      } catch (error) {
        console.error('Failed to load device name:', error);
      }
    };
    void loadDeviceName();
    return () => {
      isMounted = false;
    };
  }, []);

  const restoreTrashItem = (item: ScanItem) => {
    if (!item.location) return;
    const uri = item.location;
    Alert.alert(
      'Restore this item?',
      'Android will ask you to authorize restoring this item from Trash.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: async () => {
            try {
              const restored = await restoreTrashedAssets([uri]);
              if (!restored) {
                Alert.alert('Restore not completed', 'Android did not authorize restoring this item.');
                return;
              }
              setItems((current) => current.filter((entry) => entry.itemId !== item.itemId));
              Alert.alert('Restored', 'The item has been restored from Android Trash.');
            } catch (error) {
              console.error('Failed to restore Android trash item:', error);
              Alert.alert('Restore failed', error instanceof Error ? error.message : 'Could not restore this item.');
            }
          },
        },
      ]
    );
  };

  const toggleItem = (itemId: string) => {
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.itemId === itemId
          ? { ...item, selected: !item.selected }
          : item
      )
    );
  };

  const selectAllCleanable = () => {
    setItems(scannerService.selectAllCleanable(items));
  };

  const deselectAll = () => {
    setItems(scannerService.deselectAll(items));
  };

  const getSelectedItems = () => {
    return scannerService.getSelectedItems(items);
  };

  const getTotalCleanableSize = () => {
    if (!scanResult) return '0 MB';
    return deviceInfoService.formatBytes(scanResult.totalCleanableBytes);
  };

  const getSelectedSize = () => {
    const size = scannerService.calculateSelectedSize(items);
    return deviceInfoService.formatBytes(size);
  };

  const getItemsByCategory = () => {
    const grouped: Record<string, ScanItem[]> = {};
    items.forEach((item) => {
      if (!grouped[item.category]) {
        grouped[item.category] = [];
      }
      grouped[item.category].push(item);
    });
    return grouped;
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      TEMPORARY: '📄',
      TRASH: '🗑️',
      CACHE: '💾',
      LARGE_FILE: '📁',
      DUPLICATE: '📋',
      SCREENSHOT: '🖼️',
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
      SCREENSHOT: '#EEF5FC',
      SUSPICIOUS: '#FEE2E2',
      POTENTIALLY_CORRUPTED: '#FEE2E2',
      UNUSED_APP: '#EEF5FC',
    };
    return colors[category] || '#F1F5F9';
  };

  const proceedToClean = () => {
    const selected = getSelectedItems();
    if (selected.length === 0) {
      alert('Please select at least one item to clean');
      return;
    }
    const totalSize = scannerService.calculateSelectedSize(items);
    router.push({
      pathname: '/confirm-clean' as any,
      params: { 
        selectedItems: JSON.stringify(selected),
        totalSize: String(totalSize),
        scanResults: typeof params.scanResults === 'string' ? params.scanResults : JSON.stringify(scanResult),
      }
    });
  };

  const selectedCount = items.filter((item) => item.selected).length;
  const groupedItems = getItemsByCategory();

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
            <Text style={styles.headerTitle}>Scan Results</Text>
            <Text style={styles.headerSubtitle}>
              {scanResult?.scopeDescription || 'Cleanup results'}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
            <Text style={styles.actionIcon}>🔍</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
            <Text style={styles.actionIcon}>⋮</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Total Cleanable Summary Hero Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryLeft}>
            <View style={styles.iconBox}>
              <Text style={styles.iconEmoji}>🧹</Text>
            </View>
          </View>

          <View style={styles.summaryRight}>
            <Text style={styles.summaryLabel}>TOTAL CLEANABLE</Text>
            <Text style={styles.summaryValue}>{getTotalCleanableSize()}</Text>
            <Text style={styles.summarySubtitle}>
              {scanResult?.totalItems || 0} cleanup items
              {typeof scanResult?.scannedFileCount === 'number'
                ? ` from ${scanResult.scannedFileCount} files checked`
                : ' found'}
            </Text>
          </View>

          <View style={styles.deviceBadge}>
            <Text style={styles.deviceIcon}>📱</Text>
            <View>
              <Text style={styles.deviceLabel}>Device</Text>
              <Text style={styles.deviceName}>{deviceName}</Text>
            </View>
          </View>
        </View>

        {/* Categories Section Header */}
        <View style={styles.categoriesHeader}>
          <Text style={styles.categoriesTitle}>
            Found Items ({items.length})
          </Text>
          <View style={styles.categoriesActions}>
            <TouchableOpacity
              style={styles.selectBtn}
              onPress={selectAllCleanable}
              activeOpacity={0.7}
            >
              <Text style={styles.selectBtnText}>Select All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deselectBtn}
              onPress={deselectAll}
              activeOpacity={0.7}
            >
              <Text style={styles.deselectBtnText}>Deselect</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Categories List */}
        {Object.entries(groupedItems).map(([category, categoryItems]) => {
          const categorySize = categoryItems.reduce(
            (sum, item) => sum + (item.fileSizeBytes || 0),
            0
          );
          const categoryIcon = getCategoryIcon(category);
          const categoryBg = getCategoryBg(category);

          return (
            <View key={category} style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <View style={[styles.categoryIconBox, { backgroundColor: categoryBg }]}>
                  <Text style={styles.categoryIcon}>{categoryIcon}</Text>
                </View>
                <View style={styles.categoryHeaderInfo}>
                  <Text style={styles.categoryName}>
                    {category === 'UNUSED_APP'
                      ? 'UNUSED APPS'
                      : category === 'TRASH'
                        ? 'RECYCLE BIN'
                        : category.replace(/_/g, ' ')}
                  </Text>
                  <Text style={styles.categoryMeta}>
                    {categoryItems.length} items · {deviceInfoService.formatBytes(categorySize)}
                  </Text>
                </View>
              </View>

              {categoryItems.map((item) => (
                <TouchableOpacity
                  key={item.itemId}
                  style={styles.itemCard}
                  onPress={() => router.push({ 
                    pathname: '/file-detail', 
                    params: { 
                      itemId: item.itemId, 
                      displayName: item.displayName, 
                      filePath: item.location || '', 
                      fileSizeBytes: String(item.fileSizeBytes || 0), 
                      reason: item.reason, 
                      riskLevel: item.riskLevel, 
                      category: item.category, 
                      canClean: String(item.canClean),
                      selectedItem: JSON.stringify(item),
                      scanResults: typeof params.scanResults === 'string'
                        ? params.scanResults
                        : JSON.stringify(scanResult),
                    } 
                  })}
                  activeOpacity={0.7}
                >
                  <View style={styles.itemLeft}>
                    <TouchableOpacity
                      onPress={() => { if (item.canClean) toggleItem(item.itemId); }}
                      disabled={!item.canClean}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          item.selected && styles.checkboxSelected,
                          !item.canClean && styles.checkboxDisabled,
                        ]}
                      >
                        {item.selected && (
                          <Text style={styles.checkmark}>✓</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {item.displayName}
                    </Text>
                    <Text style={styles.itemSubtitle} numberOfLines={1}>
                      {item.reason}
                    </Text>
                    {!item.canClean && (
                      <Text style={styles.itemWarning}>Needs review before cleaning</Text>
                    )}
                    {item.requiresReview && item.canClean && (
                      <Text style={styles.itemWarning}>Needs review before cleaning</Text>
                    )}
                    {item.category === 'TRASH' && (
                      <TouchableOpacity
                        style={styles.restoreButton}
                        onPress={() => restoreTrashItem(item)}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.restoreButtonText}>Restore from Trash</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.itemRight}>
                    <Text style={styles.itemSize}>
                      {item.fileSizeBytes
                        ? deviceInfoService.formatBytes(item.fileSizeBytes)
                        : 'N/A'}
                    </Text>
                    <View
                      style={[
                        styles.riskBadge,
                        item.riskLevel === 'high' && styles.riskHigh,
                        item.riskLevel === 'medium' && styles.riskMedium,
                      ]}
                    >
                      <Text style={styles.riskText}>
                        {item.riskLevel.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          );
        })}

        {!groupedItems.TRASH?.length && Platform.OS === 'android' && (
          <View style={styles.emptyTrashCard}>
            <Text style={styles.emptyTrashTitle}>Recycle Bin</Text>
            <Text style={styles.emptyTrashText}>
              No Android MediaStore trash items were found. Some Gallery apps keep their recycle bin private; those items must be managed in that Gallery app.
            </Text>
          </View>
        )}

        {/* Review Banner */}
        <View style={styles.reviewBox}>
          <Text style={styles.reviewIcon}>💡</Text>
          <View style={styles.reviewContent}>
            <Text style={styles.reviewTitle}>Review before cleaning</Text>
            <Text style={styles.reviewText}>
              Some files may need your attention, especially unknown files.
            </Text>
          </View>
          <TouchableOpacity style={styles.viewDetailsButton} activeOpacity={0.7}>
            <Text style={styles.viewDetailsText}>Details</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.footer}>
        <View style={styles.bottomInfo}>
          <Text style={styles.bottomLabel}>Selected:</Text>
          <Text style={styles.bottomValue}>
            {selectedCount} items · {getSelectedSize()}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.cleanButton,
            selectedCount === 0 && styles.cleanButtonDisabled,
          ]}
          onPress={proceedToClean}
          activeOpacity={0.8}
          disabled={selectedCount === 0}
        >
          <Text style={styles.cleanIcon}>🧹</Text>
          <Text style={styles.cleanButtonText}>Clean Selected ({getSelectedSize()})</Text>
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
  restoreButton: {
    alignSelf: 'flex-start',
    marginTop: 7,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#EAF3FF',
  },
  restoreButtonText: { color: '#155A9C', fontSize: 11, fontWeight: '700' },
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    fontSize: 15,
    color: '#475569',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  summaryCard: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: '#EEF5FC',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryLeft: {
    marginRight: 12,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  iconEmoji: {
    fontSize: 24,
  },
  summaryRight: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0A192F',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  summarySubtitle: {
    fontSize: 11,
    color: '#64748B',
  },
  deviceBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  deviceIcon: {
    fontSize: 12,
    marginRight: 5,
  },
  deviceLabel: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '500',
  },
  deviceName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0A192F',
  },
  categoriesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 18,
    marginBottom: 10,
  },
  categoriesActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoriesTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0A192F',
    letterSpacing: -0.3,
  },
  categorySection: {
    marginBottom: 16,
  },
  emptyTrashCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTrashTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0A192F',
    marginBottom: 4,
  },
  emptyTrashText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#64748B',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  categoryHeaderInfo: {
    flex: 1,
    marginLeft: 10,
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
  categoryName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0A192F',
    marginBottom: 1,
  },
  categoryMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  itemLeft: {
    marginRight: 10,
  },
  itemInfo: {
    flex: 1,
    marginRight: 10,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0A192F',
    marginBottom: 2,
  },
  itemSubtitle: {
    fontSize: 11,
    color: '#64748B',
  },
  itemWarning: {
    fontSize: 10,
    color: '#F59E0B',
    fontWeight: '600',
    marginTop: 2,
  },
  itemRight: {
    alignItems: 'flex-end',
  },
  itemSize: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0A192F',
    marginBottom: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  checkboxDisabled: {
    opacity: 0.4,
  },
  checkmark: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  riskBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#DCFCE7',
  },
  riskHigh: {
    backgroundColor: '#FEE2E2',
  },
  riskMedium: {
    backgroundColor: '#FEF3C7',
  },
  riskText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#16A34A',
  },
  selectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#EEF5FC',
    borderRadius: 8,
    marginRight: 8,
  },
  selectBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2196F3',
  },
  deselectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  deselectBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  reviewBox: {
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
  reviewIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  reviewContent: {
    flex: 1,
  },
  reviewTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0A192F',
    marginBottom: 1,
  },
  reviewText: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
  },
  viewDetailsButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
    backgroundColor: '#FFFFFF',
    marginLeft: 8,
  },
  viewDetailsText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2196F3',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  bottomInfo: {
    flex: 1,
  },
  bottomLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  bottomValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0A192F',
  },
  cleanButton: {
    flexDirection: 'row',
    backgroundColor: '#2196F3',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 2,
  },
  cleanButtonDisabled: {
    opacity: 0.5,
  },
  cleanIcon: {
    fontSize: 15,
    marginRight: 8,
  },
  cleanButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
});
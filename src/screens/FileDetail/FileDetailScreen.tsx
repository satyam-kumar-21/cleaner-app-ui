import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { LocalizedText as Text } from '@/context/LanguageContext';
import {
  ThemedScrollView as ScrollView,
  ThemedStatusBar as StatusBar,
  ThemedTouchableOpacity as TouchableOpacity,
  ThemedView as View,
  ThemedSafeAreaView as SafeAreaView,
} from '@/context/ThemeContext';
import {
  Platform,
  StyleSheet,
  Alert,
} from 'react-native';
import { deviceInfoService } from '@/services/deviceInfoService';
import type { ScanItem } from '@/services/scanner/types';
import { fileViewerService } from '@/services/fileViewerService';

export default function FileDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const {
    displayName,
    filePath,
    fileSizeBytes,
    reason,
    riskLevel,
    category,
    canClean,
  } = params;
  const selectedItem = useMemo(() => {
    if (typeof params.selectedItem !== 'string') return null;
    try {
      const parsed = JSON.parse(params.selectedItem) as ScanItem;
      if (
        !parsed
        || typeof parsed.itemId !== 'string'
        || typeof parsed.displayName !== 'string'
        || typeof parsed.category !== 'string'
        || typeof parsed.location !== 'string'
        || typeof parsed.canClean !== 'boolean'
      ) return null;
      return {
        ...parsed,
        detectedAt: new Date(String(parsed.detectedAt)),
        selected: true,
      };
    } catch (error) {
      console.error('Failed to read the scanned item details:', error);
      return null;
    }
  }, [params.selectedItem]);

  const getCategoryIcon = (cat: string) => {
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
    return icons[cat] || '❓';
  };

  const getRiskColor = (risk: string) => {
    if (risk === 'high') return '#EF4444';
    if (risk === 'medium') return '#F59E0B';
    return '#22C55E';
  };

  const getRiskBg = (risk: string) => {
    if (risk === 'high') return '#FEE2E2';
    if (risk === 'medium') return '#FEF3C7';
    return '#DCFCE7';
  };

  const handleRemoveFile = () => {
    if (!selectedItem || !selectedItem.canClean || !selectedItem.location) {
      Alert.alert('Cannot remove this item', 'This item is not available for removal.');
      return;
    }
    const isTrashItem = selectedItem.category === 'TRASH';
    Alert.alert(
      isTrashItem ? 'Permanently remove this item?' : 'Remove this file?',
      isTrashItem
        ? 'Android will ask you to confirm permanent deletion from Trash.'
        : 'Review the selected file before confirming its removal.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => router.push({
            pathname: '/confirm-clean' as any,
            params: {
              selectedItems: JSON.stringify([selectedItem]),
              totalSize: String(selectedItem.fileSizeBytes || 0),
              scanResults: typeof params.scanResults === 'string' ? params.scanResults : '',
            },
          }),
        },
      ]
    );
  };
  const isImageFile = /\.(?:jpe?g|png|webp|heic|heif|bmp|gif)$/i.test(String(displayName || filePath || ''));
  const handleViewFile = () => {
    if (!filePath || typeof filePath !== 'string') {
      Alert.alert('Cannot view file', 'The scanned image location is unavailable.');
      return;
    }
    void fileViewerService.openFile(filePath);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Ambient Background Accents */}
      <View style={styles.topBlob} />
      <View style={styles.bottomBlob} />

      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>File Details</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* File Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.iconContainer}>
            <View style={styles.categoryIconBox}>
              <Text style={styles.categoryIcon}>
                {getCategoryIcon(String(category))}
              </Text>
            </View>
          </View>

          <Text style={styles.fileName}>{displayName}</Text>
          
          <View style={styles.filePathContainer}>
            <Text style={styles.filePathLabel}>File Path:</Text>
            <Text style={styles.filePath} numberOfLines={3}>
              {filePath || 'Not available'}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Size</Text>
              <Text style={styles.metaValue}>
                {deviceInfoService.formatBytes(Number(fileSizeBytes) || 0)}
              </Text>
            </View>

            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Category</Text>
              <Text style={styles.metaValue}>
                {String(category).replace(/_/g, ' ')}
              </Text>
            </View>
          </View>

          <View style={styles.riskContainer}>
            <Text style={styles.riskLabel}>Risk Level</Text>
            <View
              style={[
                styles.riskBadge,
                { backgroundColor: getRiskBg(String(riskLevel)) },
              ]}
            >
              <Text
                style={[
                  styles.riskText,
                  { color: getRiskColor(String(riskLevel)) },
                ]}
              >
                {String(riskLevel).toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Can Clean Section */}
        <View style={styles.cleanSection}>
          {canClean === 'true' ? (
            <View style={styles.safeBox}>
              <View style={styles.safeIconBox}>
                <Text style={styles.safeIcon}>✓</Text>
              </View>
              <View style={styles.safeContent}>
                <Text style={styles.safeTitle}>Safe to Clean</Text>
                <Text style={styles.safeText}>
                  This file can be safely removed without affecting system stability.
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.warningBox}>
              <Text style={styles.warningIcon}>⚠️</Text>
              <View style={styles.warningContent}>
                <Text style={styles.warningTitle}>Requires Review</Text>
                <Text style={styles.warningText}>{reason}</Text>
              </View>
            </View>
          )}
        </View>

        {/* File Action */}
        <View style={styles.actionsCard}>
          <Text style={styles.actionsTitle}>{isImageFile ? 'File Actions' : 'File Action'}</Text>
          {isImageFile && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleViewFile}
              activeOpacity={0.7}
            >
              <View style={styles.actionIconBox}>
                <Text style={styles.actionIcon}>🖼️</Text>
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionLabel}>View File</Text>
                <Text style={styles.actionDesc}>Open this image on your device</Text>
              </View>
              <Text style={styles.actionArrow}>›</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleRemoveFile}
            disabled={!selectedItem?.canClean || canClean !== 'true'}
            activeOpacity={0.7}
          >
            <View style={styles.actionIconBox}>
              <Text style={styles.actionIcon}>🗑️</Text>
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionLabel}>Remove File</Text>
              <Text style={styles.actionDesc}>Review and confirm removal</Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Reason Section */}
        <View style={styles.reasonCard}>
          <Text style={styles.reasonTitle}>Why was this detected?</Text>
          <Text style={styles.reasonText}>{reason}</Text>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Bottom Action Buttons */}
      <SafeAreaView edges={['bottom']} style={styles.footer}>
        {canClean !== 'true' && (
          <TouchableOpacity
            style={styles.markSafeButton}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Text style={styles.markSafeText}>Mark as Safe</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.backActionButton,
            canClean !== 'true' && styles.backActionButtonSmall,
          ]}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Text style={styles.backActionText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 20,
    color: '#0A192F',
  },
  headerTextWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0A192F',
    letterSpacing: -0.4,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  infoCard: {
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
  iconContainer: {
    alignItems: 'center',
    marginBottom: 14,
  },
  categoryIconBox: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#EEF5FC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIcon: {
    fontSize: 32,
  },
  fileName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0A192F',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  filePathContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  filePathLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  filePath: {
    fontSize: 11,
    color: '#475569',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    lineHeight: 16,
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  metaItem: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0A192F',
  },
  riskContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  riskLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0A192F',
  },
  riskBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  riskText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cleanSection: {
    marginHorizontal: 16,
    marginTop: 12,
  },
  safeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  safeIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  safeIcon: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  safeContent: {
    flex: 1,
  },
  safeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
    marginBottom: 2,
  },
  safeText: {
    fontSize: 11,
    color: '#166534',
    lineHeight: 15,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  warningIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 2,
  },
  warningText: {
    fontSize: 11,
    color: '#92400E',
    lineHeight: 15,
  },
  reasonCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  reasonTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0A192F',
    marginBottom: 6,
  },
  reasonText: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
  actionsCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  actionsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0A192F',
    marginBottom: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  actionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EEF5FC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionIcon: {
    fontSize: 18,
  },
  actionContent: {
    flex: 1,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0A192F',
    marginBottom: 2,
  },
  actionDesc: {
    fontSize: 11,
    color: '#64748B',
  },
  actionArrow: {
    fontSize: 24,
    color: '#CBD5E1',
    fontWeight: '300',
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
  markSafeButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  markSafeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  backActionButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 2,
  },
  backActionButtonSmall: {
    flex: 1,
  },
  backActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

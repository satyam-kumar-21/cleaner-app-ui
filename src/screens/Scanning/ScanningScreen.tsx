import BottomNav from '@/components/common/BottomNav';
import CircularProgress from '@/components/common/CircularProgress';
import { LocalizedText as Text } from '@/context/LanguageContext';
import {
  ThemedScrollView as ScrollView,
  ThemedStatusBar as StatusBar,
  ThemedTouchableOpacity as TouchableOpacity,
  ThemedView as View,
  ThemedSafeAreaView as SafeAreaView,
} from '@/context/ThemeContext';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
} from 'react-native';
import { scannerService } from '@/services/scanner/ScannerService';
import { cleanupService } from '@/services/cleanupService';
import type { ScanFilters, ScanCategory } from '@/services/scanner/types';

const scanStages = [
  { stage: 'files', name: 'Selected Files', subtitle: 'Checking your selected folders and file types...', icon: '📄', bg: '#EEF5FC' },
  { stage: 'integrity', name: 'File Integrity', subtitle: 'Checking temporary and incomplete files...', icon: '❌', bg: '#FEE2E2' },
  { stage: 'trash', name: 'Recycle Bin', subtitle: 'Checking Android MediaStore trash...', icon: '🗑️', bg: '#EBF7F6' },
  { stage: 'apps', name: 'Unused Apps', subtitle: 'Finding apps unused for 90 days...', icon: '📱', bg: '#F8EEFC' },
] as const;

const FILE_SCAN_CATEGORIES: ScanCategory[] = [
  'TEMPORARY',
  'POTENTIALLY_CORRUPTED',
  'LARGE_FILE',
  'DUPLICATE',
  'SCREENSHOT',
  'SUSPICIOUS',
];

function getStagesForCategories(categories: ScanCategory[]) {
  return scanStages.filter(({ stage }) => {
    if (stage === 'files') return categories.some((category) => FILE_SCAN_CATEGORIES.includes(category));
    if (stage === 'integrity') {
      return categories.includes('TEMPORARY') || categories.includes('POTENTIALLY_CORRUPTED');
    }
    if (stage === 'trash') return categories.includes('TRASH');
    return categories.includes('UNUSED_APP');
  });
}

export default function ScanningScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ scanConfig?: string }>();
  const [progress, setProgress] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [filesIndexed, setFilesIndexed] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setError] = useState<string | null>(null);
  const [activeScanStages, setActiveScanStages] = useState<typeof scanStages[number][]>([]);
  const scanStarted = useRef(false);

  const [rotateAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!isScanning) return;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [isScanning]);

  useEffect(() => {
    if (!isScanning) return;

    const animation = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 2200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animation.start();

    return () => animation.stop();
  }, [isScanning, rotateAnim]);

  const performScan = useCallback(async () => {
    try {
      let scanConfig: { enabledCategories: ScanCategory[]; filters: ScanFilters } | undefined;
      if (params.scanConfig) {
        const parsed: unknown = JSON.parse(params.scanConfig);
        if (!parsed || typeof parsed !== 'object'
          || !('enabledCategories' in parsed) || !Array.isArray(parsed.enabledCategories)
          || !('filters' in parsed) || !parsed.filters || typeof parsed.filters !== 'object') {
          throw new Error('Advanced scan configuration is invalid. Please choose your scan options again.');
        }
        const filters = parsed.filters as Partial<ScanFilters>;
        if (!Array.isArray(filters.folders) || !Array.isArray(filters.fileTypes)
          || typeof filters.minSizeBytes !== 'number'
          || !(filters.maxSizeBytes === null || typeof filters.maxSizeBytes === 'number')
          || !(filters.modifiedWithinDays === null || typeof filters.modifiedWithinDays === 'number')) {
          throw new Error('Advanced scan filters are invalid. Please choose your scan options again.');
        }
        scanConfig = {
          enabledCategories: parsed.enabledCategories.filter((category): category is ScanCategory =>
            ['TEMPORARY', 'TRASH', 'POTENTIALLY_CORRUPTED', 'UNUSED_APP', 'DUPLICATE', 'LARGE_FILE', 'SCREENSHOT'].includes(String(category))
          ),
          filters: filters as ScanFilters,
        };
        if (!scanConfig.enabledCategories.length) {
          throw new Error('Choose at least one supported scan category.');
        }
      }
      const enabledCategories = scanConfig?.enabledCategories ?? [
        'TEMPORARY',
        'TRASH',
        'POTENTIALLY_CORRUPTED',
        'UNUSED_APP',
      ];
      const permissionResult = await cleanupService.requestPermissions({
        requireSharedStorage: enabledCategories.some((category) =>
          ['TEMPORARY', 'POTENTIALLY_CORRUPTED', 'LARGE_FILE', 'DUPLICATE', 'SCREENSHOT', 'SUSPICIOUS'].includes(category)
        ),
        requireMediaAccess: enabledCategories.includes('TRASH'),
        requireUsageAccess: enabledCategories.includes('UNUSED_APP'),
      });
      if (!permissionResult.granted) {
        setError(permissionResult.message || 'Storage permission is required to scan this device.');
        setIsScanning(false);
        return;
      }
      const availableCategories = enabledCategories.filter((category) =>
        !permissionResult.unavailableCategories?.includes(category)
      );
      if (!availableCategories.length) {
        setError(permissionResult.message || 'No scan categories are available with the permissions granted.');
        setIsScanning(false);
        return;
      }

      const selectedStages = getStagesForCategories(availableCategories);
      setActiveScanStages(selectedStages);
      setIsScanning(true);
      setElapsedSeconds(0);
      setProgress(0);
      setCurrentIndex(0);
      // Run the actual scan
      const result = await scannerService.runFullScan({
        enabledCategories: availableCategories,
      }, setFilesIndexed, {
        includeSharedStorage: permissionResult.scanSharedStorage,
        filters: scanConfig?.filters,
        description: permissionResult.message,
      }, ({ stage, filesChecked }) => {
        const stageIndex = selectedStages.findIndex((category) => category.stage === stage);
        if (stageIndex >= 0) {
          setCurrentIndex(stageIndex);
          setProgress((stageIndex / selectedStages.length) * 100);
        }
        setFilesIndexed(filesChecked);
      });

      // Complete progress
      setIsScanning(false);
      setProgress(100);
      setCurrentIndex(selectedStages.length);

      // Navigate to results after a brief pause
      setTimeout(() => {
        router.replace({
          pathname: '/results' as any,
          params: { scanResults: JSON.stringify(result) }
        });
      }, 800);

    } catch (error) {
      console.error('Scan failed:', error);
      setError(error instanceof Error ? error.message : 'Scan failed');
      setIsScanning(false);
    }
  }, [params.scanConfig, router]);

  useEffect(() => {
    if (scanStarted.current) return;
    scanStarted.current = true;
    void performScan();
  }, [performScan]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const getStatus = (index: number) => {
    if (!isScanning && progress >= 100) return 'completed';
    if (index < currentIndex) return 'completed';
    if (index === currentIndex && isScanning) return 'scanning';
    return 'pending';
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
            <Text style={styles.headerTitle}>Scanning</Text>
            <Text style={styles.headerSubtitle}>
              Checking device cleanup targets...
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {scanError ? (
          /* Error State */
          <View style={styles.errorCard}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>Scan Failed</Text>
            <Text style={styles.errorMessage}>{scanError}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                setError(null);
                setProgress(0);
                setCurrentIndex(0);
                void performScan();
              }}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Main Circular Scan Progress Hero Card */}
            <View style={styles.heroCard}>
              <View style={styles.progressRingWrapper}>
                <Animated.View
                  style={[
                    styles.spinnerRing,
                    { transform: [{ rotate: spin }] },
                  ]}
                />
                <CircularProgress
                  progress={progress}
                  size={130}
                  strokeWidth={8}
                  progressColor="#2196F3"
                  trackColor="#E2E8F0"
                  showPercentage={false}
                >
                  <View>
                    <Text style={{ color: '#0F172A', fontSize: 28, fontWeight: '700', textAlign: 'center' }}>
                      {filesIndexed}
                    </Text>
                    <Text style={{ color: '#64748B', fontSize: 12, textAlign: 'center' }}>files checked</Text>
                  </View>
                </CircularProgress>
              </View>

              <View style={styles.heroMeta}>
                <Text style={styles.heroTitle}>Cleanup Scan</Text>
                <Text style={styles.heroSubtitle}>
                  {activeScanStages.length
                    ? `Scanning selected categories: ${activeScanStages.map(({ name }) => name).join(', ')}.`
                    : 'Preparing your selected scan categories...'}
                </Text>
                <View style={styles.timeBadge}>
                  <Text style={styles.timeIcon}>⏱</Text>
                  <Text style={styles.timeText}>
                    {isScanning
                      ? `Elapsed: ${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, '0')}`
                      : `Completed in ${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, '0')}`}
                  </Text>
                </View>
              </View>
            </View>

            {/* Scan Categories Section */}
            <View style={styles.categoriesContainer}>
              <Text style={styles.sectionTitle}>Scan Progress</Text>

              {activeScanStages.map((category, index) => {
                const status = getStatus(index);

                return (
                  <View key={category.name} style={styles.categoryCard}>
                    <View
                      style={[
                        styles.categoryIconBox,
                        { backgroundColor: category.bg },
                      ]}
                    >
                      <Text style={styles.categoryIcon}>{category.icon}</Text>
                    </View>

                    <View style={styles.categoryInfo}>
                      <Text style={styles.categoryName}>{category.name}</Text>
                      <Text style={styles.categorySubtitle} numberOfLines={1}>
                        {category.subtitle}
                      </Text>
                    </View>

                    <View style={styles.categoryStatus}>
                      {status === 'completed' && (
                        <View style={styles.completedBadge}>
                          <Text style={styles.completedIcon}>✓</Text>
                          <Text style={styles.completedText}>Done</Text>
                        </View>
                      )}
                      {status === 'scanning' && (
                        <View style={styles.scanningBadge}>
                          <View style={styles.smallSpinner} />
                          <Text style={styles.scanningText}>Scanning</Text>
                        </View>
                      )}
                      {status === 'pending' && (
                        <View style={styles.pendingBadge}>
                          <View style={styles.pendingDot} />
                          <Text style={styles.pendingText}>Pending</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Footer Info Box */}
            <View style={styles.infoBox}>
              <Text style={styles.infoIcon}>💡</Text>
              <Text style={styles.infoText}>
                Scanning runs locally on your device to ensure total data privacy.
              </Text>
            </View>
          </>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Cancel Action Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Text style={styles.cancelButtonText}>Cancel Scan</Text>
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
  heroCard: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  progressRingWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  spinnerRing: {
    position: 'absolute',
    width: 148,
    height: 148,
    borderRadius: 74,
    borderWidth: 2,
    borderColor: '#2196F3',
    borderStyle: 'dashed',
    opacity: 0.4,
  },
  heroMeta: {
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0A192F',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF5FC',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  timeIcon: {
    fontSize: 12,
    marginRight: 6,
  },
  timeText: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '600',
  },
  categoriesContainer: {
    paddingHorizontal: 16,
    marginTop: 18,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0A192F',
    letterSpacing: -0.3,
    marginBottom: 12,
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
    marginRight: 12,
  },
  categoryIcon: {
    fontSize: 18,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0A192F',
    marginBottom: 2,
  },
  categorySubtitle: {
    fontSize: 11,
    color: '#64748B',
  },
  categoryStatus: {
    marginLeft: 8,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  completedIcon: {
    fontSize: 11,
    marginRight: 4,
    color: '#16A34A',
    fontWeight: '700',
  },
  completedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
  },
  scanningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF5FC',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  smallSpinner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#2196F3',
    borderTopColor: 'transparent',
    marginRight: 6,
  },
  scanningText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2196F3',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pendingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#94A3B8',
    marginRight: 6,
  },
  pendingText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#EEF5FC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
  },
  errorCard: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: '#FEE2E2',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#DC2626',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 13,
    color: '#991B1B',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cancelButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#2196F3',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2196F3',
  },
});
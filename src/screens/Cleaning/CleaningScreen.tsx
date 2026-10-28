import BottomNav from '@/components/common/BottomNav';
import CircularProgress from '@/components/common/CircularProgress';
import { LocalizedText as Text } from '@/context/LanguageContext';
import {
  ThemedScrollView as ScrollView,
  ThemedStatusBar as StatusBar,
  ThemedView as View,
  ThemedSafeAreaView as SafeAreaView,
} from '@/context/ThemeContext';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Alert,
  StyleSheet,
} from 'react-native';
import { cleanupService } from '@/services/cleanupService';
import { deviceInfoService } from '@/services/deviceInfoService';
import { invalidateHomeCache } from '@/utils/homeDataCache';
import type { ScanItem } from '@/services/scanner/types';

export default function CleaningScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [progress, setProgress] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cleaningStatusText, setCleaningStatusText] = useState('Cleaning files...');
  const [pulseAnim] = useState(() => new Animated.Value(1));
  const isCleaningRef = useRef(false);

  const { items, totalSize } = useMemo(() => {
    try {
      if (params.selectedItems && typeof params.selectedItems === 'string') {
        const parsedItems: ScanItem[] = JSON.parse(params.selectedItems);
        const parsedSize = typeof params.totalSize === 'string' ? Number(params.totalSize) : 0;
        return {
          items: parsedItems,
          totalSize: Number.isFinite(parsedSize) ? parsedSize : 0,
        };
      }
    } catch (error) {
      console.error('Failed to parse selected items:', error);
    }
    return { items: [], totalSize: 0 };
  }, [params.selectedItems, params.totalSize]);

  const executeCleanup = useCallback(async (targetItems: ScanItem[]) => {
    try {
      setCleaningStatusText('Requesting permissions...');
      const enabledCategories = Array.from(new Set(targetItems.map((item) => item.category)));
      const permissionResult = await cleanupService.requestPermissions({
        requireSharedStorage: targetItems.some((item) =>
          item.category !== 'TRASH' && item.category !== 'UNUSED_APP'
        ),
        requireMediaAccess: enabledCategories.includes('TRASH'),
        requireUsageAccess: enabledCategories.includes('UNUSED_APP'),
      });
      if (!permissionResult.granted) {
        throw new Error(permissionResult.message || 'Storage permission is required to clean files.');
      }
      if (permissionResult.unavailableCategories?.length) {
        throw new Error(
          `Cannot clean selected ${permissionResult.unavailableCategories
            .map((category) => category.replace(/_/g, ' ').toLowerCase())
            .join(' and ')} without the required permission.`
        );
      }
      setCleaningStatusText('Cleaning files...');

      const result = await cleanupService.cleanItems(targetItems, (prog) => {
        const pct = Math.min(95, Math.round(((prog.itemsProcessed + 1) / targetItems.length) * 100));
        setProgress(pct);
        setCurrentIndex(prog.itemsProcessed);
        if (prog.currentItem) {
          setCleaningStatusText(`Cleaning ${prog.currentItem}...`);
        }
      });

      setProgress(100);
      setCurrentIndex(targetItems.length);
      setCleaningStatusText('Cleanup complete!');

      // Invalidate home cache so home dashboard refreshes with new data
      invalidateHomeCache();

      const cleanedItemIds = new Set(result.cleanedItemIds);
      const cleanedItems = targetItems.filter((item) => cleanedItemIds.has(item.itemId));
      setTimeout(() => {
        router.replace({
          pathname: '/complete' as any,
          params: {
            cleanupResult: JSON.stringify(result),
            cleanedItems: JSON.stringify(cleanedItems),
            totalBytesFreed: String(result.bytesFreed),
          },
        });
      }, 700);
    } catch (error) {
      console.error('Cleanup execution failed:', error);
      const message = error instanceof Error ? error.message : 'Cleanup failed.';
      Alert.alert('Cleanup failed', message, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    }
  }, [router]);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  useEffect(() => {
    if (!items.length) {
      router.back();
      return;
    }
    if (isCleaningRef.current) return;
    isCleaningRef.current = true;
    void executeCleanup(items);
  }, [executeCleanup, items, router]);

  const getFileStatus = (index: number) => {
    if (index < currentIndex) return 'completed';
    if (index === currentIndex) return 'cleaning';
    return 'pending';
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Ambient Background Accents */}
      <View style={styles.topBlob} />
      <View style={styles.bottomBlob} />

      {/* Standard Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoBox}>
            <Text style={styles.logoIcon}>🧹</Text>
          </View>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>Cleaning in Progress</Text>
            <Text style={styles.headerSubtitle}>
              Please wait while we clean your device...
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress Card Section */}
        <View style={styles.heroCard}>
          <Animated.View
            style={[
              styles.progressCircleContainer,
              { transform: [{ scale: pulseAnim }] },
            ]}
          >
            <CircularProgress
              progress={progress}
              size={120}
              strokeWidth={8}
              progressColor="#2196F3"
              trackColor="#E2E8F0"
              showPercentage={false}
            >
              <Text style={styles.cleaningIcon}>🧹</Text>
            </CircularProgress>
          </Animated.View>

          <Text style={styles.progressText}>{Math.round(progress)}%</Text>
          <Text style={styles.progressLabel}>{cleaningStatusText}</Text>
        </View>

        {/* Cleaning Stats Row */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {deviceInfoService.formatBytes(totalSize)}
            </Text>
            <Text style={styles.statLabel}>Being Cleaned</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {Math.min(currentIndex, items.length)}/{items.length}
            </Text>
            <Text style={styles.statLabel}>Files Processed</Text>
          </View>
        </View>

        {/* Processing Files List */}
        <View style={styles.filesContainer}>
          <Text style={styles.sectionTitle}>Processing Files</Text>

          {items.map((file, index) => {
            const status = getFileStatus(index);

            return (
              <View key={file.itemId || index} style={styles.fileCard}>
                <View
                  style={[
                    styles.fileStatusIcon,
                    status === 'completed' && styles.fileStatusCompleted,
                    status === 'cleaning' && styles.fileStatusCleaning,
                    status === 'pending' && styles.fileStatusPending,
                  ]}
                >
                  {status === 'completed' && (
                    <Text style={styles.statusCompletedText}>✓</Text>
                  )}
                  {status === 'cleaning' && (
                    <Text style={styles.statusCleaningText}>⟳</Text>
                  )}
                  {status === 'pending' && (
                    <Text style={styles.statusPendingText}>○</Text>
                  )}
                </View>

                <View style={styles.fileInfo}>
                  <Text
                    style={[
                      styles.fileName,
                      status === 'cleaning' && styles.fileNameActive,
                    ]}
                    numberOfLines={1}
                  >
                    {file.displayName}
                  </Text>
                  {status === 'cleaning' && (
                    <Text style={styles.fileStatusText}>Cleaning now...</Text>
                  )}
                </View>

                {status === 'completed' && (
                  <View style={styles.completedBadge}>
                    <Text style={styles.completedBadgeText}>Done</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Linear Progress Bar */}
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarBackground}>
            <View
              style={[styles.progressBarFill, { width: `${progress}%` }]}
            />
          </View>
          <Text style={styles.progressBarText}>
            Cleaning... {Math.round(progress)}%
          </Text>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

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
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  progressCircleContainer: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cleaningIcon: {
    fontSize: 36,
  },
  progressText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0A192F',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  progressLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  statsCard: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2196F3',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },
  filesContainer: {
    marginHorizontal: 16,
    marginTop: 18,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0A192F',
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  fileStatusIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  fileStatusCompleted: {
    backgroundColor: '#DCFCE7',
  },
  fileStatusCleaning: {
    backgroundColor: '#EEF5FC',
  },
  fileStatusPending: {
    backgroundColor: '#F1F5F9',
  },
  statusCompletedText: {
    fontSize: 12,
    color: '#16A34A',
    fontWeight: '800',
  },
  statusCleaningText: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '800',
  },
  statusPendingText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  fileNameActive: {
    color: '#0A192F',
    fontWeight: '700',
  },
  fileStatusText: {
    fontSize: 10,
    color: '#2196F3',
    fontWeight: '600',
    marginTop: 1,
  },
  completedBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  completedBadgeText: {
    fontSize: 10,
    color: '#16A34A',
    fontWeight: '700',
  },
  progressBarContainer: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#2196F3',
    borderRadius: 4,
  },
  progressBarText: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '600',
  },
});
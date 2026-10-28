import AdPlaceholder from '@/components/common/AdPlaceholder';
import BottomNav from '@/components/common/BottomNav';
import { LocalizedText as Text } from '@/context/LanguageContext';
import {
  ThemedScrollView as ScrollView,
  ThemedStatusBar as StatusBar,
  ThemedTouchableOpacity as TouchableOpacity,
  ThemedView as View,
  ThemedSafeAreaView as SafeAreaView,
  useTheme,
} from '@/context/ThemeContext';
import { useRouter, useFocusEffect } from 'expo-router';
import React, { useState, useCallback, useRef } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  BackHandler,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { deviceInfoService, DeviceInfo } from '@/services/deviceInfoService';
import { deviceStorage } from '@/services/local/deviceStorage';
import { useLocalProfile } from '@/context/LocalProfileContext';
import { shouldInvalidateHomeCache, resetInvalidationFlag } from '@/utils/homeDataCache';

export default function HomeScreen() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { width } = useWindowDimensions();
  const isCompact = width < 360;
  const { isLoading: isProfileLoading } = useLocalProfile();
  
  // State management
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAllDeviceInfo, setShowAllDeviceInfo] = useState(false);
  const [introOpacity] = useState(() => new Animated.Value(0));
  const [introOffset] = useState(() => new Animated.Value(18));
  const [glowScale] = useState(() => new Animated.Value(1));

  // Track if data has been loaded and if component is mounted
  const hasLoadedData = useRef(false);
  const lastLoadTime = useRef(0);
  const isMounted = useRef(false);

  // Set mounted flag
  React.useEffect(() => {
    isMounted.current = true;
    const introAnimation = Animated.parallel([
      Animated.timing(introOpacity, {
        toValue: 1,
        duration: 650,
        useNativeDriver: true,
      }),
      Animated.spring(introOffset, {
        toValue: 0,
        damping: 18,
        stiffness: 105,
        useNativeDriver: true,
      }),
    ]);
    introAnimation.start();
    const glowAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(glowScale, {
          toValue: 1.07,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(glowScale, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    );
    glowAnimation.start();
    return () => {
      isMounted.current = false;
      introAnimation.stop();
      glowAnimation.stop();
    };
  }, [glowScale, introOffset, introOpacity]);

  // Handle Android back button on Home screen
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (Platform.OS === 'android') {
          BackHandler.exitApp();
          return true; // Prevent default behavior
        }
        return false;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [])
  );

  const loadDeviceData = useCallback(async () => {
    try {
      if (isMounted.current) setIsLoading(true);
      const info = await deviceInfoService.getDeviceInfo();
      if (isMounted.current) setDeviceInfo(info);

      const deviceData = {
        deviceId: info.deviceId,
        deviceName: info.deviceName ?? undefined,
        manufacturer: info.manufacturer ?? undefined,
        model: info.model ?? undefined,
        platform: info.platform,
        osVersion: info.osVersion ?? undefined,
        appVersion: info.appVersion,
        architecture: info.architecture ?? undefined,
        processorName: info.processorName ?? undefined,
        coreCount: info.coreCount ?? undefined,
        totalRamBytes: info.totalRamBytes ?? undefined,
        availableRamBytes: info.availableRamBytes ?? undefined,
        totalStorageBytes: info.totalStorageBytes ?? undefined,
        freeStorageBytes: info.freeStorageBytes ?? undefined,
        usedStorageBytes: info.usedStorageBytes ?? undefined,
        batteryLevel: info.batteryLevel ?? undefined,
        isCharging: info.isCharging ?? undefined,
      };
      await deviceStorage.registerDevice(deviceData);

      hasLoadedData.current = true;
      lastLoadTime.current = Date.now();
    } catch (error) {
      console.error('Failed to load local device data:', error);
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  }, []);

  const refreshDeviceStats = useCallback(async () => {
    try {
      setIsRefreshing(true);
      
      // Get fresh dynamic stats
      const stats = await deviceInfoService.refreshDynamicStats();
      
      if (deviceInfo) {
        // Update device info with fresh stats
        const updatedInfo: DeviceInfo = {
          ...deviceInfo,
          availableRamBytes: stats.availableRamBytes,
          freeStorageBytes: stats.freeStorageBytes,
          usedStorageBytes: deviceInfo.totalStorageBytes !== null && stats.freeStorageBytes !== null
            ? deviceInfo.totalStorageBytes - stats.freeStorageBytes
            : deviceInfo.usedStorageBytes,
          batteryLevel: stats.batteryLevel,
          isCharging: stats.isCharging,
        };
        setDeviceInfo(updatedInfo);
      }

      if (deviceInfo) {
        await deviceStorage.sendHeartbeat(deviceInfo.deviceId, {
          availableRamBytes: stats.availableRamBytes ?? undefined,
          freeStorageBytes: stats.freeStorageBytes ?? undefined,
          batteryLevel: stats.batteryLevel ?? undefined,
          isCharging: stats.isCharging ?? undefined,
        });
      }

      lastLoadTime.current = Date.now();
    } catch (error) {
      console.error('Failed to refresh device stats:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [deviceInfo]);

  useFocusEffect(
    useCallback(() => {
      if (isProfileLoading) return;
      setShowAllDeviceInfo(false);
      const cacheInvalidated = shouldInvalidateHomeCache();
      if (cacheInvalidated || !hasLoadedData.current || Date.now() - lastLoadTime.current > 5 * 60 * 1000) {
        if (cacheInvalidated) resetInvalidationFlag();
        void loadDeviceData();
      }
    }, [isProfileLoading, loadDeviceData])
  );

  const deviceInfoRows = deviceInfo
    ? [
        {
          label: 'Device model',
          value: `${deviceInfo.manufacturer ?? ''} ${deviceInfo.model || 'Unknown'}`.trim(),
        },
        {
          label: 'System',
          value: `${deviceInfo.platform === 'ios' ? 'iOS' : deviceInfo.platform} ${deviceInfo.osVersion || ''}`.trim(),
        },
        {
          label: 'Memory',
          value: deviceInfoService.formatBytes(deviceInfo.totalRamBytes),
        },
        {
          label: 'Storage used',
          value: deviceInfoService.formatBytes(deviceInfo.usedStorageBytes),
        },
        {
          label: 'Memory available',
          value: deviceInfo.availableRamBytes !== null
            ? deviceInfoService.formatBytes(deviceInfo.availableRamBytes)
            : deviceInfo.platform === 'android' && !deviceInfo.nativeAndroidStatsAvailable
              ? 'Requires Android build'
              : 'Not available',
        },
        {
          label: 'Total storage',
          value: deviceInfoService.formatBytes(deviceInfo.totalStorageBytes),
        },
        {
          label: 'Storage free',
          value: deviceInfoService.formatBytes(deviceInfo.freeStorageBytes),
        },
        {
          label: 'Battery',
          value: deviceInfo.batteryLevel !== null
            ? `${deviceInfo.batteryLevel}%${deviceInfo.isCharging ? ' ⚡' : ''}`
            : 'Not available',
        },
        {
          label: 'Processor',
          value: deviceInfo.processorName ||
            (deviceInfo.platform === 'android' && !deviceInfo.nativeAndroidStatsAvailable
              ? 'Available in installed Android app'
              : 'Not available'),
        },
        {
          label: 'Processor cores',
          value: deviceInfo.coreCount !== null
            ? String(deviceInfo.coreCount)
            : deviceInfo.platform === 'android' && !deviceInfo.nativeAndroidStatsAvailable
              ? 'Available in installed Android app'
              : 'Not available',
        },
        { label: 'Architecture', value: deviceInfo.architecture || 'Not available' },
      ]
    : [];

  if (isLoading && !deviceInfo) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#5B7CFA" />
        <Text style={styles.loadingText}>
          Loading device information...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.brandMark}>
            <Text style={styles.logoIcon}>✦</Text>
          </View>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerEyebrow}>DEVICE CARE</Text>
            <Text style={styles.headerTitle}>Cleaner</Text>
            <Text style={styles.headerSubtitle}>
              {deviceInfo?.deviceName || 'A little more room to breathe'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => {
            setTheme(theme === 'light' ? 'dark' : 'light').catch((error: unknown) => {
              console.error('Failed to toggle theme:', error);
            });
          }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
        >
          <Text style={styles.settingsIcon}>{theme === 'light' ? '☾' : '☀'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refreshDeviceStats}
            colors={['#2196F3']}
            tintColor="#2196F3"
          />
        }
      >
        <Animated.View
          style={{
            opacity: introOpacity,
            transform: [{ translateY: introOffset }],
          }}
        >
          <View style={styles.heroShadow}>
            <LinearGradient
              colors={['#111A32', '#202F57', '#315C78']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.heroCard, isCompact && styles.heroCardCompact]}
            >
              <View style={styles.heroGlow} />
              <Animated.View style={[styles.heroOrb, { transform: [{ scale: glowScale }] }]}>
                <Text style={styles.heroOrbIcon}>✦</Text>
              </Animated.View>
              <View style={styles.freeBadge}>
                <View style={styles.freeBadgeDot} />
                <Text style={styles.freeBadgeText}>FREE DEVICE CARE</Text>
              </View>
              <Text style={[styles.heroTitle, isCompact && styles.heroTitleCompact]}>
                A cleaner device{'\n'}starts right here.
              </Text>
              <Text style={styles.heroDescription}>
                Find clutter, review it safely, and free up space in a few taps.
              </Text>
              <TouchableOpacity
                style={[styles.scanButton, isCompact && styles.scanButtonCompact]}
                onPress={() => router.push('/advanced-scan' as any)}
                activeOpacity={0.82}
                accessibilityRole="button"
                accessibilityLabel="Start a device scan"
              >
                <Text style={styles.scanButtonIcon}>⌕</Text>
                <Text style={styles.scanButtonText}>Scan my device</Text>
                <Text style={styles.scanArrow}>→</Text>
              </TouchableOpacity>
              <Text style={styles.privacyNote}>Private by design · Your data stays on this device</Text>
            </LinearGradient>
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.deviceSection,
            { opacity: introOpacity, transform: [{ translateY: introOffset }] },
          ]}
        >
          {deviceInfo && (
            <>
              <View style={styles.sectionHeading}>
                <View>
                  <Text style={styles.sectionEyebrow}>YOUR HARDWARE</Text>
                  <Text style={styles.sectionTitle}>Device details</Text>
                </View>
                <TouchableOpacity
                  style={styles.refreshButton}
                  onPress={refreshDeviceStats}
                  disabled={isRefreshing}
                  accessibilityRole="button"
                  accessibilityLabel="Refresh device details"
                >
                  <Text style={styles.refreshIcon}>{isRefreshing ? '…' : '↻'}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.deviceCard}>
                <View style={styles.deviceIdentity}>
                  <View style={styles.deviceIconBox}>
                    <Text style={styles.deviceIcon}>▣</Text>
                  </View>
                  <View style={styles.deviceIdentityCopy}>
                    <Text style={styles.deviceName} numberOfLines={1}>
                      {deviceInfo.deviceName || deviceInfo.model || 'This device'}
                    </Text>
                    <Text style={styles.deviceModel} numberOfLines={1}>
                      {[deviceInfo.manufacturer, deviceInfo.model].filter(Boolean).join(' · ')
                        || `${deviceInfo.platform.toUpperCase()} device`}
                    </Text>
                  </View>
                  <View style={styles.osPill}>
                    <Text style={styles.osPillText}>
                      {deviceInfo.platform === 'ios' ? 'iOS' : deviceInfo.platform.toUpperCase()}
                      {deviceInfo.osVersion ? ` ${deviceInfo.osVersion}` : ''}
                    </Text>
                  </View>
                </View>

                <View style={styles.storageBlock}>
                  <View style={styles.storageHeading}>
                    <Text style={styles.storageLabel}>Storage used</Text>
                    <Text style={styles.storageValue}>
                      {deviceInfoService.formatBytes(deviceInfo.usedStorageBytes)}
                      <Text style={styles.storageTotal}>
                        {' / '}{deviceInfoService.formatBytes(deviceInfo.totalStorageBytes)}
                      </Text>
                    </Text>
                  </View>
                  <View style={styles.storageTrack}>
                    <View
                      style={[
                        styles.storageFill,
                        {
                          width: deviceInfo.totalStorageBytes && deviceInfo.usedStorageBytes !== null
                            ? `${Math.min(100, Math.max(0, (deviceInfo.usedStorageBytes / deviceInfo.totalStorageBytes) * 100))}%`
                            : '0%',
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.storageFootnote}>
                    {deviceInfo.freeStorageBytes !== null
                      ? `${deviceInfoService.formatBytes(deviceInfo.freeStorageBytes)} available`
                      : 'Storage availability is not available on this device'}
                  </Text>
                </View>

                <View style={styles.metricGrid}>
                  <View style={styles.metricCell}>
                    <View style={[styles.metricIconBox, styles.memoryIconBox]}>
                      <Text style={styles.metricIcon}>◫</Text>
                    </View>
                    <View style={styles.metricCopy}>
                      <Text style={styles.metricLabel}>Total memory</Text>
                      <Text style={styles.metricValue}>{deviceInfoService.formatBytes(deviceInfo.totalRamBytes)}</Text>
                    </View>
                  </View>
                  <View style={styles.metricCell}>
                    <View style={[styles.metricIconBox, styles.batteryIconBox]}>
                      <Text style={styles.metricIcon}>ϟ</Text>
                    </View>
                    <View style={styles.metricCopy}>
                      <Text style={styles.metricLabel}>Battery</Text>
                      <Text style={styles.metricValue}>
                        {deviceInfo.batteryLevel === null
                          ? 'Not available'
                          : `${deviceInfo.batteryLevel}%${deviceInfo.isCharging ? ' · Charging' : ''}`}
                      </Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.detailsToggle}
                  onPress={() => setShowAllDeviceInfo((expanded) => !expanded)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={showAllDeviceInfo ? 'Hide more device specifications' : 'Show more device specifications'}
                  accessibilityState={{ expanded: showAllDeviceInfo }}
                >
                  <Text style={styles.detailsToggleText}>
                    {showAllDeviceInfo ? 'Hide specifications' : 'More specifications'}
                  </Text>
                  <Text style={styles.detailsToggleIcon}>{showAllDeviceInfo ? '−' : '+'}</Text>
                </TouchableOpacity>

                {showAllDeviceInfo && (
                  <View style={styles.extraDetails}>
                    {deviceInfoRows
                      .filter(({ label }) => !['Storage used', 'Total storage', 'Memory'].includes(label))
                      .map((row, index, rows) => (
                        <View
                          key={row.label}
                          style={[styles.extraDetailRow, index === rows.length - 1 && styles.extraDetailRowLast]}
                        >
                          <Text style={styles.extraDetailLabel}>{row.label}</Text>
                          <Text style={styles.extraDetailValue} numberOfLines={1}>{row.value}</Text>
                        </View>
                      ))}
                    <View style={[styles.extraDetailRow, styles.extraDetailRowLast]}>
                      <Text style={styles.extraDetailLabel}>App version</Text>
                      <Text style={styles.extraDetailValue}>{deviceInfo.appVersion}</Text>
                    </View>
                  </View>
                )}
              </View>
            </>
          )}

          <View style={styles.quickLinks}>
            <TouchableOpacity
              style={styles.quickLink}
              onPress={() => router.push('/settings' as any)}
              activeOpacity={0.78}
            >
              <View style={styles.quickLinkIcon}>
                <Text style={styles.quickLinkIconText}>⚙</Text>
              </View>
              <View style={styles.quickLinkCopy}>
                <Text style={styles.quickLinkTitle}>Settings</Text>
                <Text style={styles.quickLinkHint}>Make it yours</Text>
              </View>
              <Text style={styles.quickLinkArrow}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickLink}
              onPress={() => router.push('/about' as any)}
              activeOpacity={0.78}
            >
              <View style={[styles.quickLinkIcon, styles.aboutLinkIcon]}>
                <Text style={styles.quickLinkIconText}>i</Text>
              </View>
              <View style={styles.quickLinkCopy}>
                <Text style={styles.quickLinkTitle}>About Cleaner</Text>
                <Text style={styles.quickLinkHint}>Learn more</Text>
              </View>
              <Text style={styles.quickLinkArrow}>›</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <AdPlaceholder />

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Bottom Navigation */}
      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6FB',
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
    paddingHorizontal: 16,
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
    flex: 1,
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
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    fontSize: 22,
    color: '#334155',
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  guestBanner: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: '#FFF6EB',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  guestBannerIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  guestBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F59E0B',
    marginBottom: 2,
  },
  guestBannerText: {
    fontSize: 11,
    color: '#92400E',
  },
  guestBannerButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  guestBannerButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scanCard: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: '#EEF5FC',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  scanIllustration: {
    marginRight: 14,
  },
  phoneCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(33, 150, 243, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneInner: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneEmoji: {
    fontSize: 34,
  },
  checkBadge: {
    position: 'absolute',
    bottom: -2,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#EEF5FC',
  },
  checkIcon: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  scanInfo: {
    flex: 1,
  },
  scanLabel: {
    fontSize: 10,
    color: '#64748B',
    marginBottom: 2,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  scanStatus: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0A192F',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent  : 'center',
    backgroundColor: '#2196F3',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 2,
  },
  scanButtonCompact: {
    paddingHorizontal: 11,
  },
  scanIcon: {
    fontSize: 13,
    marginRight: 6,
    color: '#FFFFFF',
  },
  scanButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
    letterSpacing: 0.4,
  },
  scanArrow: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: 4,
  },
  section: {
    marginTop: 18,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0A192F',
    letterSpacing: -0.3,
  },
  viewDetails: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '600',
  },
  deviceInfoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  deviceInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  deviceInfoRowLast: {
    borderBottomWidth: 0,
  },
  deviceInfoLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  deviceInfoValue: {
    fontSize: 13,
    color: '#0A192F',
    fontWeight: '600',
  },
  accessGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  accessCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  accessIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  accessIcon: {
    fontSize: 15,
  },
  accessTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0A192F',
    flex: 1,
  },
  accessArrow: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
  carouselContainer: {
    marginTop: 8,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F6FB',
  },
  loadingText: {
    marginTop: 14,
    color: '#667085',
    fontSize: 14,
    fontWeight: '600',
  },
  brandMark: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#E8EEFF',
    marginRight: 12,
  },
  headerEyebrow: {
    marginBottom: 2,
    color: '#7180A0',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  heroShadow: {
    marginHorizontal: 18,
    marginTop: 12,
    borderRadius: 28,
    shadowColor: '#1C2A4A',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 10,
  },
  heroCard: {
    minHeight: 296,
    overflow: 'hidden',
    borderRadius: 28,
    paddingHorizontal: 23,
    paddingTop: 22,
    paddingBottom: 19,
  },
  heroCardCompact: {
    minHeight: 318,
    paddingHorizontal: 19,
  },
  heroGlow: {
    position: 'absolute',
    width: 260,
    height: 260,
    top: -135,
    right: -80,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 130,
    backgroundColor: 'rgba(100, 211, 222, 0.09)',
  },
  heroOrb: {
    position: 'absolute',
    width: 72,
    height: 72,
    top: 72,
    right: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 36,
    backgroundColor: 'rgba(125, 216, 225, 0.13)',
    borderWidth: 1,
    borderColor: 'rgba(196, 247, 246, 0.24)',
  },
  heroOrbIcon: {
    color: '#B9F5EC',
    fontSize: 34,
    fontWeight: '400',
  },
  freeBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
  },
  freeBadgeDot: {
    width: 6,
    height: 6,
    marginRight: 7,
    borderRadius: 3,
    backgroundColor: '#68E2BE',
  },
  freeBadgeText: {
    color: '#D5F6ED',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  heroTitle: {
    maxWidth: '82%',
    marginTop: 20,
    color: '#FFFFFF',
    fontSize: 27,
    lineHeight: 33,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  heroTitleCompact: {
    fontSize: 25,
    lineHeight: 31,
  },
  heroDescription: {
    maxWidth: '88%',
    marginTop: 8,
    color: '#CED8EA',
    fontSize: 13,
    lineHeight: 19,
  },
  scanButtonIcon: {
    marginRight: 8,
    color: '#26375B',
    fontSize: 25,
    lineHeight: 25,
  },
  privacyNote: {
    marginTop: 13,
    color: '#BBC9DF',
    fontSize: 10,
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  deviceSection: {
    marginTop: 25,
    paddingHorizontal: 18,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionEyebrow: {
    marginBottom: 3,
    color: '#8290A8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  refreshButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6EAF2',
  },
  refreshIcon: {
    color: '#596C9D',
    fontSize: 23,
    fontWeight: '500',
  },
  deviceCard: {
    padding: 16,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9EDF5',
    shadowColor: '#23304D',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 3,
  },
  deviceIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deviceIconBox: {
    width: 45,
    height: 45,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
    borderRadius: 15,
    backgroundColor: '#F0F3FF',
  },
  deviceIcon: {
    color: '#5E74D6',
    fontSize: 24,
  },
  deviceIdentityCopy: {
    flex: 1,
  },
  deviceName: {
    color: '#18233B',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  deviceModel: {
    marginTop: 3,
    color: '#8490A5',
    fontSize: 11,
    fontWeight: '500',
  },
  osPill: {
    maxWidth: 105,
    marginLeft: 6,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#F3F6FA',
  },
  osPillText: {
    color: '#68768C',
    fontSize: 9,
    fontWeight: '800',
  },
  storageBlock: {
    marginTop: 18,
    padding: 14,
    borderRadius: 17,
    backgroundColor: '#F7F8FC',
  },
  storageHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  storageLabel: {
    color: '#59657B',
    fontSize: 12,
    fontWeight: '700',
  },
  storageValue: {
    color: '#202C47',
    fontSize: 12,
    fontWeight: '800',
  },
  storageTotal: {
    color: '#8994A8',
    fontWeight: '600',
  },
  storageTrack: {
    height: 7,
    marginTop: 11,
    overflow: 'hidden',
    borderRadius: 5,
    backgroundColor: '#E4E8F1',
  },
  storageFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: '#6379E8',
  },
  storageFootnote: {
    marginTop: 7,
    color: '#8390A5',
    fontSize: 10,
    fontWeight: '500',
  },
  metricGrid: {
    flexDirection: 'row',
    marginTop: 12,
  },
  metricCell: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
  },
  metricIconBox: {
    width: 35,
    height: 35,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
    borderRadius: 12,
  },
  memoryIconBox: {
    backgroundColor: '#F1ECFF',
  },
  batteryIconBox: {
    backgroundColor: '#E7F8F3',
  },
  metricIcon: {
    color: '#7665CE',
    fontSize: 19,
  },
  metricCopy: {
    flex: 1,
    minWidth: 0,
  },
  metricLabel: {
    color: '#8792A5',
    fontSize: 9,
    fontWeight: '600',
  },
  metricValue: {
    marginTop: 3,
    color: '#25314A',
    fontSize: 12,
    fontWeight: '800',
  },
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: '#F0F2F7',
  },
  detailsToggleText: {
    color: '#5F71C8',
    fontSize: 11,
    fontWeight: '700',
  },
  detailsToggleIcon: {
    marginLeft: 7,
    color: '#5F71C8',
    fontSize: 16,
    fontWeight: '600',
  },
  extraDetails: {
    marginTop: 9,
  },
  extraDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F7',
  },
  extraDetailRowLast: {
    borderBottomWidth: 0,
  },
  extraDetailLabel: {
    flex: 1,
    color: '#778399',
    fontSize: 11,
    fontWeight: '500',
  },
  extraDetailValue: {
    maxWidth: '58%',
    color: '#27334A',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
  },
  quickLinks: {
    flexDirection: 'row',
    marginTop: 13,
    gap: 10,
  },
  quickLink: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 11,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9EDF5',
  },
  quickLinkIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderRadius: 12,
    backgroundColor: '#F0F1FF',
  },
  aboutLinkIcon: {
    backgroundColor: '#E9F7F4',
  },
  quickLinkIconText: {
    color: '#6173D2',
    fontSize: 18,
    fontWeight: '700',
  },
  quickLinkCopy: {
    flex: 1,
    minWidth: 0,
  },
  quickLinkTitle: {
    color: '#29354D',
    fontSize: 11,
    fontWeight: '800',
  },
  quickLinkHint: {
    marginTop: 2,
    color: '#8C97A9',
    fontSize: 9,
  },
  quickLinkArrow: {
    marginLeft: 4,
    color: '#99A3B4',
    fontSize: 20,
  },
});
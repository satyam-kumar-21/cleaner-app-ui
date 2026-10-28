/*
|--------------------------------------------------------------------------
| Device Info Service
|--------------------------------------------------------------------------
| Cross-platform device information retrieval.
| Uses expo-device and expo-constants for device details.
| Returns null for unavailable fields - never fabricates data.
*/

import * as Device from 'expo-device';
import * as Battery from 'expo-battery';
import * as FileSystem from 'expo-file-system/legacy';
import Constants from 'expo-constants';
import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_STORAGE_KEY = '@cleaner_installation_device_id';

interface AndroidDeviceStats {
  architecture: string | null;
  processorName: string | null;
  coreCount: number | null;
  availableRamBytes: number | null;
  totalStorageBytes: number | null;
  freeStorageBytes: number | null;
}

interface AndroidDeviceModule {
  getDeviceStats(): Promise<AndroidDeviceStats>;
}

export interface DeviceInfo {
  deviceId: string;
  deviceName: string | null;
  manufacturer: string | null;
  model: string | null;
  platform: 'android' | 'ios' | 'windows' | 'macos';
  nativeAndroidStatsAvailable: boolean;
  osVersion: string | null;
  appVersion: string;
  architecture: string | null;
  processorName: string | null;
  coreCount: number | null;
  totalRamBytes: number | null;
  availableRamBytes: number | null;
  totalStorageBytes: number | null;
  freeStorageBytes: number | null;
  usedStorageBytes: number | null;
  batteryLevel: number | null;
  isCharging: boolean | null;
}

export interface DynamicStats {
  availableRamBytes: number | null;
  freeStorageBytes: number | null;
  batteryLevel: number | null;
  isCharging: boolean | null;
}

class DeviceInfoService {
  private deviceIdPromise: Promise<string> | null = null;

  /**
   * Get comprehensive device information
   * Uses real platform APIs where available
   */
  async getDeviceInfo(): Promise<DeviceInfo> {
    const deviceId = await this.getDeviceId();
    const platform = this.getPlatform();
    const [platformStats, batteryStats] = await Promise.all([
      this.getPlatformStats(),
      this.getBatteryStats(),
    ]);
    
    return {
      deviceId,
      deviceName: Device.deviceName || null,
      manufacturer: Device.manufacturer || null,
      model: Device.modelName || null,
      platform,
      nativeAndroidStatsAvailable: platformStats.nativeAndroidStatsAvailable,
      osVersion: Device.osVersion || null,
      appVersion: Constants.expoConfig?.version || '1.0.0',
      architecture: platformStats.architecture,
      processorName: platformStats.processorName,
      coreCount: platformStats.coreCount,
      totalRamBytes: Device.totalMemory || null, // bytes
      availableRamBytes: platformStats.availableRamBytes,
      totalStorageBytes: platformStats.totalStorageBytes,
      freeStorageBytes: platformStats.freeStorageBytes,
      usedStorageBytes: platformStats.totalStorageBytes !== null && platformStats.freeStorageBytes !== null
        ? Math.max(0, platformStats.totalStorageBytes - platformStats.freeStorageBytes)
        : null,
      batteryLevel: batteryStats.level,
      isCharging: batteryStats.isCharging,
    };
  }

  /**
   * Get dynamic statistics that change frequently
   * Call this after cleanup or on dashboard refresh
   */
  async refreshDynamicStats(): Promise<DynamicStats> {
    const [platformStats, batteryStats] = await Promise.all([
      this.getPlatformStats(),
      this.getBatteryStats(),
    ]);
    return {
      availableRamBytes: platformStats.availableRamBytes,
      freeStorageBytes: platformStats.freeStorageBytes,
      batteryLevel: batteryStats.level,
      isCharging: batteryStats.isCharging,
    };
  }

  private async getPlatformStats(): Promise<AndroidDeviceStats & { nativeAndroidStatsAvailable: boolean }> {
    let nativeStats: AndroidDeviceStats | null = null;
    if (Platform.OS === 'android') {
      const module = NativeModules.CleanerDevice as AndroidDeviceModule | undefined;
      if (module) {
        try {
          nativeStats = await module.getDeviceStats();
        } catch (error) {
          console.warn('Unable to load native Android device statistics; using available Expo APIs:', error);
        }
      }
    }

    let totalStorageBytes: number | null = nativeStats?.totalStorageBytes ?? null;
    let freeStorageBytes: number | null = nativeStats?.freeStorageBytes ?? null;
    if (totalStorageBytes === null || freeStorageBytes === null) {
      try {
        const [total, free] = await Promise.all([
          FileSystem.getTotalDiskCapacityAsync(),
          FileSystem.getFreeDiskStorageAsync(),
        ]);
        totalStorageBytes ??= total;
        freeStorageBytes ??= free;
      } catch (error) {
        console.warn('Unable to read device storage capacity:', error);
      }
    }

    return {
      architecture: nativeStats?.architecture ?? Device.supportedCpuArchitectures?.[0] ?? null,
      processorName: nativeStats?.processorName ?? null,
      coreCount: nativeStats?.coreCount ?? null,
      availableRamBytes: nativeStats?.availableRamBytes ?? null,
      totalStorageBytes,
      freeStorageBytes,
      nativeAndroidStatsAvailable: nativeStats !== null,
    };
  }

  private async getBatteryStats(): Promise<{ level: number | null; isCharging: boolean | null }> {
    try {
      const [level, state] = await Promise.all([
        Battery.getBatteryLevelAsync(),
        Battery.getBatteryStateAsync(),
      ]);
      return {
        level: level >= 0 ? Math.round(level * 100) : null,
        isCharging: state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL,
      };
    } catch (error) {
      console.warn('Unable to read battery information:', error);
      return { level: null, isCharging: null };
    }
  }

  /**
   * Get a stable identifier for this app installation
   */
  private getDeviceId(): Promise<string> {
    if (!this.deviceIdPromise) {
      this.deviceIdPromise = this.loadOrCreateDeviceId().catch((error: unknown) => {
        this.deviceIdPromise = null;
        throw error;
      });
    }
    return this.deviceIdPromise;
  }

  private async loadOrCreateDeviceId(): Promise<string> {
    const storedDeviceId = await AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (storedDeviceId) return storedDeviceId;

    const randomPart = Math.random().toString(36).slice(2);
    const deviceId = `cleaner-${Date.now().toString(36)}-${randomPart}`;
    await AsyncStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
    return deviceId;
  }

  /**
   * Determine platform
   */
  private getPlatform(): 'android' | 'ios' | 'windows' | 'macos' {
    const os = Platform.OS;
    
    if (os === 'android') return 'android';
    if (os === 'ios') return 'ios';
    if (os === 'windows') return 'windows';
    if (os === 'macos') return 'macos';
    
    // Fallback for web or unknown
    return 'android';
  }

  /**
   * Format bytes to human-readable string
   */
  formatBytes(bytes: number | null): string {
    if (bytes === null || bytes === undefined) {
      return 'Not available';
    }

    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Format percentage
   */
  formatPercentage(value: number | null): string {
    if (value === null || value === undefined) {
      return 'N/A';
    }
    return `${Math.round(value)}%`;
  }

  /**
   * Calculate storage usage percentage
   */
  calculateStorageUsage(total: number | null, free: number | null): number | null {
    if (total === null || free === null || total === 0) {
      return null;
    }
    const used = total - free;
    return (used / total) * 100;
  }

  /**
   * Calculate RAM usage percentage
   */
  calculateRamUsage(total: number | null, available: number | null): number | null {
    if (total === null || available === null || total === 0) {
      return null;
    }
    const used = total - available;
    return (used / total) * 100;
  }
}

export const deviceInfoService = new DeviceInfoService();
export default deviceInfoService;

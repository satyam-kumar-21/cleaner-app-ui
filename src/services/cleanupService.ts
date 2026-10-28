/*
|--------------------------------------------------------------------------
| Cleanup Service
|--------------------------------------------------------------------------
| Handles actual file cleanup operations with strict safety checks.
| Platform-specific implementations ensure proper permissions.
*/

import { ScanCategory, ScanItem } from './scanner/types';
import { Alert, Linking, Platform, PermissionsAndroid } from 'react-native';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import { cleanedStorageService } from './scanner/cleanedStorageService';
import { deleteMediaAssets, deleteTrashedAssets } from './scanner/trashMediaStore';
import {
  hasAllFilesAccess,
  hasUsageAccess,
  openAllFilesAccessSettings,
  openUsageAccessSettings,
  uninstallApp,
} from './scanner/androidDeviceService';

export interface CleanupProgress {
  currentItem: string;
  itemsCleaned: number;
  itemsSkipped: number;
  itemsProcessed: number;
  totalItems: number;
  bytesFreed: number;
}

export interface CleanupResult {
  success: boolean;
  itemsProcessed: number;
  itemsCleaned: number;
  cleanedItemIds: string[];
  itemsSkipped: number;
  bytesFreed: number;
  durationMs: number;
  errors: string[];
}

export interface CleanupItemResult {
  itemId: string;
  success: boolean;
  bytesFreed: number;
  error?: string;
}

class CleanupService {
  /**
   * Clean selected items with progress callback
   */
  async cleanItems(
    items: ScanItem[],
    onProgress?: (progress: CleanupProgress) => void
  ): Promise<CleanupResult> {
    const startTime = Date.now();
    const results: CleanupItemResult[] = [];
    const errors: string[] = [];

    let itemsCleaned = 0;
    let itemsSkipped = 0;
    let bytesFreed = 0;
    const cleanedLocations = new Set<string>();
    const sharedStorageItems = items.filter((item) =>
      item.canClean && item.location && this.isSharedStorageLocation(item.location)
    );
    const sharedStorageItemIds = new Set(sharedStorageItems.map((item) => item.itemId));
    const trashedItems = items.filter((item) =>
      item.canClean && item.category === 'TRASH' && item.location
    );
    let trashDeleteApproved = false;
    let trashDeleteError: string | undefined;

    if (trashedItems.length > 0 && Platform.OS === 'android') {
      try {
        trashDeleteApproved = await deleteTrashedAssets(
          trashedItems.map((item) => item.location!)
        );
        if (!trashDeleteApproved) trashDeleteError = 'Android deletion confirmation was cancelled';
      } catch (error: any) {
        trashDeleteError = error?.message || 'Android could not delete the selected Trash items';
      }
    }
    const trashItemIds = new Set(trashedItems.map((item) => item.itemId));

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // Progress callback
      if (onProgress) {
        onProgress({
          currentItem: item.displayName,
          itemsCleaned,
          itemsSkipped,
          itemsProcessed: i,
          totalItems: items.length,
          bytesFreed,
        });
      }

      // Safety check: only clean items marked as cleanable
      if (!item.canClean) {
        itemsSkipped++;
        results.push({
          itemId: item.itemId,
          success: false,
          bytesFreed: 0,
          error: 'Item not marked as cleanable',
        });
        continue;
      }

      if (trashItemIds.has(item.itemId)) {
        if (trashDeleteApproved) {
          itemsCleaned++;
          const alreadyCounted = item.location ? cleanedLocations.has(item.location) : false;
          if (item.location) cleanedLocations.add(item.location);
          const itemBytesFreed = alreadyCounted ? 0 : item.fileSizeBytes || 0;
          bytesFreed += itemBytesFreed;
          results.push({
            itemId: item.itemId,
            success: true,
            bytesFreed: itemBytesFreed,
          });
        } else {
          itemsSkipped++;
          const error = trashDeleteError
            || 'Android Trash items can only be permanently deleted on Android 11 or newer';
          errors.push(`${item.displayName}: ${error}`);
          results.push({
            itemId: item.itemId,
            success: false,
            bytesFreed: 0,
            error,
          });
        }
        continue;
      }

      // Attempt cleanup
      try {
        const result = sharedStorageItemIds.has(item.itemId)
          ? await this.deleteSharedStorageItem(item)
          : await this.cleanSingleItem(item);
        results.push(result);

        if (result.success) {
          itemsCleaned++;
          const alreadyCounted = item.location ? cleanedLocations.has(item.location) : false;
          if (item.location) cleanedLocations.add(item.location);
          if (alreadyCounted) result.bytesFreed = 0;
          bytesFreed += result.bytesFreed;
        } else {
          itemsSkipped++;
          if (result.error) {
            errors.push(`${item.displayName}: ${result.error}`);
          }
        }
      } catch (error: any) {
        itemsSkipped++;
        const errorMsg = error.message || 'Unknown error';
        errors.push(`${item.displayName}: ${errorMsg}`);
        results.push({
          itemId: item.itemId,
          success: false,
          bytesFreed: 0,
          error: errorMsg,
        });
      }

      // Small delay to prevent UI blocking
      await this.delay(50);
    }

    // Final progress update
    if (onProgress) {
      onProgress({
        currentItem: 'Complete',
        itemsCleaned,
        itemsSkipped,
        itemsProcessed: items.length,
        totalItems: items.length,
        bytesFreed,
      });
    }

    const durationMs = Date.now() - startTime;

    // Persist cleaned items so they never reappear in scans
    try {
      const cleanedIds = results.filter((r) => r.success).map((r) => r.itemId);
      const cleanedLocs = items
        .filter((i) => cleanedIds.includes(i.itemId))
        .map((i) => i.location || '');
      await cleanedStorageService.markItemsAsCleaned(cleanedIds, cleanedLocs);
    } catch (saveErr) {
      console.warn('Failed to record cleaned items state:', saveErr);
    }

    return {
      success: itemsCleaned > 0,
      itemsProcessed: items.length,
      itemsCleaned,
      cleanedItemIds: results.filter((result) => result.success).map((result) => result.itemId),
      itemsSkipped,
      bytesFreed,
      durationMs,
      errors,
    };
  }

  /**
   * Request scoped file access and Android app-usage access for the scan.
   */
  async requestPermissions(options: {
    requireSharedStorage?: boolean;
    requireMediaAccess?: boolean;
    requireUsageAccess?: boolean;
  } = {}): Promise<{
    granted: boolean;
    message?: string;
    scanSharedStorage?: boolean;
    unavailableCategories?: ScanCategory[];
  }> {
    try {
      if (Platform.OS === 'android') {
        if (Constants.appOwnership === 'expo') {
          return {
            granted: false,
            message: 'Install the Android build to scan this device.',
          };
        }

        const requireSharedStorage = options.requireSharedStorage !== false;
        const requireMediaAccess = options.requireMediaAccess !== false;
        const requireUsageAccess = options.requireUsageAccess !== false;
        const unavailableCategories: ScanCategory[] = [];
        const accessDescription = [
          requireSharedStorage && 'selected folders',
          requireMediaAccess && 'Android Trash',
          requireUsageAccess && 'unused apps',
        ].filter(Boolean).join(', ');

        if (requireSharedStorage && typeof Platform.Version === 'number' && Platform.Version >= 30) {
          if (!(await hasAllFilesAccess())) {
            const shouldOpenSettings = await new Promise<boolean>((resolve) => {
              Alert.alert(
                'Allow access to device files',
                'Android requires “Allow access to manage all files” in Settings so Cleaner App can inspect the shared-storage folders you selected.',
                [
                  { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
                  { text: 'Open Settings', onPress: () => resolve(true) },
                ],
                { cancelable: true, onDismiss: () => resolve(false) }
              );
            });

            if (!shouldOpenSettings) {
              return {
                granted: false,
                message: 'All files access is required to inspect the selected shared-storage folders.',
              };
            }

            if (!(await openAllFilesAccessSettings())) {
              return {
                granted: false,
                message: 'Enable All files access, then tap Try Again.',
              };
            }
          }
        } else if (requireSharedStorage) {
          const storagePermissions = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
            PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          ]);
          const storageGranted = Object.values(storagePermissions).every(
            (status) => status === PermissionsAndroid.RESULTS.GRANTED
          );
          if (!storageGranted) {
            return {
              granted: false,
              message: 'Storage permission is required to inspect Downloads and Documents.',
            };
          }
        }

        if (requireMediaAccess) {
          const mediaPermissions =
          typeof Platform.Version === 'number' && Platform.Version >= 33
            ? [
                PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
                PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
                PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO,
              ]
            : [PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE];
          const mediaPermissionResults = await PermissionsAndroid.requestMultiple(mediaPermissions);
          if (
            Object.values(mediaPermissionResults).some(
              (status) => status !== PermissionsAndroid.RESULTS.GRANTED
            )
          ) {
            const openSettings = await new Promise<boolean>((resolve) => {
              Alert.alert(
                'Media access is required',
                'Cleaner needs media access to check Android Trash. If Android did not show a permission prompt, enable Photos and videos access in Cleaner App settings.',
                [
                  { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
                  { text: 'Open App Settings', onPress: () => resolve(true) },
                ],
                { cancelable: true, onDismiss: () => resolve(false) }
              );
            });
            if (openSettings) {
              try {
                await Linking.openSettings();
              } catch (error) {
                console.warn('Unable to open Android app permission settings:', error);
              }
            }
            unavailableCategories.push('TRASH');
          }
        }

        if (requireUsageAccess && !(await hasUsageAccess())) {
          const shouldOpenSettings = await new Promise<boolean>((resolve) => {
            Alert.alert(
              'Allow app usage access',
              'Allow Usage Access to find apps unused for 90 days.',
              [
                { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Open Settings', onPress: () => resolve(true) },
              ],
              { cancelable: true, onDismiss: () => resolve(false) }
            );
          });

          if (shouldOpenSettings) {
            const usageAccessGranted = await openUsageAccessSettings();
            if (usageAccessGranted) {
              return {
                granted: true,
                scanSharedStorage: requireSharedStorage,
                message: `Scanning ${accessDescription}`,
                unavailableCategories,
              };
            }
          }
          unavailableCategories.push('UNUSED_APP');
        }

        const skipped = unavailableCategories.length
          ? `Skipped ${unavailableCategories.map((category) =>
            category === 'TRASH' ? 'Android Trash' : 'Unused Apps'
          ).join(' and ')} because permission was not granted.`
          : undefined;
        return {
          granted: true,
          scanSharedStorage: requireSharedStorage,
          message: [
            accessDescription ? `Scanning ${accessDescription}` : 'No shared device files selected',
            skipped,
          ].filter(Boolean).join('. '),
          unavailableCategories,
        };
      } else if (Platform.OS === 'ios') {
        return {
          granted: true,
          scanSharedStorage: false,
          unavailableCategories: [],
        };
      }

      return { granted: true, scanSharedStorage: false, unavailableCategories: [] };
    } catch (error: any) {
      console.warn('Error requesting permissions:', error);
      return { granted: false, message: error?.message || 'Permission request failed' };
    }
  }

  /**
   * Clean a single item (platform-specific implementation)
   */
  private async cleanSingleItem(item: ScanItem): Promise<CleanupItemResult> {
    try {
      if (!item.location) {
        throw new Error('Scanned item has no file location');
      }

      if (item.category === 'UNUSED_APP') {
        const success = await uninstallApp(item.location);
        return {
          itemId: item.itemId,
          success,
          bytesFreed: success ? item.fileSizeBytes || 0 : 0,
          error: success ? undefined : 'Android app uninstall was cancelled or unsuccessful',
        };
      }

      const fileInfo = await FileSystem.getInfoAsync(item.location);
      if (!fileInfo.exists || fileInfo.isDirectory) {
        throw new Error('Scanned file no longer exists or is not a file');
      }

      await FileSystem.deleteAsync(item.location);
      const remainingInfo = await FileSystem.getInfoAsync(item.location);
      if (remainingInfo.exists) {
        throw new Error('The file could not be removed');
      }

      const fileName = item.location.split('/').pop();
      if (fileName && FileSystem.cacheDirectory) {
        const previewPath = `${FileSystem.cacheDirectory}preview_${fileName}`;
        try {
          const previewInfo = await FileSystem.getInfoAsync(previewPath);
          if (previewInfo.exists) {
            await FileSystem.deleteAsync(previewPath, { idempotent: true });
          }
        } catch (previewError) {
          console.warn('Failed to remove cached file preview:', previewError);
        }
      }

      return {
        itemId: item.itemId,
        success: true,
        bytesFreed: fileInfo.size,
      };
    } catch (error: any) {
      return {
        itemId: item.itemId,
        success: false,
        bytesFreed: 0,
        error: error?.message || 'Failed to remove file',
      };
    }
  }

  private isSharedStorageLocation(location: string): boolean {
    const path = location.startsWith('file://') ? location.slice('file://'.length) : location;
    return path.startsWith('/storage/emulated/0/');
  }

  private async deleteSharedStorageItem(item: ScanItem): Promise<CleanupItemResult> {
    try {
      if (Platform.OS !== 'android' || !item.location) {
        throw new Error('Native shared-storage deletion is only available on Android.');
      }
      const deleted = await deleteMediaAssets([item.location]);
      if (!deleted) throw new Error('Android did not confirm that the file was deleted.');
      return {
        itemId: item.itemId,
        success: true,
        bytesFreed: item.fileSizeBytes || 0,
      };
    } catch (error) {
      return {
        itemId: item.itemId,
        success: false,
        bytesFreed: 0,
        error: error instanceof Error ? error.message : 'Android could not delete this shared-storage file.',
      };
    }
  }

  /**
   * Validate cleanup operation (pre-flight checks)
   */
  async validateCleanup(items: ScanItem[]): Promise<{
    canProceed: boolean;
    warnings: string[];
  }> {
    const warnings: string[] = [];

    // Check if any items are selected
    if (items.length === 0) {
      return {
        canProceed: false,
        warnings: ['No items selected for cleanup'],
      };
    }

    // Check for non-cleanable items
    const nonCleanable = items.filter(item => !item.canClean);
    if (nonCleanable.length > 0) {
      warnings.push(
        `${nonCleanable.length} items require review and will be skipped`
      );
    }

    // Platform-specific checks
    if (Platform.OS === 'android') {
      // Check Android storage permissions
      warnings.push('Ensure storage permissions are granted');
    } else if (Platform.OS === 'ios') {
      // iOS sandboxing restrictions
      warnings.push('Only app-accessible files can be cleaned');
    }

    return {
      canProceed: items.some(item => item.canClean),
      warnings,
    };
  }

  /**
   * Check if item deletion would be permanent or recoverable
   */
  isDeletionPermanent(item: ScanItem): boolean {
    // Items in TRASH are already in trash, so deletion is permanent
    if (item.category === 'TRASH') {
      return true;
    }

    // On mobile platforms, most deletions are permanent
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      return true;
    }

    // Desktop platforms may support trash/recycle bin
    return false;
  }

  /**
   * Get cleanup operation description
   */
  getCleanupDescription(items: ScanItem[]): string {
    const totalSize = items.reduce(
      (sum, item) => sum + (item.fileSizeBytes || 0),
      0
    );
    const hasPermanent = items.some(item => this.isDeletionPermanent(item));

    const sizeStr = this.formatBytes(totalSize);
    const action = hasPermanent
      ? 'permanently delete'
      : 'move to trash';

    return `This will ${action} ${items.length} item(s) (${sizeStr})`;
  }

  /**
   * Format bytes helper
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const cleanupService = new CleanupService();
export default cleanupService;

import { NativeModules, Platform } from 'react-native';

export interface TrashedAsset {
  uri: string;
  name: string;
  size: number;
  modificationTime: number;
  relativePath: string;
}

export interface UnusedApp {
  packageName: string;
  name: string;
  size: number;
  lastUsedAt: number;
  installedAt: number;
}

interface AndroidDeviceNativeModule {
  getTrashedAssets(): Promise<TrashedAsset[]>;
  getMediaStoreUriForPath(filePath: string): Promise<string | null>;
  deleteTrashedAssets(uris: string[]): Promise<boolean>;
  deleteMediaAssets(locations: string[]): Promise<boolean>;
  restoreTrashedAssets(uris: string[]): Promise<boolean>;
  hasAllFilesAccess(): Promise<boolean>;
  openAllFilesAccessSettings(): Promise<boolean>;
  hasUsageAccess(): Promise<boolean>;
  openUsageAccessSettings(): Promise<boolean>;
  getUnusedApps(): Promise<UnusedApp[]>;
  uninstallApp(packageName: string): Promise<boolean>;
}

const androidDevice = NativeModules.CleanerDevice as
  | AndroidDeviceNativeModule
  | undefined;

function getNativeModule(): AndroidDeviceNativeModule {
  if (Platform.OS !== 'android' || !androidDevice) {
    throw new Error('This scan feature requires the installed Cleaner App Android build.');
  }
  return androidDevice;
}

export function hasUsageAccess(): Promise<boolean> {
  return getNativeModule().hasUsageAccess();
}

export function hasAllFilesAccess(): Promise<boolean> {
  return getNativeModule().hasAllFilesAccess();
}

export function openAllFilesAccessSettings(): Promise<boolean> {
  return getNativeModule().openAllFilesAccessSettings();
}

export function openUsageAccessSettings(): Promise<boolean> {
  return getNativeModule().openUsageAccessSettings();
}

export function getUnusedApps(): Promise<UnusedApp[]> {
  if (Platform.OS !== 'android') {
    return Promise.resolve([]);
  }
  return getNativeModule().getUnusedApps();
}

export function uninstallApp(packageName: string): Promise<boolean> {
  return getNativeModule().uninstallApp(packageName);
}

export function getTrashedAssets(): Promise<TrashedAsset[]> {
  if (Platform.OS !== 'android') {
    return Promise.resolve([]);
  }
  return getNativeModule().getTrashedAssets();
}

export function getMediaStoreUriForPath(filePath: string): Promise<string | null> {
  return getNativeModule().getMediaStoreUriForPath(filePath);
}

export function deleteTrashedAssets(uris: string[]): Promise<boolean> {
  return getNativeModule().deleteTrashedAssets(uris);
}

export function deleteMediaAssets(locations: string[]): Promise<boolean> {
  return getNativeModule().deleteMediaAssets(locations);
}

export function restoreTrashedAssets(uris: string[]): Promise<boolean> {
  return getNativeModule().restoreTrashedAssets(uris);
}

import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import type { ScanFilters } from './types';

export interface DeviceScanScope {
  includeSharedStorage?: boolean;
  includeMediaFiles?: boolean;
  filters?: ScanFilters;
}

export interface DeviceFile {
  uri: string;
  name: string;
  size: number;
  modificationTime: number;
  source: 'shared' | 'app-cache' | 'app-documents';
}

const SHARED_STORAGE_ROOT = 'file:///storage/emulated/0/';
const EXCLUDED_DIRECTORY_PATTERN = /\/Android\/(?:data|obb)(?:\/|$)/i;
const EXCLUDED_THUMBNAIL_DIRECTORY_PATTERN = /\/\.thumbnails(?:\/|$)/i;
const DEFAULT_SCAN_DIRECTORIES = new Set(['download', 'documents']);
const MAX_SCANNED_DIRECTORIES = 1_000;
const MAX_INSPECTED_ENTRIES = 20_000;
const SUPPORTED_MEDIA_PATTERN =
  /\.(?:jpe?g|png|webp|heic|heif|bmp|gif|mp4|m4v|mkv|mov|3gp|webm|mp3|wav|aac|flac|ogg)$/i;
const SCAN_FILE_PATTERN =
  /\.(?:crdownload|part|partial|download|tmp|temp|cache|pdf|zip|docx|xlsx|pptx)$/i;

interface ScanBudget {
  directoriesQueued: number;
  entriesInspected: number;
  truncated: boolean;
}

function joinUri(directory: string, name: string): string {
  return `${directory.endsWith('/') ? directory : `${directory}/`}${name}`;
}

async function readFilesFromDirectory(
  root: string,
  source: DeviceFile['source'],
  files: DeviceFile[],
  visited: Set<string>,
  budget: ScanBudget,
  onFilesIndexed?: (fileCount: number) => void,
  includeMediaFiles = false,
  filters?: ScanFilters
): Promise<void> {
  const pendingDirectories = [root];

  while (pendingDirectories.length > 0 && !budget.truncated) {
    const directory = pendingDirectories.pop()!;
    if (
      visited.has(directory)
      || EXCLUDED_DIRECTORY_PATTERN.test(directory)
      || EXCLUDED_THUMBNAIL_DIRECTORY_PATTERN.test(directory)
    ) continue;
    visited.add(directory);

    let entries: string[];
    try {
      entries = await FileSystem.readDirectoryAsync(directory);
    } catch (error) {
      if (directory === root) throw error;
      console.warn(`Unable to scan directory ${directory}:`, error);
      continue;
    }

    for (const entry of entries) {
      if (budget.entriesInspected >= MAX_INSPECTED_ENTRIES) {
        budget.truncated = true;
        break;
      }
      budget.entriesInspected++;

      const uri = joinUri(directory, entry);
      if (
        EXCLUDED_DIRECTORY_PATTERN.test(uri)
        || EXCLUDED_THUMBNAIL_DIRECTORY_PATTERN.test(uri)
      ) continue;

      try {
        const info = await FileSystem.getInfoAsync(uri);
        if (!info.exists) continue;
        if (info.isDirectory) {
          if (budget.directoriesQueued >= MAX_SCANNED_DIRECTORIES) {
            budget.truncated = true;
            break;
          }
          pendingDirectories.push(uri);
          budget.directoriesQueued++;
        } else if (
          SCAN_FILE_PATTERN.test(entry)
          || (includeMediaFiles && SUPPORTED_MEDIA_PATTERN.test(entry))
        ) {
          const size = info.size ?? 0;
          const modificationTime = info.modificationTime ?? 0;
          const extension = entry.match(/\.[^.]+$/)?.[0]?.toLowerCase() ?? '';
          if (filters && !filters.fileTypes.includes(extension)) continue;
          if (size < (filters?.minSizeBytes ?? 0)) continue;
          if (filters?.maxSizeBytes !== null && filters?.maxSizeBytes !== undefined
              && size > filters.maxSizeBytes) continue;
          if (
            filters?.modifiedWithinDays
            && modificationTime < (Date.now() / 1000) - filters.modifiedWithinDays * 86400
          ) continue;
          files.push({
            uri,
            name: entry,
            size,
            modificationTime,
            source,
          });
          if (files.length % 10 === 0) {
            onFilesIndexed?.(files.length);
          }
        }
      } catch (error) {
        console.warn(`Unable to inspect file ${uri}:`, error);
      }
    }
  }
}

export async function scanDeviceFiles(
  onFilesIndexed?: (fileCount: number) => void,
  scope: DeviceScanScope = {}
): Promise<{ files: DeviceFile[]; truncated: boolean }> {
  const files: DeviceFile[] = [];
  const visited = new Set<string>();
  const budget: ScanBudget = {
    directoriesQueued: 0,
    entriesInspected: 0,
    truncated: false,
  };

  if (Platform.OS === 'android' && scope.includeSharedStorage !== false) {
    const rootEntries = await FileSystem.readDirectoryAsync(SHARED_STORAGE_ROOT);
    const requestedDirectories = scope.filters
      ? new Set(scope.filters.folders.map((folder) => folder.toLowerCase()))
      : DEFAULT_SCAN_DIRECTORIES;
    const scanDirectories = rootEntries.filter((entry) =>
      requestedDirectories.has(entry.toLowerCase())
    );
    for (const directory of scanDirectories) {
      if (budget.truncated) break;
      if (budget.directoriesQueued >= MAX_SCANNED_DIRECTORIES) {
        budget.truncated = true;
        break;
      }
      budget.directoriesQueued++;
      await readFilesFromDirectory(
        joinUri(SHARED_STORAGE_ROOT, directory),
        'shared',
        files,
        visited,
        budget,
        onFilesIndexed,
        scope.includeMediaFiles,
        scope.filters
      );
    }
  }

  if (!budget.truncated && !scope.filters && FileSystem.documentDirectory) {
    budget.directoriesQueued++;
    await readFilesFromDirectory(
      FileSystem.documentDirectory,
      'app-documents',
      files,
      visited,
      budget,
      onFilesIndexed,
      scope.includeMediaFiles,
      scope.filters
    );
  }
  if (!budget.truncated && !scope.filters && FileSystem.cacheDirectory) {
    budget.directoriesQueued++;
    await readFilesFromDirectory(
      FileSystem.cacheDirectory,
      'app-cache',
      files,
      visited,
      budget,
      onFilesIndexed,
      scope.includeMediaFiles,
      scope.filters
    );
  }

  onFilesIndexed?.(files.length);
  return { files, truncated: budget.truncated };
}

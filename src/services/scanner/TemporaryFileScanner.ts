/*
|--------------------------------------------------------------------------
| Temporary File Scanner
|--------------------------------------------------------------------------
| Finds actual temporary files in app cache and shared storage.
*/

import { ScanItem } from './types';
import { cleanedStorageService } from './cleanedStorageService';
import type { DeviceFile } from './deviceFileService';

export class TemporaryFileScanner {
  async scan(files: DeviceFile[]): Promise<ScanItem[]> {
    const items: ScanItem[] = [];
    const cleanedIds = await cleanedStorageService.getCleanedItemIds();

    for (const file of files) {
      const isAppCache = file.source === 'app-cache';
      const isTemporaryFile = /\.(tmp|temp|cache)$/i.test(file.name);
      if ((!isAppCache && !isTemporaryFile) ||
          cleanedIds.has(file.name) ||
          cleanedIds.has(file.uri)) {
        continue;
      }

      items.push({
        itemId: `temp_${file.uri}`,
        category: 'TEMPORARY',
        displayName: file.name,
        fileSizeBytes: file.size,
        location: file.uri,
        detectedAt: new Date(file.modificationTime * 1000),
        riskLevel: 'low',
        confidence: 95,
        reason: isAppCache ? 'File in this app’s cache directory' : 'Temporary-file extension',
        recommendedAction: isAppCache ? 'Safe to remove from app cache' : 'Review before removal',
        canClean: true,
        selected: false,
      });
    }

    return items;
  }
}

export default TemporaryFileScanner;

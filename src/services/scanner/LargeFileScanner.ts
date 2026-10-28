import { ScanItem } from './types';
import { cleanedStorageService } from './cleanedStorageService';
import type { DeviceFile } from './deviceFileService';

const LARGE_FILE_THRESHOLD_BYTES = 500 * 1024 * 1024;

export class LargeFileScanner {
  async scan(files: DeviceFile[]): Promise<ScanItem[]> {
    const items: ScanItem[] = [];
    const cleanedIds = await cleanedStorageService.getCleanedItemIds();

    for (const file of files) {
      if (file.size < LARGE_FILE_THRESHOLD_BYTES ||
          cleanedIds.has(file.name) ||
          cleanedIds.has(file.uri)) {
        continue;
      }

      items.push({
        itemId: `large_${file.uri}`,
        category: 'LARGE_FILE',
        displayName: file.name,
        fileSizeBytes: file.size,
        location: file.uri,
        detectedAt: new Date(file.modificationTime * 1000),
        riskLevel: 'low',
        confidence: 100,
        reason: 'File is 500 MB or larger',
        recommendedAction: 'Review before removal',
        canClean: true,
        requiresReview: true,
        selected: false,
      });
    }

    return items;
  }
}

export default LargeFileScanner;

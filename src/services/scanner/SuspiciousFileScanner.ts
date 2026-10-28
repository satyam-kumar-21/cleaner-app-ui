import type { ScanItem } from './types';
import type { DeviceFile } from './deviceFileService';
import { cleanedStorageService } from './cleanedStorageService';

export class SuspiciousFileScanner {
  async scan(files: DeviceFile[]): Promise<ScanItem[]> {
    const cleanedIds = await cleanedStorageService.getCleanedItemIds();

    return files
      .filter((file) =>
        /\.(apk|xapk|apks)$/i.test(file.name) &&
        !cleanedIds.has(file.name) &&
        !cleanedIds.has(file.uri)
      )
      .map((file) => ({
        itemId: `installer_${file.uri}`,
        category: 'SUSPICIOUS',
        displayName: file.name,
        fileSizeBytes: file.size,
        location: file.uri,
        detectedAt: new Date(file.modificationTime * 1000),
        riskLevel: 'medium',
        confidence: 100,
        reason: 'Android installer package; this does not indicate that the file is malicious',
        recommendedAction: 'Only install if you trust its source',
        canClean: false,
        selected: false,
      }));
  }
}

export default SuspiciousFileScanner;

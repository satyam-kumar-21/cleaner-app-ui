import type { ScanItem } from './types';
import * as FileSystem from 'expo-file-system/legacy';
import { cleanedStorageService } from './cleanedStorageService';
import type { DeviceFile } from './deviceFileService';

export class DuplicateScanner {
  async scan(files: DeviceFile[]): Promise<ScanItem[]> {
    const items: ScanItem[] = [];
    const cleanedIds = await cleanedStorageService.getCleanedItemIds();
    const filesBySize = new Map<number, DeviceFile[]>();
    const imageFiles = files.filter((file) =>
      /\.(?:jpe?g|png|webp|heic|heif|bmp|gif)$/i.test(file.name)
    );

    for (const file of imageFiles) {
      if (cleanedIds.has(file.name) || cleanedIds.has(file.uri)) continue;
      const sameSizeFiles = filesBySize.get(file.size) ?? [];
      sameSizeFiles.push(file);
      filesBySize.set(file.size, sameSizeFiles);
    }

    for (const sameSizeFiles of filesBySize.values()) {
      if (sameSizeFiles.length < 2) continue;

      const filesByHash = new Map<string, DeviceFile[]>();
      for (const file of sameSizeFiles) {
        try {
          const info = await FileSystem.getInfoAsync(file.uri, { md5: true });
          if (info.exists && info.md5) {
            const sameHashFiles = filesByHash.get(info.md5) ?? [];
            sameHashFiles.push(file);
            filesByHash.set(info.md5, sameHashFiles);
          }
        } catch (error) {
          console.warn(`Unable to compare file contents for ${file.uri}:`, error);
        }
      }

      for (const identicalFiles of filesByHash.values()) {
        if (identicalFiles.length < 2) continue;
        const ordered = identicalFiles.sort((left, right) =>
          left.modificationTime - right.modificationTime
        );
        for (const duplicate of ordered.slice(1)) {
          items.push({
            itemId: `duplicate_${duplicate.uri}`,
            category: 'DUPLICATE',
            displayName: duplicate.name,
            fileSizeBytes: duplicate.size,
            location: duplicate.uri,
            detectedAt: new Date(duplicate.modificationTime * 1000),
            riskLevel: 'low',
            confidence: 100,
            reason: 'File contents match another scanned file',
            recommendedAction: 'Review before removal',
            canClean: true,
            selected: false,
          });
        }
      }
    }

    const exactDuplicateUris = new Set(items.map((item) => item.location));
    const similarGroups = new Map<string, DeviceFile[]>();
    for (const file of imageFiles) {
      if (exactDuplicateUris.has(file.uri)) continue;
      const stem = file.name.replace(/\.[^.]+$/, '')
        .replace(/(?:[_ -](?:\d{3,}|copy|edited|burst.*))+/i, '')
        .toLowerCase();
      if (!stem) continue;
      const group = similarGroups.get(stem) ?? [];
      group.push(file);
      similarGroups.set(stem, group);
    }

    for (const group of similarGroups.values()) {
      if (group.length < 2) continue;
      const ordered = group.sort((left, right) => left.modificationTime - right.modificationTime);
      const anchor = ordered[0];
      for (const candidate of ordered.slice(1)) {
        const timeDifference = Math.abs(candidate.modificationTime - anchor.modificationTime);
        const sizeRatio = Math.min(candidate.size, anchor.size) / Math.max(candidate.size, anchor.size, 1);
        if (timeDifference > 10 * 60 || sizeRatio < 0.65) continue;
        if (items.some((item) => item.location === candidate.uri)) continue;
        items.push({
          itemId: `similar_photo_${candidate.uri}`,
          category: 'DUPLICATE',
          displayName: candidate.name,
          fileSizeBytes: candidate.size,
          location: candidate.uri,
          detectedAt: new Date(candidate.modificationTime * 1000),
          riskLevel: 'medium',
          confidence: 65,
          reason: 'Possible similar photo based on filename, capture time and file size; compare before removal',
          recommendedAction: 'Review against the matching photo before selecting',
          canClean: true,
          requiresReview: true,
          selected: false,
        });
      }
    }

    return items;
  }
}

export default DuplicateScanner;

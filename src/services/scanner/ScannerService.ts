/*
|--------------------------------------------------------------------------
| Scanner Service (Orchestrator)
|--------------------------------------------------------------------------
| Coordinates all individual scanners and aggregates results.
| Main entry point for scan operations.
*/

import type { ScanItem, ScanResult, ScanCategory, ScannerConfig, ScanFilters } from './types';
import { TemporaryFileScanner } from './TemporaryFileScanner';
import { TrashScanner } from './TrashScanner';
import { LargeFileScanner } from './LargeFileScanner';
import { DuplicateScanner } from './DuplicateScanner';
import { SuspiciousFileScanner } from './SuspiciousFileScanner';
import { CorruptedFileScanner } from './CorruptedFileScanner';
import { UnusedAppScanner } from './UnusedAppScanner';
import { scanDeviceFiles, type DeviceFile, type DeviceScanScope } from './deviceFileService';

export type ScanStage = 'files' | 'integrity' | 'trash' | 'apps' | 'complete';

export interface ScanProgress {
  stage: ScanStage;
  filesChecked: number;
}

export class ScannerService {
  private tempScanner = new TemporaryFileScanner();
  private trashScanner = new TrashScanner();
  private largeFileScanner = new LargeFileScanner();
  private duplicateScanner = new DuplicateScanner();
  private suspiciousScanner = new SuspiciousFileScanner();
  private corruptedScanner = new CorruptedFileScanner();
  private unusedAppScanner = new UnusedAppScanner();

  /**
   * Scan supported shared-storage and app-owned file locations
   */
  async runFullScan(
    config?: Partial<ScannerConfig>,
    onFilesIndexed?: (fileCount: number) => void,
    scope?: DeviceScanScope & { description?: string; filters?: ScanFilters },
    onProgress?: (progress: ScanProgress) => void
  ): Promise<ScanResult> {
    const startTime = Date.now();
    const startedAt = new Date();

    const enabledCategories = config?.enabledCategories || [
      'TEMPORARY',
      'TRASH',
      'POTENTIALLY_CORRUPTED',
      'UNUSED_APP',
    ];
    const scanScope = {
      ...scope,
      includeMediaFiles: enabledCategories.includes('DUPLICATE')
        || enabledCategories.includes('SCREENSHOT')
        || enabledCategories.includes('LARGE_FILE'),
    };
    const allItems: ScanItem[] = [];
    const reportProgress = (stage: ScanStage, filesChecked = 0) =>
      onProgress?.({ stage, filesChecked });

    reportProgress('files');
    const needsFileScan = enabledCategories.some((category) =>
      ['TEMPORARY', 'POTENTIALLY_CORRUPTED', 'LARGE_FILE', 'DUPLICATE', 'SCREENSHOT', 'SUSPICIOUS'].includes(category)
    );
    const { files: deviceFiles, truncated: scanTruncated } = needsFileScan
      ? await scanDeviceFiles((count) => {
        onFilesIndexed?.(count);
        reportProgress('files', count);
      }, scanScope)
      : { files: [], truncated: false };

    if (enabledCategories.includes('TEMPORARY') || enabledCategories.includes('POTENTIALLY_CORRUPTED')) {
      reportProgress('integrity', deviceFiles.length);
    }
    if (enabledCategories.includes('TEMPORARY')) {
      allItems.push(...await this.tempScanner.scan(deviceFiles));
    }
    if (enabledCategories.includes('POTENTIALLY_CORRUPTED')) {
      allItems.push(...await this.corruptedScanner.scan(
        deviceFiles,
        (count) => reportProgress('integrity', count)
      ));
    }

    if (enabledCategories.includes('TRASH')) {
      reportProgress('trash', deviceFiles.length);
      allItems.push(...await this.trashScanner.scan(deviceFiles, scope?.filters));
    }

    if (enabledCategories.includes('UNUSED_APP')) {
      reportProgress('apps', deviceFiles.length);
      allItems.push(...await this.unusedAppScanner.scan());
    }

    if (enabledCategories.includes('LARGE_FILE')) {
      allItems.push(...await this.largeFileScanner.scan(deviceFiles));
    }
    if (enabledCategories.includes('DUPLICATE')) {
      allItems.push(...await this.duplicateScanner.scan(deviceFiles));
    }
    if (enabledCategories.includes('SCREENSHOT')) {
      allItems.push(...this.findScreenshots(deviceFiles));
    }
    if (enabledCategories.includes('SUSPICIOUS')) {
      allItems.push(...await this.suspiciousScanner.scan(deviceFiles));
    }

    reportProgress('complete', deviceFiles.length);

    const completedAt = new Date();
    const scanDurationMs = Date.now() - startTime;

    return {
      items: allItems,
      totalItems: allItems.length,
      scannedFileCount: deviceFiles.length,
      totalCleanableBytes: this.calculateTotalCleanableBytes(allItems),
      categoryCounts: this.calculateCategoryCounts(allItems),
      scanDurationMs,
      startedAt,
      completedAt,
      scopeDescription: scanTruncated
        ? [scope?.description, 'Scan limited to protect device resources; some files may not have been checked.']
          .filter(Boolean)
          .join(' · ')
        : scope?.description,
    };
  }

  private findScreenshots(files: DeviceFile[]): ScanItem[] {
    return files
      .filter((file) =>
        /\.(?:jpe?g|png|webp|heic|heif|bmp)$/i.test(file.name)
        && /(?:screenshot|screen[-_ ]?shot)/i.test(file.name)
      )
      .map((file) => ({
        itemId: `screenshot_${file.uri}`,
        category: 'SCREENSHOT',
        displayName: file.name,
        fileSizeBytes: file.size,
        location: file.uri,
        detectedAt: new Date(file.modificationTime * 1000),
        riskLevel: 'low',
        confidence: 90,
        reason: 'Image filename identifies this as a screenshot; review before removal',
        recommendedAction: 'Review and select only screenshots you no longer need',
        canClean: true,
        requiresReview: true,
        selected: false,
      }));
  }

  /**
   * Run a quick scan (only common categories)
   */
  async runQuickScan(): Promise<ScanResult> {
    return this.runFullScan({
      enabledCategories: ['TEMPORARY', 'TRASH'],
    });
  }

  /**
   * Calculate total cleanable bytes
   */
  private calculateTotalCleanableBytes(items: ScanItem[]): number {
    return items
      .filter(item => item.canClean && item.fileSizeBytes)
      .reduce((total, item) => total + (item.fileSizeBytes || 0), 0);
  }

  /**
   * Calculate category counts
   */
  private calculateCategoryCounts(items: ScanItem[]): Record<ScanCategory, number> {
    const counts: Record<string, number> = {};

    items.forEach(item => {
      counts[item.category] = (counts[item.category] || 0) + 1;
    });

    return counts as Record<ScanCategory, number>;
  }

  /**
   * Get items by category
   */
  getItemsByCategory(items: ScanItem[], category: ScanCategory): ScanItem[] {
    return items.filter(item => item.category === category);
  }

  /**
   * Get selected items
   */
  getSelectedItems(items: ScanItem[]): ScanItem[] {
    return items.filter(item => item.selected);
  }

  /**
   * Calculate total size of selected items
   */
  calculateSelectedSize(items: ScanItem[]): number {
    return this.getSelectedItems(items)
      .reduce((total, item) => total + (item.fileSizeBytes || 0), 0);
  }

  /**
   * Toggle item selection (with safety checks)
   */
  toggleItemSelection(item: ScanItem): ScanItem {
    // Only allow selection of cleanable items
    if (!item.canClean) {
      return item;
    }

    return {
      ...item,
      selected: !item.selected,
    };
  }

  /**
   * Select all cleanable items
   */
  selectAllCleanable(items: ScanItem[]): ScanItem[] {
    return items.map(item => ({
      ...item,
      selected: item.canClean,
    }));
  }

  /**
   * Deselect all items
   */
  deselectAll(items: ScanItem[]): ScanItem[] {
    return items.map(item => ({
      ...item,
      selected: false,
    }));
  }
}

export const scannerService = new ScannerService();
export default scannerService;

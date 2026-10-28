/*
|--------------------------------------------------------------------------
| Scanner Types
|--------------------------------------------------------------------------
| Shared type definitions for all scanner modules
*/

export type ScanCategory =
  | 'TRASH'
  | 'TEMPORARY'
  | 'CACHE'
  | 'LARGE_FILE'
  | 'DUPLICATE'
  | 'SCREENSHOT'
  | 'SUSPICIOUS'
  | 'POTENTIALLY_CORRUPTED'
  | 'UNUSED_APP';

export type RiskLevel = 'low' | 'medium' | 'high';

export interface ScanItem {
  itemId: string;
  category: ScanCategory;
  displayName: string;
  fileSizeBytes?: number;
  location?: string;
  detectedAt: Date;
  riskLevel: RiskLevel;
  confidence?: number; // 0-100
  reason: string;
  recommendedAction: string;
  canClean: boolean;
  selected: boolean;
  requiresReview?: boolean;
}

export interface ScanResult {
  items: ScanItem[];
  totalItems: number;
  scannedFileCount: number;
  totalCleanableBytes: number;
  categoryCounts: Record<ScanCategory, number>;
  scanDurationMs: number;
  startedAt: Date;
  completedAt: Date;
  scopeDescription?: string;
}

export interface ScannerConfig {
  enabledCategories: ScanCategory[];
  maxItemsPerCategory?: number;
  includeDemoData: boolean;
}

export interface ScanFilters {
  folders: string[];
  fileTypes: string[];
  modifiedWithinDays: number | null;
  minSizeBytes: number;
  maxSizeBytes: number | null;
}

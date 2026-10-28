import type { ScanItem, ScanFilters } from './types';
import type { DeviceFile } from './deviceFileService';
import { getTrashedAssets } from './trashMediaStore';

export class TrashScanner {
  async scan(_files: DeviceFile[], filters?: ScanFilters): Promise<ScanItem[]> {
    const assets = await getTrashedAssets();
    return assets
      .filter((asset) => {
        if (!filters) return true;
        const extension = asset.name.match(/\.[^.]+$/)?.[0]?.toLowerCase() ?? '';
        if (!filters.fileTypes.includes(extension)) return false;
        if (asset.size < filters.minSizeBytes) return false;
        if (filters.maxSizeBytes !== null && asset.size > filters.maxSizeBytes) return false;
        if (
          filters.modifiedWithinDays
          && asset.modificationTime < (Date.now() / 1000) - filters.modifiedWithinDays * 86400
        ) return false;
        const relativePath = asset.relativePath.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
        if (!relativePath || /(?:^|\/)(?:\.?trash|recycle[ _-]?bin)(?:\/|$)/i.test(relativePath)) {
          return true;
        }
        const selectedFolders = filters.folders.map((folder) =>
          folder.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase()
        );
        return selectedFolders.some((folder) =>
          relativePath === folder || relativePath.startsWith(`${folder}/`)
        );
      })
      .map((asset) => ({
      itemId: `trash_${asset.uri}`,
      category: 'TRASH',
      displayName: asset.name,
      fileSizeBytes: asset.size,
      location: asset.uri,
      detectedAt: new Date(asset.modificationTime * 1000),
      riskLevel: 'low',
      confidence: 100,
      reason: 'Marked as trashed by Android MediaStore',
      recommendedAction: 'Review and confirm deletion',
      canClean: true,
      selected: false,
      }));
  }
}

export default TrashScanner;

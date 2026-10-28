import type { ScanItem } from './types';
import type { DeviceFile } from './deviceFileService';
import { cleanedStorageService } from './cleanedStorageService';
import * as FileSystem from 'expo-file-system/legacy';

const INCOMPLETE_DOWNLOAD_PATTERN = /\.(crdownload|part|partial|download)$/i;
const FILE_SIGNATURES: Record<string, string[]> = {
  '.pdf': ['JVBERi0'],
  '.zip': ['UEs'],
  '.docx': ['UEs'],
  '.xlsx': ['UEs'],
  '.pptx': ['UEs'],
};

function getExtension(name: string): string {
  const dotIndex = name.lastIndexOf('.');
  return dotIndex < 0 ? '' : name.slice(dotIndex).toLowerCase();
}

export class CorruptedFileScanner {
  async scan(
    files: DeviceFile[],
    onFileChecked?: (checked: number) => void
  ): Promise<ScanItem[]> {
    const cleanedIds = await cleanedStorageService.getCleanedItemIds();
    const items: ScanItem[] = [];
    let checked = 0;

    for (const file of files) {
      checked++;
      if (checked % 10 === 0 || checked === files.length) onFileChecked?.(checked);
      if (cleanedIds.has(file.name) || cleanedIds.has(file.uri)) continue;

      const incompleteDownload = INCOMPLETE_DOWNLOAD_PATTERN.test(file.name);
      const signatures = FILE_SIGNATURES[getExtension(file.name)];
      let signatureMismatch = false;

      if (!incompleteDownload && signatures) {
        try {
          const header = await FileSystem.readAsStringAsync(file.uri, {
            encoding: FileSystem.EncodingType.Base64,
            length: 16,
            position: 0,
          });
          signatureMismatch = !signatures.some((signature) => header.startsWith(signature));
        } catch (error) {
          console.warn(`Unable to verify file signature for ${file.uri}:`, error);
        }
      }

      if (!incompleteDownload && !signatureMismatch) continue;

      items.push({
        itemId: `${incompleteDownload ? 'incomplete' : 'signature_mismatch'}_${file.uri}`,
        category: 'POTENTIALLY_CORRUPTED',
        displayName: file.name,
        fileSizeBytes: file.size,
        location: file.uri,
        detectedAt: new Date(file.modificationTime * 1000),
        riskLevel: 'low',
        confidence: incompleteDownload ? 100 : 85,
        reason: incompleteDownload
          ? 'File has an unfinished-download extension; its contents are not verified as corrupt'
          : 'File header does not match the expected signature for its file extension',
        recommendedAction: incompleteDownload
          ? 'Check whether a download is still in progress before removing'
          : 'Open or restore from a trusted source before removing',
        canClean: true,
        selected: false,
      });
    }

    return items;
  }
}

export default CorruptedFileScanner;

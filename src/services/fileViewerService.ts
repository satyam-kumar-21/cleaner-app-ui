import { Platform, Alert, Linking } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import * as FileSystem from 'expo-file-system/legacy';
import { getMediaStoreUriForPath } from './scanner/androidDeviceService';

/**
 * Service to open files and folders in the device's file manager
 */
class FileViewerService {
  /**
   * Open a file in the appropriate app (image viewer, document viewer, etc.)
   */
  async openFile(filePath: string): Promise<void> {
    try {
      if (Platform.OS === 'android') {
        await this.openFileAndroid(filePath);
      } else if (Platform.OS === 'ios') {
        await this.openFileIOS(filePath);
      }
    } catch (error) {
      console.error('Error opening file:', error);
      Alert.alert(
        'Cannot Open File',
        error instanceof Error
          ? error.message
          : 'Unable to open this file. Check that it still exists and that a compatible viewer is installed.',
        [{ text: 'OK' }]
      );
    }
  }

  /**
   * Open a folder in the device's file manager
   */
  async openFolder(folderPath: string): Promise<void> {
    try {
      if (Platform.OS === 'android') {
        await this.openFolderAndroid(folderPath);
      } else if (Platform.OS === 'ios') {
        await this.openFolderIOS(folderPath);
      }
    } catch (error) {
      console.error('Error opening folder:', error);
      Alert.alert(
        'Cannot Open Folder',
        'Unable to open this folder. It may not exist or your device may not have a file manager app.',
        [{ text: 'OK' }]
      );
    }
  }

  /** Verify that a scan result still points to a file on disk. */
  private async resolveAccessibleFilePath(filePath: string): Promise<string> {
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (!fileInfo.exists) {
      throw new Error('This file is no longer available at its scanned location.');
    }
    return filePath;
  }

  /**
   * Open file on Android using IntentLauncher
   */
  private async openFileAndroid(filePath: string): Promise<void> {
    const targetPath = filePath;
    const mimeType = this.getMimeType(targetPath);
    const contentUri = await this.getContentUri(targetPath);

    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      flags: 1,
      type: mimeType,
    });
  }

  /**
   * Open folder on Android - opens in file manager
   */
  private async openFolderAndroid(folderPath: string): Promise<void> {
    try {
      const contentUri = await this.getContentUri(folderPath);

      // Try opening with file manager intent
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        type: 'resource/folder',
      });
    } catch {
      // Fallback: Show user the folder path clearly
      Alert.alert(
        'Folder Location',
        `Folder Path:\n${folderPath}\n\nYou can access this folder in your device's Files or File Manager app.`,
        [{ text: 'OK' }]
      );
    }
  }

  /**
   * Open file on iOS using Linking API
   */
  private async openFileIOS(filePath: string): Promise<void> {
    const fileUri = filePath.startsWith('file://') ? filePath : `file://${filePath}`;
    const canOpen = await Linking.canOpenURL(fileUri);
    
    if (canOpen) {
      await Linking.openURL(fileUri);
    } else {
      throw new Error('Cannot open file on iOS');
    }
  }

  /**
   * Open folder on iOS - Files app
   */
  private async openFolderIOS(folderPath: string): Promise<void> {
    // iOS doesn't allow direct folder opening from third-party apps
    // We'll try to open Files app with shareddocuments scheme
    const folderUri = folderPath.startsWith('file://') ? folderPath : `file://${folderPath}`;
    
    try {
      await Linking.openURL(folderUri);
    } catch {
      // Fallback: Show info that folder access is limited on iOS
      Alert.alert(
        'Folder Access Limited',
        'iOS restricts direct folder access. You can find this file in the Files app.',
        [{ text: 'OK' }]
      );
    }
  }

  /**
   * Get MIME type based on file extension
   */
  private getMimeType(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase();
    
    const mimeTypes: Record<string, string> = {
      // Images
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      bmp: 'image/bmp',
      svg: 'image/svg+xml',
      
      // Videos
      mp4: 'video/mp4',
      avi: 'video/x-msvideo',
      mov: 'video/quicktime',
      mkv: 'video/x-matroska',
      webm: 'video/webm',
      
      // Audio
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      m4a: 'audio/mp4',
      
      // Documents
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      txt: 'text/plain',
      
      // Archives
      zip: 'application/zip',
      rar: 'application/x-rar-compressed',
      '7z': 'application/x-7z-compressed',
      
      // APK
      apk: 'application/vnd.android.package-archive',
    };

    return mimeTypes[extension || ''] || 'application/octet-stream';
  }

  /**
   * Convert file path to content URI for Android
   */
  private async getContentUri(path: string): Promise<string> {
    if (Platform.OS === 'android') {
      if (path.startsWith('content://')) return path;
      const mediaUri = await getMediaStoreUriForPath(path);
      if (mediaUri) return mediaUri;

      if (FileSystem.getContentUriAsync) {
        const fileUri = path.startsWith('file://') ? path : `file://${path}`;
        return FileSystem.getContentUriAsync(fileUri);
      }
    }

    throw new Error('Android could not create a shareable URI for this file.');
  }

  /**
   * Extract folder path from file path
   */
  getFolderPath(filePath: string): string {
    const parts = filePath.split('/');
    parts.pop(); // Remove filename
    return parts.join('/');
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      return fileInfo.exists;
    } catch {
      return false;
    }
  }
}

export const fileViewerService = new FileViewerService();

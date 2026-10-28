import type { ScanItem } from './types';
import { getUnusedApps } from './androidDeviceService';

export class UnusedAppScanner {
  async scan(): Promise<ScanItem[]> {
    const apps = await getUnusedApps();

    return apps.map((app) => ({
      itemId: `unused_app_${app.packageName}`,
      category: 'UNUSED_APP',
      displayName: app.name,
      fileSizeBytes: app.size,
      location: app.packageName,
      detectedAt: new Date(app.lastUsedAt),
      riskLevel: 'low',
      confidence: 100,
      reason: 'Installed app has not been used in at least 90 days',
      recommendedAction: 'Review and uninstall if you no longer need it',
      canClean: true,
      selected: false,
    }));
  }
}

export default UnusedAppScanner;

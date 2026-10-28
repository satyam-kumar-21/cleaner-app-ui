import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DeviceData {
  deviceId: string;
  deviceName?: string;
  manufacturer?: string;
  model?: string;
  platform: 'android' | 'ios' | 'windows' | 'macos';
  osVersion?: string;
  appVersion?: string;
  architecture?: string;
  processorName?: string;
  coreCount?: number;
  totalRamBytes?: number;
  availableRamBytes?: number;
  totalStorageBytes?: number;
  freeStorageBytes?: number;
  usedStorageBytes?: number;
  batteryLevel?: number;
  isCharging?: boolean;
}

export interface Device extends DeviceData {
  id: string;
  lastScanAt?: string;
  lastCleanedAt?: string;
  lastBytesFreed?: number;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = '@cleaner_local_devices';

async function readDevices(): Promise<Device[]> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) as Device[] : [];
}

async function saveDevices(devices: Device[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
}

class LocalDeviceStorage {
  async checkDeviceExists(deviceId: string): Promise<Device | null> {
    return (await readDevices()).find((device) => device.deviceId === deviceId) ?? null;
  }

  async registerDevice(deviceData: DeviceData): Promise<Device> {
    const devices = await readDevices();
    const existing = devices.find((device) => device.deviceId === deviceData.deviceId);
    const now = new Date().toISOString();
    const device: Device = {
      ...existing,
      ...deviceData,
      id: existing?.id ?? deviceData.deviceId,
      lastSeenAt: now,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await saveDevices(existing
      ? devices.map((item) => item.deviceId === device.deviceId ? device : item)
      : [device, ...devices]);
    return device;
  }

  async updateExistingDevice(deviceId: string, deviceData: DeviceData): Promise<Device | null> {
    const devices = await readDevices();
    const existing = devices.find((device) => device.deviceId === deviceId);
    if (!existing) return null;
    return this.registerDevice({ ...existing, ...deviceData, deviceId });
  }

  async getUserDevices(): Promise<Device[]> {
    return readDevices();
  }

  async updateDevice(deviceId: string, updates: Partial<DeviceData>): Promise<Device | null> {
    const devices = await readDevices();
    const existing = devices.find((device) => device.id === deviceId || device.deviceId === deviceId);
    if (!existing) return null;
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    await saveDevices(devices.map((device) => device === existing ? updated : device));
    return updated;
  }

  async sendHeartbeat(
    deviceId: string,
    stats: {
      availableRamBytes?: number;
      freeStorageBytes?: number;
      batteryLevel?: number;
      isCharging?: boolean;
    }
  ): Promise<boolean> {
    return (await this.updateDevice(deviceId, stats)) !== null;
  }

  async removeDevice(deviceId: string): Promise<boolean> {
    const devices = await readDevices();
    const remaining = devices.filter((device) => device.id !== deviceId && device.deviceId !== deviceId);
    if (remaining.length === devices.length) return false;
    await saveDevices(remaining);
    return true;
  }
}

export const deviceStorage = new LocalDeviceStorage();
export default deviceStorage;



import AsyncStorage from '@react-native-async-storage/async-storage';

const CLEANED_ITEMS_KEY = '@cleaner_cleaned_item_ids';

export const cleanedStorageService = {
  async getCleanedItemIds(): Promise<Set<string>> {
    try {
      const data = await AsyncStorage.getItem(CLEANED_ITEMS_KEY);
      if (data) {
        const arr = JSON.parse(data);
        return new Set(arr);
      }
    } catch (e) {
      console.warn('Failed to load cleaned items:', e);
    }
    return new Set();
  },

  async markItemsAsCleaned(itemIds: string[], locations?: string[]): Promise<void> {
    try {
      const current = await this.getCleanedItemIds();
      itemIds.forEach((id) => {
        if (id) current.add(id);
      });
      if (locations) {
        locations.forEach((loc) => {
          if (loc) {
            current.add(loc);
            const fileName = loc.split('/').pop();
            if (fileName) current.add(fileName);
          }
        });
      }
      await AsyncStorage.setItem(CLEANED_ITEMS_KEY, JSON.stringify(Array.from(current)));
    } catch (e) {
      console.warn('Failed to save cleaned items:', e);
    }
  },

  async isCleaned(itemId: string, location?: string): Promise<boolean> {
    const cleanedSet = await this.getCleanedItemIds();
    if (cleanedSet.has(itemId)) return true;
    if (location && cleanedSet.has(location)) return true;
    if (location) {
      const fileName = location.split('/').pop();
      if (fileName && cleanedSet.has(fileName)) return true;
    }
    return false;
  },

  async resetCleanedState(): Promise<void> {
    try {
      await AsyncStorage.removeItem(CLEANED_ITEMS_KEY);
    } catch (e) {
      console.warn('Failed to reset cleaned items:', e);
    }
  },
};

export default cleanedStorageService;

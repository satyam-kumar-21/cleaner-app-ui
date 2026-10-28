import AsyncStorage from '@react-native-async-storage/async-storage';

const PROFILE_KEY = '@cleaner_local_profile';
const HISTORY_CLEANUP_KEY = '@cleaner_history_cleanup_complete';

async function clearSavedHistory(): Promise<void> {
  if (await AsyncStorage.getItem(HISTORY_CLEANUP_KEY)) return;

  const keys = await AsyncStorage.getAllKeys();
  const historyKeys = keys.filter((key) =>
    key === '@cleaner_scan_history'
    || key === '@cleaner_cleanup_history'
    || key.startsWith('@cleaner_last_cleanup:')
  );
  if (historyKeys.length) await AsyncStorage.multiRemove(historyKeys);
  await AsyncStorage.setItem(HISTORY_CLEANUP_KEY, 'true');
}

export interface LocalProfile {
  name: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  language: 'en' | 'hi' | 'zh' | 'bn' | 'fr' | 'es' | 'de' | 'ja' | 'pt';
  theme: 'light' | 'dark';
  notifications: boolean;
}

const defaultProfile: LocalProfile = {
  name: 'Local User',
  preferences: { language: 'en', theme: 'light', notifications: false },
};

export const localProfileStorage = {
  async loadProfile(): Promise<LocalProfile> {
    await clearSavedHistory();
    const storedProfile = await AsyncStorage.getItem(PROFILE_KEY);
    const legacyUser = storedProfile ? null : await AsyncStorage.getItem('@cleaner_user_data');
    const previousProfile = storedProfile || legacyUser
      ? JSON.parse((storedProfile ?? legacyUser) as string) as Partial<LocalProfile>
      : null;
    const profile: LocalProfile = {
      ...defaultProfile,
      preferences: {
        ...defaultProfile.preferences,
        ...previousProfile?.preferences,
      },
    };
    if (!storedProfile) {
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    }
    if (!storedProfile) {
      await AsyncStorage.multiRemove([
        '@cleaner_auth_token',
        '@cleaner_user_data',
        '@cleaner_free_user',
      ]);
    }
    return profile;
  },

  async updatePreferences(preferences: Partial<UserPreferences>): Promise<LocalProfile> {
    const profile = await this.loadProfile();
    const updatedProfile = {
      ...profile,
      preferences: { ...profile.preferences, ...preferences },
    };
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(updatedProfile));
    return updatedProfile;
  },
};

export default localProfileStorage;

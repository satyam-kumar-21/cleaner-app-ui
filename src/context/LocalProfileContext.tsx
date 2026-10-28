import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { localProfileStorage, type LocalProfile, type UserPreferences } from '@/services/localProfileStorage';

interface LocalProfileContextType {
  profile: LocalProfile | null;
  isLoading: boolean;
  updatePreferences: (preferences: Partial<UserPreferences>) => Promise<void>;
}

const LocalProfileContext = createContext<LocalProfileContextType | undefined>(undefined);

export function LocalProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<LocalProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    localProfileStorage.loadProfile()
      .then((loadedProfile) => {
        if (active) setProfile(loadedProfile);
      })
      .catch((error: unknown) => console.error('Failed to load local profile:', error))
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const updatePreferences = useCallback(async (preferences: Partial<UserPreferences>) => {
    setProfile(await localProfileStorage.updatePreferences(preferences));
  }, []);

  return (
    <LocalProfileContext.Provider
      value={{
        profile,
        isLoading,
        updatePreferences,
      }}
    >
      {children}
    </LocalProfileContext.Provider>
  );
}

export function useLocalProfile() {
  const context = useContext(LocalProfileContext);
  if (!context) throw new Error('useLocalProfile must be used within a LocalProfileProvider');
  return context;
}

export default LocalProfileContext;

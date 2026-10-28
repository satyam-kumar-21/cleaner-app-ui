import { LocalProfileProvider } from '@/context/LocalProfileContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { AppNotificationsProvider } from '@/context/AppNotificationsContext';
import { Stack } from 'expo-router';

function AppNavigator() {
  const { theme } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: theme === 'dark' ? '#0B1220' : '#FFFFFF' },
      }}
    />
  );
}

export default function RootLayout() {
  return (
    <LocalProfileProvider>
      <LanguageProvider>
        <ThemeProvider>
          <AppNotificationsProvider>
            <AppNavigator />
          </AppNotificationsProvider>
        </ThemeProvider>
      </LanguageProvider>
    </LocalProfileProvider>
  );
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, forwardRef, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  Pressable as NativePressable,
  PressableProps,
  ScrollView as NativeScrollView,
  ScrollViewProps,
  StatusBar as NativeStatusBar,
  StatusBarProps,
  Switch as NativeSwitch,
  SwitchProps,
  StyleProp,
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
  TextInputProps,
  TextProps,
  TouchableOpacity as NativeTouchableOpacity,
  TouchableOpacityProps,
  View as NativeView,
  ViewProps,
} from 'react-native';
import {
  SafeAreaView as NativeSafeAreaView,
  SafeAreaViewProps,
} from 'react-native-safe-area-context';
import { useLocalProfile } from '@/context/LocalProfileContext';

export const APP_THEME_KEY = '@cleaner_app_theme';
export type AppTheme = 'light' | 'dark';

interface ThemeContextValue {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>('light');
  const [localLoaded, setLocalLoaded] = useState(false);
  const { profile, isLoading: isProfileLoading, updatePreferences } = useLocalProfile();

  useEffect(() => {
    AsyncStorage.getItem(APP_THEME_KEY)
      .then((savedTheme) => {
        if (savedTheme === 'light' || savedTheme === 'dark') setThemeState(savedTheme);
      })
      .catch((error: unknown) => console.error('Failed to load app appearance:', error))
      .finally(() => setLocalLoaded(true));
  }, []);

  useEffect(() => {
    const savedTheme = profile?.preferences.theme;
    if (!localLoaded || isProfileLoading || (savedTheme !== 'light' && savedTheme !== 'dark')) return;
    AsyncStorage.setItem(APP_THEME_KEY, savedTheme)
      .then(() => setThemeState(savedTheme))
      .catch((error: unknown) => console.error('Failed to save local appearance preference:', error));
  }, [profile?.preferences.theme, isProfileLoading, localLoaded]);

  const setTheme = useCallback(async (nextTheme: AppTheme) => {
    await AsyncStorage.setItem(APP_THEME_KEY, nextTheme);
    setThemeState(nextTheme);
    if (profile) await updatePreferences({ theme: nextTheme });
  }, [profile, updatePreferences]);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}

function parseHexColor(color: string): [number, number, number] | null {
  const match = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return null;
  const hex = match[1].length === 3
    ? match[1].split('').map((part) => part + part).join('')
    : match[1];
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

function toHexColor(red: number, green: number, blue: number): string {
  return `#${[red, green, blue]
    .map((channel) => Math.round(channel).toString(16).padStart(2, '0'))
    .join('')}`;
}

function getLuminance(red: number, green: number, blue: number): number {
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
}

function getSaturation(red: number, green: number, blue: number): number {
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  return max === 0 ? 0 : (max - min) / max;
}

function transformColor(color: string, property: string, theme: AppTheme): string;
function transformColor(color: unknown, property: string, theme: AppTheme): unknown;
function transformColor(color: unknown, property: string, theme: AppTheme): unknown {
  if (theme !== 'dark' || typeof color !== 'string') return color;
  const rgb = parseHexColor(color);
  if (!rgb) return color;

  const [red, green, blue] = rgb;
  const luminance = getLuminance(red, green, blue);
  const saturation = getSaturation(red, green, blue);
  const normalizedProperty = property.toLowerCase();

  if (normalizedProperty === 'shadowcolor') return '#000000';

  if (normalizedProperty === 'color' || normalizedProperty === 'tintcolor') {
    if (luminance < 0.32 && saturation < 0.85) return '#F1F5F9';
    if (luminance < 0.58 && saturation < 0.48) return '#A8B4C7';
    return color;
  }

  if (normalizedProperty.includes('border') || normalizedProperty === 'outlinecolor') {
    if (saturation < 0.24 && luminance > 0.22) return '#2B3A50';
    return color;
  }

  if (normalizedProperty.includes('background') || normalizedProperty === 'backgroundcolor') {
    if (saturation < 0.16) {
      if (luminance > 0.82) return '#111B2E';
      if (luminance > 0.55) return '#0B1220';
      if (luminance > 0.25) return '#1A263B';
      return color;
    }

    const targetLuminance = luminance > 0.68 ? 0.2 : Math.min(luminance, 0.34);
    const scale = targetLuminance / Math.max(luminance, 0.01);
    return toHexColor(red * scale, green * scale, blue * scale);
  }

  return color;
}

export function transformThemeStyle<T>(style: StyleProp<T>, theme: AppTheme): StyleProp<T> {
  if (theme !== 'dark' || !style) return style;
  const flattened = StyleSheet.flatten(style as Parameters<typeof StyleSheet.flatten>[0]);
  if (!flattened || typeof flattened !== 'object') return style;
  const transformed = Object.fromEntries(
    Object.entries(flattened).map(([property, value]) => [
      property,
      transformColor(value, property, theme),
    ])
  );
  return transformed as StyleProp<T>;
}

export const ThemedView = forwardRef<React.ComponentRef<typeof NativeView>, ViewProps>(({ style, ...props }, ref) => {
  const { theme } = useTheme();
  return <NativeView ref={ref} {...props} style={transformThemeStyle(style, theme)} />;
});
ThemedView.displayName = 'ThemedView';

export const ThemedText = forwardRef<React.ComponentRef<typeof NativeText>, TextProps>(({ style, ...props }, ref) => {
  const { theme } = useTheme();
  const themedStyle = transformThemeStyle(style, theme);
  return (
    <NativeText
      ref={ref}
      {...props}
      style={theme === 'dark' ? [{ color: '#F1F5F9' }, themedStyle] : themedStyle}
    />
  );
});
ThemedText.displayName = 'ThemedText';

export const ThemedTextInput = forwardRef<React.ComponentRef<typeof NativeTextInput>, TextInputProps>(({ style, ...props }, ref) => {
  const { theme } = useTheme();
  return (
    <NativeTextInput
      ref={ref}
      {...props}
      keyboardAppearance={theme === 'dark' ? 'dark' : props.keyboardAppearance}
      placeholderTextColor={theme === 'dark'
        ? props.placeholderTextColor
          ? typeof props.placeholderTextColor === 'string'
            ? transformColor(props.placeholderTextColor, 'color', theme)
            : props.placeholderTextColor
          : '#94A3B8'
        : props.placeholderTextColor}
      style={theme === 'dark'
        ? [{ color: '#F1F5F9' }, transformThemeStyle(style, theme)]
        : transformThemeStyle(style, theme)}
    />
  );
});
ThemedTextInput.displayName = 'ThemedTextInput';

export const ThemedTouchableOpacity = forwardRef<
  React.ElementRef<typeof NativeTouchableOpacity>,
  TouchableOpacityProps
>(
  ({ style, ...props }, ref) => {
    const { theme } = useTheme();
    return <NativeTouchableOpacity ref={ref} {...props} style={transformThemeStyle(style, theme)} />;
  }
);
ThemedTouchableOpacity.displayName = 'ThemedTouchableOpacity';

export const ThemedPressable = forwardRef<React.ComponentRef<typeof NativePressable>, PressableProps>(({ style, ...props }, ref) => {
  const { theme } = useTheme();
  const themedStyle = typeof style === 'function'
    ? (state: Parameters<typeof style>[0]) => transformThemeStyle(style(state), theme)
    : transformThemeStyle(style, theme);
  return <NativePressable ref={ref} {...props} style={themedStyle} />;
});
ThemedPressable.displayName = 'ThemedPressable';

export const ThemedScrollView = forwardRef<React.ComponentRef<typeof NativeScrollView>, ScrollViewProps>(
  ({ style, contentContainerStyle, ...props }, ref) => {
    const { theme } = useTheme();
    return (
      <NativeScrollView
        ref={ref}
        {...props}
        style={transformThemeStyle(style, theme)}
        contentContainerStyle={transformThemeStyle(contentContainerStyle, theme)}
      />
    );
  }
);
ThemedScrollView.displayName = 'ThemedScrollView';

export const ThemedSafeAreaView = forwardRef<React.ComponentRef<typeof NativeSafeAreaView>, SafeAreaViewProps>(({ style, ...props }, ref) => {
  const { theme } = useTheme();
  return <NativeSafeAreaView ref={ref} {...props} style={transformThemeStyle(style, theme)} />;
});
ThemedSafeAreaView.displayName = 'ThemedSafeAreaView';

export function ThemedSwitch(props: SwitchProps) {
  const { theme } = useTheme();
  return (
    <NativeSwitch
      {...props}
      trackColor={theme === 'dark'
        ? { ...props.trackColor, false: '#334155' }
        : props.trackColor}
    />
  );
}

type ThemedStatusBarProps = Omit<StatusBarProps, 'backgroundColor'> & {
  backgroundColor?: string;
};

export function ThemedStatusBar(props: ThemedStatusBarProps) {
  const { theme } = useTheme();
  const { backgroundColor, ...nativeProps } = props;
  void backgroundColor;
  return (
    <NativeStatusBar
      {...nativeProps}
      barStyle={theme === 'dark' ? 'light-content' : props.barStyle ?? 'dark-content'}
    />
  );
}

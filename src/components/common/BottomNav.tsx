import { usePathname, useRouter } from 'expo-router';
import { LocalizedText as Text } from '@/context/LanguageContext';
import { StyleSheet, useWindowDimensions } from 'react-native';
import {
  ThemedTouchableOpacity as TouchableOpacity,
  ThemedView as View,
  ThemedSafeAreaView as SafeAreaView,
} from '@/context/ThemeContext';

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const isCompact = width < 360;
  const tabs = [
    { name: 'Home', icon: '🏠', route: '/home' },
    { name: 'Scanner', icon: '🔍', route: '/advanced-scan' },
    { name: 'Settings', icon: '⚙️', route: '/settings' },
  ];

  const isActive = (tab: (typeof tabs)[number]) =>
    pathname === tab.route
    || (tab.name === 'Scanner' && (pathname === '/scanning' || pathname === '/advanced-scan'));

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <View style={styles.container}>
        <View style={[styles.navBar, isCompact && styles.navBarCompact]}>
          {tabs.map((tab) => {
            const active = isActive(tab);

            return (
              <TouchableOpacity
                key={tab.route}
                style={[styles.tab, isCompact && styles.tabCompact, active && styles.activeTabBg]}
                onPress={() => {
                  if (pathname === tab.route) return; // already here, do nothing
                  router.push(tab.route as any);
                }}
                activeOpacity={0.75}
              >
                {active && <View style={styles.activeIndicator} />}
                <Text style={[styles.icon, isCompact && styles.iconCompact]}>{tab.icon}</Text>
                <Text style={[styles.label, isCompact && styles.labelCompact, active && styles.labelActive]}>
                  {tab.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#FFFFFF',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 8,
  },
  navBar: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  navBarCompact: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    position: 'relative',
    borderRadius: 12,
  },
  tabCompact: {
    paddingVertical: 6,
  },
  activeTabBg: {
    backgroundColor: '#EEF5FC',
  },
  icon: {
    fontSize: 20,
    marginBottom: 2,
  },
  iconCompact: {
    fontSize: 18,
  },
  label: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  labelCompact: {
    fontSize: 10,
  },
  labelActive: {
    color: '#2196F3',
    fontWeight: '700',
  },
  activeIndicator: {
    position: 'absolute',
    top: 0,
    left: '25%',
    right: '25%',
    height: 2.5,
    backgroundColor: '#2196F3',
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
});
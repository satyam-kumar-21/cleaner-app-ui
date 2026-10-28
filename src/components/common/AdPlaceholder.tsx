import { LocalizedText as Text } from '@/context/LanguageContext';
import { StyleSheet } from 'react-native';
import {
  ThemedView as View,
} from '@/context/ThemeContext';

export default function AdPlaceholder() {
  return (
    <View style={styles.container}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Ad</Text>
      </View>
      <Text style={styles.title}>Ad space</Text>
      <Text style={styles.description}>Advertising is not configured yet.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 112,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: '#E2E8F0',
  },
  badgeText: {
    color: '#475569',
    fontSize: 10,
    fontWeight: '700',
  },
  title: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
  },
  description: {
    marginTop: 4,
    color: '#64748B',
    fontSize: 12,
  },
});

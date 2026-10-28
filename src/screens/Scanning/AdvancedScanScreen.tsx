import { LocalizedText as Text } from '@/context/LanguageContext';
import {
  ThemedSafeAreaView as SafeAreaView,
  ThemedScrollView as ScrollView,
  ThemedStatusBar as StatusBar,
  ThemedTouchableOpacity as TouchableOpacity,
  ThemedView as View,
} from '@/context/ThemeContext';
import type { ScanFilters, ScanCategory } from '@/services/scanner/types';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, TextInput } from 'react-native';

const CATEGORY_OPTIONS: { id: ScanCategory; label: string; description: string; icon: string; tint: string }[] = [
  { id: 'TEMPORARY', label: 'Temporary files', description: 'System and app temporary files', icon: '▤', tint: '#EAF3FF' },
  { id: 'TRASH', label: 'Android Trash', description: 'Items recently moved to trash', icon: '▣', tint: '#E6F7F3' },
  { id: 'POTENTIALLY_CORRUPTED', label: 'Incomplete files', description: 'Partially downloaded or corrupted files', icon: '♧', tint: '#F1EAFE' },
  { id: 'UNUSED_APP', label: 'Unused apps (90+ days)', description: 'Not used in the last 90 days', icon: '▦', tint: '#FFF1E6' },
  { id: 'DUPLICATE', label: 'Duplicate & similar photos', description: 'Repeated or similar images', icon: '▧', tint: '#EAF3FF' },
  { id: 'LARGE_FILE', label: 'Large files (500+ MB)', description: 'Very large files taking up space', icon: '▱', tint: '#F1EAFE' },
  { id: 'SCREENSHOT', label: 'Screenshots', description: 'Screenshots and screen recordings', icon: '▣', tint: '#E6F7F3' },
];
const FOLDERS = [
  { label: 'Download', icon: '↓' },
  { label: 'Documents', icon: '▤' },
  { label: 'Pictures', icon: '▧' },
  { label: 'DCIM', icon: '▣' },
];
const FILE_TYPES: { label: string; icon: string; extensions: string[] }[] = [
  { label: 'Photos', icon: '▧', extensions: ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.bmp', '.gif'] },
  { label: 'Videos', icon: '▷', extensions: ['.mp4', '.m4v', '.mkv', '.mov', '.3gp', '.webm'] },
  { label: 'Audio', icon: '♫', extensions: ['.mp3', '.wav', '.aac', '.flac', '.ogg'] },
  { label: 'Documents', icon: '▤', extensions: ['.pdf', '.docx', '.xlsx', '.pptx'] },
  { label: 'Archives', icon: '▥', extensions: ['.zip'] },
  { label: 'Temporary', icon: '◷', extensions: ['.tmp', '.temp', '.cache', '.part', '.partial', '.download', '.crdownload'] },
];

const DEFAULT_CATEGORIES: ScanCategory[] = [
  'TEMPORARY',
  'TRASH',
  'POTENTIALLY_CORRUPTED',
  'UNUSED_APP',
  'DUPLICATE',
  'LARGE_FILE',
  'SCREENSHOT',
];

export default function AdvancedScanScreen() {
  const router = useRouter();
  const [categories, setCategories] = useState<ScanCategory[]>([]);
  const [folders, setFolders] = useState(FOLDERS.map((folder) => folder.label));
  const [fileTypes, setFileTypes] = useState<string[]>(FILE_TYPES.flatMap((type) => type.extensions));
  const [modifiedWithinDays, setModifiedWithinDays] = useState<number | null>(null);
  const [minimumSizeMb, setMinimumSizeMb] = useState('0');
  const [maximumSizeMb, setMaximumSizeMb] = useState('');

  const toggleValue = <T extends string>(
    current: T[],
    value: T,
    setter: (next: T[]) => void
  ) => {
    setter(current.includes(value)
      ? current.filter((entry) => entry !== value)
      : [...current, value]);
  };

  const toggleFileType = (extensions: string[]) => {
    const isSelected = extensions.every((extension) => fileTypes.includes(extension));
    setFileTypes(isSelected
      ? fileTypes.filter((extension) => !extensions.includes(extension))
      : Array.from(new Set([...fileTypes, ...extensions])));
  };

  const resetSmartScan = () => {
    setCategories(DEFAULT_CATEGORIES);
    setFolders(FOLDERS.map((folder) => folder.label));
    setFileTypes(FILE_TYPES.flatMap((type) => type.extensions));
    setModifiedWithinDays(null);
    setMinimumSizeMb('0');
    setMaximumSizeMb('');
  };

  const startScan = () => {
    if (!categories.length) {
      Alert.alert('Select scan types', 'Choose at least one category to scan.');
      return;
    }
    if (!folders.length) {
      Alert.alert('Select folders', 'Choose at least one device folder to scan.');
      return;
    }
    const minimumMb = Number(minimumSizeMb || 0);
    const maximumMb = maximumSizeMb ? Number(maximumSizeMb) : null;
    if (!Number.isFinite(minimumMb) || minimumMb < 0
      || (maximumMb !== null && (!Number.isFinite(maximumMb) || maximumMb < minimumMb))) {
      Alert.alert('Invalid size filter', 'Enter a valid maximum size that is greater than the minimum.');
      return;
    }

    const filters: ScanFilters = {
      folders,
      fileTypes,
      modifiedWithinDays,
      minSizeBytes: minimumMb * 1024 * 1024,
      maxSizeBytes: maximumMb === null ? null : maximumMb * 1024 * 1024,
    };
    router.replace({
      pathname: '/scanning',
      params: {
        scanConfig: JSON.stringify({ enabledCategories: categories, filters }),
      },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F9FC" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Advanced Scan</Text>
          <Text style={styles.headerSubtitle}>Choose what to scan for a cleaner, faster device.</Text>
        </View>
        <TouchableOpacity style={styles.smartScanButton} onPress={resetSmartScan}>
          <Text style={styles.smartScanText}>✦ Smart Scan</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Scan Categories</Text>
            <Text style={styles.sectionHint}>Select what you want to scan for.</Text>
          </View>
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{categories.length} selected  ›</Text>
          </View>
        </View>
        <View style={styles.card}>
          {CATEGORY_OPTIONS.map((option) => {
            const selected = categories.includes(option.id);
            return (
              <TouchableOpacity
                key={option.id}
                style={styles.optionRow}
                onPress={() => toggleValue(categories, option.id, setCategories)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
              >
                <View style={[styles.categoryIconBox, { backgroundColor: option.tint }]}>
                  <Text style={styles.categoryIcon}>{option.icon}</Text>
                </View>
                <View style={styles.optionCopy}>
                  <Text style={styles.optionText}>{option.label}</Text>
                  <Text style={styles.optionDescription}>{option.description}</Text>
                </View>
                <View style={[styles.check, selected && styles.checkSelected]}>
                  {selected && <Text style={styles.checkmark}>✓</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Device Folders</Text>
            <Text style={styles.sectionHint}>Choose folders to include in the scan.</Text>
          </View>
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{folders.length} selected  ›</Text>
          </View>
        </View>
        <View style={styles.folderCard}>
          {FOLDERS.map((folder) => {
            const selected = folders.includes(folder.label);
            return (
              <TouchableOpacity
                key={folder.label}
                style={[styles.folderChip, selected && styles.folderChipSelected]}
                onPress={() => toggleValue(folders, folder.label, setFolders)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
              >
                <Text style={[styles.folderCheck, selected && styles.folderCheckSelected]}>{selected ? '✓' : '+'}</Text>
                <Text style={styles.folderIcon}>{folder.icon}</Text>
                <Text style={styles.folderText}>{folder.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>File Types</Text>
            <Text style={styles.sectionHint}>Filter by file type for focused results.</Text>
          </View>
          <TouchableOpacity
            style={styles.countPill}
            onPress={() => {
              const allSelected = FILE_TYPES.every((type) =>
                type.extensions.every((extension) => fileTypes.includes(extension))
              );
              setFileTypes(allSelected ? [] : FILE_TYPES.flatMap((type) => type.extensions));
            }}
          >
            <Text style={styles.countPillText}>
              {FILE_TYPES.every((type) => type.extensions.every((extension) => fileTypes.includes(extension)))
                ? 'All selected'
                : 'Select all'}  ›
            </Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.card, styles.fileTypesCard]}>
          {FILE_TYPES.map((type) => {
            const selected = type.extensions.every((extension) => fileTypes.includes(extension));
            return (
              <TouchableOpacity
                key={type.label}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => toggleFileType(type.extensions)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
              >
                <Text style={[styles.chipCheck, selected && styles.chipCheckSelected]}>{selected ? '✓' : '○'}</Text>
                <Text style={styles.typeIcon}>{type.icon}</Text>
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{type.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.filterPanels}>
        <View style={styles.filterPanel}>
        <Text style={styles.filterTitle}>◷  Modified Within</Text>
        <Text style={styles.filterHint}>Scan files created or modified in the last:</Text>
        <View style={styles.chips}>
          {([{ label: 'Any time', days: null }, { label: '7 days', days: 7 }, { label: '30 days', days: 30 }, { label: '90 days', days: 90 }] as const)
            .map((option) => {
              const selected = modifiedWithinDays === option.days;
              return (
                <TouchableOpacity
                  key={option.label}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => setModifiedWithinDays(option.days)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
        </View>
        </View>
        <View style={styles.filterPanel}>
        <Text style={styles.filterTitle}>▤  File Size (MB)</Text>
        <Text style={styles.filterHint}>Find files within this size range:</Text>
        <View style={styles.sizeRow}>
          <TextInput
            style={styles.sizeInput}
            value={minimumSizeMb}
            onChangeText={setMinimumSizeMb}
            keyboardType="decimal-pad"
            placeholder="Minimum"
            accessibilityLabel="Minimum file size in megabytes"
          />
          <Text style={styles.sizeSeparator}>to</Text>
          <TextInput
            style={styles.sizeInput}
            value={maximumSizeMb}
            onChangeText={setMaximumSizeMb}
            keyboardType="decimal-pad"
            placeholder="No maximum"
            accessibilityLabel="Maximum file size in megabytes"
          />
        </View>
        </View>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <TouchableOpacity style={styles.startButton} onPress={startScan} accessibilityRole="button">
          <Text style={styles.startButtonText}>✦  Start Advanced Scan  →</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F9FC' },
  header: { minHeight: 66, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 10, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  backButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  backIcon: { color: '#0A192F', fontSize: 30, lineHeight: 32, marginTop: -3 },
  headerCopy: { flex: 1 },
  headerTitle: { color: '#102347', fontSize: 19, fontWeight: '800' },
  headerSubtitle: { color: '#71819B', fontSize: 11, marginTop: 3 },
  smartScanButton: { backgroundColor: '#EAF3FF', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 9 },
  smartScanText: { color: '#1769C2', fontSize: 12, fontWeight: '700' },
  content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16 },
  sectionHeader: { minHeight: 56, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 8, paddingHorizontal: 2 },
  sectionTitle: { color: '#142748', fontSize: 16, fontWeight: '800' },
  sectionHint: { color: '#8190A8', fontSize: 11, marginTop: 3 },
  countPill: { backgroundColor: '#EAF3FF', borderRadius: 15, paddingHorizontal: 11, paddingVertical: 8 },
  countPillText: { color: '#1769C2', fontSize: 11, fontWeight: '700' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 17, paddingHorizontal: 14, borderWidth: 1, borderColor: '#EAF0F8', elevation: 1 },
  optionRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F0F4FA', gap: 11 },
  categoryIconBox: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  categoryIcon: { color: '#2674D8', fontSize: 20, fontWeight: '700' },
  optionCopy: { flex: 1 },
  optionText: { color: '#172B4D', fontSize: 13, fontWeight: '700' },
  optionDescription: { color: '#8190A8', fontSize: 10, marginTop: 3 },
  check: { width: 20, height: 20, borderRadius: 5, borderWidth: 1, borderColor: '#C7D4E6', alignItems: 'center', justifyContent: 'center' },
  checkSelected: { borderColor: '#1976D2', backgroundColor: '#1976D2' },
  checkmark: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', lineHeight: 16 },
  folderCard: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#EAF0F8' },
  folderChip: { width: '48%', minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 9, borderRadius: 20, backgroundColor: '#F3F6FA' },
  folderChipSelected: { backgroundColor: '#EAF3FF' },
  folderCheck: { color: '#8A99AD', fontSize: 13, fontWeight: '800' },
  folderCheckSelected: { color: '#1769C2' },
  folderIcon: { color: '#2674D8', fontSize: 15 },
  folderText: { color: '#284064', fontSize: 11, fontWeight: '600' },
  fileTypesCard: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 12, gap: 7 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: '#E0E8F3', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 9, backgroundColor: '#FFFFFF' },
  chipSelected: { borderColor: '#D8E9FF', backgroundColor: '#EAF3FF' },
  chipCheck: { color: '#90A0B5', fontSize: 11 },
  chipCheckSelected: { color: '#1769C2', fontWeight: '800' },
  typeIcon: { color: '#2674D8', fontSize: 14 },
  chipText: { color: '#475569', fontSize: 11, fontWeight: '600' },
  chipTextSelected: { color: '#155A9C' },
  filterPanels: { flexDirection: 'row', gap: 8, marginTop: 10 },
  filterPanel: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 10, borderWidth: 1, borderColor: '#EAF0F8' },
  filterTitle: { color: '#263B5C', fontSize: 12, fontWeight: '800', marginBottom: 5 },
  filterHint: { color: '#8190A8', fontSize: 9, lineHeight: 13, marginBottom: 8 },
  sizeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sizeInput: { flex: 1, minWidth: 0, minHeight: 38, borderRadius: 8, borderWidth: 1, borderColor: '#DCE5F1', backgroundColor: '#FFFFFF', paddingHorizontal: 8, color: '#0A192F', fontSize: 11 },
  sizeSeparator: { color: '#64748B', fontSize: 10 },
  sizeUnit: { color: '#64748B', fontSize: 10 },
  footer: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 8, backgroundColor: '#F7F9FC' },
  startButton: { minHeight: 52, borderRadius: 26, backgroundColor: '#1976D2', alignItems: 'center', justifyContent: 'center', elevation: 3 },
  startButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});

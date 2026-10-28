import { LocalizedText as Text } from '@/context/LanguageContext';
import {
  ThemedSafeAreaView as SafeAreaView,
  ThemedScrollView as ScrollView,
  ThemedStatusBar as StatusBar,
  ThemedTouchableOpacity as TouchableOpacity,
  ThemedView as View,
} from '@/context/ThemeContext';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

export interface LegalSection {
  heading: string;
  body: string;
}

interface LegalDocumentScreenProps {
  title: string;
  introduction: string;
  sections: LegalSection[];
}

export default function LegalDocumentScreen({
  title,
  introduction,
  sections,
}: LegalDocumentScreenProps) {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.introduction}>{introduction}</Text>

        {sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.sectionHeading}>{section.heading}</Text>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </View>
        ))}

        <View style={styles.bottomSpace} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  title: {
    marginTop: 24,
    marginBottom: 8,
    fontSize: 26,
    fontWeight: '800',
    color: '#1F2937',
  },
  introduction: {
    marginBottom: 24,
    fontSize: 15,
    lineHeight: 23,
    color: '#4B5563',
  },
  section: {
    marginBottom: 22,
  },
  sectionHeading: {
    marginBottom: 8,
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
  },
  sectionBody: {
    fontSize: 14,
    lineHeight: 22,
    color: '#4B5563',
  },
  bottomSpace: {
    height: 24,
  },
});

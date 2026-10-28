import { LocalizedText as Text } from '@/context/LanguageContext';
import {
  ThemedSafeAreaView as SafeAreaView,
  ThemedScrollView as ScrollView,
  ThemedStatusBar as StatusBar,
  ThemedTextInput as TextInput,
  ThemedTouchableOpacity as TouchableOpacity,
  ThemedView as View,
} from '@/context/ThemeContext';
import { supportNoteStorage, type SupportTicket } from '@/services/local/supportNoteStorage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet } from 'react-native';

export default function PrioritySupportScreen() {
  const router = useRouter();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [ticketError, setTicketError] = useState<string | null>(null);

  const loadTickets = async () => {
    setTicketError(null);
    try {
      const result = await supportNoteStorage.list();
      setTickets(result.tickets);
    } catch (error) {
      console.error('Could not load local support notes:', error);
      setTicketError(error instanceof Error ? error.message : 'Could not load support requests.');
    }
  };

  useEffect(() => {
    let isActive = true;
    supportNoteStorage.list()
      .then((result) => {
        if (isActive) setTickets(result.tickets);
      })
      .catch((error: unknown) => {
        console.error('Could not load local support notes:', error);
        if (isActive) setTicketError(error instanceof Error ? error.message : 'Could not load support requests.');
      })
      .finally(() => {
        if (isActive) setLoadingTickets(false);
      });
    return () => { isActive = false; };
  }, []);

  const submit = async () => {
    if (subject.trim().length < 5 || message.trim().length < 20) {
      Alert.alert('More information needed', 'Enter a subject of at least 5 characters and a message of at least 20 characters.');
      return;
    }
    setSubmitting(true);
    try {
      await supportNoteStorage.create(subject.trim(), message.trim());
      setSubject('');
      setMessage('');
      await loadTickets();
      Alert.alert('Saved locally', 'Your support request is stored on this device and was not sent.');
    } catch (error) {
      console.error('Could not save local support note:', error);
      Alert.alert('Support request failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>‹</Text></TouchableOpacity>
        <Text style={styles.title}>Support notes</Text>
        <View style={styles.spacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.description}>Create a support note. It is saved only on this device and is not sent to a support team.</Text>
        <Text style={styles.label}>SUBJECT</Text>
        <TextInput style={styles.input} value={subject} onChangeText={setSubject} maxLength={120} placeholder="What do you need help with?" />
        <Text style={styles.label}>MESSAGE</Text>
        <TextInput style={[styles.input, styles.message]} value={message} onChangeText={setMessage} maxLength={5000} multiline textAlignVertical="top" placeholder="Describe the issue and steps to reproduce it." />
        <Text style={styles.counter}>{message.length}/5000</Text>
        <TouchableOpacity style={styles.button} onPress={submit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Save note</Text>}
        </TouchableOpacity>
        <Text style={styles.sectionTitle}>SAVED NOTES</Text>
        {loadingTickets ? (
          <ActivityIndicator color="#1976D2" style={styles.ticketLoader} />
        ) : ticketError ? (
          <View style={styles.ticketError}>
            <Text style={styles.ticketErrorText}>{ticketError}</Text>
            <TouchableOpacity
              onPress={() => {
                setLoadingTickets(true);
                void loadTickets().finally(() => setLoadingTickets(false));
              }}
            ><Text style={styles.retryText}>Retry</Text></TouchableOpacity>
          </View>
        ) : tickets.length ? tickets.map((ticket) => (
          <View key={ticket.id} style={styles.ticketCard}>
            <View style={styles.ticketHeading}>
              <Text style={styles.ticketSubject}>{ticket.subject}</Text>
              <Text style={styles.ticketStatus}>{ticket.status.replace('_', ' ')}</Text>
            </View>
            <Text style={styles.ticketDate}>{new Date(ticket.createdAt).toLocaleDateString()}</Text>
          </View>
        )) : (
          <Text style={styles.emptyTickets}>You have no saved notes yet.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F9FC' },
  header: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, backgroundColor: '#FFFFFF' },
  backButton: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  backText: { color: '#0A192F', fontSize: 30, marginTop: -3 },
  title: { color: '#0A192F', fontSize: 18, fontWeight: '700' },
  spacer: { width: 38 },
  content: { padding: 20 },
  description: { color: '#64748B', fontSize: 14, lineHeight: 21, marginBottom: 20 },
  label: { color: '#64748B', fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8, marginTop: 12 },
  input: { minHeight: 48, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 13, color: '#0A192F' },
  message: { minHeight: 180, paddingTop: 13 },
  counter: { textAlign: 'right', color: '#94A3B8', fontSize: 11, marginTop: 5 },
  button: { minHeight: 52, marginTop: 24, borderRadius: 14, backgroundColor: '#1976D2', alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  sectionTitle: { color: '#64748B', fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginTop: 28, marginBottom: 10 },
  ticketLoader: { marginTop: 14 },
  ticketError: { padding: 14, backgroundColor: '#FEF2F2', borderRadius: 12 },
  ticketErrorText: { color: '#991B1B', fontSize: 13 },
  retryText: { color: '#155A9C', fontSize: 13, fontWeight: '700', marginTop: 8 },
  ticketCard: { padding: 14, borderRadius: 12, backgroundColor: '#FFFFFF', marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  ticketHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  ticketSubject: { flex: 1, color: '#0A192F', fontSize: 14, fontWeight: '700' },
  ticketStatus: { color: '#155A9C', fontSize: 10, fontWeight: '800' },
  ticketDate: { color: '#64748B', fontSize: 11, marginTop: 6 },
  emptyTickets: { color: '#64748B', fontSize: 13, marginVertical: 10 },
});

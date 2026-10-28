import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  status: 'SAVED_LOCALLY';
  createdAt: string;
}

const STORAGE_KEY = '@cleaner_local_support_requests';

async function readTickets(): Promise<SupportTicket[]> {
  const saved = await AsyncStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) as SupportTicket[] : [];
}

export const supportNoteStorage = {
  async list(): Promise<{ tickets: SupportTicket[] }> {
    return { tickets: await readTickets() };
  },

  async create(subject: string, message: string): Promise<SupportTicket> {
    const tickets = await readTickets();
    const ticket: SupportTicket = {
      id: `support-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      subject,
      message,
      status: 'SAVED_LOCALLY',
      createdAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([ticket, ...tickets]));
    return ticket;
  },
};

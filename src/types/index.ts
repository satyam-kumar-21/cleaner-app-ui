export interface ScanCategory {
  id: string;
  name: string;
  size: string;
  files: number;
  subtitle: string;
  icon: string;
  color: string;
  bg: string;
  selected: boolean;
}

export interface ProcessingFile {
  name: string;
  status: 'completed' | 'cleaning' | 'pending';
}

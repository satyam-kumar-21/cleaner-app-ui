import LegalDocumentScreen, { type LegalSection } from './LegalDocumentScreen';

const sections: LegalSection[] = [
  {
    heading: 'Using Cleaner',
    body: 'You may use Cleaner for its intended device scanning and storage management features. The app works locally without an account or backend service. You are responsible for using it lawfully and only on devices and files you are authorized to access.',
  },
  {
    heading: 'File operations',
    body: 'Review the items selected for cleanup before confirming an operation. Removing files may be permanent or difficult to reverse. You are responsible for keeping backups of files you want to retain.',
  },
  {
    heading: 'Free app and local data',
    body: 'All current app features are free. Cleaner has no paid upgrades or in-app purchases. Preferences and support notes are stored on your device. Scan and cleanup results are not saved as history, and support notes are not sent to a support team.',
  },
  {
    heading: 'Availability and changes',
    body: 'Features may change, be temporarily unavailable, or depend on your device and operating system. We may update the app and these terms from time to time.',
  },
  {
    heading: 'Disclaimer',
    body: 'Cleaner is provided on an “as available” basis. To the extent permitted by law, we do not guarantee uninterrupted operation or that every scan will identify every item that may be suitable for cleanup.',
  },
  {
    heading: 'Contact',
    body: 'For questions about these terms, use the support or contact information provided with the app, if available.',
  },
];

export default function TermsOfServiceScreen() {
  return (
    <LegalDocumentScreen
      title="Terms of Service"
      introduction="By using Cleaner, you agree to these terms. Please read them before using the app."
      sections={sections}
    />
  );
}

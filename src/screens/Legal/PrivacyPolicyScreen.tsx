import LegalDocumentScreen, { type LegalSection } from './LegalDocumentScreen';

const sections: LegalSection[] = [
  {
    heading: 'Information used by the app',
    body: 'Cleaner does not require an account. Device details, app preferences, and support notes are stored locally on your device and are not sent to a server.',
  },
  {
    heading: 'Files and scans',
    body: 'Cleaner scans and manages files on your device to provide its cleaning features. File contents are processed on your device and are not uploaded as part of scanning or cleaning.',
  },
  {
    heading: 'Local storage',
    body: 'The app stores your preferences, device details, and support notes in local app storage. Scan and cleanup results are not saved as history. You can clear the app’s stored data in your device settings.',
  },
  {
    heading: 'How information is used',
    body: 'Locally stored information is used only to provide app features on your device. Cleaner does not send this information to a backend service. Advertising is not currently configured.',
  },
  {
    heading: 'Your choices',
    body: 'You can turn local notifications off in Settings. Support notes are stored locally and are not delivered to a support team.',
  },
  {
    heading: 'Changes to this policy',
    body: 'We may update this policy as the app changes. The latest version will be available from Settings in the app.',
  },
];

export default function PrivacyPolicyScreen() {
  return (
    <LegalDocumentScreen
      title="Privacy Policy"
      introduction="This policy explains what information Cleaner uses and how the app handles it."
      sections={sections}
    />
  );
}

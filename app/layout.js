import './globals.css';

export const metadata = {
  title: 'ARK Tracker',
  description: 'IELTS & CEFR student progress tracker',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

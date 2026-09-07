import './globals.css';

export const metadata = {
  title: 'ARK Tracker',
  description: 'IELTS & CEFR student progress tracker',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script src="/cloud-sync.js" />
      </head>
      <body>{children}</body>
    </html>
  );
}

import { Poppins } from 'next/font/google';
import './globals.css';
import './typography.css';
import './final-tools.css';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-poppins',
  display: 'swap',
});

export const metadata = {
  title: 'ARK Tracker',
  description: 'IELTS & CEFR student progress tracker',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={poppins.variable}>
      <head>
        <script src="/cloud-sync.js" />
        <script src="/submitted-bars.js" defer />
        <script src="/overall-tools.js" defer />
      </head>
      <body>{children}</body>
    </html>
  );
}

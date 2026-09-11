import { Poppins } from 'next/font/google';
import './globals.css';
import './ark-v2.css';
import './auth.css';
import './shop-polish.css';
import AuthGate from './AuthGate';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-poppins',
  display: 'swap',
});

export const metadata = {
  title: 'ARK Tracker',
  description: 'ARK Education management, finance, roles and gamification platform',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={poppins.variable}>
      <body><AuthGate>{children}</AuthGate></body>
    </html>
  );
}
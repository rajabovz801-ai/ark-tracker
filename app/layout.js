import { Poppins } from 'next/font/google';
import './globals.css';
import './ark-v2.css';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-poppins',
  display: 'swap',
});

export const metadata = {
  title: 'ARK Tracker',
  description: 'ARK Education management, finance and gamification platform',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={poppins.variable}>
      <head>
        <script src="/cloud-sync.js" />
      </head>
      <body>{children}</body>
    </html>
  );
}

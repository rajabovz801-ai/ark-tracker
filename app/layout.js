import { Poppins } from 'next/font/google';
import './globals.css';
import './ark-v2.css';
import './auth.css';
import './shop-polish.css';
import './reference-ui.css';
import './mobile.css';
import './student-app.css';
import './dashboard-polish.css';
import './cloud-status.css';
import './reports.css';
import './student-lifecycle.css';
import './uzbek-upgrade.css';
import './hardening.css';
import AuthGate from './AuthGate';
import UzbekUI from './UzbekUI';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-poppins',
  display: 'swap',
});

export const metadata = {
  title: 'ARK Tracker',
  description: 'ARK Education o‘quv markazi boshqaruv, moliya, rollar va gamifikatsiya platformasi',
};

export default function RootLayout({ children }) {
  return (
    <html lang="uz" className={poppins.variable}>
      <body><UzbekUI/><AuthGate>{children}</AuthGate></body>
    </html>
  );
}

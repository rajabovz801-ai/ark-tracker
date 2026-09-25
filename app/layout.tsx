import type {Metadata,Viewport} from 'next';
import './globals.css';
export const metadata:Metadata={title:'ARK EDUCATION | Smart Attendance',description:'ARK EDUCATION uchun aqlli davomat tizimi',applicationName:'ARK Smart Attendance',manifest:'/manifest.webmanifest'};
export const viewport:Viewport={width:'device-width',initialScale:1,themeColor:'#182D45'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="uz"><body>{children}</body></html>;}

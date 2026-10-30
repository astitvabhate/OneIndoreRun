import type { Metadata, Viewport } from 'next';
import { DM_Sans, Inter } from 'next/font/google';
import './globals.css';

// Self-hosted, preloaded fonts. CSS reads them through --font-display and --font-ui.
const display = DM_Sans({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const ui = Inter({ subsets: ['latin'], variable: '--font-ui', display: 'swap' });

export const metadata: Metadata = {
  title: 'One Indore Run Indore 2.0',
  description: 'One Indore Run Indore 2.0 — run your distance, celebrate the city and be part of the running community.',
  openGraph: {
    title: 'One Indore Run Indore 2.0',
    description: 'Choose 3 KM, 5 KM or 10 KM and run the heart of Indore.',
    type: 'website',
  },
};

export const viewport: Viewport = { themeColor: '#101613' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${ui.variable}`} data-scroll-behavior="smooth">
      <body>
        {/* Without JavaScript, scroll-reveal content would stay hidden. */}
        <noscript><style>{'.reveal{opacity:1!important;transform:none!important}'}</style></noscript>
        {children}
      </body>
    </html>
  );
}

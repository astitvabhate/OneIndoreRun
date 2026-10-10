import type { Metadata } from 'next';
import './globals.css';
import './normal.css';
import './image-placeholders.css';
import './hero-reference.css';
import './official-logo.css';
export const metadata: Metadata = { title: 'One Indore Run | Indore 2.0', description: 'One Indore Run Indore 2.0 — run your distance, celebrate the city and be part of the running community.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }

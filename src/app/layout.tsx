// src/app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import '@/styles/det-rtl.css';
import { getLang } from '@/lib/i18n/server';
import { LangProvider } from '@/lib/i18n/client';

export const metadata: Metadata = {
  title: 'Digital Enterprise Tracker',
  description: 'Institutional project and governance management platform',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

// Inline script injected before paint — reads localStorage and sets data-theme
// so there is never a flash of the wrong theme on reload
const themeScript = `
  (function() {
    try {
      var t = localStorage.getItem('pes-theme') || 'light';
      document.documentElement.setAttribute('data-theme', t);
    } catch(e) {}
  })();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = getLang();
  return (
    <html lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'} data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&family=Noto+Kufi+Arabic:wght@500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body style={{ margin: 0 }}>
        <LangProvider lang={lang}>{children}</LangProvider>
      </body>
    </html>
  );
}

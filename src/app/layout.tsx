// src/app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DGCC Enterprise System',
  description: 'Institutional project and governance management platform',
};

// Inline script injected before paint — reads localStorage and sets data-theme
// so there is never a flash of the wrong theme on reload
const themeScript = `
  (function() {
    try {
      var t = localStorage.getItem('pes-theme') || 'dark';
      document.documentElement.setAttribute('data-theme', t);
    } catch(e) {}
  })();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body style={{ margin: 0 }}>
        {children}
      </body>
    </html>
  );
}

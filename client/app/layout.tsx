import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Virex — Intelligent Secure P2P Network',
  description: 'ISPDN: AI-driven peer selection, real-time threat detection, adaptive data transfer',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ height: '100vh', overflow: 'hidden', background: 'var(--bg-base)' }}>
        {children}
      </body>
    </html>
  );
}

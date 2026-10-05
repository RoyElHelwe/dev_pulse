import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dev Pulse',
  description: 'Collaborative workspace inside a 2D virtual office',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">{children}</body>
    </html>
  );
}

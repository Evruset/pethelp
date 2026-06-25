import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'VetHelp — Портал клиники',
  description: 'Очередь ручного подтверждения записей VetHelp',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}

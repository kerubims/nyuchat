import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/Navbar';

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
});

const mono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'uChat — Stateful Persona Roleplay',
  description: 'Roleplay with persistent memory, Stheno style, and BGE-M3 RAG engine.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${mono.variable} antialiased bg-zinc-950 text-zinc-100 min-h-screen flex flex-col`}>
        <Navbar />
        <div className="flex-1 flex flex-col">{children}</div>
      </body>
    </html>
  );
}

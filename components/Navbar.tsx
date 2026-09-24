'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, Plus, Compass, ChatCircleDots } from '@phosphor-icons/react';

export function Navbar() {
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Dashboard', icon: ChatCircleDots },
    { href: '/characters', label: 'Personas', icon: Compass },
    { href: '/characters/new', label: 'Create', icon: Plus },
    { href: '/profile', label: 'Profile', icon: User },
  ];

  return (
    <header className="h-14 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between px-4 md:px-8">
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="h-7 w-7 rounded-lg bg-zinc-100 text-zinc-950 flex items-center justify-center font-mono font-bold text-xs group-hover:scale-105 transition-transform">
            uC
          </div>
          <span className="font-semibold tracking-tight text-sm text-zinc-100">
            uChat <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest ml-1">v4.5</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {links.map((link) => {
            const Icon = link.icon;
            const active = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  active
                    ? 'bg-zinc-900 text-zinc-100 border border-zinc-800'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
                }`}
              >
                <Icon size={16} weight={active ? 'fill' : 'regular'} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href="/characters/new"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 text-zinc-950 hover:bg-zinc-200 font-medium text-xs transition-colors"
        >
          <Plus size={14} weight="bold" />
          <span>New Persona</span>
        </Link>
      </div>
    </header>
  );
}

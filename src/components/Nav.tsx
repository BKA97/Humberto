"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TickerSearch } from "./TickerSearch";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/morning-brief", label: "Morning Brief" },
  { href: "/active", label: "Active" },
  { href: "/history", label: "History" },
  { href: "/archive", label: "Archive" },
  { href: "/research", label: "Research" },
];

export function Nav() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <header className="sticky top-0 z-20 border-b bg-(--color-surface)/90 backdrop-blur" style={{ borderColor: "var(--border)" }}>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="mr-2 text-sm font-semibold tracking-tight whitespace-nowrap">
          Market Reaction Lab
        </Link>
        <nav className="flex flex-wrap gap-1">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-link ${pathname === link.href ? "nav-link-active" : ""}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto w-full sm:w-72">
          <TickerSearch compact />
        </div>
      </div>
    </header>
  );
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '▦' },
  { href: '/contacts', label: 'Contacts', icon: '👥' },
  { href: '/templates', label: 'Templates', icon: '📄' },
  { href: '/campaigns', label: 'Campaigns', icon: '📧' },
]

const bottomNavItems = [
  { href: '/users', label: 'Users', icon: '👤' },
  { href: '/master-data/divisions', label: 'Divisions', icon: '🏢' },
  { href: '/logs', label: 'Logs', icon: '📋' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
]

export default function Sidebar() {
  const pathname = usePathname()

  const isActive = (href: string) => pathname.startsWith(href)

  const navLinkClass = (href: string) =>
    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive(href)
        ? 'bg-indigo-50 text-indigo-700'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }`

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-white border-r border-gray-200 flex flex-col z-10">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-200">
        <span className="text-xl font-bold text-indigo-600 tracking-tight">PVMailer</span>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} className={navLinkClass(item.href)}>
            <span className="text-base">{item.icon}</span>
            {item.label}
          </Link>
        ))}

        {/* Divider */}
        <div className="pt-3 pb-1">
          <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Admin</p>
        </div>

        {bottomNavItems.map((item) => (
          <Link key={item.href} href={item.href} className={navLinkClass(item.href)}>
            <span className="text-base">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Sign out */}
      <div className="px-3 py-4 border-t border-gray-200">
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          <span>⎋</span>
          Sign out
        </button>
      </div>
    </aside>
  )
}

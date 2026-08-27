'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  LayoutDashboard,
  Users,
  FileText,
  Send,
  UserCog,
  Building2,
  ScrollText,
  Settings,
  LogOut,
  Mail,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/templates', label: 'Templates', icon: FileText },
  { href: '/campaigns', label: 'Campaigns', icon: Send },
]

const bottomNavItems = [
  { href: '/users', label: 'Users', icon: UserCog },
  { href: '/master-data/divisions', label: 'Divisions', icon: Building2 },
  { href: '/logs', label: 'Logs', icon: ScrollText },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()

  const isActive = (href: string) => pathname.startsWith(href)

  const navLinkClass = (href: string) =>
    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
      isActive(href)
        ? 'bg-white/10 text-white'
        : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
    }`

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 flex flex-col z-10"
      style={{ background: 'linear-gradient(180deg, #1e1b4b 0%, #1a1040 100%)' }}>
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Mail size={16} className="text-white" />
          </div>
          <span className="text-base font-bold text-white tracking-tight">PVMailer</span>
        </div>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 relative ${
                active
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}>
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-indigo-400 rounded-r-full" />
              )}
              <Icon size={16} strokeWidth={active ? 2.5 : 2} className={active ? 'text-indigo-400' : ''} />
              {item.label}
            </Link>
          )
        })}

        {/* Divider */}
        <div className="pt-4 pb-1">
          <p className="px-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Admin</p>
        </div>

        {bottomNavItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 relative ${
                active
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}>
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-indigo-400 rounded-r-full" />
              )}
              <Icon size={16} strokeWidth={active ? 2.5 : 2} className={active ? 'text-indigo-400' : ''} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Sign out */}
      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-all duration-150"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  )
}

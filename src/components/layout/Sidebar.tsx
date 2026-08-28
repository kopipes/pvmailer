'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useState } from 'react'
import {
  LayoutDashboard, Users, FileText, Send, UserCog,
  Building2, ScrollText, Settings, LogOut, Mail, Menu, X,
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

function SidebarContent({ onNav }: { onNav?: () => void }) {
  const pathname = usePathname()
  const isActive = (href: string) => pathname.startsWith(href)

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10 shrink-0">
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
            <Link key={item.href} href={item.href} onClick={onNav}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 relative ${
                active ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}>
              {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-indigo-400 rounded-r-full" />}
              <Icon size={16} strokeWidth={active ? 2.5 : 2} className={active ? 'text-indigo-400' : ''} />
              {item.label}
            </Link>
          )
        })}

        <div className="pt-4 pb-1">
          <p className="px-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Admin</p>
        </div>

        {bottomNavItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link key={item.href} href={item.href} onClick={onNav}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 relative ${
                active ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}>
              {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-indigo-400 rounded-r-full" />}
              <Icon size={16} strokeWidth={active ? 2.5 : 2} className={active ? 'text-indigo-400' : ''} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Sign out */}
      <div className="px-3 py-4 border-t border-white/10 shrink-0">
        <button onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-all duration-150">
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </div>
  )
}

export default function Sidebar() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-60 flex-col z-20"
        style={{ background: 'linear-gradient(180deg, #1e1b4b 0%, #1a1040 100%)' }}>
        <SidebarContent />
      </aside>

      {/* Mobile topbar */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-20 h-14 flex items-center px-4 gap-3"
        style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #1a1040 100%)' }}>
        <button onClick={() => setOpen(true)}
          className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center">
            <Mail size={14} className="text-white" />
          </div>
          <span className="text-sm font-bold text-white">PVMailer</span>
        </div>
      </header>

      {/* Mobile drawer overlay */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-30 flex">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          {/* Drawer */}
          <aside className="relative w-64 h-full flex flex-col z-10"
            style={{ background: 'linear-gradient(180deg, #1e1b4b 0%, #1a1040 100%)' }}>
            <button onClick={() => setOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
              <X size={18} />
            </button>
            <SidebarContent onNav={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </>
  )
}

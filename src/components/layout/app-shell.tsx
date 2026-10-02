'use client'

import { useState, useEffect } from 'react'
import {
  Home,
  Compass,
  Bell,
  MessageCircle,
  Bookmark,
  User as UserIcon,
  Settings,
  Shield,
  Plus,
  Search,
  MoreHorizontal,
  LogOut,
  Moon,
  Sun,
  Laptop,
  Users,
} from 'lucide-react'
import { useAuthStore, useViewStore, useThemeStore, type ViewName } from '@/stores/app-store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { TwivterLogo } from '@/components/twivter-logo'
import { ComposeDialog } from '@/components/post/compose-dialog'
import { toast } from 'sonner'

interface NavItem {
  view: ViewName
  label: string
  icon: typeof Home
  badgeKey?: 'notifications' | 'messages'
}

const navItems: NavItem[] = [
  { view: 'home', label: 'Home', icon: Home },
  { view: 'explore', label: 'Explore', icon: Compass },
  { view: 'notifications', label: 'Notifications', icon: Bell, badgeKey: 'notifications' },
  { view: 'messages', label: 'Messages', icon: MessageCircle, badgeKey: 'messages' },
  { view: 'bookmarks', label: 'Bookmarks', icon: Bookmark },
  { view: 'communities', label: 'Communities', icon: Users },
  { view: 'profile', label: 'Profile', icon: UserIcon },
]

export function AppShell({ children, rightSidebar }: { children: React.ReactNode; rightSidebar?: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const view = useViewStore((s) => s.view)
  const navigate = useViewStore((s) => s.navigate)
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)
  const [composeOpen, setComposeOpen] = useState(false)
  const [unreadNotif, setUnreadNotif] = useState(0)
  const [unreadMsg, setUnreadMsg] = useState(0)

  // Poll unread counts (lightweight)
  useEffect(() => {
    if (!user) return
    let cancelled = false
    const poll = async () => {
      try {
        const [n, m] = await Promise.all([
          fetch('/api/notifications?unread=1').then((r) => r.json()),
          fetch('/api/conversations').then((r) => r.json()),
        ])
        if (cancelled) return
        setUnreadNotif(n.unreadCount ?? 0)
        const convs = m.conversations ?? []
        setUnreadMsg(convs.reduce((sum: number, c: any) => sum + (c.unreadCount ?? 0), 0))
      } catch {
        /* ignore */
      }
    }
    poll()
    const id = setInterval(poll, 30_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [user])

  const onNavigate = (item: NavItem) => {
    if (item.view === 'profile' && user) {
      navigate('profile', { profileUsername: user.username })
    } else {
      navigate(item.view)
    }
  }

  const doLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      toast.success('Berhasil logout. Sampai jumpa! 👋')
      window.location.href = '/'
    } catch {
      toast.error('Gagal logout')
    }
  }

  const themeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Laptop
  const ThemeIcon = themeIcon

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── Mobile Header ───────────────────────── */}
      <header className="md:hidden sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <button onClick={() => navigate('home')} className="flex items-center gap-2">
            <TwivterLogo size={28} />
          </button>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => navigate('explore')}
            >
              <Search className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full relative"
              onClick={() => navigate('notifications')}
            >
              <Bell className="h-5 w-5" />
              {unreadNotif > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                  {unreadNotif > 9 ? '9+' : unreadNotif}
                </span>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* ── Main 3-column layout ────────────────── */}
      <div className="flex-1 mx-auto w-full max-w-7xl flex">
        {/* Left sidebar (desktop) */}
        <aside className="hidden md:flex flex-col sticky top-0 h-screen w-20 xl:w-64 shrink-0 border-r border-border px-2 xl:px-4 py-4">
          <button
            onClick={() => navigate('home')}
            className="flex items-center gap-2 px-2 mb-4 self-start"
          >
            <TwivterLogo size={36} />
            <span className="hidden xl:block text-xl font-bold text-gradient-twivter">Twivter</span>
          </button>

          <nav className="flex-1 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = view === item.view
              const badge = item.badgeKey === 'notifications' ? unreadNotif : item.badgeKey === 'messages' ? unreadMsg : 0
              return (
                <button
                  key={item.view}
                  onClick={() => onNavigate(item)}
                  className={cn(
                    'group flex items-center gap-4 px-3 py-2.5 rounded-full transition-colors w-full',
                    'hover:bg-accent hover:text-accent-foreground',
                    active && 'font-semibold',
                    'xl:pr-6 justify-center xl:justify-start'
                  )}
                >
                  <span className="relative">
                    <Icon className={cn('h-6 w-6', active && 'text-primary')} strokeWidth={active ? 2.5 : 2} />
                    {badge > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                        {badge > 9 ? '9+' : badge}
                      </span>
                    )}
                  </span>
                  <span className="hidden xl:inline text-base">{item.label}</span>
                </button>
              )
            })}
            {user?.role === 'admin' && (
              <button
                onClick={() => navigate('admin')}
                className={cn(
                  'flex items-center gap-4 px-3 py-2.5 rounded-full transition-colors w-full hover:bg-accent hover:text-accent-foreground justify-center xl:justify-start',
                  view === 'admin' && 'font-semibold'
                )}
              >
                <Shield className={cn('h-6 w-6', view === 'admin' && 'text-primary')} />
                <span className="hidden xl:inline text-base">Admin</span>
              </button>
            )}
            <button
              onClick={() => navigate('settings')}
              className={cn(
                'flex items-center gap-4 px-3 py-2.5 rounded-full transition-colors w-full hover:bg-accent hover:text-accent-foreground justify-center xl:justify-start',
                view === 'settings' && 'font-semibold'
              )}
            >
              <Settings className={cn('h-6 w-6', view === 'settings' && 'text-primary')} />
              <span className="hidden xl:inline text-base">Settings</span>
            </button>
          </nav>

          <Button
            onClick={() => setComposeOpen(true)}
            className="mt-4 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/20 xl:px-8 xl:py-6 xl:text-base px-0 py-3"
          >
            <Plus className="h-5 w-5 xl:mr-1" />
            <span className="hidden xl:inline">Post</span>
          </Button>

          {/* User menu */}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="mt-4 flex items-center gap-3 p-2 rounded-full hover:bg-accent w-full justify-center xl:justify-start">
                  <Avatar className="h-9 w-9">
                    {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.displayName} /> : null}
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {user.displayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden xl:flex flex-col items-start text-left min-w-0 flex-1">
                    <span className="text-sm font-semibold truncate max-w-full">{user.displayName}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-full">@{user.username}</span>
                  </div>
                  <MoreHorizontal className="hidden xl:block h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">{user.displayName}</span>
                    <span className="text-xs text-muted-foreground">@{user.username}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('profile', { profileUsername: user.username })}>
                  <UserIcon className="mr-2 h-4 w-4" /> Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('settings')}>
                  <Settings className="mr-2 h-4 w-4" /> Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                  <ThemeIcon className="mr-2 h-4 w-4" /> {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={doLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </aside>

        {/* Center content */}
        <main className="flex-1 min-w-0 border-x border-border min-h-screen">
          {children}
        </main>

        {/* Right sidebar (desktop) */}
        {rightSidebar ? (
          <aside className="hidden lg:block w-80 xl:w-96 shrink-0 p-4 sticky top-0 h-screen overflow-y-auto scrollbar-thin">
            {rightSidebar}
          </aside>
        ) : null}
      </div>

      {/* ── Mobile bottom nav ───────────────────── */}
      <nav className="md:hidden sticky bottom-0 z-40 bg-background/90 backdrop-blur-xl border-t border-border">
        <div className="grid grid-cols-5 h-14">
          <MobileNavBtn icon={Home} label="Home" active={view === 'home'} onClick={() => navigate('home')} />
          <MobileNavBtn icon={Compass} label="Explore" active={view === 'explore'} onClick={() => navigate('explore')} />
          <button
            onClick={() => setComposeOpen(true)}
            className="flex items-center justify-center"
            aria-label="Create post"
          >
            <span className="bg-primary text-primary-foreground rounded-full h-9 w-9 flex items-center justify-center shadow-lg shadow-primary/30">
              <Plus className="h-5 w-5" />
            </span>
          </button>
          <MobileNavBtn icon={Bell} label="Notif" active={view === 'notifications'} badge={unreadNotif} onClick={() => navigate('notifications')} />
          <MobileNavBtn
            icon={UserIcon}
            label="Me"
            active={view === 'profile'}
            onClick={() => user && navigate('profile', { profileUsername: user.username })}
          />
        </div>
      </nav>

      <ComposeDialog open={composeOpen} onOpenChange={setComposeOpen} />
    </div>
  )
}

function MobileNavBtn({
  icon: Icon,
  label,
  active,
  onClick,
  badge = 0,
}: {
  icon: typeof Home
  label: string
  active: boolean
  onClick: () => void
  badge?: number
}) {
  return (
    <button onClick={onClick} className="flex flex-col items-center justify-center gap-0.5 relative">
      <span className="relative">
        <Icon className={cn('h-5 w-5', active && 'text-primary')} strokeWidth={active ? 2.5 : 2} />
        {badge > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </span>
      <span className={cn('text-[10px]', active && 'text-primary font-semibold')}>{label}</span>
    </button>
  )
}

// Search box used in right sidebar
export function SearchBox({
  value,
  onChange,
  onSearch,
}: {
  value: string
  onChange: (v: string) => void
  onSearch: () => void
}) {
  return (
    <div className="relative">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSearch()
        }}
        placeholder="Cari di Twivter"
        className="pl-11 rounded-full bg-muted border-transparent focus-visible:bg-background focus-visible:border-primary"
      />
    </div>
  )
}

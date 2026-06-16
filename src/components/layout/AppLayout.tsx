import { ReactNode, useState, useEffect, useRef } from 'react';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Loader2, Search, Bell, FolderKanban, Settings, LogOut } from 'lucide-react';
import { useUnreadNotificationsCount } from '@/hooks/useNotifications';
import { LuminaWidget } from '@/components/chat/LuminaWidget';

interface AppLayoutProps {
  children: ReactNode;
}

interface SearchResult {
  projects: { id: string; name: string; tipo_programa: string | null; is_completed: boolean }[];
  tasks: { id: string; title: string; project_id: string; project_name: string; status_name: string }[];
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, isLoading, signOut } = useAuth();
  const { data: unreadCount = 0 } = useUnreadNotificationsCount();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: searchResults, isFetching } = useQuery<SearchResult>({
    queryKey: ['search', debouncedQuery],
    queryFn: () => api.get(`/api/search?q=${encodeURIComponent(debouncedQuery)}`),
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const hasResults =
    (searchResults?.projects?.length ?? 0) > 0 ||
    (searchResults?.tasks?.length ?? 0) > 0;

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1 overflow-auto">
          <header className="h-14 flex items-center gap-4 border-b border-border bg-card px-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <SidebarTrigger className="-ml-1 rounded-lg" />
            <div className="flex-1 flex items-center justify-center max-w-md mx-4" ref={searchRef}>
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                {isFetching && debouncedQuery.length >= 2 && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                )}
                <Input
                  type="search"
                  placeholder="Buscar proyectos, tareas..."
                  className="pl-9 h-9 rounded-lg bg-muted/50 border-border shadow-sm text-sm"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowResults(true);
                  }}
                  onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
                  onKeyDown={(e) => e.key === 'Escape' && setShowResults(false)}
                />
                {showResults && debouncedQuery.length >= 2 && (
                  <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                    {!hasResults && !isFetching && (
                      <p className="px-4 py-3 text-sm text-muted-foreground">Sin resultados para "{debouncedQuery}"</p>
                    )}
                    {(searchResults?.projects?.length ?? 0) > 0 && (
                      <div>
                        <p className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide bg-muted/40">
                          Proyectos
                        </p>
                        {searchResults!.projects.map((p) => (
                          <button
                            key={p.id}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-muted/60 flex items-center gap-2"
                            onMouseDown={() => {
                              setShowResults(false);
                              setSearchQuery('');
                              navigate(`/projects/${p.id}`);
                            }}
                          >
                            <FolderKanban className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate">{p.name}</span>
                            {p.is_completed && (
                              <span className="ml-auto text-[10px] text-muted-foreground shrink-0">Completado</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                    {(searchResults?.tasks?.length ?? 0) > 0 && (
                      <div>
                        <p className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide bg-muted/40">
                          Tareas
                        </p>
                        {searchResults!.tasks.map((t) => (
                          <button
                            key={t.id}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-muted/60 flex flex-col gap-0.5"
                            onMouseDown={() => {
                              setShowResults(false);
                              setSearchQuery('');
                              navigate(`/projects/${t.project_id}`);
                            }}
                          >
                            <span className="truncate">{t.title}</span>
                            <span className="text-[11px] text-muted-foreground">{t.project_name} · {t.status_name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Link to="/notifications">
                <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-lg">
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-amber-500" />
                  )}
                </Button>
              </Link>
              <Link to="/projects">
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg">
                  <FolderKanban className="h-4 w-4" />
                </Button>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="rounded-full p-0 h-9 w-9">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {getInitials(user.full_name)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-lg">
                  <DropdownMenuLabel className="font-normal">
                    <p className="font-medium">{user.full_name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/settings" className="flex items-center gap-2 cursor-pointer">
                      <Settings className="h-4 w-4" />
                      Configuración
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut()} className="text-destructive focus:text-destructive cursor-pointer">
                    <LogOut className="h-4 w-4 mr-2" />
                    Cerrar sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main
            className="flex-1 relative"
            style={{
              backgroundImage: 'url(./bg_app.png)',
              backgroundSize: 'cover',
              backgroundPosition: 'bottom center',
              backgroundAttachment: 'fixed',
            }}
          >
            {children}
            <LuminaWidget />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

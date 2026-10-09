import { ReactNode, useState, useEffect, useRef, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
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
import { Loader2, Search, Bell, FolderKanban, Settings, LogOut, User as UserIcon } from 'lucide-react';
import { roleLabel, titleForPath } from './navConfig';
import { useDocumentTitle } from '@/hooks/usePageTitle';
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
  const { user, isLoading, signOut, isAdmin, isProjectLeader } = useAuth();
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  // Título de pestaña por ruta (las páginas con título propio, como el detalle de proyecto, lo fijan ellas).
  useDocumentTitle(titleForPath(location.pathname));
  const { data: unreadCount = 0 } = useUnreadNotificationsCount();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
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

  type FlatResult =
    | { kind: 'project'; id: string; label: string }
    | { kind: 'task'; id: string; projectId: string; label: string };

  const flatResults: FlatResult[] = [
    ...(searchResults?.projects ?? []).map((p): FlatResult => ({ kind: 'project', id: p.id, label: p.name })),
    ...(searchResults?.tasks ?? []).map((t): FlatResult => ({ kind: 'task', id: t.id, projectId: t.project_id, label: t.title })),
  ];

  useEffect(() => {
    setActiveIndex(-1);
  }, [searchResults]);

  const selectResult = (result: FlatResult) => {
    setShowResults(false);
    setSearchQuery('');
    setActiveIndex(-1);
    if (result.kind === 'project') {
      navigate(`/projects/${result.id}`);
    } else {
      navigate(`/projects/${result.projectId}?task=${result.id}`);
    }
  };

  const handleSearchKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setShowResults(false);
      return;
    }
    if (!showResults || flatResults.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      selectResult(flatResults[activeIndex]);
    }
  };

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
          <button
            type="button"
            className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-floating focus:ring-2 focus:ring-ring"
            onClick={() => mainRef.current?.focus()}
          >
            Saltar al contenido
          </button>
          <header className="min-h-14 flex items-center gap-2 sm:gap-4 border-b border-border bg-card px-3 sm:px-4 shadow-card">
            <SidebarTrigger className="-ml-1 rounded-lg" />
            <div className="flex-1 min-w-0 flex items-center justify-center max-w-md mx-1 sm:mx-4" ref={searchRef}>
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                {isFetching && debouncedQuery.length >= 2 && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                )}
                <Input
                  type="search"
                  role="combobox"
                  aria-label="Buscar proyectos y tareas"
                  aria-expanded={showResults && debouncedQuery.length >= 2}
                  aria-controls="global-search-listbox"
                  aria-autocomplete="list"
                  aria-activedescendant={activeIndex >= 0 ? `global-search-option-${activeIndex}` : undefined}
                  placeholder="Buscar proyectos, tareas..."
                  className="pl-9 h-9 rounded-lg bg-muted/50 border-border shadow-card text-sm"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowResults(true);
                  }}
                  onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
                  onKeyDown={handleSearchKeyDown}
                />
                {showResults && debouncedQuery.length >= 2 && (
                  <div
                    id="global-search-listbox"
                    role="listbox"
                    aria-label="Resultados de búsqueda"
                    className="absolute top-full mt-1 left-0 right-0 z-50 bg-card border border-border rounded-xl shadow-floating overflow-hidden"
                  >
                    {!hasResults && !isFetching && (
                      <p className="px-4 py-3 text-sm text-muted-foreground">Sin resultados para "{debouncedQuery}"</p>
                    )}
                    {(searchResults?.projects?.length ?? 0) > 0 && (
                      <div>
                        <p className="px-3 py-1.5 text-2xs font-semibold text-muted-foreground bg-muted/40">
                          Proyectos
                        </p>
                        {searchResults!.projects.map((p, i) => (
                          <button
                            key={p.id}
                            id={`global-search-option-${i}`}
                            role="option"
                            aria-selected={activeIndex === i}
                            className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 focus:outline-none ${activeIndex === i ? 'bg-muted/70' : 'hover:bg-muted/60'}`}
                            onMouseEnter={() => setActiveIndex(i)}
                            onMouseDown={() => selectResult({ kind: 'project', id: p.id, label: p.name })}
                          >
                            <FolderKanban className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate">{p.name}</span>
                            {p.is_completed && (
                              <span className="ml-auto text-2xs text-muted-foreground shrink-0">Completado</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                    {(searchResults?.tasks?.length ?? 0) > 0 && (
                      <div>
                        <p className="px-3 py-1.5 text-2xs font-semibold text-muted-foreground bg-muted/40">
                          Tareas
                        </p>
                        {searchResults!.tasks.map((t, ti) => {
                          const i = (searchResults?.projects?.length ?? 0) + ti;
                          return (
                            <button
                              key={t.id}
                              id={`global-search-option-${i}`}
                              role="option"
                              aria-selected={activeIndex === i}
                              className={`w-full text-left px-4 py-2 text-sm flex flex-col gap-0.5 focus:outline-none ${activeIndex === i ? 'bg-muted/70' : 'hover:bg-muted/60'}`}
                              onMouseEnter={() => setActiveIndex(i)}
                              onMouseDown={() => selectResult({ kind: 'task', id: t.id, projectId: t.project_id, label: t.title })}
                            >
                              <span className="truncate">{t.title}</span>
                              <span className="text-2xs text-muted-foreground">{t.project_name} · {t.status_name}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="relative h-11 w-11 md:h-9 md:w-9 rounded-lg"
              >
                <Link
                  to="/notifications"
                  aria-label={unreadCount > 0 ? `Notificaciones (${unreadCount} sin leer)` : 'Notificaciones'}
                >
                  <Bell className="h-4 w-4" aria-hidden="true" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-coral-strong" aria-hidden="true" />
                  )}
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" aria-label="Menú de cuenta" className="rounded-full p-0 h-11 w-11 md:h-9 md:w-9">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.avatar_url || undefined} alt="" />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {getInitials(user.full_name)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-floating">
                  <DropdownMenuLabel className="font-normal">
                    <p className="font-medium truncate">{user.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    <p className="text-xs text-muted-foreground">{roleLabel(!!isAdmin, !!isProjectLeader)}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="flex items-center gap-2 cursor-pointer">
                      <UserIcon className="h-4 w-4" aria-hidden="true" />
                      Perfil
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/settings" className="flex items-center gap-2 cursor-pointer">
                      <Settings className="h-4 w-4" />
                      Configuración
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut()} className="text-destructive-strong focus:text-destructive-strong cursor-pointer">
                    <LogOut className="h-4 w-4 mr-2" />
                    Cerrar sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main
            id="main-content"
            ref={mainRef}
            tabIndex={-1}
            className="flex-1 relative bg-background focus:outline-none"
            style={{
              backgroundImage: 'linear-gradient(180deg, hsl(var(--background) / 0.94), hsl(var(--background) / 0.94)), url(./bg_app.webp)',
              backgroundSize: 'auto, cover',
              backgroundAttachment: 'scroll, scroll',
              backgroundPosition: 'center, center',
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

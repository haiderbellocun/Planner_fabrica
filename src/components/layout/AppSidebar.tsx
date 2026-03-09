import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUnreadNotificationsCount } from '@/hooks/useNotifications';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { NavLink } from '@/components/NavLink';
import {
  LayoutGrid,
  FolderKanban,
  ListTodo,
  BarChart3,
  Calculator,
  Settings,
  LogOut,
  Bell,
  User,
  GitBranch,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const baseNavItems = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutGrid },
  { title: 'Proyectos', url: '/projects', icon: FolderKanban },
  { title: 'Mis Tareas', url: '/my-tasks', icon: ListTodo },
];

const reportsNavItem = { title: 'Reportes', url: '/reports', icon: BarChart3 };

const baseNavItemsWithReports = (showReports: boolean) =>
  showReports ? [...baseNavItems, reportsNavItem] : baseNavItems;

const leaderNavItems = [
  { title: 'Calculadora', url: '/calculator', icon: Calculator },
];

const adminFlowNavItems = [
  { title: 'Flujo', url: '/flows', icon: GitBranch },
];

const settingsNavItems = [
  { title: 'Configuración', url: '/settings', icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { profile, signOut, isAdmin, isProjectLeader } = useAuth();
  const { data: unreadCount = 0 } = useUnreadNotificationsCount();

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-white/10 bg-[#0DD9D0]">
        <SidebarHeader className="border-b border-white/20 px-3 py-4">
          <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 shadow-sm">
            <img src="./logo.png" alt="FC" className="h-8 w-8 object-contain" />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold uppercase tracking-wide text-white/90">Dirección Ops</span>
              <span className="font-semibold text-sm text-white/90 leading-tight truncate">Fábrica de Contenido</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sm font-semibold uppercase tracking-wide text-white/90 px-2 mb-1">Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {[...baseNavItemsWithReports(isAdmin || isProjectLeader),
                ...(isAdmin || isProjectLeader ? leaderNavItems : []),
                ...(isAdmin ? adminFlowNavItems : []),
              ].map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[15px] font-medium text-white/90 hover:bg-white/10 [&>svg]:text-white/90"
                      activeClassName="bg-white/15 border border-white/20 rounded-xl text-white [&>svg]:text-white"
                    >
                      <item.icon className="h-[18px] w-[18px]" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-sm font-semibold uppercase tracking-wide text-white/90 px-2 mb-1">Sistema</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname === '/notifications'}>
                  <NavLink
                    to="/notifications"
                    className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[15px] font-medium text-white/90 hover:bg-white/10 [&>svg]:text-white/90"
                    activeClassName="bg-white/15 border border-white/20 rounded-xl text-white [&>svg]:text-white"
                  >
                    <div className="relative">
                      <Bell className="h-[18px] w-[18px]" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-amber-500 text-[10px] font-medium text-white flex items-center justify-center">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </div>
                    <span>Notificaciones</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {settingsNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[15px] font-medium text-white/90 hover:bg-white/10 [&>svg]:text-white/90"
                      activeClassName="bg-white/15 border border-white/20 rounded-xl text-white [&>svg]:text-white"
                    >
                      <item.icon className="h-[18px] w-[18px]" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-white/20">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-2 px-2 text-white/90 hover:bg-white/10 hover:text-white">
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-white/20 text-white text-xs">
                  {getInitials(profile?.full_name)}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="flex flex-col items-start text-left overflow-hidden">
                  <span className="text-sm font-medium truncate max-w-[140px] text-white/90">
                    {profile?.full_name || 'Usuario'}
                  </span>
                  <span className="text-xs text-white/70 truncate max-w-[140px]">
                    {isAdmin ? 'Administrador' : 'Usuario'}
                  </span>
                </div>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/profile" className="flex items-center gap-2 cursor-pointer">
                <User className="h-4 w-4" />
                <span>Perfil</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/settings" className="flex items-center gap-2 cursor-pointer">
                <Settings className="h-4 w-4" />
                <span>Configuración</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut()}
              className="text-destructive focus:text-destructive cursor-pointer"
            >
              <LogOut className="h-4 w-4 mr-2" />
              <span>Cerrar Sesión</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

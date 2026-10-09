import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUnreadNotificationsCount } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import { getInitials } from '@/lib/names';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getNavGroups, isNavItemActive, roleLabel, type NavItem } from './navConfig';

// Navegación principal (Mi trabajo, Producción, Gestión) y accesos secundarios («Más»), con menos
// peso visual y separados. El menú de cuenta (Perfil, Configuración, Cerrar sesión) vive solo en el
// encabezado; aquí el pie es un acceso directo al perfil, no un segundo menú.

const ITEM_BASE =
  'flex min-h-11 md:min-h-10 items-center gap-2.5 rounded-xl px-2.5 py-2 font-medium transition-[background-color,color] duration-press ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white';

export function AppSidebar() {
  const location = useLocation();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { profile, isAdmin, isProjectLeader } = useAuth();
  const { data: unreadCount = 0 } = useUnreadNotificationsCount();
  const canManage = !!(isAdmin || isProjectLeader);
  const groups = getNavGroups({ canManage });

  const renderItem = (item: NavItem, secondary: boolean) => {
    const active = isNavItemActive(location.pathname, item.url);
    const unread = item.badge === 'notifications' ? unreadCount : 0;
    return (
      <SidebarMenuItem key={item.url}>
        <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
          <NavLink
            to={item.url}
            aria-current={active ? 'page' : undefined}
            className={cn(
              ITEM_BASE,
              secondary ? 'text-sm' : 'text-base',
              active
                ? 'bg-white/15 border border-white/20 text-white'
                : 'border border-transparent text-white/90 hover:bg-white/10 hover:text-white',
            )}
          >
            <span className="relative shrink-0">
              <item.icon className={secondary ? 'h-4 w-4' : 'h-[18px] w-[18px]'} aria-hidden="true" />
              {unread > 0 && collapsed && (
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-coral-strong ring-2 ring-sidebar" aria-hidden="true" />
              )}
            </span>
            <span className="flex-1 truncate">{item.title}</span>
            {unread > 0 && !collapsed && (
              <span aria-hidden="true" className="min-w-5 rounded-full bg-coral-strong px-1.5 text-center text-2xs font-semibold leading-5 text-white">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
            {unread > 0 && <span className="sr-only">{unread} sin leer</span>}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-white/10 bg-sidebar">
      <div
        className="flex h-full flex-col"
        style={{
          backgroundImage: 'linear-gradient(180deg, rgba(4,58,56,0.2), rgba(4,58,56,0.2)), url(./deco_coral.webp)',
          backgroundSize: 'cover, cover',
          backgroundPosition: 'center, center',
          backgroundRepeat: 'no-repeat, no-repeat',
        }}
      >
        <SidebarHeader className="border-b border-white/20 px-3 py-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 shadow-card">
              <img src="./logo_foca.webp" alt="FC" className="h-8 w-8 object-contain" />
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold text-white/90">Dirección Ops</span>
                <span className="font-semibold text-sm text-white/90 leading-tight truncate">Fábrica de Contenido</span>
              </div>
            )}
          </div>
        </SidebarHeader>

        <SidebarContent className="px-2 py-3 bg-transparent">
          <nav aria-label="Navegación principal" className="flex flex-1 flex-col">
            {groups.map((group) => (
              <SidebarGroup
                key={group.id}
                className={cn(group.secondary && 'mt-auto border-t border-white/15 pt-3')}
              >
                <SidebarGroupLabel
                  className={cn('px-2 mb-1 text-xs font-semibold', group.secondary ? 'text-white/80' : 'text-white/90')}
                >
                  {group.label}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="space-y-0.5">
                    {group.items.map((item) => renderItem(item, !!group.secondary))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </nav>
        </SidebarContent>

        <SidebarFooter className="border-t border-white/20">
          <Link
            to="/profile"
            aria-label={`Mi perfil: ${profile?.full_name || 'Usuario'}`}
            title={collapsed ? profile?.full_name || 'Mi perfil' : undefined}
            className="flex min-h-11 items-center gap-2 rounded-xl px-2 py-1.5 text-white/90 transition-colors duration-press hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={profile?.avatar_url || undefined} alt="" />
              <AvatarFallback className="bg-white/20 text-white text-xs">{getInitials(profile?.full_name)}</AvatarFallback>
            </Avatar>
            {!collapsed && (
              <span className="flex min-w-0 flex-col text-left">
                <span className="truncate text-sm font-medium">{profile?.full_name || 'Usuario'}</span>
                <span className="truncate text-xs text-white/80">{roleLabel(!!isAdmin, !!isProjectLeader)}</span>
              </span>
            )}
          </Link>
        </SidebarFooter>
      </div>
    </Sidebar>
  );
}

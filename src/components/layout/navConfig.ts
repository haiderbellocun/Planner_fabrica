import {
  BarChart3, Bell, CalendarClock, CalendarDays, Calculator, FolderKanban, LayoutGrid, ListTodo,
  Megaphone, PackageCheck, Settings, Users, type LucideIcon,
} from 'lucide-react';

// Configuración de navegación (sin React) para poder probar permisos, orden y rutas.
// Las rutas, los permisos y las opciones son los de siempre; solo cambia la agrupación visual.

export interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  /** Muestra el contador de notificaciones sin leer. */
  badge?: 'notifications';
}

export interface NavGroup {
  id: 'trabajo' | 'produccion' | 'gestion' | 'mas';
  label: string;
  items: NavItem[];
  /** Accesos secundarios: se muestran con menos peso visual y separados de la navegación principal. */
  secondary?: boolean;
}

const INICIO: NavItem = { title: 'Inicio', url: '/dashboard', icon: LayoutGrid };
const MIS_TAREAS: NavItem = { title: 'Mis Tareas', url: '/my-tasks', icon: ListTodo };
const CALENDARIO: NavItem = { title: 'Calendario', url: '/calendar', icon: CalendarDays };
const NOTIFICACIONES: NavItem = { title: 'Notificaciones', url: '/notifications', icon: Bell, badge: 'notifications' };
const PROYECTOS: NavItem = { title: 'Proyectos', url: '/projects', icon: FolderKanban };
const PROXIMOS: NavItem = { title: 'Próximos Proyectos', url: '/proximos-programas', icon: CalendarClock };
const EQUIPOS: NavItem = { title: 'Equipos', url: '/equipos', icon: Users };
const REPORTES: NavItem = { title: 'Reportes', url: '/reports', icon: BarChart3 };
const CALCULADORA: NavItem = { title: 'Calculadora', url: '/calculator', icon: Calculator };
const ENTREGAS: NavItem = { title: 'Registro de Entregas', url: '/entregas', icon: PackageCheck };
const MARKETING: NavItem = { title: 'Solicitudes de Marketing', url: '/solicitudes-marketing', icon: Megaphone };
const CONFIGURACION: NavItem = { title: 'Configuración', url: '/settings', icon: Settings };

/**
 * Visibilidad por permisos (igual que antes):
 *  - Mi trabajo y Producción/Proyectos: todos. «Próximos Proyectos», Gestión y los accesos
 *    adicionales: solo administradores y líderes. Configuración: todos.
 */
export function getNavGroups({ canManage }: { canManage: boolean }): NavGroup[] {
  const groups: NavGroup[] = [
    { id: 'trabajo', label: 'Mi trabajo', items: [INICIO, MIS_TAREAS, CALENDARIO, NOTIFICACIONES] },
    { id: 'produccion', label: 'Producción', items: canManage ? [PROYECTOS, PROXIMOS] : [PROYECTOS] },
  ];
  if (canManage) groups.push({ id: 'gestion', label: 'Gestión', items: [EQUIPOS, REPORTES, CALCULADORA] });
  groups.push({
    id: 'mas',
    label: 'Más',
    secondary: true,
    items: canManage ? [ENTREGAS, MARKETING, CONFIGURACION] : [CONFIGURACION],
  });
  return groups;
}

/** «Proyectos» sigue resaltado dentro del detalle (/projects/:id); el resto usa ruta exacta. */
export function isNavItemActive(pathname: string, url: string): boolean {
  if (url === '/projects') return pathname === '/projects' || pathname.startsWith('/projects/');
  if (url === '/equipos') return pathname === '/equipos' || pathname.startsWith('/equipos/');
  return pathname === url;
}

export function roleLabel(isAdmin: boolean, isProjectLeader: boolean): string {
  if (isAdmin) return 'Administrador';
  if (isProjectLeader) return 'Líder de proyecto';
  return 'Colaborador';
}

// ---------- Títulos de página ----------

const ROUTE_TITLES: Record<string, string> = {
  '/dashboard': 'Inicio',
  '/my-tasks': 'Mis tareas',
  '/calendar': 'Calendario',
  '/notifications': 'Notificaciones',
  '/projects': 'Proyectos',
  '/proximos-programas': 'Próximos proyectos',
  '/equipos': 'Equipos',
  '/reports': 'Reportes',
  '/calculator': 'Calculadora',
  '/entregas': 'Registro de entregas',
  '/solicitudes-marketing': 'Solicitudes de marketing',
  '/settings': 'Configuración',
  '/profile': 'Mi perfil',
  '/flows': 'Flujos',
};

export const APP_NAME = 'Planner Fábrica';

/**
 * Título de pestaña por ruta. Devuelve null en rutas con título propio (/projects/:id: el nombre
 * del proyecto lo fija la página) para que el layout no lo pise.
 */
export function titleForPath(pathname: string): string | null {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (/^\/projects\/[^/]+$/.test(clean)) return null;
  if (/^\/equipos\/[^/]+\/plan$/.test(clean)) return `Plan semanal · ${APP_NAME}`;
  const t = ROUTE_TITLES[clean];
  return t ? `${t} · ${APP_NAME}` : null;
}

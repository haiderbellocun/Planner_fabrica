import { useState, useMemo, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { MiniCalendar, type CalendarEvent } from '@/components/ui/MiniCalendar';
import { CreateProjectWizard } from '@/components/project/CreateProjectWizard';
import { DIALOG_SIZES } from '@/lib/dialogSizes';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { format, isPast, isWithinInterval, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  CalendarClock,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Search,
  CalendarDays,
  TableProperties,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  useProximosProgramas,
  useCreateProximoPrograma,
  useUpdateProximoPrograma,
  useDeleteProximoPrograma,
  type ProximoPrograma,
  type ProximoProgramaInput,
  type NivelPrograma,
  type ClasificacionPrograma,
  type Modalidad,
  type Prioridad,
  type EstadoPrograma,
} from '@/hooks/useProximosProgramas';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

// ─── Label maps ───────────────────────────────────────────────────────────────

const NIVEL_LABELS: Record<NivelPrograma, string> = {
  pregrado: 'Pregrado',
  especializacion: 'Especialización',
  maestria: 'Maestría',
  doctorado: 'Doctorado',
  diplomado: 'Diplomado',
  curso_rapido: 'Curso Rápido',
};

const CLASIFICACION_LABELS: Record<ClasificacionPrograma, string> = {
  nuevo: 'Nuevo',
  renovacion: 'Renovación',
};

const MODALIDAD_LABELS: Record<Modalidad, string> = {
  virtual: 'Virtual',
  hibrida: 'Híbrida',
  presencial: 'Presencial',
};

const PRIORIDAD_CONFIG: Record<Prioridad, { label: string; className: string }> = {
  alta: { label: 'Alta', className: 'bg-red-100 text-red-700 border-red-200' },
  media: { label: 'Media', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  baja: { label: 'Baja', className: 'bg-green-100 text-green-700 border-green-200' },
};

const ESTADO_CONFIG: Record<EstadoPrograma, { label: string; className: string }> = {
  pendiente: { label: 'Pendiente', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  en_proceso: { label: 'En Proceso', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  completado: { label: 'Completado', className: 'bg-teal-100 text-teal-700 border-teal-200' },
};

// ─── Blank form ────────────────────────────────────────────────────────────────

const BLANK_FORM: ProximoProgramaInput = {
  escuela: '',
  nivel_programa: 'pregrado',
  clasificacion_programa: 'nuevo',
  programa_con_cambio: null,
  programa_sin_cambio: null,
  modalidad: 'virtual',
  cantidad_asignaturas: 0,
  fecha_envio_curriculo: '',
  prioridad: 'media',
  estado: 'pendiente',
  dependencia: null,
  link: null,
  notas: null,
};

// Parsea la fecha de forma segura sin importar si viene con o sin hora
function parseDate(s: string): Date {
  return new Date(s.slice(0, 10) + 'T00:00:00');
}

// ─── Sort helpers ──────────────────────────────────────────────────────────────

type SortKey = keyof ProximoPrograma | '';
type SortDir = 'asc' | 'desc';

function sortPrograms(
  items: ProximoPrograma[],
  key: SortKey,
  dir: SortDir,
): ProximoPrograma[] {
  if (!key) return items;
  return [...items].sort((a, b) => {
    let av: any = a[key as keyof ProximoPrograma];
    let bv: any = b[key as keyof ProximoPrograma];
    if (key === 'prioridad') {
      const order: Record<Prioridad, number> = { alta: 1, media: 2, baja: 3 };
      av = order[av as Prioridad] ?? 9;
      bv = order[bv as Prioridad] ?? 9;
    }
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return dir === 'asc' ? cmp : -cmp;
  });
}

// ─── Date urgency helper ────────────────────────────────────────────────────────

function dateUrgencyClass(dateStr: string, estado: EstadoPrograma): string {
  if (estado === 'completado') return '';
  const date = parseDate(dateStr);
  if (isPast(date)) return 'text-red-600 font-semibold';
  if (isWithinInterval(date, { start: new Date(), end: addDays(new Date(), 14) }))
    return 'text-amber-600 font-medium';
  return '';
}

// ─── SortHeader ────────────────────────────────────────────────────────────────

function SortHeader({
  label,
  colKey,
  sortKey,
  sortDir,
  onSort,
  className,
}: {
  label: string;
  colKey: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = sortKey === colKey;
  return (
    <TableHead
      className={cn('cursor-pointer select-none whitespace-nowrap', className)}
      onClick={() => onSort(colKey)}
    >
      <div className="flex items-center gap-1">
        {label}
        {active ? (
          sortDir === 'asc' ? (
            <ChevronUp className="h-3.5 w-3.5 text-primary" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-primary" />
          )
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
        )}
      </div>
    </TableHead>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function ProximosProgramasPage() {
  const { isAdmin, isProjectLeader } = useAuth();
  const canEdit = isAdmin || isProjectLeader;

  if (!isAdmin && !isProjectLeader) {
    return <Navigate to="/dashboard" replace />;
  }

  const { data: programas = [], isLoading } = useProximosProgramas();
  const createMutation = useCreateProximoPrograma();
  const updateMutation = useUpdateProximoPrograma();
  const deleteMutation = useDeleteProximoPrograma();

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProximoPrograma | null>(null);
  const [form, setForm] = useState<ProximoProgramaInput>(BLANK_FORM);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<ProximoPrograma | null>(null);

  // Panel de detalle al hacer clic en una fila
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailPrograma, setDetailPrograma] = useState<ProximoPrograma | null>(null);

  // Wizard de creación de proyecto (se abre desde el panel de detalle)
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardSource, setWizardSource] = useState<ProximoPrograma | null>(null);

  const openDetail = useCallback((p: ProximoPrograma) => {
    setDetailPrograma(p);
    setDetailOpen(true);
  }, []);

  const openWizardFromDetail = useCallback(() => {
    if (!detailPrograma) return;
    setDetailOpen(false);
    setWizardSource(detailPrograma);
    setWizardOpen(true);
  }, [detailPrograma]);

  const handleWizardSuccess = useCallback(async () => {
    if (!wizardSource) return;
    await updateMutation.mutateAsync({ id: wizardSource.id, estado: 'completado' });
    setWizardSource(null);
  }, [wizardSource, updateMutation]);

  const [view, setView] = useState<'table' | 'calendar'>('table');

  // Filters — completados ocultos por defecto
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState<EstadoPrograma | 'todos' | 'activos'>('activos');
  const [filterPrioridad, setFilterPrioridad] = useState<Prioridad | 'todos'>('todos');

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>('fecha_envio_curriculo');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const filtered = useMemo(() => {
    let list = [...programas];
    if (filterEstado === 'activos') list = list.filter((p) => p.estado !== 'completado');
    else if (filterEstado !== 'todos') list = list.filter((p) => p.estado === filterEstado);
    if (filterPrioridad !== 'todos') list = list.filter((p) => p.prioridad === filterPrioridad);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.escuela.toLowerCase().includes(q) ||
          (p.programa_con_cambio ?? '').toLowerCase().includes(q) ||
          (p.programa_sin_cambio ?? '').toLowerCase().includes(q),
      );
    }
    return sortPrograms(list, sortKey, sortDir);
  }, [programas, filterEstado, filterPrioridad, search, sortKey, sortDir]);

  function openCreate() {
    setEditTarget(null);
    setForm(BLANK_FORM);
    setDialogOpen(true);
  }

  function openEdit(p: ProximoPrograma) {
    setEditTarget(p);
    setForm({
      escuela: p.escuela,
      nivel_programa: p.nivel_programa,
      clasificacion_programa: p.clasificacion_programa,
      programa_con_cambio: p.programa_con_cambio,
      programa_sin_cambio: p.programa_sin_cambio,
      modalidad: p.modalidad,
      cantidad_asignaturas: p.cantidad_asignaturas,
      fecha_envio_curriculo: p.fecha_envio_curriculo.slice(0, 10),
      prioridad: p.prioridad,
      estado: p.estado,
      dependencia: p.dependencia,
      link: p.link,
      notas: p.notas,
    });
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!form.escuela || !form.fecha_envio_curriculo) return;
    if (editTarget) {
      await updateMutation.mutateAsync({ id: editTarget.id, ...form });
    } else {
      await createMutation.mutateAsync(form);
    }
    setDialogOpen(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteMutation.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // Stats
  const total = programas.length;
  const pendientes = programas.filter((p) => p.estado === 'pendiente').length;
  const proximos14 = programas.filter((p) => {
    const d = parseDate(p.fecha_envio_curriculo);
    return (
      p.estado !== 'completado' &&
      isWithinInterval(d, { start: new Date(), end: addDays(new Date(), 14) })
    );
  }).length;
  const vencidos = programas.filter((p) => {
    const d = parseDate(p.fecha_envio_curriculo);
    return p.estado !== 'completado' && isPast(d);
  }).length;

  return (
    <div className="page-container">
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <CalendarClock className="h-6 w-6 text-primary" />
            Próximos Proyectos
          </h1>
          <p className="page-description">
            Pipeline de proyectos que ingresan a la Fábrica de Contenido, ordenados por fecha y prioridad.
          </p>
        </div>
        {canEdit && (
          <Button onClick={openCreate} className="flex items-center gap-2 shrink-0">
            <Plus className="h-4 w-4" />
            Agregar programa
          </Button>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', value: total, color: 'text-foreground' },
          { label: 'Pendientes', value: pendientes, color: 'text-slate-600' },
          { label: 'Próximos 14 días', value: proximos14, color: 'text-amber-600' },
          { label: 'Vencidos', value: vencidos, color: 'text-red-600' },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border bg-card p-4 shadow-sm"
          >
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{s.label}</p>
            <p className={cn('text-3xl font-semibold mt-1', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters + view toggle */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por escuela o programa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <Select
          value={filterEstado}
          onValueChange={(v) => setFilterEstado(v as EstadoPrograma | 'todos' | 'activos')}
        >
          <SelectTrigger className="h-9 w-44">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="activos">Activos (sin completar)</SelectItem>
            <SelectItem value="todos">Todos los estados</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="en_proceso">En Proceso</SelectItem>
            <SelectItem value="completado">Completado</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filterPrioridad}
          onValueChange={(v) => setFilterPrioridad(v as Prioridad | 'todos')}
        >
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder="Prioridad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Toda prioridad</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
            <SelectItem value="media">Media</SelectItem>
            <SelectItem value="baja">Baja</SelectItem>
          </SelectContent>
        </Select>

        {/* View toggle */}
        <div className="flex border rounded-lg overflow-hidden ml-auto">
          <Button
            variant={view === 'table' ? 'default' : 'ghost'}
            size="sm"
            className="rounded-none gap-1.5 px-3"
            onClick={() => setView('table')}
          >
            <TableProperties className="h-4 w-4" /> Tabla
          </Button>
          <Button
            variant={view === 'calendar' ? 'default' : 'ghost'}
            size="sm"
            className="rounded-none gap-1.5 px-3"
            onClick={() => setView('calendar')}
          >
            <CalendarDays className="h-4 w-4" /> Calendario
          </Button>
        </div>
      </div>

      {/* Calendar view */}
      {view === 'calendar' && (() => {
        const PRIORIDAD_COLORS: Record<string, string> = {
          alta:  'bg-red-500',
          media: 'bg-amber-400',
          baja:  'bg-green-500',
        };
        const calEvents: CalendarEvent[] = filtered.map((p) => ({
          id:    p.id,
          date:  p.fecha_envio_curriculo.slice(0, 10),
          label: `${p.escuela} · ${p.nivel_programa}`,
          color: PRIORIDAD_COLORS[p.prioridad] ?? 'bg-primary',
          onClick: () => openDetail(p),
        }));
        return (
          <div className="space-y-3 mb-4">
            <div className="flex gap-4 flex-wrap text-xs text-slate-500">
              {[
                { label: 'Alta prioridad',  color: 'bg-red-500'   },
                { label: 'Media prioridad', color: 'bg-amber-400' },
                { label: 'Baja prioridad',  color: 'bg-green-500' },
              ].map((l) => (
                <span key={l.label} className="flex items-center gap-1.5">
                  <span className={cn('h-2.5 w-2.5 rounded-full', l.color)} />
                  {l.label}
                </span>
              ))}
            </div>
            <MiniCalendar events={calEvents} />
          </div>
        );
      })()}

      {/* Table */}
      {view === 'table' && <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <CalendarClock className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium">
              {programas.length === 0
                ? 'Aún no hay programas registrados'
                : 'Sin resultados para los filtros aplicados'}
            </p>
            {canEdit && programas.length === 0 && (
              <Button variant="outline" size="sm" className="mt-4" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1" />
                Agregar el primero
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <SortHeader label="Escuela" colKey="escuela" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="min-w-[160px]" />
                <SortHeader label="Nivel" colKey="nivel_programa" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Clasificación" colKey="clasificacion_programa" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <TableHead className="min-w-[180px]">Prog. con Cambio</TableHead>
                <TableHead className="min-w-[180px]">Prog. sin Cambio</TableHead>
                <SortHeader label="Modalidad" colKey="modalidad" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="# Asignaturas" colKey="cantidad_asignaturas" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="text-center" />
                <SortHeader label="Fecha Envío Currículo" colKey="fecha_envio_curriculo" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="min-w-[160px]" />
                <TableHead className="min-w-[140px]">Dependencia</TableHead>
                <TableHead className="w-16 text-center">Link</TableHead>
                <SortHeader label="Prioridad" colKey="prioridad" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Estado" colKey="estado" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                {canEdit && <TableHead className="w-20 text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow
                  key={p.id}
                  className="hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => openDetail(p)}
                  title="Ver detalle"
                >
                  <TableCell className="font-medium">{p.escuela}</TableCell>
                  <TableCell className="whitespace-nowrap">{NIVEL_LABELS[p.nivel_programa]}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs',
                        p.clasificacion_programa === 'nuevo'
                          ? 'border-teal-300 text-teal-700 bg-teal-50'
                          : 'border-orange-300 text-orange-700 bg-orange-50',
                      )}
                    >
                      {CLASIFICACION_LABELS[p.clasificacion_programa]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.programa_con_cambio ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="line-clamp-1 max-w-[180px] block cursor-default text-primary">
                            {p.programa_con_cambio}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          {p.programa_con_cambio}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.programa_sin_cambio ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="line-clamp-1 max-w-[180px] block cursor-default">
                            {p.programa_sin_cambio}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          {p.programa_sin_cambio}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                  <TableCell>{MODALIDAD_LABELS[p.modalidad]}</TableCell>
                  <TableCell className="text-center">{p.cantidad_asignaturas}</TableCell>
                  <TableCell
                    className={cn(
                      'whitespace-nowrap text-sm',
                      dateUrgencyClass(p.fecha_envio_curriculo, p.estado),
                    )}
                  >
                    {format(parseDate(p.fecha_envio_curriculo), 'dd/MM/yyyy', { locale: es })}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {p.dependencia ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {p.link ? (
                      <a
                        href={p.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center justify-center h-6 w-6 rounded text-primary hover:bg-primary/10 transition-colors"
                        title={p.link}
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                          <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                        </svg>
                      </a>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn('text-xs', PRIORIDAD_CONFIG[p.prioridad].className)}
                    >
                      {PRIORIDAD_CONFIG[p.prioridad].label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn('text-xs', ESTADO_CONFIG[p.estado].className)}
                    >
                      {ESTADO_CONFIG[p.estado].label}
                    </Badge>
                  </TableCell>
                  {canEdit && (
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEdit(p)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(p)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>}

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className={`${DIALOG_SIZES.lg} max-h-[90vh] overflow-y-auto`}>
          <DialogHeader>
            <DialogTitle>
              {editTarget ? 'Editar programa' : 'Agregar próximo programa'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            {/* Escuela */}
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="escuela">
                Escuela <span className="text-destructive">*</span>
              </Label>
              <Input
                id="escuela"
                value={form.escuela}
                onChange={(e) => setForm((f) => ({ ...f, escuela: e.target.value }))}
                placeholder="Ej. Escuela de Ingeniería"
              />
            </div>

            {/* Nivel */}
            <div className="space-y-1.5">
              <Label>Nivel de programa <span className="text-destructive">*</span></Label>
              <Select
                value={form.nivel_programa}
                onValueChange={(v) => setForm((f) => ({ ...f, nivel_programa: v as NivelPrograma }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pregrado">Pregrado</SelectItem>
                  <SelectItem value="especializacion">Especialización</SelectItem>
                  <SelectItem value="maestria">Maestría</SelectItem>
                  <SelectItem value="doctorado">Doctorado</SelectItem>
                  <SelectItem value="diplomado">Diplomado</SelectItem>
                  <SelectItem value="curso_rapido">Curso Rápido</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Clasificación */}
            <div className="space-y-1.5">
              <Label>Clasificación <span className="text-destructive">*</span></Label>
              <Select
                value={form.clasificacion_programa}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, clasificacion_programa: v as ClasificacionPrograma }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nuevo">Nuevo</SelectItem>
                  <SelectItem value="renovacion">Renovación</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Programa con cambio */}
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="con_cambio">Programa con Cambio de Carácter</Label>
              <Input
                id="con_cambio"
                value={form.programa_con_cambio ?? ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, programa_con_cambio: e.target.value || null }))
                }
                placeholder="Nombre del programa (o dejar vacío)"
              />
            </div>

            {/* Programa sin cambio */}
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="sin_cambio">Programa sin Cambio de Carácter</Label>
              <Input
                id="sin_cambio"
                value={form.programa_sin_cambio ?? ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, programa_sin_cambio: e.target.value || null }))
                }
                placeholder="Nombre del programa (o dejar vacío)"
              />
            </div>

            {/* Modalidad */}
            <div className="space-y-1.5">
              <Label>Modalidad <span className="text-destructive">*</span></Label>
              <Select
                value={form.modalidad}
                onValueChange={(v) => setForm((f) => ({ ...f, modalidad: v as Modalidad }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="virtual">Virtual</SelectItem>
                  <SelectItem value="hibrida">Híbrida</SelectItem>
                  <SelectItem value="presencial">Presencial</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Cantidad asignaturas */}
            <div className="space-y-1.5">
              <Label htmlFor="asignaturas">Cantidad de asignaturas promedio</Label>
              <Input
                id="asignaturas"
                type="number"
                min={0}
                value={form.cantidad_asignaturas}
                onChange={(e) =>
                  setForm((f) => ({ ...f, cantidad_asignaturas: parseInt(e.target.value) || 0 }))
                }
              />
            </div>

            {/* Fecha envío currículo */}
            <div className="space-y-1.5">
              <Label htmlFor="fecha">
                Fecha de Envío de Currículo <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fecha"
                type="date"
                value={form.fecha_envio_curriculo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, fecha_envio_curriculo: e.target.value }))
                }
              />
            </div>

            {/* Prioridad */}
            <div className="space-y-1.5">
              <Label>Prioridad</Label>
              <Select
                value={form.prioridad}
                onValueChange={(v) => setForm((f) => ({ ...f, prioridad: v as Prioridad }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="baja">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Estado */}
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select
                value={form.estado}
                onValueChange={(v) => setForm((f) => ({ ...f, estado: v as EstadoPrograma }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="en_proceso">En Proceso</SelectItem>
                  <SelectItem value="completado">Completado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Dependencia */}
            <div className="space-y-1.5">
              <Label htmlFor="dependencia">Dependencia que solicita</Label>
              <Input
                id="dependencia"
                value={form.dependencia ?? ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dependencia: e.target.value || null }))
                }
                placeholder="Ej. Dirección Académica"
              />
            </div>

            {/* Link */}
            <div className="space-y-1.5">
              <Label htmlFor="link">Link de referencia</Label>
              <Input
                id="link"
                type="url"
                value={form.link ?? ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, link: e.target.value || null }))
                }
                placeholder="https://..."
              />
            </div>

            {/* Notas */}
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="notas">Notas</Label>
              <Textarea
                id="notas"
                rows={3}
                value={form.notas ?? ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notas: e.target.value || null }))
                }
                placeholder="Información adicional..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSaving || !form.escuela || !form.fecha_envio_curriculo}
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editTarget ? 'Guardar cambios' : 'Agregar programa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar programa?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>{deleteTarget?.escuela}</strong> del pipeline. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Panel de detalle */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {detailPrograma && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle className="text-base leading-snug">
                  {detailPrograma.programa_con_cambio || detailPrograma.programa_sin_cambio || detailPrograma.escuela}
                </SheetTitle>
              </SheetHeader>

              <div className="space-y-3 text-sm">
                {[
                  { label: 'Escuela', value: detailPrograma.escuela },
                  { label: 'Nivel', value: NIVEL_LABELS[detailPrograma.nivel_programa] },
                  { label: 'Clasificación', value: CLASIFICACION_LABELS[detailPrograma.clasificacion_programa] },
                  { label: 'Programa con cambio', value: detailPrograma.programa_con_cambio },
                  { label: 'Programa sin cambio', value: detailPrograma.programa_sin_cambio },
                  { label: 'Modalidad', value: MODALIDAD_LABELS[detailPrograma.modalidad] },
                  { label: '# Asignaturas', value: String(detailPrograma.cantidad_asignaturas) },
                  { label: 'Fecha envío currículo', value: format(parseDate(detailPrograma.fecha_envio_curriculo), 'dd/MM/yyyy', { locale: es }) },
                  { label: 'Dependencia', value: detailPrograma.dependencia },
                ].map(({ label, value }) => value ? (
                  <div key={label} className="flex gap-2">
                    <span className="text-muted-foreground w-36 shrink-0">{label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ) : null)}

                {detailPrograma.link && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-36 shrink-0">Link</span>
                    <a href={detailPrograma.link} target="_blank" rel="noopener noreferrer"
                      className="font-medium text-primary underline truncate max-w-[220px]">
                      {detailPrograma.link}
                    </a>
                  </div>
                )}

                <div className="flex gap-2">
                  <span className="text-muted-foreground w-36 shrink-0">Prioridad</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${PRIORIDAD_CONFIG[detailPrograma.prioridad].className}`}>
                    {PRIORIDAD_CONFIG[detailPrograma.prioridad].label}
                  </span>
                </div>

                <div className="flex gap-2">
                  <span className="text-muted-foreground w-36 shrink-0">Estado</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ESTADO_CONFIG[detailPrograma.estado].className}`}>
                    {ESTADO_CONFIG[detailPrograma.estado].label}
                  </span>
                </div>

                {detailPrograma.notas && (
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground">Notas</span>
                    <p className="text-foreground bg-muted/50 rounded-lg p-3 text-sm leading-relaxed">
                      {detailPrograma.notas}
                    </p>
                  </div>
                )}
              </div>

              {detailPrograma.estado !== 'completado' && canEdit && (
                <div className="mt-6 pt-4 border-t">
                  <Button className="w-full" onClick={openWizardFromDetail}>
                    <Plus className="h-4 w-4 mr-2" />
                    Crear Proyecto
                  </Button>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Wizard de creación de proyecto — se monta con key para resetear estado al cambiar fila */}
      {wizardSource && (
        <CreateProjectWizard
          key={wizardSource.id}
          open={wizardOpen}
          onOpenChange={(open) => {
            setWizardOpen(open);
            if (!open) setWizardSource(null);
          }}
          initialData={{
            name: wizardSource.programa_con_cambio || wizardSource.programa_sin_cambio || wizardSource.escuela,
            end_date: wizardSource.fecha_envio_curriculo.slice(0, 10),
          }}
          onSuccess={handleWizardSuccess}
        />
      )}
    </div>
  );
}

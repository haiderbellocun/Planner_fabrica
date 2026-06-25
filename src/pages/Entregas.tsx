import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search, PackageCheck, Download, CalendarDays, TableProperties, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { MiniCalendar, type CalendarEvent } from '@/components/ui/MiniCalendar';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  useEntregas,
  useCreateEntrega,
  useUpdateEntrega,
  useDeleteEntrega,
  parseTags,
  serializeTags,
  type Entrega,
  type EntregaInput,
  type TipoEntrega,
  type EstadoEntrega,
  type NivelPrograma,
  type Modalidad,
} from '@/hooks/useEntregas';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

// ─── Constants ──────────────────────────────────────────────────────────────────

const NIVEL_LABELS: Record<NivelPrograma, string> = {
  pregrado:       'Pregrado',
  especializacion:'Especialización',
  maestria:       'Maestría',
  doctorado:      'Doctorado',
  diplomado:      'Diplomado',
  curso_rapido:   'Curso rápido',
};

const MODALIDAD_LABELS: Record<Modalidad, string> = {
  virtual:    'Virtual',
  hibrida:    'Híbrida',
  presencial: 'Presencial',
};

const TIPO_LABELS: Record<TipoEntrega, string> = {
  primera_entrega: 'Primera entrega',
  correccion:      'Corrección',
  final:           'Final',
};

const ESTADO_LABELS: Record<EstadoEntrega, string> = {
  aceptado:          'Aceptado',
  con_observaciones: 'Con observaciones',
  rechazado:         'Rechazado',
  pendiente:         'Pendiente',
};

const TIPO_COLORS: Record<TipoEntrega, string> = {
  primera_entrega: 'bg-blue-100 text-blue-700',
  correccion:      'bg-amber-100 text-amber-700',
  final:           'bg-purple-100 text-purple-700',
};

const ESTADO_COLORS: Record<EstadoEntrega, string> = {
  aceptado:          'bg-green-100 text-green-700',
  con_observaciones: 'bg-amber-100 text-amber-700',
  rechazado:         'bg-red-100 text-red-700',
  pendiente:         'bg-slate-100 text-slate-600',
};

const EMPTY_FORM: EntregaInput = {
  nombre_proyecto:      '',
  escuela:              '',
  nivel_programa:       null,
  modalidad:            null,
  fecha_entrega:        '',
  entregado_a:          '',
  tipo_entrega:         'primera_entrega',
  estado:               'pendiente',
  notas:                '',
  cantidad_semestres:   null,
  materias:             null,
  materiales_entregados: null,
};

function parseDate(s: string): Date {
  return new Date(s.slice(0, 10) + 'T00:00:00');
}

function formatDate(s: string): string {
  return parseDate(s).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Tag input component ────────────────────────────────────────────────────────

function TagInput({
  label,
  tags,
  onChange,
  placeholder,
}: {
  label: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState('');

  const add = () => {
    const val = input.trim();
    if (!val || tags.includes(val)) return;
    onChange([...tags, val]);
    setInput('');
  };

  const remove = (i: number) => onChange(tags.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="flex-1"
        />
        <Button type="button" variant="outline" size="sm" onClick={add} disabled={!input.trim()}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {tags.map((tag, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium"
            >
              {tag}
              <button type="button" onClick={() => remove(i)} className="hover:text-destructive transition-colors">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Form Sheet ─────────────────────────────────────────────────────────────────

function EntregaForm({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial: Entrega | null;
}) {
  const isEdit = !!initial;
  const [form, setForm] = useState<EntregaInput>(() =>
    initial
      ? {
          nombre_proyecto:      initial.nombre_proyecto,
          escuela:              initial.escuela ?? '',
          nivel_programa:       initial.nivel_programa,
          modalidad:            initial.modalidad,
          fecha_entrega:        initial.fecha_entrega.slice(0, 10),
          entregado_a:          initial.entregado_a ?? '',
          tipo_entrega:         initial.tipo_entrega,
          estado:               initial.estado,
          notas:                initial.notas ?? '',
          cantidad_semestres:   initial.cantidad_semestres,
          materias:             initial.materias,
          materiales_entregados: initial.materiales_entregados,
        }
      : { ...EMPTY_FORM }
  );

  // Tag lists managed as arrays, serialized on submit
  const [materiasList, setMateriasList] = useState<string[]>(() => parseTags(initial?.materias));
  const [materialesList, setMaterialesList] = useState<string[]>(() => parseTags(initial?.materiales_entregados));

  const createMutation = useCreateEntrega();
  const updateMutation = useUpdateEntrega();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const set = (k: keyof EntregaInput, v: unknown) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre_proyecto.trim() || !form.fecha_entrega) return;

    const payload: EntregaInput = {
      ...form,
      escuela:              form.escuela || null,
      nivel_programa:       form.nivel_programa || null,
      modalidad:            form.modalidad || null,
      entregado_a:          form.entregado_a || null,
      notas:                form.notas || null,
      cantidad_semestres:   form.cantidad_semestres || null,
      materias:             serializeTags(materiasList),
      materiales_entregados: serializeTags(materialesList),
    };

    if (isEdit && initial) {
      updateMutation.mutate({ id: initial.id, ...payload }, { onSuccess: onClose });
    } else {
      createMutation.mutate(payload, { onSuccess: onClose });
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Editar entrega' : 'Registrar entrega'}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {/* Nombre proyecto */}
          <div className="space-y-1.5">
            <Label>Nombre del proyecto <span className="text-red-500">*</span></Label>
            <Input
              value={form.nombre_proyecto}
              onChange={(e) => set('nombre_proyecto', e.target.value)}
              placeholder="Ej. Ingeniería de Sistemas - Pregrado"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Escuela */}
            <div className="space-y-1.5">
              <Label>Escuela</Label>
              <Input
                value={form.escuela ?? ''}
                onChange={(e) => set('escuela', e.target.value)}
                placeholder="Ej. EISI"
              />
            </div>

            {/* Nivel */}
            <div className="space-y-1.5">
              <Label>Nivel</Label>
              <select
                value={form.nivel_programa ?? ''}
                onChange={(e) => set('nivel_programa', e.target.value || null)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— Seleccionar —</option>
                {(Object.entries(NIVEL_LABELS) as [NivelPrograma, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Modalidad */}
            <div className="space-y-1.5">
              <Label>Modalidad</Label>
              <select
                value={form.modalidad ?? ''}
                onChange={(e) => set('modalidad', e.target.value || null)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— Seleccionar —</option>
                {(Object.entries(MODALIDAD_LABELS) as [Modalidad, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>

            {/* Fecha entrega */}
            <div className="space-y-1.5">
              <Label>Fecha de entrega <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                value={form.fecha_entrega}
                onChange={(e) => set('fecha_entrega', e.target.value)}
                required
              />
            </div>
          </div>

          {/* Cantidad de semestres */}
          <div className="space-y-1.5">
            <Label>Cantidad de semestres</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={form.cantidad_semestres ?? ''}
              onChange={(e) => set('cantidad_semestres', e.target.value ? parseInt(e.target.value) : null)}
              placeholder="Ej. 4"
            />
          </div>

          {/* Materias */}
          <TagInput
            label="Materias entregadas"
            tags={materiasList}
            onChange={setMateriasList}
            placeholder="Escribe una materia y presiona +"
          />

          {/* Materiales entregados */}
          <TagInput
            label="Materiales entregados"
            tags={materialesList}
            onChange={setMaterialesList}
            placeholder="Ej. Video, PDF, Infografía…"
          />

          {/* Entregado a */}
          <div className="space-y-1.5">
            <Label>Entregado a</Label>
            <Input
              value={form.entregado_a ?? ''}
              onChange={(e) => set('entregado_a', e.target.value)}
              placeholder="Persona o área que recibió el proyecto"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Tipo */}
            <div className="space-y-1.5">
              <Label>Tipo de entrega</Label>
              <select
                value={form.tipo_entrega}
                onChange={(e) => set('tipo_entrega', e.target.value as TipoEntrega)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {(Object.entries(TIPO_LABELS) as [TipoEntrega, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>

            {/* Estado */}
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <select
                value={form.estado}
                onChange={(e) => set('estado', e.target.value as EstadoEntrega)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {(Object.entries(ESTADO_LABELS) as [EstadoEntrega, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Notas */}
          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Textarea
              value={form.notas ?? ''}
              onChange={(e) => set('notas', e.target.value)}
              placeholder="Observaciones, correcciones pendientes..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || !form.nombre_proyecto.trim() || !form.fecha_entrega}>
              {isPending ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Registrar'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function Entregas() {
  const { isAdmin, isProjectLeader } = useAuth();
  const canWrite = isAdmin || isProjectLeader;

  const { data: entregas = [], isLoading } = useEntregas();
  const deleteMutation = useDeleteEntrega();

  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState<EstadoEntrega | 'todos'>('todos');
  const [filterTipo, setFilterTipo] = useState<TipoEntrega | 'todos'>('todos');
  const [view, setView] = useState<'table' | 'calendar'>('table');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Entrega | null>(null);
  const [deleting, setDeleting] = useState<Entrega | null>(null);

  const filtered = useMemo(() => {
    let list = entregas;
    if (filterEstado !== 'todos') list = list.filter((e) => e.estado === filterEstado);
    if (filterTipo !== 'todos') list = list.filter((e) => e.tipo_entrega === filterTipo);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.nombre_proyecto.toLowerCase().includes(q) ||
          (e.escuela ?? '').toLowerCase().includes(q) ||
          (e.entregado_a ?? '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [entregas, filterEstado, filterTipo, search]);

  const stats = useMemo(() => ({
    total:            entregas.length,
    aceptado:         entregas.filter((e) => e.estado === 'aceptado').length,
    con_observaciones:entregas.filter((e) => e.estado === 'con_observaciones').length,
    pendiente:        entregas.filter((e) => e.estado === 'pendiente').length,
    rechazado:        entregas.filter((e) => e.estado === 'rechazado').length,
  }), [entregas]);

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (e: Entrega) => { setEditing(e); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditing(null); };

  const ESTADO_CAL_COLORS: Record<EstadoEntrega, string> = {
    aceptado:          'bg-green-500',
    con_observaciones: 'bg-amber-400',
    rechazado:         'bg-red-500',
    pendiente:         'bg-slate-400',
  };

  const calendarEvents: CalendarEvent[] = filtered.map((e) => ({
    id:    e.id,
    date:  e.fecha_entrega.slice(0, 10),
    label: e.nombre_proyecto,
    color: ESTADO_CAL_COLORS[e.estado],
    onClick: () => openEdit(e),
  }));

  const handleExport = () => {
    const rows = filtered.map((e) => ({
      'Proyecto':              e.nombre_proyecto,
      'Escuela':               e.escuela ?? '',
      'Nivel':                 e.nivel_programa ? NIVEL_LABELS[e.nivel_programa] : '',
      'Modalidad':             e.modalidad ? MODALIDAD_LABELS[e.modalidad] : '',
      'Fecha entrega':         formatDate(e.fecha_entrega),
      'Semestres':             e.cantidad_semestres ?? '',
      'Materias':              parseTags(e.materias).join(', '),
      'Materiales entregados': parseTags(e.materiales_entregados).join(', '),
      'Entregado a':           e.entregado_a ?? '',
      'Tipo':                  TIPO_LABELS[e.tipo_entrega],
      'Estado':                ESTADO_LABELS[e.estado],
      'Notas':                 e.notas ?? '',
      'Registrado por':        e.creator_name ?? '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Entregas');
    XLSX.writeFile(wb, 'registro_entregas.xlsx');
  };

  return (
    <div className="p-6 space-y-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <PackageCheck className="h-6 w-6 text-primary" />
            Registro de Entregas
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Historial de proyectos entregados
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex border rounded-lg overflow-hidden">
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
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Exportar Excel
          </Button>
          {canWrite && (
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Registrar entrega
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total registros',       value: stats.total,             color: 'text-foreground'  },
          { label: 'Aceptados',             value: stats.aceptado,          color: 'text-green-600'   },
          { label: 'Con observaciones',     value: stats.con_observaciones, color: 'text-amber-600'   },
          { label: 'Pendientes/Rechazados', value: stats.pendiente + stats.rechazado, color: 'text-slate-500' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-3 shadow-sm">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{s.label}</p>
            <p className={cn('text-2xl font-semibold mt-0.5', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar proyecto, escuela, receptor…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={filterEstado}
          onChange={(e) => setFilterEstado(e.target.value as EstadoEntrega | 'todos')}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="todos">Todos los estados</option>
          {(Object.entries(ESTADO_LABELS) as [EstadoEntrega, string][]).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select
          value={filterTipo}
          onChange={(e) => setFilterTipo(e.target.value as TipoEntrega | 'todos')}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="todos">Todos los tipos</option>
          {(Object.entries(TIPO_LABELS) as [TipoEntrega, string][]).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {/* Calendar view */}
      {view === 'calendar' && (
        <div className="space-y-3">
          <div className="flex gap-4 flex-wrap text-xs text-slate-500">
            {(Object.entries(ESTADO_LABELS) as [EstadoEntrega, string][]).map(([k, l]) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className={cn('h-2.5 w-2.5 rounded-full', {
                  'bg-green-500': k === 'aceptado',
                  'bg-amber-400': k === 'con_observaciones',
                  'bg-red-500':   k === 'rechazado',
                  'bg-slate-400': k === 'pendiente',
                })} />
                {l}
              </span>
            ))}
          </div>
          <MiniCalendar events={calendarEvents} />
        </div>
      )}

      {/* Table */}
      {view === 'table' && (
        <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
              Cargando…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
              <PackageCheck className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-muted-foreground font-medium">
                {entregas.length === 0 ? 'Aún no hay entregas registradas' : 'Sin resultados para los filtros aplicados'}
              </p>
              {canWrite && entregas.length === 0 && (
                <Button variant="outline" size="sm" onClick={openCreate} className="mt-1 gap-1">
                  <Plus className="h-3.5 w-3.5" /> Registrar primera entrega
                </Button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="px-4 py-3 text-left">Proyecto</th>
                  <th className="px-3 py-3 text-left whitespace-nowrap">Escuela</th>
                  <th className="px-3 py-3 text-left whitespace-nowrap">Nivel</th>
                  <th className="px-3 py-3 text-center whitespace-nowrap">Semestres</th>
                  <th className="px-3 py-3 text-left whitespace-nowrap">Materias</th>
                  <th className="px-3 py-3 text-left whitespace-nowrap">Materiales</th>
                  <th className="px-3 py-3 text-left whitespace-nowrap">Fecha entrega</th>
                  <th className="px-3 py-3 text-center whitespace-nowrap">Tipo</th>
                  <th className="px-3 py-3 text-center whitespace-nowrap">Estado</th>
                  {canWrite && <th className="px-3 py-3 text-center whitespace-nowrap">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => {
                  const materiasTags = parseTags(e.materias);
                  const materialesTags = parseTags(e.materiales_entregados);
                  return (
                    <tr
                      key={e.id}
                      className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium max-w-[180px]">
                        <p className="truncate" title={e.nombre_proyecto}>{e.nombre_proyecto}</p>
                        {e.entregado_a && (
                          <p className="text-xs text-slate-400 truncate">→ {e.entregado_a}</p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-slate-600 whitespace-nowrap">
                        {e.escuela ?? <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {e.nivel_programa
                          ? <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{NIVEL_LABELS[e.nivel_programa]}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-3 text-center text-slate-700 font-medium">
                        {e.cantidad_semestres ?? <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-3 max-w-[180px]">
                        {materiasTags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {materiasTags.slice(0, 2).map((m, i) => (
                              <span key={i} className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{m}</span>
                            ))}
                            {materiasTags.length > 2 && (
                              <span className="text-xs text-slate-400">+{materiasTags.length - 2}</span>
                            )}
                          </div>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-3 max-w-[180px]">
                        {materialesTags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {materialesTags.slice(0, 2).map((m, i) => (
                              <span key={i} className="text-xs bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded">{m}</span>
                            ))}
                            {materialesTags.length > 2 && (
                              <span className="text-xs text-slate-400">+{materialesTags.length - 2}</span>
                            )}
                          </div>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-slate-700 font-medium">
                        {formatDate(e.fecha_entrega)}
                      </td>
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <Badge className={cn('text-xs font-medium border-0', TIPO_COLORS[e.tipo_entrega])}>
                          {TIPO_LABELS[e.tipo_entrega]}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <Badge className={cn('text-xs font-medium border-0', ESTADO_COLORS[e.estado])}>
                          {ESTADO_LABELS[e.estado]}
                        </Badge>
                      </td>
                      {canWrite && (
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-500 hover:text-primary"
                              onClick={() => openEdit(e)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-500 hover:text-destructive"
                              onClick={() => setDeleting(e)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Form Sheet */}
      {formOpen && (
        <EntregaForm
          key={editing?.id ?? 'new'}
          open={formOpen}
          onClose={closeForm}
          initial={editing}
        />
      )}

      {/* Delete confirm */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar entrega?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el registro de <strong>{deleting?.nombre_proyecto}</strong>. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (deleting) deleteMutation.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

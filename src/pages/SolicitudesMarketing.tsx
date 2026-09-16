import { useState, useMemo } from 'react';
import {
  Plus, Pencil, Trash2, Search, Megaphone, Download,
  TableProperties, LayoutGrid, X,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { LoadingState, EmptyState } from '@/components/shared/StoryUI';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { BADGE_TONES } from '@/lib/badgeColors';
import { useAuth } from '@/contexts/AuthContext';
import {
  useSolicitudesMarketing,
  useCreateSolicitudMarketing,
  useUpdateSolicitudMarketing,
  useDeleteSolicitudMarketing,
  parseCanales,
  serializeCanales,
  type SolicitudMarketing,
  type SolicitudMarketingInput,
  type Prioridad,
  type EstadoInsumos,
  type EstadoProduccion,
} from '@/hooks/useSolicitudesMarketing';
import { useProjects } from '@/hooks/useProjects';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';

// ─── Constants ──────────────────────────────────────────────────────────────────

const CANAL_OPTIONS: { value: string; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook',  label: 'Facebook' },
  { value: 'tiktok',    label: 'TikTok' },
  { value: 'linkedin',  label: 'LinkedIn' },
  { value: 'youtube',   label: 'YouTube' },
  { value: 'whatsapp',  label: 'WhatsApp' },
  { value: 'email',     label: 'Email' },
  { value: 'web',       label: 'Página web' },
  { value: 'otro',      label: 'Otro' },
];

const TIPO_PIEZA_OPTIONS: { value: string; label: string }[] = [
  { value: 'imagen',        label: 'Imagen estática' },
  { value: 'video',         label: 'Video' },
  { value: 'carrusel',      label: 'Carrusel' },
  { value: 'historia_reel', label: 'Historia / Reel' },
  { value: 'impreso',       label: 'Pieza impresa' },
  { value: 'otro',          label: 'Otro' },
];

const PRIORIDAD_LABELS: Record<Prioridad, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' };
const PRIORIDAD_COLORS: Record<Prioridad, string> = {
  alta:  BADGE_TONES.danger,
  media: BADGE_TONES.warning,
  baja:  BADGE_TONES.neutral,
};

const ESTADO_INSUMOS_LABELS: Record<EstadoInsumos, string> = {
  pendiente:  'Pendiente',
  recibido:   'Recibido',
  incompleto: 'Incompleto',
};
const ESTADO_INSUMOS_COLORS: Record<EstadoInsumos, string> = {
  pendiente:  BADGE_TONES.neutral,
  recibido:   BADGE_TONES.success,
  incompleto: BADGE_TONES.warning,
};

const ESTADO_PRODUCCION_ORDER: EstadoProduccion[] = ['pendiente', 'en_diseno', 'en_revision', 'aprobado', 'publicado'];
const ESTADO_PRODUCCION_LABELS: Record<EstadoProduccion, string> = {
  pendiente:    'Pendiente',
  en_diseno:    'En diseño',
  en_revision:  'En revisión',
  aprobado:     'Aprobado',
  publicado:    'Publicado',
};
const ESTADO_PRODUCCION_COLORS: Record<EstadoProduccion, string> = {
  pendiente:    BADGE_TONES.neutral,
  en_diseno:    BADGE_TONES.info,
  en_revision:  BADGE_TONES.warning,
  aprobado:     BADGE_TONES.special,
  publicado:    BADGE_TONES.success,
};

const EMPTY_FORM: SolicitudMarketingInput = {
  fecha_limite:               '',
  area_solicitante:           '',
  solicitante:                '',
  contacto:                   '',
  numero_ticket:              '',
  campana:                    '',
  proyecto_id:                null,
  brief:                      '',
  objetivo_comunicacion:      '',
  publico_objetivo:           '',
  canal:                      null,
  tipo_pieza:                 '',
  formato_medidas:            '',
  cantidad:                   1,
  entregables_especificos:    '',
  mensaje_clave:              '',
  cta:                        '',
  insumos_disponibles:        false,
  link_insumos:               '',
  restricciones:              '',
  prioridad:                  'media',
  estado_insumos:             'pendiente',
  estado_produccion:          'pendiente',
  fecha_estimada_entrega:     '',
  observaciones:              '',
  entregas_links:             '',
  nuevas_observaciones:       '',
  observaciones_adicionales:  '',
};

function parseDate(s: string): Date {
  return new Date(s.slice(0, 10) + 'T00:00:00');
}

function formatDate(s: string | null): string {
  if (!s) return '—';
  return parseDate(s).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function folioLabel(folio: number): string {
  return `SOL-${String(folio).padStart(4, '0')}`;
}

// ─── Form Sheet ─────────────────────────────────────────────────────────────────

function SolicitudForm({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial: SolicitudMarketing | null;
}) {
  const isEdit = !!initial;
  const [form, setForm] = useState<SolicitudMarketingInput>(() =>
    initial
      ? {
          fecha_limite:               initial.fecha_limite.slice(0, 10),
          area_solicitante:           initial.area_solicitante,
          solicitante:                initial.solicitante,
          contacto:                   initial.contacto ?? '',
          numero_ticket:              initial.numero_ticket ?? '',
          campana:                    initial.campana,
          proyecto_id:                initial.proyecto_id,
          brief:                      initial.brief ?? '',
          objetivo_comunicacion:      initial.objetivo_comunicacion ?? '',
          publico_objetivo:           initial.publico_objetivo ?? '',
          canal:                      initial.canal,
          tipo_pieza:                 initial.tipo_pieza ?? '',
          formato_medidas:            initial.formato_medidas ?? '',
          cantidad:                   initial.cantidad ?? 1,
          entregables_especificos:    initial.entregables_especificos ?? '',
          mensaje_clave:              initial.mensaje_clave ?? '',
          cta:                        initial.cta ?? '',
          insumos_disponibles:        initial.insumos_disponibles,
          link_insumos:               initial.link_insumos ?? '',
          restricciones:              initial.restricciones ?? '',
          prioridad:                  initial.prioridad,
          estado_insumos:             initial.estado_insumos,
          estado_produccion:          initial.estado_produccion,
          fecha_estimada_entrega:     initial.fecha_estimada_entrega?.slice(0, 10) ?? '',
          observaciones:              initial.observaciones ?? '',
          entregas_links:             initial.entregas_links ?? '',
          nuevas_observaciones:       initial.nuevas_observaciones ?? '',
          observaciones_adicionales:  initial.observaciones_adicionales ?? '',
        }
      : { ...EMPTY_FORM }
  );
  const [canales, setCanales] = useState<string[]>(() => parseCanales(initial?.canal));

  const { data: projects = [] } = useProjects();
  const marketingProjects = useMemo(
    () => projects.filter((p) => p.category === 'marketing'),
    [projects]
  );

  const createMutation = useCreateSolicitudMarketing();
  const updateMutation = useUpdateSolicitudMarketing();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const set = <K extends keyof SolicitudMarketingInput>(k: K, v: SolicitudMarketingInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toggleCanal = (value: string) =>
    setCanales((prev) => (prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]));

  const isValid = form.fecha_limite && form.area_solicitante.trim() && form.solicitante.trim() && form.campana.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    const payload: SolicitudMarketingInput = {
      ...form,
      contacto:                   form.contacto || null,
      numero_ticket:              form.numero_ticket?.trim() || 'Nuevo',
      brief:                      form.brief || null,
      objetivo_comunicacion:      form.objetivo_comunicacion || null,
      publico_objetivo:           form.publico_objetivo || null,
      canal:                      serializeCanales(canales),
      tipo_pieza:                 form.tipo_pieza || null,
      formato_medidas:            form.formato_medidas || null,
      cantidad:                   form.cantidad || 1,
      entregables_especificos:    form.entregables_especificos || null,
      mensaje_clave:              form.mensaje_clave || null,
      cta:                        form.cta || null,
      link_insumos:               form.insumos_disponibles ? (form.link_insumos || null) : null,
      restricciones:              form.restricciones || null,
      fecha_estimada_entrega:     form.fecha_estimada_entrega || null,
      observaciones:              form.observaciones || null,
      entregas_links:             form.entregas_links || null,
      nuevas_observaciones:       form.nuevas_observaciones || null,
      observaciones_adicionales:  form.observaciones_adicionales || null,
    };

    try {
      if (isEdit && initial) {
        await updateMutation.mutateAsync({ id: initial.id, ...payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onClose();
    } catch {
      // los toasts de error ya los maneja cada mutation
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? `Editar solicitud ${folioLabel(initial!.folio)}` : 'Nueva solicitud de marketing'}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Tabs defaultValue="solicitante" className="w-full">
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="solicitante">Solicitante</TabsTrigger>
              <TabsTrigger value="brief">Brief</TabsTrigger>
              <TabsTrigger value="pieza">Pieza y copy</TabsTrigger>
              <TabsTrigger value="insumos">Insumos</TabsTrigger>
              <TabsTrigger value="seguimiento">Seguimiento</TabsTrigger>
            </TabsList>

            {/* ── Solicitante ── */}
            <TabsContent value="solicitante" className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Área solicitante <span className="text-red-500">*</span></Label>
                  <Input
                    value={form.area_solicitante}
                    onChange={(e) => set('area_solicitante', e.target.value)}
                    placeholder="Ej. Admisiones, Bienestar…"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Director / solicitante <span className="text-red-500">*</span></Label>
                  <Input
                    value={form.solicitante}
                    onChange={(e) => set('solicitante', e.target.value)}
                    placeholder="Nombre de quien solicita"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Correo / contacto</Label>
                  <Input
                    type="email"
                    value={form.contacto ?? ''}
                    onChange={(e) => set('contacto', e.target.value)}
                    placeholder="correo@cun.edu.co"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Número de ticket</Label>
                  <Input
                    value={form.numero_ticket ?? ''}
                    onChange={(e) => set('numero_ticket', e.target.value)}
                    placeholder="Nuevo"
                  />
                  <p className="text-xs text-muted-foreground">Si no cuenta con ticket previo, deja "Nuevo".</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Fecha límite <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={form.fecha_limite}
                  onChange={(e) => set('fecha_limite', e.target.value)}
                  required
                />
              </div>
            </TabsContent>

            {/* ── Brief ── */}
            <TabsContent value="brief" className="space-y-4">
              <div className="space-y-1.5">
                <Label>Campaña / proyecto <span className="text-red-500">*</span></Label>
                <Input
                  value={form.campana}
                  onChange={(e) => set('campana', e.target.value)}
                  placeholder="Ej. Convocatoria 2026-1"
                  required
                />
              </div>
              {marketingProjects.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Vincular a proyecto de Marketing (opcional)</Label>
                  <select
                    value={form.proyecto_id ?? ''}
                    onChange={(e) => set('proyecto_id', e.target.value || null)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">— Ninguno —</option>
                    {marketingProjects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Necesidad / brief corto</Label>
                <Textarea
                  value={form.brief ?? ''}
                  onChange={(e) => set('brief', e.target.value)}
                  placeholder="¿Qué se necesita y por qué?"
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Objetivo de comunicación</Label>
                <Textarea
                  value={form.objetivo_comunicacion ?? ''}
                  onChange={(e) => set('objetivo_comunicacion', e.target.value)}
                  placeholder="Ej. Generar registros a la convocatoria"
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Público objetivo</Label>
                <Input
                  value={form.publico_objetivo ?? ''}
                  onChange={(e) => set('publico_objetivo', e.target.value)}
                  placeholder="Ej. Bachilleres 16-18 años"
                />
              </div>
            </TabsContent>

            {/* ── Pieza y copy ── */}
            <TabsContent value="pieza" className="space-y-4">
              <div className="space-y-1.5">
                <Label>Canal</Label>
                <div className="grid grid-cols-3 gap-2 rounded-lg border p-3">
                  {CANAL_OPTIONS.map((c) => (
                    <label key={c.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <Checkbox checked={canales.includes(c.value)} onCheckedChange={() => toggleCanal(c.value)} />
                      {c.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Tipo de pieza</Label>
                  <select
                    value={form.tipo_pieza ?? ''}
                    onChange={(e) => set('tipo_pieza', e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">— Seleccionar —</option>
                    {TIPO_PIEZA_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Cantidad</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.cantidad ?? 1}
                    onChange={(e) => set('cantidad', parseInt(e.target.value, 10) || 1)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Formato / medidas</Label>
                <Input
                  value={form.formato_medidas ?? ''}
                  onChange={(e) => set('formato_medidas', e.target.value)}
                  placeholder="Ej. 1080x1920px, tamaño carta…"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Entregables específicos</Label>
                <Textarea
                  value={form.entregables_especificos ?? ''}
                  onChange={(e) => set('entregables_especificos', e.target.value)}
                  placeholder="Ej. 1 video de 30s + 3 piezas estáticas"
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Mensaje clave / copy base</Label>
                <Textarea
                  value={form.mensaje_clave ?? ''}
                  onChange={(e) => set('mensaje_clave', e.target.value)}
                  placeholder="Texto o idea central que debe comunicar la pieza"
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label>CTA</Label>
                <Input
                  value={form.cta ?? ''}
                  onChange={(e) => set('cta', e.target.value)}
                  placeholder="Ej. Inscríbete ahora"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Restricciones / obligatorios</Label>
                <Textarea
                  value={form.restricciones ?? ''}
                  onChange={(e) => set('restricciones', e.target.value)}
                  placeholder="Ej. Debe incluir logo institucional, no usar color rojo…"
                  rows={2}
                />
              </div>
            </TabsContent>

            {/* ── Insumos ── */}
            <TabsContent value="insumos" className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>¿Insumos disponibles?</Label>
                  <p className="text-xs text-muted-foreground">Fotos, videos, logos u otro material que aporta el solicitante.</p>
                </div>
                <Switch
                  checked={form.insumos_disponibles}
                  onCheckedChange={(v) => set('insumos_disponibles', v)}
                />
              </div>
              {form.insumos_disponibles && (
                <div className="space-y-1.5">
                  <Label>Link carpeta de insumos</Label>
                  <Input
                    type="url"
                    value={form.link_insumos ?? ''}
                    onChange={(e) => set('link_insumos', e.target.value)}
                    placeholder="https://drive.google.com/…"
                  />
                </div>
              )}
            </TabsContent>

            {/* ── Seguimiento ── */}
            <TabsContent value="seguimiento" className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Prioridad</Label>
                  <select
                    value={form.prioridad}
                    onChange={(e) => set('prioridad', e.target.value as Prioridad)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {(Object.entries(PRIORIDAD_LABELS) as [Prioridad, string][]).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Estado insumos</Label>
                  <select
                    value={form.estado_insumos}
                    onChange={(e) => set('estado_insumos', e.target.value as EstadoInsumos)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {(Object.entries(ESTADO_INSUMOS_LABELS) as [EstadoInsumos, string][]).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Estado producción</Label>
                  <select
                    value={form.estado_produccion}
                    onChange={(e) => set('estado_produccion', e.target.value as EstadoProduccion)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {ESTADO_PRODUCCION_ORDER.map((v) => (
                      <option key={v} value={v}>{ESTADO_PRODUCCION_LABELS[v]}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Fecha estimada de entrega</Label>
                <Input
                  type="date"
                  value={form.fecha_estimada_entrega ?? ''}
                  onChange={(e) => set('fecha_estimada_entrega', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Observaciones</Label>
                <Textarea
                  value={form.observaciones ?? ''}
                  onChange={(e) => set('observaciones', e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Entregas</Label>
                <Textarea
                  value={form.entregas_links ?? ''}
                  onChange={(e) => set('entregas_links', e.target.value)}
                  placeholder="Links o descripción de lo entregado"
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Nuevas observaciones</Label>
                <Textarea
                  value={form.nuevas_observaciones ?? ''}
                  onChange={(e) => set('nuevas_observaciones', e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Observaciones adicionales</Label>
                <Textarea
                  value={form.observaciones_adicionales ?? ''}
                  onChange={(e) => set('observaciones_adicionales', e.target.value)}
                  rows={2}
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-2 border-t mt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || !isValid}>
              {isPending ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear solicitud'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function SolicitudesMarketing() {
  const { isAdmin, isProjectLeader } = useAuth();
  const canWrite = isAdmin || isProjectLeader;

  const { data: solicitudes = [], isLoading } = useSolicitudesMarketing();
  const deleteMutation = useDeleteSolicitudMarketing();

  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState<EstadoProduccion | 'todos'>('todos');
  const [filterPrioridad, setFilterPrioridad] = useState<Prioridad | 'todos'>('todos');
  const [view, setView] = useState<'table' | 'kanban'>('table');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SolicitudMarketing | null>(null);
  const [deleting, setDeleting] = useState<SolicitudMarketing | null>(null);

  const filtered = useMemo(() => {
    let list = solicitudes;
    if (filterEstado !== 'todos') list = list.filter((s) => s.estado_produccion === filterEstado);
    if (filterPrioridad !== 'todos') list = list.filter((s) => s.prioridad === filterPrioridad);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.campana.toLowerCase().includes(q) ||
          s.solicitante.toLowerCase().includes(q) ||
          s.area_solicitante.toLowerCase().includes(q)
      );
    }
    return list;
  }, [solicitudes, filterEstado, filterPrioridad, search]);

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (s: SolicitudMarketing) => { setEditing(s); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditing(null); };

  const handleExport = () => {
    const rows = filtered.map((s) => ({
      'ID':                        folioLabel(s.folio),
      'Fecha registro':            formatDate(s.fecha_registro),
      'Fecha límite':              formatDate(s.fecha_limite),
      'Área solicitante':          s.area_solicitante,
      'Director / solicitante':    s.solicitante,
      'Correo / contacto':         s.contacto ?? '',
      'Número de ticket':          s.numero_ticket ?? '',
      'Campaña / proyecto':        s.campana,
      'Necesidad / brief corto':   s.brief ?? '',
      'Objetivo de comunicación':  s.objetivo_comunicacion ?? '',
      'Público objetivo':          s.publico_objetivo ?? '',
      'Canal':                     parseCanales(s.canal).join(', '),
      'Tipo de pieza':             s.tipo_pieza ?? '',
      'Formato / medidas':         s.formato_medidas ?? '',
      'Cantidad':                  s.cantidad ?? '',
      'Entregables específicos':   s.entregables_especificos ?? '',
      'Mensaje clave / copy base': s.mensaje_clave ?? '',
      'CTA':                       s.cta ?? '',
      '¿Insumos disponibles?':     s.insumos_disponibles ? 'Sí' : 'No',
      'Link carpeta insumos':      s.link_insumos ?? '',
      'Restricciones / obligatorios': s.restricciones ?? '',
      'Prioridad':                 PRIORIDAD_LABELS[s.prioridad],
      'Estado insumos':            ESTADO_INSUMOS_LABELS[s.estado_insumos],
      'Estado producción':         ESTADO_PRODUCCION_LABELS[s.estado_produccion],
      'Fecha estimada entrega':    formatDate(s.fecha_estimada_entrega),
      'Observaciones':             s.observaciones ?? '',
      'Entregas':                  s.entregas_links ?? '',
      'Nuevas observaciones':      s.nuevas_observaciones ?? '',
      'Observaciones adicionales': s.observaciones_adicionales ?? '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Solicitudes');
    XLSX.writeFile(wb, 'solicitudes_marketing.xlsx');
  };

  return (
    <div className="p-6 space-y-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" />
            Solicitudes de Marketing
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Seguimiento de solicitudes de piezas, desde el brief hasta la entrega
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
              variant={view === 'kanban' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none gap-1.5 px-3"
              onClick={() => setView('kanban')}
            >
              <LayoutGrid className="h-4 w-4" /> Kanban
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
              Nueva solicitud
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar campaña, solicitante, área…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterEstado} onValueChange={(v) => setFilterEstado(v as EstadoProduccion | 'todos')}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            {ESTADO_PRODUCCION_ORDER.map((v) => (
              <SelectItem key={v} value={v}>{ESTADO_PRODUCCION_LABELS[v]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterPrioridad} onValueChange={(v) => setFilterPrioridad(v as Prioridad | 'todos')}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas las prioridades</SelectItem>
            {(Object.entries(PRIORIDAD_LABELS) as [Prioridad, string][]).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {(search || filterEstado !== 'todos' || filterPrioridad !== 'todos') && (
        <div className="flex flex-wrap items-center gap-1.5 -mt-1.5">
          {search && (
            <Badge variant="secondary" className="gap-1">
              "{search}"
              <button
                className="rounded-full p-0.5 -mr-0.5 hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
                onClick={() => setSearch('')}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filterEstado !== 'todos' && (
            <Badge variant="secondary" className="gap-1">
              {ESTADO_PRODUCCION_LABELS[filterEstado]}
              <button
                className="rounded-full p-0.5 -mr-0.5 hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
                onClick={() => setFilterEstado('todos')}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filterPrioridad !== 'todos' && (
            <Badge variant="secondary" className="gap-1">
              {PRIORIDAD_LABELS[filterPrioridad]}
              <button
                className="rounded-full p-0.5 -mr-0.5 hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
                onClick={() => setFilterPrioridad('todos')}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground"
            onClick={() => { setSearch(''); setFilterEstado('todos'); setFilterPrioridad('todos'); }}
          >
            Limpiar filtros
          </Button>
        </div>
      )}

      {/* Table view */}
      {view === 'table' && (
        <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
          {isLoading ? (
            <LoadingState label="Cargando solicitudes…" className="py-20 min-h-0" />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              message={solicitudes.length === 0 ? 'Aún no hay solicitudes registradas' : 'Sin resultados para los filtros aplicados'}
              action={canWrite && solicitudes.length === 0 ? { label: 'Crear primera solicitud', onClick: openCreate } : undefined}
            />
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b border-border text-xs font-semibold text-muted-foreground">
                  <th className="px-3 py-3 text-left whitespace-nowrap">ID</th>
                  <th className="px-4 py-3 text-left">Campaña</th>
                  <th className="px-3 py-3 text-left whitespace-nowrap">Área solicitante</th>
                  <th className="px-3 py-3 text-left whitespace-nowrap">Canal</th>
                  <th className="px-3 py-3 text-left whitespace-nowrap">Fecha límite</th>
                  <th className="px-3 py-3 text-center whitespace-nowrap">Prioridad</th>
                  <th className="px-3 py-3 text-center whitespace-nowrap">Estado producción</th>
                  {canWrite && <th className="px-3 py-3 text-center whitespace-nowrap">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const canales = parseCanales(s.canal);
                  return (
                    <tr key={s.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                      <td className="px-3 py-3 whitespace-nowrap text-slate-500 font-mono text-xs">
                        {folioLabel(s.folio)}
                      </td>
                      <td className="px-4 py-3 font-medium max-w-[200px]">
                        <p className="truncate" title={s.campana}>{s.campana}</p>
                        <p className="text-xs text-slate-400 truncate">{s.solicitante}</p>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">{s.area_solicitante}</td>
                      <td className="px-3 py-3 max-w-[180px]">
                        {canales.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {canales.slice(0, 2).map((c, i) => (
                              <span key={i} className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded capitalize">{c}</span>
                            ))}
                            {canales.length > 2 && (
                              <span className="text-xs text-slate-400">+{canales.length - 2}</span>
                            )}
                          </div>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-slate-700 font-medium">
                        {formatDate(s.fecha_limite)}
                      </td>
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <Badge className={cn('text-xs font-medium border-0', PRIORIDAD_COLORS[s.prioridad])}>
                          {PRIORIDAD_LABELS[s.prioridad]}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <Badge className={cn('text-xs font-medium border-0', ESTADO_PRODUCCION_COLORS[s.estado_produccion])}>
                          {ESTADO_PRODUCCION_LABELS[s.estado_produccion]}
                        </Badge>
                      </td>
                      {canWrite && (
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-500 hover:text-primary"
                              onClick={() => openEdit(s)}
                              aria-label={`Editar solicitud ${folioLabel(s.folio)}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-500 hover:text-destructive"
                              onClick={() => setDeleting(s)}
                              aria-label={`Eliminar solicitud ${folioLabel(s.folio)}`}
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

      {/* Kanban view */}
      {view === 'kanban' && (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {ESTADO_PRODUCCION_ORDER.map((estado) => {
            const items = filtered.filter((s) => s.estado_produccion === estado);
            return (
              <div key={estado} className="flex-1 min-w-[240px] space-y-2">
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {ESTADO_PRODUCCION_LABELS[estado]}
                  </p>
                  <span className="text-xs text-muted-foreground/70">{items.length}</span>
                </div>
                <div className="space-y-2 min-h-[60px]">
                  {items.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => canWrite && openEdit(s)}
                      className="w-full text-left rounded-lg border bg-card p-3 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <p className="text-xs text-slate-400 font-mono">{folioLabel(s.folio)}</p>
                      <p className="text-sm font-medium truncate mt-0.5" title={s.campana}>{s.campana}</p>
                      <p className="text-xs text-slate-500 truncate">{s.area_solicitante}</p>
                      <div className="flex items-center justify-between mt-2">
                        <Badge className={cn('text-[10px] font-medium border-0', PRIORIDAD_COLORS[s.prioridad])}>
                          {PRIORIDAD_LABELS[s.prioridad]}
                        </Badge>
                        <span className="text-[10px] text-slate-400">{formatDate(s.fecha_limite)}</span>
                      </div>
                    </button>
                  ))}
                  {items.length === 0 && (
                    <p className="text-xs text-slate-300 text-center py-4">Sin solicitudes</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Sheet */}
      {formOpen && (
        <SolicitudForm
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
            <AlertDialogTitle>¿Eliminar solicitud?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la solicitud <strong>{deleting ? folioLabel(deleting.folio) : ''} - {deleting?.campana}</strong>. Esta acción no se puede deshacer.
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

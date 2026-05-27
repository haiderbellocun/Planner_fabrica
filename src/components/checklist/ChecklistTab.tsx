import { useCallback } from 'react';
import { Loader2, CheckSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useChecklist,
  useUpdateChecklist,
  useAssignMaestro,
  calcEstadoFinal,
  type ChecklistRow,
  type ChecklistUpdate,
  type EstadoRevision,
  type GroupField,
} from '@/hooks/useChecklist';
import { useAdminUsers } from '@/hooks/useAdminUsers';
import { useAuth } from '@/contexts/AuthContext';

// ─── Constants ─────────────────────────────────────────────────────────────────

const GROUPS = [1, 2, 3, 4, 5] as const;
const GROUP_FIELDS: { key: GroupField; label: string }[] = [
  { key: 'inf',   label: 'Inf' },
  { key: 'vid',   label: 'Vid' },
  { key: 'pod',   label: 'Pod' },
  { key: 'glos',  label: 'Glos' },
  { key: 'fecha', label: 'Fecha' },
  { key: 'rev',   label: 'Rev' },
];

const ESTADO_OPTIONS: { value: EstadoRevision; label: string }[] = [
  { value: 'sin_iniciar', label: 'Sin iniciar' },
  { value: 'en_proceso',  label: 'En proceso'  },
  { value: 'finalizado',  label: 'Finalizado'  },
];

const ESTADO_COLORS: Record<EstadoRevision, string> = {
  sin_iniciar: 'bg-slate-100 text-slate-600',
  en_proceso:  'bg-amber-100 text-amber-700',
  finalizado:  'bg-teal-100  text-teal-700',
};

const FINAL_COLORS: Record<string, string> = {
  'Materia Completa': 'bg-green-100 text-green-700 font-semibold',
  'En proceso':       'bg-amber-100 text-amber-700',
  'Sin iniciar':      'bg-slate-100 text-slate-500',
};

// ─── Sub-components ────────────────────────────────────────────────────────────

function Checkbox({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'h-5 w-5 rounded border-2 flex items-center justify-center transition-colors shrink-0',
        checked
          ? 'bg-teal-500 border-teal-500 text-white'
          : 'border-slate-300 bg-white hover:border-teal-400',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      {checked && (
        <svg viewBox="0 0 12 10" className="h-3 w-3 fill-none stroke-white stroke-2">
          <polyline points="1,5 4,8 11,1" />
        </svg>
      )}
    </button>
  );
}

function StatusSelect({
  value,
  onChange,
  disabled,
}: {
  value: EstadoRevision;
  onChange: (v: EstadoRevision) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as EstadoRevision)}
      className={cn(
        'text-xs rounded-md border-0 px-1.5 py-0.5 font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary',
        ESTADO_COLORS[value],
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      {ESTADO_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// ─── Row ───────────────────────────────────────────────────────────────────────

function ChecklistRowComponent({
  row,
  onUpdate,
  onAssign,
  users,
  isPending,
}: {
  row: ChecklistRow;
  onUpdate: (asignaturaId: string, data: ChecklistUpdate) => void;
  onAssign: (asignaturaId: string, maestroId: string | null) => void;
  users: { profile_id: string | null; full_name: string }[];
  isPending: boolean;
}) {
  const estadoFinal = calcEstadoFinal(row);

  const update = useCallback(
    (data: ChecklistUpdate) => onUpdate(row.asignatura_id, data),
    [onUpdate, row.asignatura_id],
  );

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
      {/* Programa */}
      <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap sticky left-0 bg-white z-10 border-r border-slate-100">
        {row.programa_name ?? '—'}
      </td>

      {/* Asignatura */}
      <td className="px-3 py-2 min-w-[180px] sticky left-[110px] bg-white z-10 border-r border-slate-200">
        <p className="text-sm font-medium leading-tight">{row.asignatura_name}</p>
        {row.asignatura_code && (
          <p className="text-[10px] text-slate-400">{row.asignatura_code}</p>
        )}
      </td>

      {/* Semestre */}
      <td className="px-2 py-2 text-center text-xs text-slate-500">
        {row.semestre ?? '—'}
      </td>

      {/* Asignado a */}
      <td className="px-2 py-2">
        <select
          value={row.maestro_name
            ? (users.find((u) => u.full_name === row.maestro_name)?.profile_id ?? '')
            : ''}
          onChange={(e) => onAssign(row.asignatura_id, e.target.value || null)}
          disabled={isPending}
          className="text-xs rounded-md border border-slate-200 px-1.5 py-0.5 bg-white text-slate-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary w-full min-w-[110px] max-w-[150px]"
        >
          <option value="">Sin asignar</option>
          {users.map((u) => (
            u.profile_id && (
              <option key={u.profile_id} value={u.profile_id}>
                {u.full_name}
              </option>
            )
          ))}
        </select>
      </td>

      {/* Listo para revisar */}
      <td className="px-2 py-2 text-center">
        <StatusSelect
          value={row.listo_para_revisar}
          onChange={(v) => update({ listo_para_revisar: v })}
          disabled={isPending}
        />
      </td>

      {/* QA */}
      <td className="px-2 py-2 text-center">
        <StatusSelect
          value={row.qa_status}
          onChange={(v) => update({ qa_status: v })}
          disabled={isPending}
        />
      </td>

      {/* G1 – G5 */}
      {GROUPS.map((g) => (
        GROUP_FIELDS.map(({ key }) => (
          <td key={`g${g}_${key}`} className="px-1 py-2 text-center">
            <div className="flex justify-center">
              <Checkbox
                checked={row[`g${g}_${key}`]}
                onChange={(v) => update({ [`g${g}_${key}`]: v } as ChecklistUpdate)}
                disabled={isPending}
              />
            </div>
          </td>
        ))
      ))}

      {/* Carga completa */}
      <td className="px-1 py-2 text-center">
        <div className="flex justify-center">
          <Checkbox
            checked={row.carga_completa}
            onChange={(v) => update({ carga_completa: v })}
            disabled={isPending}
          />
        </div>
      </td>

      {/* Actividades Moodle */}
      <td className="px-1 py-2 text-center">
        <div className="flex justify-center">
          <Checkbox
            checked={row.actividades_moodle}
            onChange={(v) => update({ actividades_moodle: v })}
            disabled={isPending}
          />
        </div>
      </td>

      {/* Estado final */}
      <td className="px-3 py-2 text-center">
        <span className={cn('text-xs px-2 py-0.5 rounded-full whitespace-nowrap', FINAL_COLORS[estadoFinal])}>
          {estadoFinal}
        </span>
      </td>
    </tr>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function ChecklistTab({ projectId }: { projectId: string }) {
  const { isAdmin, isProjectLeader } = useAuth();
  const { data: rows = [], isLoading } = useChecklist(projectId);
  const { mutate: updateChecklist, isPending: updatingChecklist } = useUpdateChecklist(projectId);
  const { mutate: assignMaestro, isPending: assigningMaestro } = useAssignMaestro(projectId);
  const { data: users = [] } = useAdminUsers(isAdmin || isProjectLeader);

  const isPending = updatingChecklist || assigningMaestro;

  const handleUpdate = useCallback(
    (asignaturaId: string, data: ChecklistUpdate) => {
      updateChecklist({ asignaturaId, data });
    },
    [updateChecklist],
  );

  const handleAssign = useCallback(
    (asignaturaId: string, maestroId: string | null) => {
      assignMaestro({ asignaturaId, maestroId });
    },
    [assignMaestro],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <CheckSquare className="h-12 w-12 text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground font-medium">No hay asignaturas en este proyecto</p>
        <p className="text-sm text-muted-foreground mt-1">Agrega programas y asignaturas desde la pestaña Programas</p>
      </div>
    );
  }

  // Stats rápidas
  const total = rows.length;
  const completas = rows.filter((r) => calcEstadoFinal(r) === 'Materia Completa').length;
  const enProceso = rows.filter((r) => calcEstadoFinal(r) === 'En proceso').length;
  const sinIniciar = total - completas - enProceso;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total asignaturas', value: total,      color: 'text-foreground' },
          { label: 'Materia Completa',  value: completas,  color: 'text-green-600'  },
          { label: 'En proceso',        value: enProceso,  color: 'text-amber-600'  },
          { label: 'Sin iniciar',       value: sinIniciar, color: 'text-slate-500'  },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-3 shadow-sm">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{s.label}</p>
            <p className={cn('text-2xl font-semibold mt-0.5', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {/* Fixed cols */}
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 whitespace-nowrap sticky left-0 bg-slate-50 z-20 border-r border-slate-200 min-w-[110px]">
                Programa
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 sticky left-[110px] bg-slate-50 z-20 border-r border-slate-200 min-w-[180px]">
                Asignatura
              </th>
              <th className="px-2 py-2.5 text-center text-xs font-semibold text-slate-600 whitespace-nowrap">Sem.</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">Asignado a</th>
              <th className="px-2 py-2.5 text-center text-xs font-semibold text-slate-600 whitespace-nowrap">Listo</th>
              <th className="px-2 py-2.5 text-center text-xs font-semibold text-slate-600">QA</th>

              {/* G1-G5 headers */}
              {GROUPS.map((g) => (
                <th
                  key={`g${g}`}
                  colSpan={6}
                  className="px-1 py-2.5 text-center text-xs font-semibold text-slate-600 border-l border-slate-200 whitespace-nowrap"
                >
                  G{g}
                </th>
              ))}

              {/* Sub-headers row is a second <tr> below */}
              <th className="px-1 py-2.5 text-center text-xs font-semibold text-slate-600 border-l border-slate-200 whitespace-nowrap">
                Carga<br />Completa
              </th>
              <th className="px-1 py-2.5 text-center text-xs font-semibold text-slate-600 whitespace-nowrap">
                Moodle
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-600 whitespace-nowrap">
                Estado Final
              </th>
            </tr>
            {/* Sub-header for G fields */}
            <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] text-slate-500">
              <th colSpan={6} className="sticky left-0 bg-slate-50/80 z-20" />
              {GROUPS.map((g) =>
                GROUP_FIELDS.map(({ key, label }) => (
                  <th key={`sub_g${g}_${key}`} className="px-1 py-1 text-center font-medium border-l border-slate-100 first:border-slate-200">
                    {label}
                  </th>
                ))
              )}
              <th colSpan={3} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <ChecklistRowComponent
                key={row.asignatura_id}
                row={row}
                onUpdate={handleUpdate}
                onAssign={handleAssign}
                users={users}
                isPending={isPending}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

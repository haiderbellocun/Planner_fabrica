import { describe, it, expect } from 'vitest';
import { computeFocusStats, prioritize } from './focusStats';

const t = (id: string, due: string | null | undefined, status: { name?: string; is_completed?: boolean } | null = { name: 'En proceso' }) =>
  ({ id, due_date: due, status });
const TODAY = '2026-10-09'; // viernes
const EOW = '2026-10-11';   // domingo

describe('computeFocusStats', () => {
  const tasks = [
    t('over', '2026-10-01'), t('today', '2026-10-09'), t('sat', '2026-10-10'), t('next', '2026-10-12'),
    t('none', null), t('bad', 'xx'), t('rev', '2026-10-20', { name: 'En revisión' }),
    t('done', '2026-10-01', { name: 'Finalizado', is_completed: true }), t('nostatus', '2026-10-09', null),
  ];
  const s = computeFocusStats(tasks, TODAY, EOW);
  it('excluye completadas y cuenta cada categoría', () => {
    expect(s.pending.map((x) => x.id)).not.toContain('done');
    expect(s.vencidas.map((x) => x.id)).toEqual(['over']);
    expect(s.vencenHoy.map((x) => x.id)).toEqual(['today', 'nostatus']);
    expect(s.estaSemana.map((x) => x.id)).toEqual(['today', 'sat', 'nostatus']);
    expect(s.enRevision.map((x) => x.id)).toEqual(['rev']);
  });
  it('conjunto vacío o incompleto no falla', () => {
    expect(computeFocusStats([], TODAY, EOW)).toEqual({ pending: [], vencenHoy: [], vencidas: [], estaSemana: [], enRevision: [] });
    expect(computeFocusStats([t('a', undefined, null)], TODAY, EOW).pending).toHaveLength(1);
  });
  it('límites de semana: hoy y el domingo cuentan; el lunes siguiente no', () => {
    const r = computeFocusStats([t('d', EOW), t('m', '2026-10-12')], TODAY, EOW);
    expect(r.estaSemana.map((x) => x.id)).toEqual(['d']);
  });
});

describe('prioritize', () => {
  it('vencidas, luego hoy, luego por fecha; sin fecha al final; máximo 5', () => {
    const s = computeFocusStats([
      t('f2', '2026-10-30'), t('none', null), t('today', TODAY), t('over', '2026-09-01'), t('f1', '2026-10-15'), t('f3', '2026-11-30'),
    ], TODAY, EOW);
    expect(prioritize(s).map((x) => x.id)).toEqual(['over', 'today', 'f1', 'f2', 'f3']);
    expect(prioritize(s, 2).map((x) => x.id)).toEqual(['over', 'today']);
  });
});

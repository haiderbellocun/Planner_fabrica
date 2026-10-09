import { describe, it, expect, vi, beforeAll } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { render, screen, waitFor, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ApiRequestError, shouldRetryQuery } from '@/lib/apiError';

const auth = { user: { id: 'u1' as string | null } as { id: string } | null };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
const apiGet = vi.fn();
vi.mock('@/lib/api', () => ({ api: { get: (...a: unknown[]) => apiGet(...a) }, apiBaseUrl: '' }));
vi.mock('@/contexts/AuthContext.tsx', () => ({ useAuth: () => auth }));

import { QueryCacheGuard } from '@/components/QueryCacheGuard';
import { useTasks } from '@/hooks/useTasks';
import { TaskListView } from '@/components/tasks/TaskListView';

beforeAll(() => { Element.prototype.hasPointerCapture = () => false; });

describe('política de reintentos (408 y 429 son transitorios)', () => {
  it('408 y 429 se reintentan con el límite de 3; el resto de 4xx no', () => {
    for (const s of [408, 429]) {
      expect(shouldRetryQuery(0, new ApiRequestError('x', s))).toBe(true);
      expect(shouldRetryQuery(2, new ApiRequestError('x', s))).toBe(true);
      expect(shouldRetryQuery(3, new ApiRequestError('x', s))).toBe(false);
    }
    for (const s of [400, 401, 403, 404, 422]) expect(shouldRetryQuery(0, new ApiRequestError('x', s))).toBe(false);
    expect(shouldRetryQuery(0, new ApiRequestError('x', 503))).toBe(true);
  });
});

describe('separación de datos entre usuarios', () => {
  const setup = () => {
    const qc = new QueryClient();
    qc.setQueryData(['my-tasks'], [{ id: 'tarea-de-A' }]);
    const view = () => render(<QueryClientProvider client={qc}><QueryCacheGuard /></QueryClientProvider>);
    return { qc, view };
  };
  it('al cambiar de usuario (A → B) se vacía la caché: B nunca ve datos de A', () => {
    auth.user = { id: 'A' };
    const { qc, view } = setup();
    const r = view();
    expect(qc.getQueryData(['my-tasks'])).toBeDefined();
    auth.user = { id: 'B' };
    r.rerender(<QueryClientProvider client={qc}><QueryCacheGuard /></QueryClientProvider>);
    expect(qc.getQueryData(['my-tasks'])).toBeUndefined();
  });
  it('al cerrar sesión (A → sin usuario) también se vacía', () => {
    auth.user = { id: 'A' };
    const { qc, view } = setup();
    const r = view();
    auth.user = null;
    r.rerender(<QueryClientProvider client={qc}><QueryCacheGuard /></QueryClientProvider>);
    expect(qc.getQueryData(['my-tasks'])).toBeUndefined();
  });
  it('la hidratación inicial (sin usuario → usuario) y los re-render con el mismo usuario NO vacían la caché', () => {
    auth.user = null;
    const { qc, view } = setup();
    const r = view();
    auth.user = { id: 'A' };
    r.rerender(<QueryClientProvider client={qc}><QueryCacheGuard /></QueryClientProvider>);
    r.rerender(<QueryClientProvider client={qc}><QueryCacheGuard /></QueryClientProvider>);
    expect(qc.getQueryData(['my-tasks'])).toBeDefined();
  });
});

describe('separación de datos entre proyectos', () => {
  it('al pasar de un proyecto a otro nunca se muestran las tareas del anterior (ni como datos provisionales)', async () => {
    let releaseB!: () => void;
    const gateB = new Promise<void>((r) => { releaseB = r; });
    apiGet.mockImplementation(async (path: string) => {
      if (path.includes('/projects/B/')) { await gateB; return [{ id: 'tB', title: 'Tarea de B' }]; }
      return [{ id: 'tA', title: 'Tarea de A' }];
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    const { result, rerender } = renderHook(({ id }) => useTasks(id), { wrapper, initialProps: { id: 'A' } });
    await waitFor(() => expect(result.current.data?.[0]?.id).toBe('tA'));
    rerender({ id: 'B' });
    expect(result.current.data).toBeUndefined(); // sin datos provisionales de otro proyecto
    releaseB();
    await waitFor(() => expect(result.current.data?.[0]?.id).toBe('tB'));
  });

  it('al cambiar filtros del MISMO proyecto se conservan las tareas anteriores mientras carga', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    apiGet.mockImplementation(async (path: string) => {
      if (path.includes('priority=high')) { await gate; return [{ id: 't2' }]; }
      return [{ id: 't1' }];
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    const { result, rerender } = renderHook(({ f }) => useTasks('A', f), { wrapper, initialProps: { f: undefined as { priority: ('high')[] } | undefined } });
    await waitFor(() => expect(result.current.data?.[0]?.id).toBe('t1'));
    rerender({ f: { priority: ['high'] } });
    expect(result.current.data?.[0]?.id).toBe('t1');
    expect(result.current.isPlaceholderData).toBe(true);
    release();
    await waitFor(() => expect(result.current.data?.[0]?.id).toBe('t2'));
  });
});

describe('claves de consulta', () => {
  it('toda consulta cuyo hook recibe un identificador lo incluye en su queryKey', () => {
    const missing: string[] = [];
    for (const f of readdirSync('src/hooks').filter((n) => n.endsWith('.ts'))) {
      const src = readFileSync(`src/hooks/${f}`, 'utf8');
      for (const part of src.split(/\nexport function /).slice(1)) {
        const sig = part.match(/^(\w+)\(([^)]*)\)/);
        const key = part.match(/queryKey:\s*(\[[^\]]*\])/);
        if (!sig || !key) continue;
        const ids = [...sig[2].matchAll(/(\w+Id)\b/g)].map((m) => m[1]);
        for (const id of ids) if (!key[1].includes(id)) missing.push(`${f}:${sig[1]}:${id}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe('listas grandes', () => {
  it('la lista de tareas pagina: con 500 tareas solo se renderizan 25 filas', () => {
    const tasks = Array.from({ length: 500 }, (_, i) => ({
      id: `t${i}`, title: `Tarea ${i}`, task_number: i + 1, priority: 'medium', status_id: 's1', due_date: null,
      status: { id: 's1', name: 'En proceso', color: '#0DD9D0', is_completed: false }, assignee: null, epic: null, team: null, sprint: null,
      created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z',
    })) as never;
    render(
      <QueryClientProvider client={new QueryClient()}><MemoryRouter>
        <TaskListView tasks={tasks} projectKey="ALF" projectId="p1" onTaskClick={vi.fn()} />
      </MemoryRouter></QueryClientProvider>,
    );
    const rows = screen.getAllByRole('row').length - 1; // menos la cabecera
    expect(rows).toBe(25);
    expect(screen.getByText(/Mostrando 1-25 de 500 tareas/)).toBeInTheDocument();
  });
});

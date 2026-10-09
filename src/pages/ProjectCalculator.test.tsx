import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';

const auth = { isAdmin: false, isProjectLeader: false };
// useAuth usa un hook real: así el render con redirección ya tiene 1 hook y React detecta cambios de orden.
vi.mock('@/contexts/AuthContext', async () => {
  const { useState } = await import('react');
  return { useAuth: () => { useState(0); return auth; } };
});
vi.mock('@/hooks/useMateriales', () => ({ useMaterialTypes: () => ({ data: [], isLoading: false }) }));
vi.mock('@/hooks/useTiemposEstimados', () => ({ useTiemposEstimados: () => ({ data: [], isLoading: false }) }));

import ProjectCalculator from './ProjectCalculator';

const ui = () => (
  <MemoryRouter><TooltipProvider><ProjectCalculator /></TooltipProvider></MemoryRouter>
);

describe('ProjectCalculator', () => {
  it('cambiar de rol entre renders no altera el orden de los hooks', () => {
    const errors: unknown[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...a) => { errors.push(a); });
    auth.isAdmin = false; auth.isProjectLeader = false;
    const { rerender } = render(ui());
    auth.isProjectLeader = true;
    expect(() => rerender(ui())).not.toThrow();
    auth.isProjectLeader = false;
    expect(() => rerender(ui())).not.toThrow();
    spy.mockRestore();
    expect(errors.filter((e) => String(e).includes('order of Hooks'))).toEqual([]);
  });

  it('con catálogos vacíos renderiza sin caerse', () => {
    auth.isAdmin = true;
    expect(() => render(ui())).not.toThrow();
  });
});

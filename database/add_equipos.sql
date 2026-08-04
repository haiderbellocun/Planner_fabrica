-- Migration: Add equipos (panel global de 5 equipos fijos)
-- Creates equipos + equipo_members tables and seeds the 5 fixed slots

-- 1. Create equipos table (slot fijo 1..5, no se crean ni eliminan filas)
CREATE TABLE IF NOT EXISTS public.equipos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot INTEGER NOT NULL UNIQUE CHECK (slot BETWEEN 1 AND 5),
  name TEXT NOT NULL,
  color VARCHAR(20) NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create equipo_members table
CREATE TABLE IF NOT EXISTS public.equipo_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipo_id UUID NOT NULL REFERENCES public.equipos(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (equipo_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_equipo_members_equipo_id ON public.equipo_members(equipo_id);

-- 3. Seed the 5 fixed slots
INSERT INTO public.equipos (slot, name, color) VALUES
  (1, 'Equipo 1', '#6366f1'),
  (2, 'Equipo 2', '#8b5cf6'),
  (3, 'Equipo 3', '#ec4899'),
  (4, 'Equipo 4', '#f97316'),
  (5, 'Equipo 5', '#22c55e')
ON CONFLICT (slot) DO NOTHING;

-- Verify
SELECT 'equipos table created' AS result
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='equipos');

SELECT 'equipo_members table created' AS result
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='equipo_members');

SELECT 'equipos seeded: ' || COUNT(*) AS result FROM public.equipos;

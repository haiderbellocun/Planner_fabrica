import { useEffect } from 'react';
import { APP_NAME } from '@/components/layout/navConfig';

/** Fija el título de la pestaña («{título} · Planner Fábrica»). Sin título, no hace nada. */
export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    if (!title) return;
    document.title = title.endsWith(APP_NAME) ? title : `${title} · ${APP_NAME}`;
  }, [title]);
}

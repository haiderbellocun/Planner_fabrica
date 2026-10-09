import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

export interface Crumb {
  label: string;
  /** Sin `to`, es la página actual. */
  to?: string;
}

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  /** Acciones principales de la página (la primera, la más importante). */
  actions?: ReactNode;
  breadcrumbs?: Crumb[];
  className?: string;
}

/**
 * Encabezado único de página: migas opcionales, <h1>, subtítulo y acciones. En móvil apila las
 * acciones bajo el título; en pantallas anchas las alinea a la derecha. Un solo <h1> por página.
 */
export function PageHeader({ title, description, icon: Icon, actions, breadcrumbs, className }: PageHeaderProps) {
  return (
    <div className={cn('page-header flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <Breadcrumb className="mb-2">
            <BreadcrumbList>
              {breadcrumbs.map((c, i) => (
                <Fragment key={`${c.label}-${i}`}>
                  {i > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem>
                    {c.to ? (
                      <BreadcrumbLink asChild><Link to={c.to}>{c.label}</Link></BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage>{c.label}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                </Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        )}
        <h1 className="page-title flex items-center gap-2">
          {Icon && <Icon className="h-6 w-6 shrink-0 text-primary-deep" aria-hidden="true" />}
          <span className="min-w-0 break-words">{title}</span>
        </h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>}
    </div>
  );
}

import { PageSkeleton } from '@/components/shared/Skeletons';
import { ErrorState, RefetchError } from '@/components/shared/StoryUI';
import { PageHeader } from '@/components/layout/PageHeader';
import { activatable, activatableRow } from '@/lib/a11y';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead, useDeleteNotification } from '@/hooks/useNotifications';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Check, CheckCheck, Trash2, Loader2, FolderKanban, ListTodo } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

const notificationIcons = {
  task_assigned: ListTodo,
  project_member_added: FolderKanban,
  task_status_changed: Check,
  task_commented: Bell,
  task_updated: ListTodo,
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { data: notificationsData, isLoading, isError, error, refetch, isFetching } = useNotifications();
  const notifications = notificationsData ?? [];
  const markAsRead = useMarkNotificationRead();
  const markAllAsRead = useMarkAllNotificationsRead();
  const deleteNotification = useDeleteNotification();

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleNotificationClick = (notification: (typeof notifications)[0]) => {
    if (!notification.read) markAsRead.mutate(notification.id);
    if (notification.project_id && notification.task_id) {
      navigate(`/projects/${notification.project_id}?task=${notification.task_id}`);
    } else if (notification.project_id) {
      navigate(`/projects/${notification.project_id}`);
    }
  };

  if (isLoading) {
    return (
      <div className="page-container max-w-3xl">
        <PageSkeleton tiles={0} rows={6} />
      </div>
    );
  }

  // Error sin datos: se explica y se ofrece reintentar. Con datos anteriores se conservan (aviso abajo).
  if (isError && notificationsData === undefined) {
    return (
      <div className="page-container max-w-3xl">
        <PageHeader title="Notificaciones" />
        <ErrorState message="No se pudieron cargar las notificaciones." error={error} onRetry={() => refetch()} retrying={isFetching} />
      </div>
    );
  }

  return (
    <div className="page-container max-w-3xl">
      <PageHeader
        title="Notificaciones"
        description={unreadCount > 0 ? `${unreadCount} sin leer` : notifications.length > 0 ? 'Todas leídas' : undefined}
        actions={unreadCount > 0 && (
          <Button
            variant="outline"
            onClick={() => markAllAsRead.mutate()}
            disabled={markAllAsRead.isPending}
          >
            <CheckCheck className="mr-2 h-4 w-4" />
            Marcar todas como leídas
          </Button>
        )}
      />
      {isError && <RefetchError error={error} onRetry={() => refetch()} retrying={isFetching} />}

      <Card>
        <CardContent className="p-0">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Bell className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Sin notificaciones</h3>
              <p className="text-muted-foreground text-center">
                Te notificaremos cuando haya actividad relevante
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => {
                const Icon = notificationIcons[notification.type as keyof typeof notificationIcons] || Bell;
                const isClickable = !!notification.project_id;

                return (
                  <div
                    key={notification.id}
                    {...(isClickable ? activatable(() => handleNotificationClick(notification)) : { onClick: () => handleNotificationClick(notification) })}
                    className={cn(
                      'flex items-start gap-4 p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                      !notification.read && 'bg-accent/20',
                      isClickable && 'cursor-pointer hover:bg-muted/60',
                      !isClickable && 'hover:bg-muted/30',
                    )}
                  >
                    <div
                      className={cn(
                        'h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0',
                        notification.read ? 'bg-muted' : 'bg-primary/10'
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-5 w-5',
                          notification.read ? 'text-muted-foreground' : 'text-primary'
                        )}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{notification.title}</p>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {notification.message}
                          </p>
                        </div>
                        {!notification.read && (
                          <Badge variant="default" className="flex-shrink-0">Nueva</Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(notification.created_at), {
                            addSuffix: true,
                            locale: es,
                          })}
                        </span>
                        {isClickable && (
                          <span className="text-xs text-primary">
                            · {notification.task_id ? 'Clic para ir a la tarea' : 'Clic para ir al proyecto'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {!notification.read && (
                        <Button aria-label="Confirmar"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => markAsRead.mutate(notification.id)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Button aria-label="Eliminar"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteNotification.mutate(notification.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import * as RadixHoverCard from '@radix-ui/react-hover-card';
import {Link, NavLink, useFetcher} from '@remix-run/react';
import {ChevronUp} from 'lucide-react';
import {useEffect, useMemo, useState} from 'react';
import {LuBell} from 'react-icons/lu';
import {Button} from '~/components/ui/button';

type NotificationsResponse = {
  loggedIn: boolean;
  unreadCount: number;
  notifications: Array<{
    id: string;
    title: string;
    message: string;
    createdAt: string;
    readAt?: string | null;
  }>;
};

function NotificationsDropdown() {
  const [open, setOpen] = useState(false);
  const fetcher = useFetcher<NotificationsResponse>();

  const notifications = fetcher.data?.notifications ?? [];
  const unreadCount = fetcher.data?.unreadCount ?? 0;

  useEffect(() => {
    fetcher.load('/api/notifications?limit=6');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return;
    fetcher.load('/api/notifications?limit=6');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const notificationsUrl = useMemo(() => {
    return fetcher.data?.loggedIn === false
      ? '/account/login'
      : '/account/notifications';
  }, [fetcher.data?.loggedIn]);

  return (
    <RadixHoverCard.Root
      open={open}
      onOpenChange={setOpen}
      openDelay={100}
      closeDelay={100}
    >
      <RadixHoverCard.Trigger asChild>
        <div className="flex items-center gap-1 cursor-pointer">
          <NavLink prefetch="intent" to={notificationsUrl}>
            <Button className="w-1" variant="outline">
              <div>
                <LuBell className="relative -bottom-3 -right-1" />
                <span className="relative -top-6 -right-5 bg-primary text-white rounded-full h-6 w-6 flex items-center justify-center text-xs">
                  {unreadCount}
                </span>
              </div>
            </Button>
          </NavLink>
          <span className="cursor-default text-primary">
            <ChevronUp
              className={`rounded-md border border-input transition-transform duration-200 ${
                open ? 'rotate-180' : 'rotate-0'
              }`}
              size={18}
            />
          </span>
        </div>
      </RadixHoverCard.Trigger>

      <RadixHoverCard.Portal>
        <RadixHoverCard.Content
          sideOffset={6}
          align="end"
          className="hovercard-content rounded border-l border-r border-t border-b w-[340px]"
        >
          <div className="p-2">
            {notifications.length ? (
              <div className="flex flex-col">
                {notifications.map((notification) => {
                  const isUnread = !notification.readAt;
                  const selectedUrl = fetcher.data?.loggedIn
                    ? `/account/notifications?selected=${encodeURIComponent(
                        notification.id,
                      )}`
                    : '/account/login';
                  return (
                    <Link
                      key={notification.id}
                      to={selectedUrl}
                      className="rounded px-3 py-2 hover:bg-accent"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {notification.title}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {notification.message}
                          </p>
                        </div>
                        {isUnread && (
                          <span className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No notifications yet.
              </div>
            )}
          </div>
        </RadixHoverCard.Content>
      </RadixHoverCard.Portal>
    </RadixHoverCard.Root>
  );
}

export default NotificationsDropdown;

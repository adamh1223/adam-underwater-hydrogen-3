import * as RadixHoverCard from '@radix-ui/react-hover-card';
import {NavLink, useLocation, useRouteLoaderData} from '@remix-run/react';
import {ChevronUp} from 'lucide-react';
import {useEffect, useState} from 'react';
import {useMobileActivationGuard} from '~/lib/useMobileActivationGuard';
import type {RootLoader} from '~/root';

function AdminDropdown() {
  const rootData = useRouteLoaderData<RootLoader>('root');
  const [open, setOpen] = useState(false);
  const mobileActivationGuard = useMobileActivationGuard();
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search, location.hash]);

  if (!rootData?.isAdmin) return null;

  return (
    <RadixHoverCard.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (mobileActivationGuard.isMobileTouchUi && nextOpen) return;
        setOpen(nextOpen);
      }}
      openDelay={100}
      closeDelay={100}
    >
      <RadixHoverCard.Trigger asChild>
        <div className="flex items-center cursor-pointer">
          <div className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive cursor-pointer border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-[6px] py-2 flex items-center gap-[0px] cursor-pointer">
            <span className="font-bold text-primary select-none">A</span>
            <button
              type="button"
              aria-label="Toggle admin menu"
              aria-expanded={open}
              className="ps-[1px] text-primary cursor-default"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (mobileActivationGuard.shouldSuppressActivation()) {
                  return;
                }
                setOpen((currentOpen) => !currentOpen);
              }}
            >
              <ChevronUp
                className={`rounded-md border border-input transition-transform duration-200 ${
                  open ? 'rotate-180' : 'rotate-0'
                }`}
                size={18}
              />
            </button>
          </div>
        </div>
      </RadixHoverCard.Trigger>

      <RadixHoverCard.Portal>
        <RadixHoverCard.Content
          sideOffset={6}
          align="center"
          className="hovercard-content rounded border-l border-r border-t border-b w-[200px]"
        >
          <div className="p-2">
            <NavLink
              to="/admin/dashboard"
              onClick={() => setOpen(false)}
              className="block rounded px-3 py-2 hover:bg-accent text-sm font-medium"
            >
              Customer Channels
            </NavLink>
          </div>
        </RadixHoverCard.Content>
      </RadixHoverCard.Portal>
    </RadixHoverCard.Root>
  );
}

export default AdminDropdown;

// ServicesDropdown.tsx (Portal version)
import * as RadixHoverCard from '@radix-ui/react-hover-card';
import {Link, NavLink} from '@remix-run/react';
import React, {useEffect, useRef, useState} from 'react';
import {ChevronUp} from 'lucide-react';
import {Button} from '../ui/button';

function ServicesDropdown({
  menuItems,
  publicStoreDomain,
  primaryDomainUrl,
  enableMobileToggle = false,
}: {
  menuItems: any;
  publicStoreDomain: string;
  primaryDomainUrl: string;
  enableMobileToggle?: boolean;
}) {
  const triggerUrl =
    menuItems.url.includes('myshopify.com') ||
    menuItems.url.includes(publicStoreDomain) ||
    menuItems.url.includes(primaryDomainUrl)
      ? new URL(menuItems.url).pathname
      : menuItems.url;

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const writeScrollTarget = (sectionId: string) => {
    try {
      sessionStorage.setItem('services-scroll-target', sectionId);
    } catch (e) {
      // ignore storage errors (privacy mode, etc.)
    }
  };

  useEffect(() => {
    if (!enableMobileToggle || !open) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current?.contains(target) ||
        contentRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [enableMobileToggle, open]);

  return (
    <RadixHoverCard.Root
      open={open}
      onOpenChange={setOpen}
      openDelay={100}
      closeDelay={100}
    >
      <div ref={containerRef} className="flex items-center">
        <RadixHoverCard.Trigger asChild>
          <NavLink
            to={triggerUrl}
            className="relative services-dropdown"
            end
            prefetch="intent"
          >
            <button className="relative group about-dropdown-button ps-3 py-2 rounded-md transition-colors hover:bg-accent hover:text-primary cursor-pointer text-primary hover:bg-accent hover:text-accent-foreground text-sm font-md">
              {menuItems.title}
              <span className="absolute bottom-0 left-[2px] right-[2px] h-[2px] bg-primary scale-x-0 transition-transform duration-300 group-hover:scale-x-100 origin-center" />
            </button>
          </NavLink>
        </RadixHoverCard.Trigger>

        {enableMobileToggle && (
          <button
            type="button"
            aria-label={`Toggle ${menuItems.title} menu`}
            aria-expanded={open}
            className="h-8 ps-1 pe-[6px] text-primary hover:bg-accent hover:text-accent-foreground"
            onClick={(event) => {
              event.preventDefault();
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
        )}
      </div>

      <RadixHoverCard.Portal>
        <RadixHoverCard.Content
          ref={contentRef}
          sideOffset={0}
          align="center"
          className="hovercard-content rounded border-l border-r border-t border-b w-[178px]"
        >
          <div className="p-3">
            <Button variant="ghost">
              <Link
                to={'/pages/services#video'}
                onClick={() => writeScrollTarget('video')}
              >
                Underwater Video
              </Link>
            </Button>

            <Button variant="ghost">
              <Link
                to={'/pages/services#photo'}
                onClick={() => writeScrollTarget('photo')}
              >
                Underwater Photo
              </Link>
            </Button>

            <Button variant="ghost">
              <Link
                to={'/pages/services#drone'}
                onClick={() => writeScrollTarget('drone')}
              >
                Drone Services
              </Link>
            </Button>
          </div>
        </RadixHoverCard.Content>
      </RadixHoverCard.Portal>
    </RadixHoverCard.Root>
  );
}

export default ServicesDropdown;

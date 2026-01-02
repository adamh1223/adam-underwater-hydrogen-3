// AboutDropdown.tsx (updated)
import * as RadixHoverCard from '@radix-ui/react-hover-card';
import {Link, NavLink} from '@remix-run/react';
import React, {useEffect, useRef, useState} from 'react';
import {ChevronUp} from 'lucide-react';
import {Button} from '../ui/button';

function AboutDropdown({
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
      sessionStorage.setItem('about-scroll-target', sectionId);
    } catch (e) {
      // ignore storage errors
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
      <div ref={containerRef} className="flex items-center gap-1">
        <RadixHoverCard.Trigger asChild>
          <NavLink
            to={triggerUrl}
            className="relative about-dropdown"
            end
            prefetch="intent"
          >
            <Button
              variant="ghost2"
              className="relative group about-dropdown-button py-2 rounded-md transition-colors hover:bg-accent hover:text-primary cursor-pointer"
            >
              {menuItems.title}
              <span className="absolute bottom-0 left-[2px] right-[2px] h-[2px] bg-primary scale-x-0 transition-transform duration-300 group-hover:scale-x-100 origin-center" />
            </Button>
          </NavLink>
        </RadixHoverCard.Trigger>

        {enableMobileToggle && (
          <Button
            type="button"
            variant="ghost2"
            size="icon"
            aria-label={`Toggle ${menuItems.title} menu`}
            aria-expanded={open}
            className="p-1 h-8 w-8 flex items-center justify-center"
            onClick={(event) => {
              event.preventDefault();
              setOpen((currentOpen) => !currentOpen);
            }}
          >
            <ChevronUp
              className={`transition-transform duration-200 ${
                open ? 'rotate-180' : 'rotate-0'
              }`}
              size={18}
            />
          </Button>
        )}
      </div>

      <RadixHoverCard.Portal>
        <RadixHoverCard.Content
          ref={contentRef}
          sideOffset={0}
          align="center"
          className="hovercard-content rounded border-l border-r border-t border-b w-[122px]"
        >
          <div className="p-3">
            <Button variant="ghost" className="cursor-pointer">
              <Link
                to={'/pages/about'}
                onClick={() => writeScrollTarget('about')}
              >
                About Me
              </Link>
            </Button>
            <Button variant="ghost" className="cursor-pointer">
              <Link
                to={'/pages/about#gear'}
                onClick={() => writeScrollTarget('gear')}
              >
                My Gear
              </Link>
            </Button>
          </div>
        </RadixHoverCard.Content>
      </RadixHoverCard.Portal>
    </RadixHoverCard.Root>
  );
}

export default AboutDropdown;

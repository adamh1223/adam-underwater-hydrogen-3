// ServicesDropdown.tsx (Portal version)
import * as RadixHoverCard from '@radix-ui/react-hover-card';
import {NavLink, Link} from '@remix-run/react';
import React from 'react';
import {Button} from '../ui/button';

function ServicesDropdown({
  menuItems,
  publicStoreDomain,
  primaryDomainUrl,
}: {
  menuItems: any;
  publicStoreDomain: string;
  primaryDomainUrl: string;
}) {
  const triggerUrl =
    menuItems.url.includes('myshopify.com') ||
    menuItems.url.includes(publicStoreDomain) ||
    menuItems.url.includes(primaryDomainUrl)
      ? new URL(menuItems.url).pathname
      : menuItems.url;

  const writeScrollTarget = (sectionId: string) => {
    try {
      sessionStorage.setItem('services-scroll-target', sectionId);
    } catch (e) {
      // ignore storage errors (privacy mode, etc.)
    }
  };

  return (
    <RadixHoverCard.Root openDelay={100} closeDelay={100}>
      <RadixHoverCard.Trigger asChild>
        <NavLink
          to={triggerUrl}
          className="relative services-dropdown"
          end
          prefetch="intent"
        >
          <Button
            variant="ghost2"
            className="relative group services-dropdown-button py-2 rounded-md transition-colors hover:bg-accent hover:text-primary cursor-pointer"
          >
            {menuItems.title}
            <span className="absolute bottom-0 left-[2px] right-[2px] h-[2px] bg-primary scale-x-0 transition-transform duration-300 group-hover:scale-x-100 origin-center" />
          </Button>
        </NavLink>
      </RadixHoverCard.Trigger>

      <RadixHoverCard.Portal>
        <RadixHoverCard.Content
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

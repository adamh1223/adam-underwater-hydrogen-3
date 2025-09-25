// ServicesDropdown.tsx (Portal version)
import * as RadixHoverCard from '@radix-ui/react-hover-card';
import {NavLink} from '@remix-run/react';
import {Link} from 'react-router-dom';
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
            className="relative group px-4 py-2 rounded-md transition-colors hover:bg-accent hover:text-primary cursor-pointer"
          >
            {menuItems.title}
            <span className="absolute bottom-0 left-[2px] right-[2px] h-[2px] bg-primary scale-x-0 transition-transform duration-300 group-hover:scale-x-100 origin-center" />
          </Button>
        </NavLink>
      </RadixHoverCard.Trigger>

      {/* Portal ensures the Content is appended to document.body */}
      <RadixHoverCard.Portal>
        <RadixHoverCard.Content
          sideOffset={0}
          align="center"
          className="hovercard-content rounded border-l border-r border-t border-b w-[178px]"
        >
          <div className="p-3">
            <Button variant="ghost">
              <Link to={'/pages/services#video'}>Underwater Video</Link>
            </Button>
            <Button variant="ghost">
              <Link to={'/pages/services#photo'}>Underwater Photo</Link>
            </Button>
            <Button variant="ghost">
              <Link to={'/pages/services#drone'}>Drone Services</Link>
            </Button>
          </div>
        </RadixHoverCard.Content>
      </RadixHoverCard.Portal>
    </RadixHoverCard.Root>
  );
}

export default ServicesDropdown;

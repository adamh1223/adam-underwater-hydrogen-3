// AboutDropdown.tsx (updated)
import * as RadixHoverCard from '@radix-ui/react-hover-card';
import {NavLink, Link} from '@remix-run/react';
import React from 'react';
import {Button} from '../ui/button';

function AboutDropdown({
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
      sessionStorage.setItem('about-scroll-target', sectionId);
    } catch (e) {
      // ignore storage errors
    }
  };

  return (
    <RadixHoverCard.Root openDelay={100} closeDelay={100}>
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

      <RadixHoverCard.Portal>
        <RadixHoverCard.Content
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

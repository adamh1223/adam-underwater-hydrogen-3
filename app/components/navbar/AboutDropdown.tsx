import Submenu from './Submenu';

import {NavLink} from '@remix-run/react';
import {Link} from 'react-router-dom';
import React from 'react';
import {HoverCard, HoverCardContent, HoverCardTrigger} from '../ui/hover-card';
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
  return (
    <HoverCard openDelay={100} closeDelay={100}>
      <HoverCardTrigger>
        <NavLink
          to={triggerUrl}
          className="relative z-10"
          end
          prefetch="intent"
        >
          <Button
            variant="ghost2"
            className="relative group px-4 py-2 rounded-md transition-colors hover:bg-accent hover:text-primary cursor-pointer"
          >
            {/* <NavLink to = {triggerUrl}>{menuItems.title}</NavLink> */}
            {menuItems.title}
            <span className="absolute bottom-0 left-[2px] right-[2px] h-[2px] bg-primary scale-x-0 transition-transform duration-300 group-hover:scale-x-100 origin-center" />
          </Button>
        </NavLink>
      </HoverCardTrigger>
      <HoverCardContent className="w-36">
        {/* <NavLink to = {url}>{subItem.title}</NavLink> */}
        <Button variant="ghost">
          <Link to={'/pages/about'}>About Me</Link>
        </Button>
        <Button variant="ghost">
          <Link to={'/pages/about#gear'}>My Gear</Link>
        </Button>

        {/* {menuItems.items.map((subItem: any) => {
        console.log(new URL(subItem.url), '333333');
        
            const url =
          subItem.url.includes('myshopify.com') ||
          subItem.url.includes(publicStoreDomain) ||
          subItem.url.includes(primaryDomainUrl)
            ? `${new URL(subItem.url).pathname}${new URL(subItem.url).hash}`
            : menuItems.url;
            console.log(url, '777');
            return (
          <React.Fragment key={url}>
          
        <Button variant="link" key={url}>


        <Link to={'/pages/about'}>About Me</Link>
        <Link to={'/pages/about#gear'}>My Gear</Link>
        
        </Button>
      </React.Fragment>
    )})} */}
      </HoverCardContent>
    </HoverCard>
  );
}

export default AboutDropdown;

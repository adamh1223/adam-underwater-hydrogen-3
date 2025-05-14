

import Submenu from "./Submenu";

import { NavLink } from "@remix-run/react";
import { Link } from "react-router-dom";
import React from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../ui/hover-card";
import { Button } from "../ui/button";


function ServicesDropdown({menuItems, publicStoreDomain, primaryDomainUrl}:{menuItems: any, publicStoreDomain: string, primaryDomainUrl: string}) {
const triggerUrl =
          menuItems.url.includes('myshopify.com') ||
          menuItems.url.includes(publicStoreDomain) ||
          menuItems.url.includes(primaryDomainUrl)
            ? new URL(menuItems.url).pathname
            : menuItems.url;
  return (
    <HoverCard openDelay={100} closeDelay={100}>
        <HoverCardTrigger>
          <Button variant="link">
            {/* <NavLink to = {triggerUrl}>{menuItems.title}</NavLink> */}
            <Link to={triggerUrl}>{menuItems.title}</Link>
          </Button>
      </HoverCardTrigger>
      <HoverCardContent className="w-40">
         <Button variant="link">

        {/* <NavLink to = {url}>{subItem.title}</NavLink> */}
        <Link to={'/pages/services#video'}>Underwater Video</Link>
        <Link to={'/pages/services#photo'}>Underwater Photo</Link>
        <Link to={'/pages/services#drone'}>Underwater Photo</Link>
        
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


export default ServicesDropdown;

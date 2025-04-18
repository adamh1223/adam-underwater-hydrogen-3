
import { Button } from "../ui/button";
import Submenu from "./Submenu";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../ui/hover-card";
import { NavLink } from "@remix-run/react";
import { Link } from "react-router-dom";


function AboutDropdown({menuItems, publicStoreDomain, primaryDomainUrl}:{menuItems: any, publicStoreDomain: string, primaryDomainUrl: string}) {
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
      {menuItems.items.map((subItem: any) => {
        console.log(subItem, '333333');
        
            const url =
          subItem.url.includes('myshopify.com') ||
          subItem.url.includes(publicStoreDomain) ||
          subItem.url.includes(primaryDomainUrl)
            ? new URL(subItem.url).pathname
            : menuItems.url;
            return (
          <>

        <Button variant="link" key={url}>

        {/* <NavLink to = {url}>{subItem.title}</NavLink> */}
        <Link to ={url}>{subItem.title}</Link>
        
        </Button>
      </>
    )})}
    </HoverCardContent>
    </HoverCard>
  );
}


export default AboutDropdown;

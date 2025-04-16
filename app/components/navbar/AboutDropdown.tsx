
import { Button } from "../ui/button";
import Submenu from "./Submenu";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../ui/hover-card";


function AboutDropdown() {
  const handleServicesClick = () => {
    
  };
  const handleSubservicesClick = (section: string) => {
    
  };
  return (
    <HoverCard openDelay={100} closeDelay={100}>
      <HoverCardTrigger>
        <Button variant="link" onClick={handleServicesClick}>
          About
        </Button>
      </HoverCardTrigger>

      <HoverCardContent className="w-40">
        <Button variant="ghost" onClick={() => handleSubservicesClick("about")}>
          About Me
        </Button>
        <Button variant="ghost" onClick={() => handleSubservicesClick("gear")}>
          My Gear
        </Button>
      </HoverCardContent>
    </HoverCard>
  );
}

export default AboutDropdown;

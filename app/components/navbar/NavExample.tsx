import {
  Navbar03,
  defaultNavigationLinks,
} from 'components/ui/shadcn-io/navbar-03';

const NavExample = () => (
  <div className="relative w-full">
    <Navbar03 navigationLinks={defaultNavigationLinks}></Navbar03>
  </div>
);
export default NavExample;

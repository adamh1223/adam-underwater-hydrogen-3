import './Submenu.css'


interface SubmenuProps{
  visible: Boolean;
  onMouseLeave: () => void
}

function Submenu({visible, onMouseLeave}:SubmenuProps) {
  return (
    <div
    onMouseLeave={onMouseLeave}
      className={visible ? "submenu show-submenu" : "submenu"}
    >
      {visible && <><h5>{'hello'}</h5>
      <div
        className="submenu-links"
        style={{
          gridTemplateColumns:
            "1fr",
        }}
      >
            <a>
              <div className="submenu-icon">{'thing'}</div>
              <p className="sublink-text">{'thing2'}</p>
            </a>
      </div></>}
      
    </div>
    
  );
}

export default Submenu

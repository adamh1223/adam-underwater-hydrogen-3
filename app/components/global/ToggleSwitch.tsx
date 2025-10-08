import React, {useState} from 'react';

export default function ToggleSwitch({
  updateState,
}: {
  updateState: React.Dispatch<React.SetStateAction<string>>;
}) {
  const [selected, setSelected] = useState<string>('All');
  const updateParent = (direction: string) => {
    setSelected(direction);
    updateState(direction);
  };

  return (
    <div className="toggle-container">
      <button
        className={`toggle-option ${selected === 'All' ? 'selected' : ''}`}
        onClick={() => updateParent('All')}
      >
        All
      </button>
      <button
        className={`toggle-option ${selected === 'Horizontal' ? 'selected' : ''}`}
        onClick={() => updateParent('Horizontal')}
      >
        Horizontal
      </button>
      <button
        className={`toggle-option ${selected === 'Vertical' ? 'selected' : ''}`}
        onClick={() => updateParent('Vertical')}
      >
        Vertical
      </button>
    </div>
  );
}

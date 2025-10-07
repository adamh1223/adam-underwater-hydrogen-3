import React, {useState} from 'react';

export default function ToggleSwitch() {
  const [selected, setSelected] = useState<'Horizontal' | 'Vertical' | 'All'>(
    'All',
  );

  return (
    <div className="toggle-container">
      <button
        className={`toggle-option ${selected === 'All' ? 'selected' : ''}`}
        onClick={() => setSelected('All')}
      >
        All
      </button>
      <button
        className={`toggle-option ${selected === 'Horizontal' ? 'selected' : ''}`}
        onClick={() => setSelected('Horizontal')}
      >
        Horizontal
      </button>
      <button
        className={`toggle-option ${selected === 'Vertical' ? 'selected' : ''}`}
        onClick={() => setSelected('Vertical')}
      >
        Vertical
      </button>
    </div>
  );
}

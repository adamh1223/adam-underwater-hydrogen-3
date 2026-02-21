import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip';

export default function ToggleSwitch({
  selected,
  onChange,
}: {
  selected: 'All' | 'Horizontal' | 'Vertical';
  onChange: (value: 'All' | 'Horizontal' | 'Vertical') => void;
}) {
  return (
    <TooltipProvider>
      <div className="toggle-container">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className={`toggle-option ${selected === 'All' ? 'selected' : ''}`}
              onClick={() => onChange('All')}
            >
              All
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-sm z-1000">
            Keyboard shortcut: a
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className={`toggle-option ${selected === 'Horizontal' ? 'selected' : ''}`}
              onClick={() => onChange('Horizontal')}
            >
              Horizontal
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-sm z-1000">
            Keyboard shortcut: h
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className={`toggle-option ${selected === 'Vertical' ? 'selected' : ''}`}
              onClick={() => onChange('Vertical')}
            >
              Vertical
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-sm z-1000">
            Keyboard shortcut: v
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

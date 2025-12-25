import * as React from 'react';
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import {Toaster as Sonner, type ToasterProps} from 'sonner';

const Toaster = (props: ToasterProps) => {
  return (
    <Sonner
      toastOptions={{
        classNames: {
          toast:
            'toast-width bg-primary text-background border !border-background shadow-lg',

          // ✅ success background + text via CSS variables
          // this is where we can change toast colors
          success: '!bg-primary !text-background',

          description: 'text-[hsl(var(--background)/0.85)]',

          actionButton: '!bg-background !text-white',

          cancelButton: 'bg-transparent text-[hsl(var(--background))]',
        },
      }}
      icons={{
        success: <CircleCheckIcon className="h-4 w-4" />,
        info: <InfoIcon className="h-4 w-4" />,
        warning: <TriangleAlertIcon className="h-4 w-4" />,
        error: <OctagonXIcon className="h-4 w-4" />,
        loading: <Loader2Icon className="h-4 w-4 animate-spin" />,
      }}
      {...props}
    />
  );
};

export {Toaster};

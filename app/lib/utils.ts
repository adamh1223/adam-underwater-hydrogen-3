import {clsx, type ClassValue} from 'clsx';
import {twMerge} from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateCartDescription(tag: string | undefined) {
  if (tag === 'Prints') {
    return 'PRINT';
  }
  if (tag === 'Video') {
    return 'VIDEO';
  }
}
export function includesTagName(tags: string[], tagToLookFor: string) {
  if (tags?.includes(tagToLookFor)) {
    return tags?.filter((tag) => tag === tagToLookFor)[0];
  }
}

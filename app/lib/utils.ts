import {clsx, type ClassValue} from 'clsx';
import {twMerge} from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateCartDescription(tags: string[] = []) {
  if (tags.includes('Prints')) {
    return 'Framed Canvas Print';
  }
  if (tags.includes('Video') && tags.includes('Bundle')) {
    return 'Stock Footage Video Bundle';
  }
  if (tags.includes('Video')) {
    return 'Stock Footage Video';
  }
}
export function includesTagName(tags: string[], tagToLookFor: string) {
  if (tags?.includes(tagToLookFor)) {
    return tags?.filter((tag) => tag === tagToLookFor)[0];
  }
}

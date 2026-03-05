export const DEFAULT_LINK_PREVIEW_ICON =
  'https://downloads.adamunderwater.com/store-1-au/public/imessage-icon.png';

export function buildIconLinkPreviewMeta(title: string) {
  const normalizedTitle =
    typeof title === 'string' && title.trim().length > 0
      ? title.trim()
      : 'Adam Underwater';

  return [
    {title: normalizedTitle},
    {name: 'title', content: normalizedTitle},
    {property: 'og:type', content: 'website'},
    {property: 'og:title', content: normalizedTitle},
    {property: 'og:image', content: DEFAULT_LINK_PREVIEW_ICON},
    {property: 'og:image:secure_url', content: DEFAULT_LINK_PREVIEW_ICON},
    {property: 'og:image:alt', content: 'Adam Underwater icon preview'},
    {name: 'twitter:card', content: 'summary_large_image'},
    {name: 'twitter:title', content: normalizedTitle},
    {name: 'twitter:image', content: DEFAULT_LINK_PREVIEW_ICON},
    {name: 'twitter:image:alt', content: 'Adam Underwater icon preview'},
  ];
}

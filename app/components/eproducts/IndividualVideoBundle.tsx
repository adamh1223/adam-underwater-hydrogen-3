import {useMemo} from 'react';
import '../../styles/routeStyles/work.css';

type BundleWmlink = {index: number; id: string};

const wmlinkRegex = /^wmlink(\d+)_/i;

const parseBundleWmlinks = (tags: string[]): BundleWmlink[] =>
  tags
    .map((tag) => {
      const match = tag.match(wmlinkRegex);
      if (!match) return null;
      return {index: Number(match[1]), id: tag.split('_')[1]};
    })
    .filter(
      (item): item is BundleWmlink =>
        Boolean(item?.index) && Boolean(item?.id),
    )
    .sort((a, b) => a.index - b.index);

const splitBundleDescriptions = (descriptionHtml?: string): string[] => {
  if (!descriptionHtml) return [];

  const withParagraphs = descriptionHtml
    .split(/(?=<p>[\s\S]*?Clip\s*\d+:)/gi)
    .map((section) => section.trim())
    .filter(Boolean);

  if (withParagraphs.length > 0) {
    return withParagraphs;
  }

  return descriptionHtml
    .split(/(?=Clip\s*\d+:)/gi)
    .map((section) => section.trim())
    .filter(Boolean);
};

function IndividualVideoBundle({
  productName,
  descriptionHtml,
  tags,
}: {
  productName: string;
  descriptionHtml?: string;
  tags: string[];
}) {
  const bundleWmlinks = useMemo(() => parseBundleWmlinks(tags), [tags]);
  const bundleDescriptions = useMemo(
    () => splitBundleDescriptions(descriptionHtml),
    [descriptionHtml],
  );

  const clipCount = Math.max(bundleWmlinks.length, bundleDescriptions.length);

  const clips = Array.from({length: clipCount}).map((_, index) => {
    const clipNumber = index + 1;
    const wmlinkMatch = bundleWmlinks.find((link) => link.index === clipNumber);
    return {
      index: clipNumber,
      wmlinkId: wmlinkMatch?.id,
      descriptionHtml: bundleDescriptions[index],
    };
  });

  return (
    <div className="flex flex-col gap-10 w-full">
      <h2 className="text-3xl font-bold text-center">{productName}</h2>
      {clips
        .filter((clip) => Boolean(clip.wmlinkId))
        .map((clip) => (
          <div key={`bundle-clip-${clip.index}`} className="flex flex-col gap-6">
            {clip.descriptionHtml && (
              <div
                className="bundle-clip-description text-start"
                dangerouslySetInnerHTML={{__html: clip.descriptionHtml}}
              />
            )}
            <div className="clip-wrapper flex justify-center relative">
              <iframe
                className="clip"
                src={`https://player.vimeo.com/video/${clip.wmlinkId}?badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479`}
                allow="autoplay; fullscreen; picture-in-picture;"
                title={`Bundle clip ${clip.index}`}
              ></iframe>
            </div>
          </div>
        ))}
    </div>
  );
}

export default IndividualVideoBundle;

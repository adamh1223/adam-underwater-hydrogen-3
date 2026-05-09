import {useEffect, useRef} from 'react';

const BG_SRC =
  'https://downloads.adamunderwater.com/shared/site/bg/master.m3u8';

/**
 * Muted, looping, no-controls HLS background video.
 * Accepts the same className the hero components pass to the Vimeo iframe
 * and fires onReady once the first real frame is decoded.
 */
export function BgHlsVideo({
  className,
  onReady,
}: {
  className?: string;
  onReady?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readyFiredRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    let hlsInstance: any = null;
    let playTriggered = false;

    import('hls.js').then(({default: Hls}) => {
      if (cancelled || !videoRef.current) return;
      const v = videoRef.current;

      if (Hls.isSupported()) {
        const hls = new Hls({
          startLevel: -1,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          backBufferLength: 10,
        });
        hlsInstance = hls;
        hls.loadSource(BG_SRC);
        hls.attachMedia(v);

        hls.on(Hls.Events.FRAG_BUFFERED, (_: any, data: any) => {
          if (playTriggered || cancelled) return;
          if (typeof data.frag.sn !== 'number') return;
          playTriggered = true;
          v.play().catch(() => {});
        });
      } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
        v.src = BG_SRC;
        v.addEventListener(
          'canplay',
          () => { if (!cancelled) v.play().catch(() => {}); },
          {once: true},
        );
      }
    });

    return () => {
      cancelled = true;
      if (hlsInstance) hlsInstance.destroy();
    };
  }, []);

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || readyFiredRef.current || v.currentTime === 0) return;
    readyFiredRef.current = true;
    setTimeout(() => onReady?.(), 250);
  };

  return (
    <video
      ref={videoRef}
      className={className}
      playsInline
      muted
      loop
      onTimeUpdate={handleTimeUpdate}
    />
  );
}

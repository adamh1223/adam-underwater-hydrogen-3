import {useCallback, useEffect, useRef, useState} from 'react';
import '../../styles/components/HlsPlayer.css';

const HLS_BASE = 'https://downloads.adamunderwater.com/shared/stock/streaming/hls';

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function labelForHeight(h: number): string {
  if (h >= 2160) return '4K';
  if (h >= 1080) return '1080p';
  if (h >= 720) return '720p';
  if (h >= 480) return '480p';
  return '360p';
}

function aspectRatioString(width?: number, height?: number): string | undefined {
  if (!width || !height || !isFinite(width) || !isFinite(height) || height <= 0) {
    return undefined;
  }
  return `${width} / ${height}`;
}

function pickDominantAspectRatio(levels: Array<{width?: number; height?: number}>): string | undefined {
  const buckets = new Map<
    string,
    {count: number; width: number; height: number; pixelArea: number}
  >();

  for (const level of levels) {
    const width = Number(level.width ?? 0);
    const height = Number(level.height ?? 0);
    if (!width || !height) continue;
    const normalized = (width / height).toFixed(3);
    const existing = buckets.get(normalized);
    const pixelArea = width * height;
    if (existing) {
      existing.count += 1;
      if (pixelArea > existing.pixelArea) {
        existing.width = width;
        existing.height = height;
        existing.pixelArea = pixelArea;
      }
      continue;
    }
    buckets.set(normalized, {count: 1, width, height, pixelArea});
  }

  let selected: {count: number; width: number; height: number; pixelArea: number} | null = null;
  for (const bucket of buckets.values()) {
    if (!selected) {
      selected = bucket;
      continue;
    }
    if (bucket.count > selected.count) {
      selected = bucket;
      continue;
    }
    if (bucket.count === selected.count && bucket.pixelArea > selected.pixelArea) {
      selected = bucket;
    }
  }

  if (!selected) return undefined;
  return aspectRatioString(selected.width, selected.height);
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  );
}

function VolumeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
    </svg>
  );
}

function MuteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true">
      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
      <path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
    </svg>
  );
}

function FullscreenIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true">
      <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
    </svg>
  );
}

function ExitFullscreenIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true">
      <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
    </svg>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type QualityLevel = {index: number; label: string};

// ── Component ─────────────────────────────────────────────────────────────────

export function HlsPlayer({
  hlsId,
  poster,
  title = 'Video',
  loop = true,
  preferredStartHeight,
}: {
  hlsId: string;
  poster?: string;
  title?: string;
  loop?: boolean;
  /** Preferred starting resolution height in pixels (e.g. 2160, 1080).
   *  hls.js still adapts up/down from this point based on bandwidth. */
  preferredStartHeight?: number;
}) {
  const defaultAspectRatio = '16 / 9';
  const INITIAL_LEVEL_LOCK_SECONDS = 3.5;
  const ACTIVE_CONTROLS_HIDE_DELAY_MS = 1700;
  const MOUSE_LEAVE_HIDE_DELAY_MS = 220;
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // -1 = auto (ABR), ≥0 = user-selected level to soft-lock
  const manualLevelRef = useRef<number>(-1);
  const isDraggingVolumeRef = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(1);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [playerAspectRatio, setPlayerAspectRatio] = useState(defaultAspectRatio);
  const [posterVisible, setPosterVisible] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(false);
  const posterHiddenRef = useRef(false);
  const playTriggeredRef = useRef(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  // Quality selector
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<number>(-1); // -1 = Auto
  const [currentLevel, setCurrentLevel] = useState<number>(-1);
  const [showQualityMenu, setShowQualityMenu] = useState(false);

  const src = `${HLS_BASE}/${hlsId}/master.m3u8`;

  // Load HLS source
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    // Reset all transient state for this video
    posterHiddenRef.current = false;
    playTriggeredRef.current = false;
    manualLevelRef.current = -1;
    setPosterVisible(true);
    setControlsVisible(false);
    setPlayerAspectRatio(defaultAspectRatio);

    import('hls.js').then(({default: Hls}) => {
      if (cancelled || !videoRef.current) return;
      const v = videoRef.current;

      if (Hls.isSupported()) {
        const hls = new Hls({
          startLevel: -1, // overridden in MANIFEST_PARSED once levels are known
          capLevelToPlayerSize: false,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          backBufferLength: 10,
        });
        hlsRef.current = hls;
        hls.loadSource(src);
        hls.attachMedia(v);

        hls.on(Hls.Events.MANIFEST_PARSED, (_: any, data: any) => {
          if (cancelled) return;
          const levels: QualityLevel[] = data.levels.map(
            (lvl: any, i: number) => ({
              index: i,
              label: labelForHeight(lvl.height),
            }),
          );
          setQualityLevels(levels);
          setSelectedLevel(-1);

          const dominantAspect = pickDominantAspectRatio(data.levels);
          if (dominantAspect) setPlayerAspectRatio(dominantAspect);

          // Pin the first segment to 720p. Starting at auto (-1) causes hls.js
          // to pick the lowest quality first, then ABR immediately ramps to a
          // much higher quality whose large segment depletes the tiny buffer →
          // plays 1 s → freezes 5 s → skips. A fixed 720p start avoids the
          // violent first-switch. ABR adapts freely from segment 2 onwards.
          const idx720 = data.levels.reduce(
            (best: number, lvl: any, i: number) =>
              Math.abs(lvl.height - 720) < Math.abs(data.levels[best].height - 720)
                ? i
                : best,
            0,
          );
          hls.startLevel = idx720;
        });

        // Trigger play only after the first full main segment is in the buffer.
        hls.on(Hls.Events.FRAG_BUFFERED, (_: any, data: any) => {
          if (playTriggeredRef.current || cancelled) return;
          if (typeof data.frag.sn !== 'number') return;
          playTriggeredRef.current = true;
          v.play().catch(() => {});
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (_: any, data: any) => {
          setCurrentLevel(data.level);
          const locked = manualLevelRef.current;
          if (locked >= 0 && data.level !== locked) {
            hls.nextLevel = locked;
          }
        });
      } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS
        v.src = src;
        v.addEventListener('canplay', () => { if (!cancelled) v.play().catch(() => {}); }, {once: true});
      }
    });

    return () => {
      cancelled = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [defaultAspectRatio, src]);

  // Fullscreen change listener
  useEffect(() => {
    const onFsChange = () =>
      setIsFullscreen(
        !!(document.fullscreenElement || (document as any).webkitFullscreenElement),
      );
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, []);

  // Close quality menu on outside click
  useEffect(() => {
    if (!showQualityMenu) return;
    const onClickOutside = () => setShowQualityMenu(false);
    document.addEventListener('click', onClickOutside);
    return () => document.removeEventListener('click', onClickOutside);
  }, [showQualityMenu]);

  // Auto-hide controls after 3 s of inactivity while playing
  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(
      () => setControlsVisible(false),
      ACTIVE_CONTROLS_HIDE_DELAY_MS,
    );
  }, [ACTIVE_CONTROLS_HIDE_DELAY_MS]);

  const hideControlsSoon = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(
      () => setControlsVisible(false),
      MOUSE_LEAVE_HIDE_DELAY_MS,
    );
  }, [MOUSE_LEAVE_HIDE_DELAY_MS]);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => {
    if (!playing) {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setControlsVisible(true);
    } else {
      scheduleHide();
    }
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [playing, scheduleHide]);

  // Actions
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }, []);

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = videoRef.current;
      if (!v) return;
      const val = Number(e.target.value);
      v.volume = val;
      v.muted = val === 0;
      setVolume(val);
      setMuted(val === 0);
    },
    [],
  );

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const val = Number(e.target.value);
    v.currentTime = val * v.duration;
    setProgress(val);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const c = containerRef.current;
    const v = videoRef.current;
    if (!c || !v) return;

    const isFs = !!(
      document.fullscreenElement || (document as any).webkitFullscreenElement
    );

    if (isFs) {
      if (document.exitFullscreen) document.exitFullscreen();
      else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
      return;
    }

    // iOS Safari only supports fullscreen on the video element itself
    if ((v as any).webkitEnterFullscreen) {
      (v as any).webkitEnterFullscreen();
    } else if (c.requestFullscreen) {
      c.requestFullscreen().catch(() => {});
    } else if ((c as any).webkitRequestFullscreen) {
      (c as any).webkitRequestFullscreen();
    }
  }, []);

  const selectQuality = useCallback((level: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    manualLevelRef.current = level;
    // nextLevel switches at the next segment boundary — no buffer flush,
    // no freeze. The LEVEL_SWITCHED handler re-queues it each segment to
    // keep the selection sticky without ever calling currentLevel.
    hls.nextLevel = level;
    setSelectedLevel(level);
    setShowQualityMenu(false);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      const v = videoRef.current;
      if (!v) return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      else if (e.code === 'ArrowRight') { v.currentTime = Math.min(v.duration, v.currentTime + 5); }
      else if (e.code === 'ArrowLeft') { v.currentTime = Math.max(0, v.currentTime - 5); }
      else if (e.code === 'KeyM') { toggleMute(); }
      else if (e.code === 'KeyF') { toggleFullscreen(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [togglePlay, toggleMute, toggleFullscreen]);

  // Label shown on the gear button: Auto or the fixed resolution
  const activeLabel =
    selectedLevel === -1
      ? `Auto${currentLevel >= 0 && qualityLevels[currentLevel] ? ` (${qualityLevels[currentLevel].label})` : ''}`
      : (qualityLevels[selectedLevel]?.label ?? 'Auto');

  const effectiveVolume = muted ? 0 : volume;
  const volumeFillPercent = Math.max(0, Math.min(100, effectiveVolume * 100));
  const volumeTrackStyle = {
    background: `linear-gradient(to right, #22b8ff 0%, #22b8ff ${volumeFillPercent}%, rgba(255, 255, 255, 0.30) ${volumeFillPercent}%, rgba(255, 255, 255, 0.30) 100%)`,
  } as const;

  return (
    <div
      ref={containerRef}
      className="hls-player"
      style={{aspectRatio: playerAspectRatio}}
      onMouseMove={revealControls}
      onMouseEnter={revealControls}
      onMouseLeave={() => {
        setShowVolumeSlider(false);
        setShowQualityMenu(false);
        if (playing) hideControlsSoon();
      }}
    >
      <video
        ref={videoRef}
        className="hls-video"
        playsInline
        loop={loop}
        muted
        preload="auto"
        title={title}
        onTimeUpdate={() => {
          const v = videoRef.current;
          const hls = hlsRef.current;
          if (!v) return;
          setCurrentTime(v.currentTime);
          if (v.duration) {
            setProgress(v.currentTime / v.duration);
            if (v.buffered.length > 0) {
              setBuffered(v.buffered.end(v.buffered.length - 1) / v.duration);
            }
          }
          // Hide poster only once a real frame has rendered (currentTime > 0).
          if (!posterHiddenRef.current && v.currentTime > 0) {
            posterHiddenRef.current = true;
            requestAnimationFrame(() =>
              requestAnimationFrame(() => setPosterVisible(false)),
            );
          }

        }}
        onDurationChange={() => {
          const v = videoRef.current;
          if (v) setDuration(v.duration);
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEmptied={() => {
          // iOS Safari discards the video buffer under memory pressure or when
          // the element scrolls far offscreen. Show the poster again and allow
          // FRAG_BUFFERED to re-trigger play() once the buffer refills.
          posterHiddenRef.current = false;
          playTriggeredRef.current = false;
          setPosterVisible(true);
          setPlaying(false);
        }}
        onVolumeChange={() => {
          const v = videoRef.current;
          if (v) setMuted(v.muted);
        }}
      />

      {poster && (
        <div
          className="hls-poster"
          style={{backgroundImage: `url(${poster})`, opacity: posterVisible ? 1 : 0}}
        />
      )}

      <div className="hls-click-area" onClick={togglePlay} />

      {/* Controls — never shown while the poster is covering the player */}
      <div className={`hls-controls${controlsVisible && !posterVisible ? ' visible' : ''}`}>
        {/* Progress bar */}
        <div className="hls-progress-track">
          <div className="hls-track-bg" />
          <div className="hls-buffered-fill" style={{width: `${buffered * 100}%`}} />
          <div className="hls-played-fill" style={{width: `${progress * 100}%`}} />
          <input
            type="range"
            className="hls-seek"
            min={0}
            max={1}
            step={0.001}
            value={progress}
            onChange={handleSeek}
            aria-label="Seek"
          />
        </div>

        {/* Bottom row */}
        <div className="hls-bottom-row">
          <button className="hls-btn" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>

          <span className="hls-time">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div className="hls-spacer" />

          {/* Quality selector */}
          {qualityLevels.length > 0 && (
            <div className="hls-quality-group" onClick={(e) => e.stopPropagation()}>
              <button
                className="hls-btn hls-quality-btn"
                onClick={() => setShowQualityMenu((v) => !v)}
                aria-label="Quality"
                title="Quality"
              >
                <GearIcon />
                <span className="hls-quality-label">{activeLabel}</span>
              </button>
              {showQualityMenu && (
                <div className="hls-quality-menu">
                  <button
                    className={`hls-quality-option${selectedLevel === -1 ? ' active' : ''}`}
                    onClick={() => selectQuality(-1)}
                  >
                    Auto
                    {selectedLevel === -1 && currentLevel >= 0 && qualityLevels[currentLevel] && (
                      <span className="hls-quality-auto-hint">
                        {' '}({qualityLevels[currentLevel].label})
                      </span>
                    )}
                  </button>
                  {[...qualityLevels].reverse().map((lvl) => (
                    <button
                      key={lvl.index}
                      className={`hls-quality-option${selectedLevel === lvl.index ? ' active' : ''}`}
                      onClick={() => selectQuality(lvl.index)}
                    >
                      {lvl.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Volume */}
          <div
            className="hls-volume-group"
            onMouseEnter={() => setShowVolumeSlider(true)}
            onMouseLeave={() => {
              if (!isDraggingVolumeRef.current) setShowVolumeSlider(false);
            }}
          >
            <button className="hls-btn" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
              {muted || volume === 0 ? <MuteIcon /> : <VolumeIcon />}
            </button>
            <div className={`hls-volume-slider-wrap${showVolumeSlider ? ' visible' : ''}`}>
              <input
                type="range"
                className="hls-volume"
                min={0}
                max={1}
                step={0.01}
                value={effectiveVolume}
                onChange={handleVolumeChange}
                aria-label="Volume"
                style={volumeTrackStyle}
                onPointerDown={(e) => {
                  isDraggingVolumeRef.current = true;
                  // Capture the pointer so drag continues outside the element
                  (e.currentTarget as HTMLInputElement).setPointerCapture(e.pointerId);
                }}
                onPointerUp={() => {
                  isDraggingVolumeRef.current = false;
                }}
                onPointerCancel={() => {
                  isDraggingVolumeRef.current = false;
                }}
              />
            </div>
          </div>

          <button
            className="hls-btn"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
          </button>
        </div>
      </div>
    </div>
  );
}

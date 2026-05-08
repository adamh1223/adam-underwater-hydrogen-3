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
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(1);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [posterVisible, setPosterVisible] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(true);
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

    import('hls.js').then(({default: Hls}) => {
      if (cancelled || !videoRef.current) return;
      const v = videoRef.current;

      if (Hls.isSupported()) {
        const hls = new Hls({startLevel: -1});
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

          if (preferredStartHeight != null && data.levels.length > 0) {
            // Find the level whose height is closest to the preferred height.
            // hls.js will still adapt from this starting point.
            const startIdx = data.levels.reduce(
              (best: number, lvl: any, i: number) => {
                const diff = Math.abs(lvl.height - preferredStartHeight);
                const bestDiff = Math.abs(
                  data.levels[best].height - preferredStartHeight,
                );
                return diff < bestDiff ? i : best;
              },
              0,
            );
            hls.startLevel = startIdx;
            setSelectedLevel(-1); // still "Auto" in the UI — user can override
          } else {
            setSelectedLevel(-1);
          }

          v.play().catch(() => {});
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (_: any, data: any) => {
          setCurrentLevel(data.level);
        });
      } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS — no programmatic quality switching
        v.src = src;
        v.play().catch(() => {});
      }
    });

    return () => {
      cancelled = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src]);

  // Fullscreen change listener
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
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
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
  }, []);

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
    if (!c) return;
    if (!document.fullscreenElement) c.requestFullscreen().catch(() => {});
    else document.exitFullscreen();
  }, []);

  const selectQuality = useCallback((level: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    hls.currentLevel = level; // -1 = auto
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

  return (
    <div
      ref={containerRef}
      className="hls-player"
      onMouseMove={revealControls}
      onMouseEnter={revealControls}
    >
      <video
        ref={videoRef}
        className="hls-video"
        playsInline
        loop={loop}
        muted
        title={title}
        onTimeUpdate={() => {
          const v = videoRef.current;
          if (!v) return;
          setCurrentTime(v.currentTime);
          if (v.duration) {
            setProgress(v.currentTime / v.duration);
            if (v.buffered.length > 0) {
              setBuffered(v.buffered.end(v.buffered.length - 1) / v.duration);
            }
          }
        }}
        onDurationChange={() => {
          const v = videoRef.current;
          if (v) setDuration(v.duration);
        }}
        onPlay={() => { setPlaying(true); setPosterVisible(false); }}
        onPause={() => setPlaying(false)}
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

      {/* Controls */}
      <div className={`hls-controls${controlsVisible ? ' visible' : ''}`}>
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
            onMouseLeave={() => setShowVolumeSlider(false)}
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
                value={muted ? 0 : volume}
                onChange={handleVolumeChange}
                aria-label="Volume"
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

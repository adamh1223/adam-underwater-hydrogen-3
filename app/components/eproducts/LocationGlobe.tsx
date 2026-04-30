import {useEffect, useRef} from 'react';
import {geoGraticule, geoOrthographic, geoPath} from 'd3-geo';
import {feature} from 'topojson-client';
import 'maplibre-gl/dist/maplibre-gl.css';

const DEG = Math.PI / 180;
const GLOBE_SECTION_HEIGHT = 360;
const BASE_RADIUS_FACTOR = 0.37;
const TARGET_ZOOM_FACTOR = 14;
const ZOOM_DURATION_MS = 2200;
const OCEAN = '#0a1628';
const LAND = '#1a3a2a';
const LAND_STROKE = '#2d6a44';
const SPIN_SPEED_DEG_PER_MS = 0.09;
const LAND_IN_MS = 3200;
const DECEL_MS = 1800;
const QUICK_LAND_MS = 500;
const PULSE_PERIOD_MS = 2000;

let cached110m: any | null = null;
let cached50m: any | null = null;
let load110mPromise: Promise<any | null> | null = null;
let load50mPromise: Promise<any | null> | null = null;
const graticule = geoGraticule().step([30, 30])();

async function loadLandFeature(res: '110m' | '50m'): Promise<any | null> {
  if (res === '110m') {
    if (cached110m) return cached110m;
    if (load110mPromise) return load110mPromise;
    load110mPromise = fetchLand('/land-110m.json').then((f) => { cached110m = f; return f; });
    return load110mPromise;
  } else {
    if (cached50m) return cached50m;
    if (load50mPromise) return load50mPromise;
    load50mPromise = fetchLand('/land-50m.json').then((f) => { cached50m = f; return f; });
    return load50mPromise;
  }
}

async function fetchLand(url: string): Promise<any | null> {
  return fetch(url)
    .then((r) => r.json() as Promise<Record<string, any>>)
    .then((topo) => {
      const landObject = (topo?.['objects'] as Record<string, any>)?.['land'];
      if (!landObject) throw new Error(`land object missing in ${url}`);
      return feature(topo as any, landObject as any);
    })
    .catch((err) => { console.error('[LocationGlobe] Failed to load', url, err); return null; });
}

async function geocode(location: string): Promise<[number, number] | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`;
    const r = await fetch(url, {headers: {'Accept-Language': 'en'}});
    const data = (await r.json()) as any[];
    if (!data?.[0]) return null;
    return [parseFloat(data[0].lat as string), parseFloat(data[0].lon as string)];
  } catch (err) {
    console.error('[LocationGlobe] Geocode failed:', err);
    return null;
  }
}

function easeInOut(t: number): number { return 0.5 - 0.5 * Math.cos(t * Math.PI); }
function easeOut(t: number): number { return 1 - Math.pow(1 - t, 3); }

function drawGlobe(
  ctx: CanvasRenderingContext2D,
  landFeature: any | null,
  lambdaC: number,
  phiC: number,
  currentScale: number,
  baseScale: number,
  maxScale: number,
  viewportWidth: number,
  viewportHeight: number,
  dotCoords: [number, number] | null,
  dotAlpha: number,
) {
  const centerX = viewportWidth / 2;
  const centerY = viewportHeight / 2;
  const zoomProgress = Math.max(
    0,
    Math.min((currentScale - baseScale) / (maxScale - baseScale), 1),
  );

  const projection = geoOrthographic()
    .translate([centerX, centerY])
    .scale(currentScale)
    .rotate([-(lambdaC / DEG), -(phiC / DEG)])
    .clipAngle(90)
    .precision(0.5);
  const path = geoPath(projection, ctx);

  ctx.clearRect(0, 0, viewportWidth, viewportHeight);

  // Ocean background (projection scale is the single source of zoom truth)
  const gr = currentScale;
  const grad = ctx.createRadialGradient(
    centerX - gr * 0.3,
    centerY - gr * 0.3,
    gr * 0.05,
    centerX,
    centerY,
    gr,
  );
  grad.addColorStop(0, '#1a3a6e');
  grad.addColorStop(1, OCEAN);
  ctx.beginPath();
  ctx.arc(centerX, centerY, gr, 0, 2 * Math.PI);
  ctx.fillStyle = grad;
  ctx.fill();

  // Graticule fades as zoom progresses
  const gratAlpha = Math.max(0, 1 - zoomProgress * 3);
  if (gratAlpha > 0.01) {
    ctx.beginPath();
    path(graticule as any);
    ctx.strokeStyle = `rgba(255,255,255,${(0.06 * gratAlpha).toFixed(3)})`;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  // Land
  if (landFeature) {
    ctx.beginPath();
    path(landFeature as any);
    ctx.fillStyle = LAND;
    ctx.fill();
    ctx.strokeStyle = LAND_STROKE;
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }

  // Vignette + specular fade with zoom
  const vigAlpha = Math.max(0, 1 - zoomProgress * 2);
  if (vigAlpha > 0.01) {
    const vignette = ctx.createRadialGradient(
      centerX,
      centerY,
      currentScale * 0.6,
      centerX,
      centerY,
      currentScale,
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, `rgba(0,0,0,${(0.55 * vigAlpha).toFixed(3)})`);
    ctx.beginPath();
    ctx.arc(centerX, centerY, currentScale, 0, 2 * Math.PI);
    ctx.fillStyle = vignette;
    ctx.fill();
  }

  const specAlpha = Math.max(0, 1 - zoomProgress * 2.5);
  if (specAlpha > 0.01) {
    const spec = ctx.createRadialGradient(
      centerX - currentScale * 0.38,
      centerY - currentScale * 0.38,
      0,
      centerX - currentScale * 0.3,
      centerY - currentScale * 0.3,
      currentScale * 0.55,
    );
    spec.addColorStop(0, `rgba(255,255,255,${(0.07 * specAlpha).toFixed(3)})`);
    spec.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.beginPath();
    ctx.arc(centerX, centerY, currentScale, 0, 2 * Math.PI);
    ctx.fillStyle = spec;
    ctx.fill();
  }

  // Location dot
  if (dotCoords && dotAlpha > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, currentScale, 0, 2 * Math.PI);
    ctx.clip();

    const pt = projection([dotCoords[1], dotCoords[0]]);
    if (pt) {
      const a = dotAlpha;
      const glow = ctx.createRadialGradient(pt[0], pt[1], 0, pt[0], pt[1], 18);
      glow.addColorStop(0, `hsla(198.6,88.7%,48.4%,${(0.55 * a).toFixed(3)})`);
      glow.addColorStop(1, `hsla(198.6,88.7%,48.4%,0)`);
      ctx.beginPath();
      ctx.arc(pt[0], pt[1], 18, 0, 2 * Math.PI);
      ctx.fillStyle = glow;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(pt[0], pt[1], 5, 0, 2 * Math.PI);
      ctx.fillStyle = `hsla(198.6,88.7%,48.4%,${a.toFixed(3)})`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(pt[0], pt[1], 2.5, 0, 2 * Math.PI);
      ctx.fillStyle = `hsla(198.6,88.7%,75%,${a.toFixed(3)})`;
      ctx.fill();
    }
    ctx.restore();
  }
}

interface LocationGlobeProps {
  formattedLocation: string;
}

const OFMAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const MAP_ZOOM = 9.5;

// Inject the pulsing dot CSS once globally
function ensureMarkerStyles() {
  if (document.getElementById('lgm-style')) return;
  const s = document.createElement('style');
  s.id = 'lgm-style';
  s.textContent = `
    @keyframes lgm-ring {
      0%   { transform: scale(1);   opacity: 0.8; }
      100% { transform: scale(2.8); opacity: 0; }
    }
    .lgm-wrap { position: relative; width: 22px; height: 22px; }
    .lgm-ring {
      position: absolute; inset: 0; border-radius: 50%;
      border: 2px solid hsl(198.6,88.7%,48.4%);
      animation: lgm-ring 1.8s ease-out infinite;
    }
    .lgm-core {
      position: absolute; top: 50%; left: 50%;
      width: 10px; height: 10px; border-radius: 50%;
      transform: translate(-50%,-50%);
      background: hsl(198.6,88.7%,48.4%);
      box-shadow: 0 0 8px 2px hsla(198.6,88.7%,48.4%,0.6);
    }
  `;
  document.head.appendChild(s);
}

export function LocationGlobe({formattedLocation}: LocationGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!formattedLocation) return;

    if (!canvasRef.current || !viewportRef.current) return;
    const canvas: HTMLCanvasElement = canvasRef.current;
    const viewport: HTMLDivElement = viewportRef.current;
    const ctxOrNull = canvas.getContext('2d', {alpha: false});
    if (!ctxOrNull) return;
    const ctx: CanvasRenderingContext2D = ctxOrNull;

    let rafId = 0;
    let alive = true;
    let mapInitialized = false;
    let viewportWidth = 0;
    let viewportHeight = 0;
    let baseRadius = 1;
    let zoomRadius = baseRadius * TARGET_ZOOM_FACTOR;

    function syncViewportSize() {
      const nextWidth = Math.max(1, Math.round(viewport.clientWidth));
      const nextHeight = Math.max(1, Math.round(viewport.clientHeight));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      viewportWidth = nextWidth;
      viewportHeight = nextHeight;
      baseRadius = Math.max(1, Math.min(viewportWidth, viewportHeight) * BASE_RADIUS_FACTOR);
      zoomRadius = baseRadius * TARGET_ZOOM_FACTOR;

      canvas.width = Math.max(1, Math.round(viewportWidth * dpr));
      canvas.height = Math.max(1, Math.round(viewportHeight * dpr));
      canvas.style.width = `${viewportWidth}px`;
      canvas.style.height = `${viewportHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    syncViewportSize();
    const resizeObserver = new ResizeObserver(() => {
      syncViewportSize();
    });
    resizeObserver.observe(viewport);

    let lambdaC = 0;
    let phiC = 0;
    let targetLambdaC = 0;
    let targetPhiC = 0;
    let currentScale = baseRadius;
    let startTime = performance.now();
    let landStartTime = 0;
    let landingDurationMs = DECEL_MS;
    let zoomStartTime = 0;
    let settledTime = 0;
    let phase: 'spinning' | 'landing' | 'zooming' | 'settled' = 'spinning';
    let landFeature110m: any | null = null;
    let landFeature50m: any | null = null;
    let dotCoords: [number, number] | null = null;
    let geocoded = false;
    let landingStartLambda = 0;
    let landingStartPhi = 0;

    function frame(now: number) {
      if (!alive) return;
      const elapsed = now - startTime;

      if (phase === 'spinning') {
        lambdaC = elapsed * SPIN_SPEED_DEG_PER_MS * DEG;
        currentScale = baseRadius;
        if (elapsed >= LAND_IN_MS) {
          phase = 'landing';
          landStartTime = now;
          landingDurationMs = geocoded ? DECEL_MS : QUICK_LAND_MS;
          landingStartLambda = lambdaC;
          landingStartPhi = phiC;
          if (geocoded) {
            const diff =
              ((targetLambdaC - landingStartLambda) % (2 * Math.PI) +
                3 * Math.PI) %
                (2 * Math.PI) -
              Math.PI;
            targetLambdaC = landingStartLambda + diff;
          } else {
            targetLambdaC = lambdaC;
            targetPhiC = phiC;
          }
        }
      } else if (phase === 'landing') {
        const t = Math.min((now - landStartTime) / landingDurationMs, 1);
        const e = easeOut(t);
        lambdaC = landingStartLambda + (targetLambdaC - landingStartLambda) * e;
        phiC = landingStartPhi + (targetPhiC - landingStartPhi) * e;
        currentScale = baseRadius;
        if (t >= 1) {
          lambdaC = targetLambdaC;
          phiC = targetPhiC;
          phase = 'zooming';
          zoomStartTime = now;
        }
      } else if (phase === 'zooming') {
        const t = Math.min((now - zoomStartTime) / ZOOM_DURATION_MS, 1);
        currentScale = baseRadius * Math.pow(TARGET_ZOOM_FACTOR, easeInOut(t));
        if (t >= 1) {
          currentScale = zoomRadius;
          phase = 'settled';
          settledTime = now;
        }
      } else {
        currentScale = zoomRadius;
      }

      let dotAlpha = 0;
      if (phase === 'zooming' && dotCoords) {
        const t = Math.min((now - zoomStartTime) / ZOOM_DURATION_MS, 1);
        dotAlpha = Math.max(0, (t - 0.4) / 0.6);
      } else if (phase === 'settled' && dotCoords) {
        const pulseT = ((now - settledTime) % PULSE_PERIOD_MS) / PULSE_PERIOD_MS;
        dotAlpha = 0.5 - 0.5 * Math.cos(pulseT * 2 * Math.PI);
        // Kick off the real map once, after a short delay so the dot is visible first
        if (!mapInitialized) {
          mapInitialized = true;
          setTimeout(() => initMap(), 600);
        }
      }

      const activeLand =
        phase === 'zooming' || phase === 'settled'
          ? (landFeature50m ?? landFeature110m)
          : landFeature110m;
      drawGlobe(
        ctx,
        activeLand,
        lambdaC,
        phiC,
        currentScale,
        baseRadius,
        zoomRadius,
        viewportWidth,
        viewportHeight,
        dotCoords,
        dotAlpha,
      );
      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);

    Promise.all([loadLandFeature('110m'), loadLandFeature('50m'), geocode(formattedLocation)]).then(
      ([f110m, f50m, geoResult]) => {
        if (!alive) return;
        landFeature110m = f110m;
        landFeature50m = f50m;
        if (geoResult) {
          dotCoords = geoResult;
          geocoded = true;
          targetLambdaC = geoResult[1] * DEG;
          targetPhiC = geoResult[0] * DEG;
          if (phase === 'landing') {
            landStartTime = performance.now();
            landingDurationMs = DECEL_MS;
            landingStartLambda = lambdaC;
            landingStartPhi = phiC;
            const diff =
              ((targetLambdaC - landingStartLambda) % (2 * Math.PI) +
                3 * Math.PI) %
                (2 * Math.PI) -
              Math.PI;
            targetLambdaC = landingStartLambda + diff;
          }
        }
      },
    );

    async function initMap() {
      if (!alive || !mapDivRef.current || !dotCoords) return;
      const [lon, lat] = [dotCoords[1], dotCoords[0]];

      const mlgl = await import('maplibre-gl');
      if (!alive || !mapDivRef.current) return;

      ensureMarkerStyles();

      const map = new mlgl.Map({
        container: mapDivRef.current,
        style: OFMAP_STYLE,
        center: [lon, lat],
        zoom: MAP_ZOOM,
        attributionControl: false,
        pitchWithRotate: false,
        dragRotate: false,
      });
      mapRef.current = map;

      map.on('load', () => {
        if (!alive) return;

        // Pulsing dot marker
        const el = document.createElement('div');
        el.className = 'lgm-wrap';
        el.innerHTML = '<div class="lgm-ring"></div><div class="lgm-core"></div>';
        new mlgl.Marker({element: el, anchor: 'center'}).setLngLat([lon, lat]).addTo(map);

        // Crossfade: map in, canvas out
        const mapDiv = mapDivRef.current;
        const cvs = canvasRef.current;
        if (mapDiv) { mapDiv.style.transition = 'opacity 0.9s ease'; mapDiv.style.opacity = '1'; }
        if (cvs)    { cvs.style.transition    = 'opacity 0.9s ease'; cvs.style.opacity    = '0'; }

        // Stop canvas RAF after fade
        setTimeout(() => { alive = false; cancelAnimationFrame(rafId); }, 950);
      });
    }

    return () => {
      alive = false;
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, [formattedLocation]);

  if (!formattedLocation) return null;

  return (
    <section className="relative left-1/2 right-1/2 -mx-[50vw] w-screen py-8">
      <div
        ref={viewportRef}
        style={{
          width: '100%',
          height: GLOBE_SECTION_HEIGHT,
          position: 'relative',
          overflow: 'hidden',
          filter: 'drop-shadow(0 0 32px rgba(14,165,233,0.2))',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{display: 'block', width: '100%', height: '100%'}}
        />
        {/* MapLibre map — fades in over the canvas once the globe animation settles */}
        <div
          ref={mapDivRef}
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0,
          }}
        />
      </div>
      <p className="mt-3 text-center text-sm text-muted-foreground tracking-wider uppercase">
        {formattedLocation}
      </p>
    </section>
  );
}

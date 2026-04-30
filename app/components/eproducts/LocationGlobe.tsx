import {useEffect, useRef} from 'react';
import {geoGraticule, geoOrthographic, geoPath} from 'd3-geo';
import {feature} from 'topojson-client';

const DEG = Math.PI / 180;
const SIZE = 350;           // 25% larger than the original 280
const R = 155;              // globe radius in px (scaled with SIZE)
const R_ZOOM = 14000;       // zoomed-in scale — shows ~160 km across the canvas
const ZOOM_DURATION_MS = 2200;
const CX = SIZE / 2;
const CY = SIZE / 2;
const OCEAN = '#0a1628';
const LAND = '#1a3a2a';
const LAND_STROKE = '#2d6a44';
const SPIN_SPEED_DEG_PER_MS = 0.09;
const LAND_IN_MS = 3200;
const DECEL_MS = 1800;
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
    load110mPromise = fetchLand('/land-110m.json').then((f) => {
      cached110m = f;
      return f;
    });
    return load110mPromise;
  } else {
    if (cached50m) return cached50m;
    if (load50mPromise) return load50mPromise;
    load50mPromise = fetchLand('/land-50m.json').then((f) => {
      cached50m = f;
      return f;
    });
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
    .catch((err) => {
      console.error('[LocationGlobe] Failed to load', url, err);
      return null;
    });
}

async function geocode(location: string): Promise<[number, number] | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`;
    const r = await fetch(url, {headers: {'Accept-Language': 'en'}});
    const data = (await r.json()) as any[];
    if (!data?.[0]) return null;
    return [
      parseFloat(data[0].lat as string),
      parseFloat(data[0].lon as string),
    ];
  } catch (err) {
    console.error('[LocationGlobe] Geocode failed:', err);
    return null;
  }
}

// t ∈ [0,1] → smooth ease-in/ease-out
function easeInOut(t: number): number {
  return 0.5 - 0.5 * Math.cos(t * Math.PI);
}

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function drawGlobe(
  ctx: CanvasRenderingContext2D,
  landFeature: any | null,
  lambdaC: number,
  phiC: number,
  currentScale: number,
  dotCoords: [number, number] | null,
  dotAlpha: number,
) {
  // 0 = full globe view, 1 = fully zoomed in
  const zoomProgress = Math.max(0, Math.min((currentScale - R) / (R_ZOOM - R), 1));
  const isZoomed = currentScale > SIZE * 1.1;

  const projection = geoOrthographic()
    .translate([CX, CY])
    .scale(currentScale)
    .rotate([-(lambdaC / DEG), -(phiC / DEG)])
    .clipAngle(90)
    .precision(0.5);
  const path = geoPath(projection, ctx);

  ctx.clearRect(0, 0, SIZE, SIZE);

  // ── Ocean background ────────────────────────────────────────────────────────
  if (!isZoomed) {
    // Globe fits within canvas — draw sphere with gradient
    const gr = currentScale;
    const grad = ctx.createRadialGradient(
      CX - gr * 0.3, CY - gr * 0.3, gr * 0.05,
      CX, CY, gr,
    );
    grad.addColorStop(0, '#1a3a6e');
    grad.addColorStop(1, OCEAN);
    ctx.beginPath();
    ctx.arc(CX, CY, gr, 0, 2 * Math.PI);
    ctx.fillStyle = grad;
    ctx.fill();
  } else {
    // Sphere extends far beyond canvas — fill entire canvas with ocean
    ctx.fillStyle = OCEAN;
    ctx.fillRect(0, 0, SIZE, SIZE);
  }

  // ── Graticule (fades out as zoom increases) ─────────────────────────────────
  const gratAlpha = Math.max(0, 1 - zoomProgress * 3);
  if (gratAlpha > 0.01) {
    ctx.beginPath();
    path(graticule as any);
    ctx.strokeStyle = `rgba(255,255,255,${(0.06 * gratAlpha).toFixed(3)})`;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  // ── Land polygons ────────────────────────────────────────────────────────────
  if (landFeature) {
    ctx.beginPath();
    path(landFeature as any);
    ctx.fillStyle = LAND;
    ctx.fill();
    ctx.strokeStyle = LAND_STROKE;
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }

  // ── Vignette (fades during zoom) ─────────────────────────────────────────────
  if (!isZoomed) {
    const vigAlpha = Math.max(0, 1 - zoomProgress * 2);
    if (vigAlpha > 0.01) {
      const vignette = ctx.createRadialGradient(
        CX, CY, currentScale * 0.6,
        CX, CY, currentScale,
      );
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, `rgba(0,0,0,${(0.55 * vigAlpha).toFixed(3)})`);
      ctx.beginPath();
      ctx.arc(CX, CY, currentScale, 0, 2 * Math.PI);
      ctx.fillStyle = vignette;
      ctx.fill();
    }

    // ── Specular highlight (fades during zoom) ──────────────────────────────────
    const specAlpha = Math.max(0, 1 - zoomProgress * 2.5);
    if (specAlpha > 0.01) {
      const spec = ctx.createRadialGradient(
        CX - currentScale * 0.38, CY - currentScale * 0.38, 0,
        CX - currentScale * 0.3, CY - currentScale * 0.3, currentScale * 0.55,
      );
      spec.addColorStop(0, `rgba(255,255,255,${(0.07 * specAlpha).toFixed(3)})`);
      spec.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.beginPath();
      ctx.arc(CX, CY, currentScale, 0, 2 * Math.PI);
      ctx.fillStyle = spec;
      ctx.fill();
    }
  }

  // ── Location dot ─────────────────────────────────────────────────────────────
  if (dotCoords && dotAlpha > 0) {
    ctx.save();
    // Clip dot to the visible sphere circle
    ctx.beginPath();
    if (!isZoomed) {
      ctx.arc(CX, CY, currentScale, 0, 2 * Math.PI);
    } else {
      ctx.rect(0, 0, SIZE, SIZE);
    }
    ctx.clip();

    const pt = projection([dotCoords[1], dotCoords[0]]);
    if (pt) {
      // Dot grows slightly as we zoom in so it stays visible
      const dotScale = 1 + zoomProgress * 1.5;
      const glowR = 18 * dotScale;
      const dotR = 5 * dotScale;
      const innerR = 2.5 * dotScale;
      const a = dotAlpha;

      const glow = ctx.createRadialGradient(pt[0], pt[1], 0, pt[0], pt[1], glowR);
      glow.addColorStop(0, `hsla(198.6,88.7%,48.4%,${(0.55 * a).toFixed(3)})`);
      glow.addColorStop(1, `hsla(198.6,88.7%,48.4%,0)`);
      ctx.beginPath();
      ctx.arc(pt[0], pt[1], glowR, 0, 2 * Math.PI);
      ctx.fillStyle = glow;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(pt[0], pt[1], dotR, 0, 2 * Math.PI);
      ctx.fillStyle = `hsla(198.6,88.7%,48.4%,${a.toFixed(3)})`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(pt[0], pt[1], innerR, 0, 2 * Math.PI);
      ctx.fillStyle = `hsla(198.6,88.7%,75%,${a.toFixed(3)})`;
      ctx.fill();
    }
    ctx.restore();
  }
}

interface LocationGlobeProps {
  formattedLocation: string;
}

export function LocationGlobe({formattedLocation}: LocationGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!formattedLocation) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctxOrNull = canvas.getContext('2d');
    if (!ctxOrNull) return;
    const ctx: CanvasRenderingContext2D = ctxOrNull;

    let rafId = 0;
    let alive = true;

    let lambdaC = 0;
    let phiC = 0;
    let targetLambdaC = 0;
    let targetPhiC = 0;
    let currentScale = R;
    let startTime = performance.now();
    let landStartTime = 0;
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
        currentScale = R;

        if (elapsed >= LAND_IN_MS) {
          if (geocoded) {
            phase = 'landing';
            landStartTime = now;
            landingStartLambda = lambdaC;
            landingStartPhi = phiC;
            const diff =
              ((targetLambdaC - landingStartLambda) % (2 * Math.PI) +
                3 * Math.PI) %
                (2 * Math.PI) -
              Math.PI;
            targetLambdaC = landingStartLambda + diff;
          } else if (elapsed >= LAND_IN_MS + 4000) {
            phase = 'settled';
            settledTime = now;
          }
        }
      } else if (phase === 'landing') {
        const t = Math.min((now - landStartTime) / DECEL_MS, 1);
        const e = easeOut(t);
        lambdaC = landingStartLambda + (targetLambdaC - landingStartLambda) * e;
        phiC = landingStartPhi + (targetPhiC - landingStartPhi) * e;
        currentScale = R;
        if (t >= 1) {
          lambdaC = targetLambdaC;
          phiC = targetPhiC;
          phase = 'zooming';
          zoomStartTime = now;
        }
      } else if (phase === 'zooming') {
        const t = Math.min((now - zoomStartTime) / ZOOM_DURATION_MS, 1);
        const e = easeInOut(t);
        currentScale = R + (R_ZOOM - R) * e;
        if (t >= 1) {
          currentScale = R_ZOOM;
          phase = 'settled';
          settledTime = now;
        }
      } else {
        currentScale = R_ZOOM;
      }

      // Dot alpha: fades in during second half of zoom, then cosine-pulses when settled
      let dotAlpha = 0;
      if (phase === 'zooming' && dotCoords) {
        const t = Math.min((now - zoomStartTime) / ZOOM_DURATION_MS, 1);
        dotAlpha = Math.max(0, (t - 0.4) / 0.6); // appears in last 60% of zoom
      } else if (phase === 'settled' && dotCoords) {
        const pulseT = ((now - settledTime) % PULSE_PERIOD_MS) / PULSE_PERIOD_MS;
        dotAlpha = 0.5 - 0.5 * Math.cos(pulseT * 2 * Math.PI);
      }

      // Use 50m detail during zoom/settled; fall back to 110m while it loads
      const activeLand =
        (phase === 'zooming' || phase === 'settled')
          ? (landFeature50m ?? landFeature110m)
          : landFeature110m;
      drawGlobe(ctx, activeLand, lambdaC, phiC, currentScale, dotCoords, dotAlpha);
      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);

    // Load 110m immediately (needed for spinning globe), 50m in parallel (needed for zoom)
    Promise.all([
      loadLandFeature('110m'),
      loadLandFeature('50m'),
      geocode(formattedLocation),
    ]).then(([f110m, f50m, geoResult]) => {
      if (!alive) return;
      landFeature110m = f110m;
      landFeature50m = f50m;
      if (geoResult) {
        dotCoords = geoResult;
        geocoded = true;
        targetLambdaC = geoResult[1] * DEG;
        targetPhiC = geoResult[0] * DEG;
      }
    });

    return () => {
      alive = false;
      cancelAnimationFrame(rafId);
    };
  }, [formattedLocation]);

  if (!formattedLocation) return null;

  return (
    <section className="flex flex-col items-center py-8 gap-3">
      <div
        style={{
          width: SIZE,
          height: SIZE,
          filter: 'drop-shadow(0 0 32px rgba(14,165,233,0.2))',
        }}
      >
        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          style={{borderRadius: '50%', display: 'block'}}
        />
      </div>
      <p className="text-sm text-muted-foreground tracking-wider uppercase">
        {formattedLocation}
      </p>
    </section>
  );
}

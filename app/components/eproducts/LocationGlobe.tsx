import {useEffect, useRef} from 'react';
import {geoGraticule, geoOrthographic, geoPath} from 'd3-geo';
import {feature} from 'topojson-client';

const DEG = Math.PI / 180;
const SIZE = 280;
const R = 124;
const CX = SIZE / 2;
const CY = SIZE / 2;
const OCEAN = '#0a1628';
const LAND = '#1a3a2a';
const LAND_STROKE = '#2d6a44';
const GRATICULE = 'rgba(255,255,255,0.06)';
const GLOBE_HIGHLIGHT = 'rgba(255,255,255,0.07)';
const SPIN_SPEED_DEG_PER_MS = 0.09;
const LAND_IN_MS = 3200;
const DECEL_MS = 1800;
const PULSE_PERIOD_MS = 2000;

let cachedLandFeature: any | null = null;
let loadPromise: Promise<any | null> | null = null;
const graticule = geoGraticule().step([30, 30])();

async function loadWorldLandFeature(): Promise<any | null> {
  if (cachedLandFeature) return cachedLandFeature;
  if (loadPromise) return loadPromise;

  loadPromise = fetch('/land-110m.json')
    .then((r) => r.json() as Promise<Record<string, any>>)
    .then((topo) => {
      const objects = topo?.['objects'] as Record<string, any> | undefined;
      const landObject = objects?.['land'];
      if (!landObject) throw new Error('land object missing from world atlas');

      const landFeature = feature(topo as any, landObject as any);
      cachedLandFeature = landFeature as any;
      return landFeature;
    })
    .catch((err) => {
      console.error('[LocationGlobe] Failed to load world atlas:', err);
      loadPromise = null;
      return null;
    });

  return loadPromise;
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

function drawGlobe(
  ctx: CanvasRenderingContext2D,
  landFeature: any | null,
  lambdaC: number,
  phiC: number,
  dotCoords: [number, number] | null,
  dotAlpha: number,
) {
  const projection = geoOrthographic()
    .translate([CX, CY])
    .scale(R)
    .rotate([-(lambdaC / DEG), -(phiC / DEG)])
    .clipAngle(90)
    .precision(0.5);
  const path = geoPath(projection, ctx);

  ctx.clearRect(0, 0, SIZE, SIZE);

  // Ocean sphere
  const grad = ctx.createRadialGradient(
    CX - R * 0.3, CY - R * 0.3, R * 0.05,
    CX, CY, R,
  );
  grad.addColorStop(0, '#1a3a6e');
  grad.addColorStop(1, OCEAN);
  ctx.beginPath();
  ctx.arc(CX, CY, R, 0, 2 * Math.PI);
  ctx.fillStyle = grad;
  ctx.fill();

  // Graticule
  ctx.beginPath();
  path(graticule as any);
  ctx.strokeStyle = GRATICULE;
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // Land polygons (d3 projection + clipping avoids seam warping artifacts)
  if (landFeature) {
    ctx.beginPath();
    path(landFeature as any);
    ctx.fillStyle = LAND;
    ctx.fill();

    ctx.strokeStyle = LAND_STROKE;
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }

  // Vignette
  const vignette = ctx.createRadialGradient(CX, CY, R * 0.6, CX, CY, R);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.beginPath();
  ctx.arc(CX, CY, R, 0, 2 * Math.PI);
  ctx.fillStyle = vignette;
  ctx.fill();

  // Specular highlight
  const spec = ctx.createRadialGradient(
    CX - R * 0.38, CY - R * 0.38, 0,
    CX - R * 0.3, CY - R * 0.3, R * 0.55,
  );
  spec.addColorStop(0, GLOBE_HIGHLIGHT);
  spec.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.beginPath();
  ctx.arc(CX, CY, R, 0, 2 * Math.PI);
  ctx.fillStyle = spec;
  ctx.fill();

  // Location dot — clipped to sphere, alpha-controlled for smooth pulse
  if (dotCoords && dotAlpha > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(CX, CY, R, 0, 2 * Math.PI);
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

function easeOut(t: number) {
  return 1 - Math.pow(1 - t, 3);
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
    let startTime = performance.now();
    let landStartTime = 0;
    let settledTime = 0;
    let phase: 'spinning' | 'landing' | 'settled' = 'spinning';
    let landFeature: any | null = null;
    let dotCoords: [number, number] | null = null;
    let geocoded = false;
    let landingStartLambda = 0;
    let landingStartPhi = 0;

    function frame(now: number) {
      if (!alive) return;
      const elapsed = now - startTime;

      if (phase === 'spinning') {
        lambdaC = elapsed * SPIN_SPEED_DEG_PER_MS * DEG;

        if (elapsed >= LAND_IN_MS) {
          if (geocoded) {
            phase = 'landing';
            landStartTime = now;
            landingStartLambda = lambdaC;
            landingStartPhi = phiC;
            // Shortest angular path to target
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
        if (t >= 1) {
          lambdaC = targetLambdaC;
          phiC = targetPhiC;
          phase = 'settled';
          settledTime = now;
        }
      }

      // Smooth cosine pulse: ease-in/ease-out between 0 and 1
      let dotAlpha = 0;
      if (phase === 'settled' && dotCoords) {
        const pulseT = ((now - settledTime) % PULSE_PERIOD_MS) / PULSE_PERIOD_MS;
        dotAlpha = 0.5 - 0.5 * Math.cos(pulseT * 2 * Math.PI);
      }

      drawGlobe(ctx, landFeature, lambdaC, phiC, dotCoords, dotAlpha);
      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);

    Promise.all([loadWorldLandFeature(), geocode(formattedLocation)]).then(
      ([landResult, geoResult]) => {
        if (!alive) return;
        landFeature = landResult;
        if (geoResult) {
          dotCoords = geoResult;
          geocoded = true;
          targetLambdaC = geoResult[1] * DEG;
          targetPhiC = geoResult[0] * DEG;
        }
      },
    );

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
          filter: 'drop-shadow(0 0 24px rgba(59,130,246,0.18))',
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

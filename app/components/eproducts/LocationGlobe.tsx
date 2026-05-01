import {useEffect, useRef, useState} from 'react';
import {geoCentroid, geoGraticule, geoOrthographic, geoPath} from 'd3-geo';
import {feature, mesh} from 'topojson-client';

const DEG = Math.PI / 180;
const GLOBE_SECTION_HEIGHT = 360;
const BASE_RADIUS_FACTOR = 0.37;
const TARGET_ZOOM_FACTOR = 80;   // final animation zoom (more detail)
const ZOOM_DURATION_MS = 2200;
const ZOOM_STEP = 2;             // scale multiplier per +/- click (larger step per tap)
const BTN_ZOOM_MS = 220;         // duration of button-triggered zoom animation
const BTN_ZOOM_EXTREME_MS = 1200; // slower easing for MAX/MIN jumps
const OCEAN = '#0a1628';
const LAKE  = '#0e2244';   // interior water — distinct from ocean but same family
const LAND = '#1a3a2a';
const LAND_STROKE = '#2d6a44';
const SPIN_SPEED_DEG_PER_MS = 0.0225;
const LAND_IN_MS = 3200;
const DECEL_MS = 1800;
const QUICK_LAND_MS = 500;
const PULSE_PERIOD_MS = 2000;
const STARFIELD_SEED = 412877;
const STAR_COUNT = 3200;
const STAR_FOV_DEG = 105;
const STAR_CAMERA_ORBIT_RADIUS = 0.6;

// ── Static datasets ───────────────────────────────────────────────────────────

// ISO 3166-1 numeric → display name (enough for labelling visible countries)
const COUNTRY_NAMES: Record<string, string> = {
  '004':'Afghanistan','008':'Albania','012':'Algeria','024':'Angola',
  '032':'Argentina','036':'Australia','040':'Austria','050':'Bangladesh',
  '056':'Belgium','068':'Bolivia','076':'Brazil','100':'Bulgaria',
  '116':'Cambodia','120':'Cameroon','124':'Canada','152':'Chile',
  '156':'China','170':'Colombia','178':'Congo','180':'DR Congo',
  '188':'Costa Rica','191':'Croatia','192':'Cuba','208':'Denmark',
  '218':'Ecuador','818':'Egypt','222':'El Salvador','231':'Ethiopia',
  '246':'Finland','250':'France','276':'Germany','288':'Ghana',
  '300':'Greece','320':'Guatemala','332':'Haiti','340':'Honduras',
  '348':'Hungary','356':'India','360':'Indonesia','364':'Iran',
  '368':'Iraq','372':'Ireland','376':'Israel','380':'Italy',
  '388':'Jamaica','392':'Japan','400':'Jordan','398':'Kazakhstan',
  '404':'Kenya','408':'North Korea','410':'South Korea','418':'Laos',
  '422':'Lebanon','430':'Liberia','434':'Libya','442':'Luxembourg',
  '458':'Malaysia','484':'Mexico','504':'Morocco','508':'Mozambique',
  '516':'Namibia','524':'Nepal','528':'Netherlands','554':'New Zealand',
  '558':'Nicaragua','562':'Niger','566':'Nigeria','578':'Norway',
  '586':'Pakistan','591':'Panama','604':'Peru','608':'Philippines',
  '616':'Poland','620':'Portugal','630':'Puerto Rico','642':'Romania',
  '643':'Russia','682':'Saudi Arabia','686':'Senegal','706':'Somalia',
  '710':'South Africa','724':'Spain','729':'Sudan','752':'Sweden',
  '756':'Switzerland','760':'Syria','158':'Taiwan','834':'Tanzania',
  '764':'Thailand','788':'Tunisia','792':'Turkey','800':'Uganda',
  '804':'Ukraine','784':'UAE','826':'United Kingdom',
  '840':'United States','858':'Uruguay','860':'Uzbekistan',
  '862':'Venezuela','704':'Vietnam','887':'Yemen','894':'Zambia',
  '716':'Zimbabwe',
};

// Major cities: [name, lon, lat, tier]  tier 1=capital/megacity  2=regional  3=local
type City = [string, number, number, 1 | 2 | 3];
const CITIES: City[] = [
  // US West Coast / target region
  ['Los Angeles',    -118.2,  34.1, 1],
  ['San Francisco',  -122.4,  37.8, 2],
  ['San Diego',      -117.2,  32.7, 2],
  ['Las Vegas',      -115.1,  36.2, 2],
  ['Phoenix',        -112.1,  33.4, 2],
  ['Seattle',        -122.3,  47.6, 2],
  ['Portland',       -122.7,  45.5, 2],
  ['Sacramento',     -121.5,  38.6, 3],
  ['Santa Barbara',  -119.7,  34.4, 3],
  ['Fresno',         -119.8,  36.7, 3],
  ['Tijuana',        -117.0,  32.5, 3],
  // US East / Central
  ['New York',        -74.0,  40.7, 1],
  ['Chicago',         -87.6,  41.9, 1],
  ['Houston',         -95.4,  29.8, 2],
  ['Dallas',          -96.8,  32.8, 2],
  ['Denver',         -104.9,  39.7, 2],
  ['Washington DC',   -77.0,  38.9, 1],
  ['Miami',           -80.2,  25.8, 2],
  ['Atlanta',         -84.4,  33.7, 2],
  // Canada / Mexico
  ['Vancouver',      -123.1,  49.3, 2],
  ['Calgary',        -114.1,  51.0, 3],
  ['Toronto',         -79.4,  43.7, 1],
  ['Mexico City',     -99.1,  19.4, 1],
  ['Guadalajara',    -103.3,  20.7, 2],
  ['Monterrey',      -100.3,  25.7, 2],
  // South America
  ['Bogotá',          -74.1,   4.7, 1],
  ['Lima',            -77.0, -12.0, 1],
  ['Santiago',        -70.7, -33.5, 1],
  ['Buenos Aires',    -58.4, -34.6, 1],
  ['São Paulo',       -46.6, -23.5, 1],
  ['Rio de Janeiro',  -43.2, -22.9, 1],
  // Europe
  ['London',           -0.1,  51.5, 1],
  ['Paris',             2.3,  48.9, 1],
  ['Berlin',           13.4,  52.5, 1],
  ['Madrid',           -3.7,  40.4, 1],
  ['Rome',             12.5,  41.9, 1],
  ['Amsterdam',         4.9,  52.4, 2],
  ['Brussels',          4.4,  50.8, 2],
  ['Vienna',           16.4,  48.2, 2],
  ['Warsaw',           21.0,  52.2, 2],
  ['Stockholm',        18.1,  59.3, 2],
  ['Oslo',             10.7,  59.9, 2],
  ['Kyiv',             30.5,  50.5, 2],
  ['Moscow',           37.6,  55.8, 1],
  ['Istanbul',         29.0,  41.0, 1],
  ['Athens',           23.7,  37.9, 2],
  // Africa
  ['Cairo',            31.2,  30.1, 1],
  ['Lagos',             3.4,   6.5, 1],
  ['Nairobi',          36.8,  -1.3, 1],
  ['Johannesburg',     28.0, -26.2, 1],
  ['Casablanca',       -7.6,  33.6, 2],
  ['Addis Ababa',      38.7,   9.0, 2],
  ['Kinshasa',         15.3,  -4.3, 1],
  // Middle East / Asia
  ['Riyadh',           46.7,  24.7, 1],
  ['Tehran',           51.4,  35.7, 1],
  ['Baghdad',          44.4,  33.3, 1],
  ['Dubai',            55.3,  25.2, 2],
  ['Karachi',          67.0,  24.9, 1],
  ['Islamabad',        73.0,  33.7, 2],
  ['Delhi',            77.2,  28.6, 1],
  ['Mumbai',           72.8,  19.1, 1],
  ['Dhaka',            90.4,  23.7, 1],
  ['Kolkata',          88.4,  22.6, 2],
  ['Colombo',          79.9,   6.9, 2],
  ['Bangkok',         100.5,  13.8, 1],
  ['Kuala Lumpur',    101.7,   3.1, 1],
  ['Singapore',       103.8,   1.4, 1],
  ['Jakarta',         106.8,  -6.2, 1],
  ['Manila',          120.9,  14.6, 1],
  ['Ho Chi Minh City',106.7,  10.8, 2],
  ['Hanoi',           105.8,  21.0, 2],
  ['Yangon',           96.2,  16.9, 2],
  ['Taipei',          121.6,  25.0, 1],
  ['Hong Kong',       114.2,  22.3, 1],
  ['Guangzhou',       113.3,  23.1, 2],
  ['Shanghai',        121.5,  31.2, 1],
  ['Beijing',         116.4,  39.9, 1],
  ['Seoul',           126.9,  37.6, 1],
  ['Tokyo',           139.7,  35.7, 1],
  ['Osaka',           135.5,  34.7, 2],
  ['Pyongyang',       125.7,  39.0, 2],
  ['Ulaanbaatar',     106.9,  47.9, 2],
  ['Kabul',            69.2,  34.5, 2],
  ['Tashkent',         69.2,  41.3, 2],
  ['Almaty',           76.9,  43.3, 2],
  // Oceania
  ['Sydney',          151.2, -33.9, 1],
  ['Melbourne',       145.0, -37.8, 1],
  ['Brisbane',        153.0, -27.5, 2],
  ['Auckland',        174.8, -36.9, 1],
];

// ── Data loaders ──────────────────────────────────────────────────────────────

let cached110m:    any | null = null;
let cached50m:     any | null = null;
let cachedCountries: {borders: any; countryFeatures: any[]} | null = null;
let cachedAdmin1: any | null = null;
let cachedLakes:  any | null = null;
let cachedRivers: any | null = null;
let cachedStars: StarParticle[] | null = null;
let load110mPromise:     Promise<any | null>  | null = null;
let load50mPromise:      Promise<any | null>  | null = null;
let loadCountriesPromise: Promise<{borders: any; countryFeatures: any[]} | null> | null = null;
let loadAdmin1Promise: Promise<any | null> | null = null;
let loadLakesPromise:   Promise<any | null> | null = null;
let loadRiversPromise:  Promise<any | null> | null = null;

const graticule = geoGraticule().step([30, 30])();

type StarParticle = {
  x: number;
  y: number;
  z: number;
  distance: number;
  radius: number;
  alpha: number;
  layer: 1 | 2 | 3;
  twinkleSpeed: number;
  twinklePhase: number;
};

async function loadLandFeature(res: '110m' | '50m'): Promise<any | null> {
  if (res === '110m') {
    if (cached110m) return cached110m;
    if (load110mPromise) return load110mPromise;
    load110mPromise = fetchTopoLand('/land-110m.json').then(f => { cached110m = f; return f; });
    return load110mPromise;
  }
  if (cached50m) return cached50m;
  if (load50mPromise) return load50mPromise;
  load50mPromise = fetchTopoLand('/land-50m.json').then(f => { cached50m = f; return f; });
  return load50mPromise;
}

async function fetchTopoLand(url: string): Promise<any | null> {
  return fetch(url)
    .then(r => r.json() as Promise<Record<string, any>>)
    .then(topo => {
      const obj = (topo?.['objects'] as Record<string, any>)?.['land'];
      if (!obj) throw new Error(`land missing in ${url}`);
      return feature(topo as any, obj as any);
    })
    .catch(err => { console.error('[LocationGlobe]', url, err); return null; });
}

async function loadCountriesData(): Promise<typeof cachedCountries> {
  if (cachedCountries) return cachedCountries;
  if (loadCountriesPromise) return loadCountriesPromise;
  loadCountriesPromise = fetch('/countries-50m.json')
    .then(r => r.json() as Promise<Record<string, any>>)
    .then(topo => {
      const obj = (topo?.['objects'] as Record<string, any>)?.['countries'];
      if (!obj) throw new Error('countries object missing');
      const borders = mesh(topo as any, obj as any, (a: any, b: any) => a !== b);
      const fc = feature(topo as any, obj as any) as any;
      cachedCountries = {borders, countryFeatures: fc.features ?? []};
      return cachedCountries;
    })
    .catch(err => {
      console.error('[LocationGlobe] countries load failed:', err);
      loadCountriesPromise = null;
      return null;
    });
  return loadCountriesPromise;
}

async function loadLakesData(): Promise<any | null> {
  if (cachedLakes) return cachedLakes;
  if (loadLakesPromise) return loadLakesPromise;
  loadLakesPromise = fetch('/lakes-10m.geojson')
    .then(r => r.json())
    .then(geojson => { cachedLakes = geojson; return geojson; })
    .catch(err => { console.error('[LocationGlobe] lakes load failed:', err); loadLakesPromise = null; return null; });
  return loadLakesPromise;
}

async function loadRiversData(): Promise<any | null> {
  if (cachedRivers) return cachedRivers;
  if (loadRiversPromise) return loadRiversPromise;
  loadRiversPromise = fetch('/rivers-50m.geojson')
    .then(r => r.json())
    .then(gj => { cachedRivers = gj; return gj; })
    .catch(err => { console.error('[LocationGlobe] rivers load failed:', err); loadRiversPromise = null; return null; });
  return loadRiversPromise;
}

async function loadAdmin1Data(): Promise<any | null> {
  if (cachedAdmin1) return cachedAdmin1;
  if (loadAdmin1Promise) return loadAdmin1Promise;
  loadAdmin1Promise = fetch('/admin1-50m.geojson')
    .then(r => r.json())
    .then(geojson => { cachedAdmin1 = geojson; return geojson; })
    .catch(err => { console.error('[LocationGlobe] admin1 load failed:', err); loadAdmin1Promise = null; return null; });
  return loadAdmin1Promise;
}

async function geocode(location: string): Promise<[number, number] | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`;
    const r = await fetch(url, {headers: {'Accept-Language': 'en'}});
    const data = (await r.json()) as any[];
    if (!data?.[0]) return null;
    return [parseFloat(data[0].lat as string), parseFloat(data[0].lon as string)];
  } catch (err) {
    console.error('[LocationGlobe] geocode failed:', err);
    return null;
  }
}

function easeInOut(t: number) { return 0.5 - 0.5 * Math.cos(t * Math.PI); }
function easeOut(t:   number) { return 1 - Math.pow(1 - t, 3); }

function createSeededRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function getStarfield(): StarParticle[] {
  if (cachedStars) return cachedStars;
  const rand = createSeededRandom(STARFIELD_SEED);
  const stars: StarParticle[] = [];
  for (let i = 0; i < STAR_COUNT; i += 1) {
    const depthBucket = rand();
    const layer: 1 | 2 | 3 = depthBucket < 0.12 ? 3 : depthBucket < 0.55 ? 2 : 1;
    const distance =
      layer === 3
        ? 2.3 + rand() * 2.5
        : layer === 2
          ? 4.8 + rand() * 6.5
          : 11.5 + rand() * 22;
    const radius = layer === 1 ? 0.14 + rand() * 0.14 : layer === 2 ? 0.2 + rand() * 0.2 : 0.3 + rand() * 0.32;
    const alpha = layer === 1 ? 0.12 + rand() * 0.18 : layer === 2 ? 0.2 + rand() * 0.28 : 0.34 + rand() * 0.34;
    // Uniform point on unit sphere, used as celestial directions.
    const lat = Math.asin(rand() * 2 - 1);
    const lon = rand() * 2 * Math.PI - Math.PI;
    const cosLat = Math.cos(lat);
    const dirX = cosLat * Math.sin(lon);
    const dirY = Math.sin(lat);
    const dirZ = cosLat * Math.cos(lon);
    stars.push({
      x: dirX * distance,
      y: dirY * distance,
      z: dirZ * distance,
      distance,
      radius,
      alpha: Math.min(alpha, 0.95),
      layer,
      twinkleSpeed: 0.00035 + rand() * 0.00095,
      twinklePhase: rand() * 2 * Math.PI,
    });
  }
  cachedStars = stars;
  return stars;
}

function rotatePointToView(
  x: number,
  y: number,
  z: number,
  lambdaC: number,
  phiC: number,
) {
  // Match globe interaction orientation: yaw by lambda, pitch by phi.
  const yaw = -lambdaC;
  const pitch = -phiC;

  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const x1 = x * cosYaw - z * sinYaw;
  const z1 = x * sinYaw + z * cosYaw;

  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  const y2 = y * cosPitch - z1 * sinPitch;
  const z2 = y * sinPitch + z1 * cosPitch;

  return {x: x1, y: y2, z: z2};
}

function isPointVisibleOnFrontHemisphere(
  centerLonRad: number,
  centerLatRad: number,
  pointLonDeg: number,
  pointLatDeg: number,
): boolean {
  const pointLonRad = pointLonDeg * DEG;
  const pointLatRad = pointLatDeg * DEG;
  // cos(angularDistance) > 0  => point is on the front hemisphere (<= 90 deg away)
  const cosAngularDistance =
    Math.sin(centerLatRad) * Math.sin(pointLatRad) +
    Math.cos(centerLatRad) * Math.cos(pointLatRad) * Math.cos(pointLonRad - centerLonRad);
  return cosAngularDistance > 0.0001;
}

function drawStarfield(
  ctx: CanvasRenderingContext2D,
  vw: number,
  vh: number,
  lambdaC: number,
  phiC: number,
  nowMs: number,
) {
  const cx = vw / 2;
  const cy = vh / 2;
  const fov = STAR_FOV_DEG * DEG;
  const focal = (vw * 0.5) / Math.tan(fov / 2);

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, vw, vh);

  const stars = getStarfield();
  const camX = Math.sin(lambdaC) * STAR_CAMERA_ORBIT_RADIUS;
  const camY = Math.sin(phiC) * STAR_CAMERA_ORBIT_RADIUS * 0.8;
  const camZ = Math.cos(lambdaC) * Math.cos(phiC) * STAR_CAMERA_ORBIT_RADIUS;

  for (const star of stars) {
    // Translate by a subtle orbiting camera to create depth parallax.
    const relX = star.x - camX;
    const relY = star.y - camY;
    const relZ = star.z - camZ;
    const view = rotatePointToView(relX, relY, relZ, lambdaC, phiC);
    // Only render stars in front of the camera frustum.
    if (view.z <= 0.02) continue;

    const x = cx + (view.x / view.z) * focal;
    const y = cy - (view.y / view.z) * focal;
    if (x < -24 || x > vw + 24 || y < -24 || y > vh + 24) continue;

    const depthT = Math.max(0, Math.min(1, (star.distance - 2.3) / 31.2));
    const twinkle = 0.72 + 0.28 * Math.sin(nowMs * star.twinkleSpeed + star.twinklePhase);
    const coreR = star.radius * (star.layer === 3 ? 1.2 : star.layer === 2 ? 1.08 : 0.95);
    const haloR = coreR + (star.layer === 3 ? 1.25 : star.layer === 2 ? 0.92 : 0.65) * twinkle;
    const halo = ctx.createRadialGradient(x, y, 0, x, y, haloR);
    halo.addColorStop(0, `rgba(255, 255, 255, ${(star.alpha * 0.45 * twinkle).toFixed(3)})`);
    halo.addColorStop(0.45, `rgba(245, 248, 255, ${(star.alpha * (0.045 + (1 - depthT) * 0.045) * twinkle).toFixed(3)})`);
    halo.addColorStop(1, 'rgba(245, 248, 255, 0)');
    ctx.beginPath();
    ctx.arc(x, y, haloR, 0, 2 * Math.PI);
    ctx.fillStyle = halo;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.24, coreR * 0.65), 0, 2 * Math.PI);
    ctx.fillStyle = `rgba(255, 255, 255, ${(star.alpha * 0.95 * twinkle).toFixed(3)})`;
    ctx.fill();
  }
}

// ── Renderer ──────────────────────────────────────────────────────────────────

function drawGlobe(
  ctx: CanvasRenderingContext2D,
  landFeature:      any | null,
  lakesFeature:     any | null,
  riversFeature:    any | null,
  admin1Feature:    any | null,
  countriesData:    {borders: any; countryFeatures: any[]} | null,
  lambdaC:          number,
  phiC:             number,
  currentScale:     number,
  baseScale:        number,
  maxScale:         number,
  vw:               number,
  vh:               number,
  dotCoords:        [number, number] | null,
  dotAlpha:         number,
  nowMs:            number,
) {
  const cx = vw / 2;
  const cy = vh / 2;
  const zp = Math.max(0, Math.min((currentScale - baseScale) / (maxScale - baseScale), 1));

  const projection = geoOrthographic()
    .translate([cx, cy])
    .scale(currentScale)
    .rotate([-(lambdaC / DEG), -(phiC / DEG)])
    .clipAngle(90)
    .precision(0.5);
  const path = geoPath(projection, ctx);

  ctx.clearRect(0, 0, vw, vh);

  // Panoramic space background behind the globe.
  drawStarfield(ctx, vw, vh, lambdaC, phiC, nowMs);

  // Ocean
  const gr = currentScale;
  const grad = ctx.createRadialGradient(cx - gr * 0.3, cy - gr * 0.3, gr * 0.05, cx, cy, gr);
  grad.addColorStop(0, '#1a3a6e');
  grad.addColorStop(1, OCEAN);
  ctx.beginPath();
  ctx.arc(cx, cy, gr, 0, 2 * Math.PI);
  ctx.fillStyle = grad;
  ctx.fill();

  // Graticule (fades with zoom)
  const gratA = Math.max(0, 1 - zp * 3);
  if (gratA > 0.01) {
    ctx.beginPath();
    path(graticule as any);
    ctx.strokeStyle = `rgba(255,255,255,${(0.06 * gratA).toFixed(3)})`;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  // Land fill
  if (landFeature) {
    ctx.beginPath();
    path(landFeature as any);
    ctx.fillStyle = LAND;
    ctx.fill();
    ctx.strokeStyle = LAND_STROKE;
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }

  // Lakes — drawn over land so they punch through as water
  if (lakesFeature) {
    ctx.beginPath();
    path(lakesFeature as any);
    ctx.fillStyle = LAKE;
    ctx.fill();
    ctx.strokeStyle = 'rgba(14,34,68,0.6)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  // Rivers — only appear as zoom increases; line width and opacity scale with zp
  if (riversFeature && zp > 0.1) {
    const riverFeats: any[] = riversFeature.features ?? [];
    // zp 0→1: rivers fade in and thicken proportionally
    const zpRiver = Math.max(0, (zp - 0.1) / 0.9); // 0 at globe, 1 at full zoom
    for (const feat of riverFeats) {
      const rank: number = feat?.properties?.rank ?? 9;
      // Minor rivers only show when well zoomed in
      if (rank > 5 && zpRiver < 0.5) continue;
      if (rank > 3 && zpRiver < 0.2) continue;
      ctx.beginPath();
      path(feat as any);
      const baseOpacity = rank <= 3 ? 0.9  : rank <= 5 ? 0.75 : 0.6;
      const baseWidth   = rank <= 3 ? 1.6  : rank <= 5 ? 1.1  : 0.7;
      ctx.strokeStyle = `rgba(14,34,68,${(baseOpacity * zpRiver).toFixed(3)})`;
      ctx.lineWidth   = baseWidth * zpRiver;
      ctx.stroke();
    }
  }

  // ── Zoomed layers: state borders, country borders, labels, cities ──────────
  if (zp > 0.15 && admin1Feature) {
    const layerAlpha = Math.min(1, (zp - 0.15) / 0.4);

    // State / province borders
    ctx.beginPath();
    path(admin1Feature as any);
    ctx.strokeStyle = `rgba(255,255,255,${(0.18 * layerAlpha).toFixed(3)})`;
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // State / province abbreviations at each region's centroid
    const abbrevA = (0.85 * layerAlpha).toFixed(3);
    ctx.save();
    ctx.font = `bold 10px system-ui,sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const features: any[] = admin1Feature.features ?? [];
    for (const feat of features) {
      const abbrev: string = feat?.properties?.postal ?? '';
      if (!abbrev) continue;
      try {
        const centroid = geoCentroid(feat as any);
        const pt = projection(centroid);
        if (!pt) continue;
        if (pt[0] < 0 || pt[0] > vw || pt[1] < 0 || pt[1] > vh) continue;
        // shadow
        ctx.fillStyle = `rgba(0,0,0,${(0.45 * layerAlpha).toFixed(3)})`;
        ctx.fillText(abbrev, pt[0] + 1, pt[1] + 1);
        // label in text-muted-foreground: hsl(215,20.2%,65.1%)
        ctx.fillStyle = `hsla(215,20.2%,65.1%,${abbrevA})`;
        ctx.fillText(abbrev, pt[0], pt[1]);
      } catch { /* skip degenerate geometries */ }
    }
    ctx.restore();
  }

  // ── Water labels: lakes + rivers (italic, light blue) ─────────────────────
  if (zp > 0.2) {
    const waterA = Math.min(1, (zp - 0.2) / 0.5);
    ctx.save();
    ctx.font = `italic 10px system-ui,sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const labelColor = `hsla(210,75%,78%,${waterA.toFixed(3)})`;
    const shadowColor = `rgba(0,0,0,${(0.5 * waterA).toFixed(3)})`;

    // Lake labels
    const lakeFts: any[] = lakesFeature?.features ?? [];
    for (const feat of lakeFts) {
      const name: string = feat?.properties?.name ?? '';
      if (!name) continue;
      try {
        const centroid = geoCentroid(feat as any);
        const pt = projection(centroid);
        if (!pt) continue;
        if (pt[0] < 0 || pt[0] > vw || pt[1] < 0 || pt[1] > vh) continue;
        ctx.fillStyle = shadowColor;
        ctx.fillText(name, pt[0] + 1, pt[1] + 1);
        ctx.fillStyle = labelColor;
        ctx.fillText(name, pt[0], pt[1]);
      } catch { /* skip */ }
    }

    // River labels — only rank ≤ 5 (major rivers), label at geometric centroid
    ctx.font = `italic 9px system-ui,sans-serif`;
    const riverFts: any[] = riversFeature?.features ?? [];
    for (const feat of riverFts) {
      const name: string = feat?.properties?.name ?? '';
      const rank: number = feat?.properties?.rank ?? 9;
      if (!name || rank > 5) continue;
      try {
        const centroid = geoCentroid(feat as any);
        const pt = projection(centroid);
        if (!pt) continue;
        if (pt[0] < 0 || pt[0] > vw || pt[1] < 0 || pt[1] > vh) continue;
        ctx.fillStyle = shadowColor;
        ctx.fillText(name, pt[0] + 1, pt[1] + 1);
        ctx.fillStyle = labelColor;
        ctx.fillText(name, pt[0], pt[1]);
      } catch { /* skip */ }
    }
    ctx.restore();
  }

  if (zp > 0.15 && countriesData) {
    const layerAlpha = Math.min(1, (zp - 0.15) / 0.4); // fade in

    // Country borders (brighter / thicker than state lines)
    ctx.beginPath();
    path(countriesData.borders as any);
    ctx.strokeStyle = `rgba(255,255,255,${(0.35 * layerAlpha).toFixed(3)})`;
    ctx.lineWidth = 0.7;
    ctx.stroke();

    // Country name labels
    ctx.save();
    ctx.font = `bold ${Math.round(11 * layerAlpha + 2)}px system-ui,sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const feat of countriesData.countryFeatures) {
      const name = COUNTRY_NAMES[String(feat.id)] ?? null;
      if (!name) continue;
      try {
        const centroid = geoCentroid(feat as any);
        const pt = projection(centroid);
        if (!pt) continue;
        if (pt[0] < -40 || pt[0] > vw + 40 || pt[1] < -40 || pt[1] > vh + 40) continue;
        // shadow
        ctx.fillStyle = `rgba(0,0,0,${(0.55 * layerAlpha).toFixed(3)})`;
        ctx.fillText(name, pt[0] + 1, pt[1] + 1);
        // text
        ctx.fillStyle = `rgba(220,230,255,${(0.85 * layerAlpha).toFixed(3)})`;
        ctx.fillText(name, pt[0], pt[1]);
      } catch { /* skip degenerate geometries */ }
    }
    ctx.restore();

    // City dots + labels
    ctx.save();
    for (const [cityName, lon, lat, tier] of CITIES) {
      // Show all tiers when fully zoomed, only tier 1 early on
      if (tier === 3 && zp < 0.6) continue;
      if (tier === 2 && zp < 0.4) continue;

      const pt = projection([lon, lat]);
      if (!pt) continue;
      if (pt[0] < -20 || pt[0] > vw + 20 || pt[1] < -20 || pt[1] > vh + 20) continue;

      const dotR = tier === 1 ? 3 : tier === 2 ? 2 : 1.5;
      const fontSize = tier === 1 ? 11 : tier === 2 ? 10 : 9;
      const textA = layerAlpha * (tier === 3 ? 0.75 : 0.9);

      // dot
      ctx.beginPath();
      ctx.arc(pt[0], pt[1], dotR, 0, 2 * Math.PI);
      ctx.fillStyle = `rgba(255,255,255,${textA.toFixed(3)})`;
      ctx.fill();

      // label shadow
      ctx.font = `${tier === 1 ? 'bold ' : ''}${fontSize}px system-ui,sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = `rgba(0,0,0,${(0.5 * layerAlpha).toFixed(3)})`;
      ctx.fillText(cityName, pt[0] + dotR + 2.5, pt[1] + 1);
      // label
      ctx.fillStyle = `rgba(255,255,255,${textA.toFixed(3)})`;
      ctx.fillText(cityName, pt[0] + dotR + 2, pt[1]);
    }
    ctx.restore();
  }

  // Vignette (fades with zoom)
  const vigA = Math.max(0, 1 - zp * 2);
  if (vigA > 0.01) {
    const vign = ctx.createRadialGradient(cx, cy, currentScale * 0.6, cx, cy, currentScale);
    vign.addColorStop(0, 'rgba(0,0,0,0)');
    vign.addColorStop(1, `rgba(0,0,0,${(0.55 * vigA).toFixed(3)})`);
    ctx.beginPath();
    ctx.arc(cx, cy, currentScale, 0, 2 * Math.PI);
    ctx.fillStyle = vign;
    ctx.fill();
  }

  // Specular (fades with zoom)
  const specA = Math.max(0, 1 - zp * 2.5);
  if (specA > 0.01) {
    const spec = ctx.createRadialGradient(
      cx - currentScale * 0.38, cy - currentScale * 0.38, 0,
      cx - currentScale * 0.3,  cy - currentScale * 0.3,  currentScale * 0.55,
    );
    spec.addColorStop(0, `rgba(255,255,255,${(0.07 * specA).toFixed(3)})`);
    spec.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.beginPath();
    ctx.arc(cx, cy, currentScale, 0, 2 * Math.PI);
    ctx.fillStyle = spec;
    ctx.fill();
  }

  // Location dot
  if (
    dotCoords &&
    dotAlpha > 0 &&
    isPointVisibleOnFrontHemisphere(lambdaC, phiC, dotCoords[1], dotCoords[0])
  ) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, currentScale, 0, 2 * Math.PI);
    ctx.clip();
    const pt = projection([dotCoords[1], dotCoords[0]]);
    if (pt) {
      const a = dotAlpha;
      const glow = ctx.createRadialGradient(pt[0], pt[1], 0, pt[0], pt[1], 18);
      glow.addColorStop(0, `hsla(198.6,88.7%,48.4%,${(0.55 * a).toFixed(3)})`);
      glow.addColorStop(1,  'hsla(198.6,88.7%,48.4%,0)');
      ctx.beginPath(); ctx.arc(pt[0], pt[1], 18, 0, 2 * Math.PI);
      ctx.fillStyle = glow; ctx.fill();
      ctx.beginPath(); ctx.arc(pt[0], pt[1], 5, 0, 2 * Math.PI);
      ctx.fillStyle = `hsla(198.6,88.7%,48.4%,${a.toFixed(3)})`; ctx.fill();
      ctx.beginPath(); ctx.arc(pt[0], pt[1], 2.5, 0, 2 * Math.PI);
      ctx.fillStyle = `hsla(198.6,88.7%,75%,${a.toFixed(3)})`; ctx.fill();
    }
    ctx.restore();
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface LocationGlobeProps { formattedLocation: string; }

export function LocationGlobe({formattedLocation}: LocationGlobeProps) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const viewportRef  = useRef<HTMLDivElement>(null);
  // Exposed to button onClick handlers without re-renders
  const actionsRef = useRef<{
    zoomIn: () => void;
    zoomOut: () => void;
    zoomMax: () => void;
    zoomMin: () => void;
  }>({
    zoomIn: () => {},
    zoomOut: () => {},
    zoomMax: () => {},
    zoomMin: () => {},
  });
  const [isSettled, setIsSettled] = useState(false);

  useEffect(() => {
    if (!formattedLocation) return;
    if (!canvasRef.current || !viewportRef.current) return;
    const canvas:   HTMLCanvasElement = canvasRef.current;
    const viewport: HTMLDivElement    = viewportRef.current;
    const ctxOrNull = canvas.getContext('2d', {alpha: false});
    if (!ctxOrNull) return;
    const ctx: CanvasRenderingContext2D = ctxOrNull;

    let rafId = 0, alive = true;
    let vw = 0, vh = 0, baseRadius = 1, zoomRadius = 1;

    function syncSize() {
      vw = Math.max(1, Math.round(viewport.clientWidth));
      vh = Math.max(1, Math.round(viewport.clientHeight));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      baseRadius = Math.max(1, Math.min(vw, vh) * BASE_RADIUS_FACTOR);
      zoomRadius = baseRadius * TARGET_ZOOM_FACTOR;
      canvas.width  = Math.round(vw * dpr);
      canvas.height = Math.round(vh * dpr);
      canvas.style.width  = `${vw}px`;
      canvas.style.height = `${vh}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    syncSize();
    const ro = new ResizeObserver(syncSize);
    ro.observe(viewport);

    let lambdaC = 0, phiC = 0;
    let targetLambdaC = 0, targetPhiC = 0;
    let currentScale = baseRadius;
    let startTime = 0;
    let landStartTime = 0, landingDurationMs = DECEL_MS;
    let zoomStartTime = 0, settledTime = 0;
    let phase: 'spinning' | 'landing' | 'zooming' | 'settled' = 'spinning';
    let land110: any = null, land50: any = null;
    let lakes: any = null, rivers: any = null;
    let admin1: any = null;
    let countries: {borders: any; countryFeatures: any[]} | null = null;
    let dotCoords: [number, number] | null = null;
    let geocoded = false;
    let animationStarted = false;
    let landingStartLambda = 0, landingStartPhi = 0;
    let spinStartLambda = 0;
    const spinOmega = SPIN_SPEED_DEG_PER_MS * DEG;

    // ── Interactive zoom (button presses) ──────────────────────────────────────
    let btnZoomFrom = baseRadius, btnZoomTo = baseRadius, btnZoomStart = 0;
    let btnZoomDurationMs = BTN_ZOOM_MS;

    function clampScale(s: number) {
      return Math.max(baseRadius, Math.min(zoomRadius, s));
    }

    actionsRef.current.zoomIn = () => {
      btnZoomFrom  = currentScale;
      btnZoomTo    = clampScale(currentScale * ZOOM_STEP);
      btnZoomStart = performance.now();
      btnZoomDurationMs = BTN_ZOOM_MS;
    };
    actionsRef.current.zoomOut = () => {
      btnZoomFrom  = currentScale;
      btnZoomTo    = clampScale(currentScale / ZOOM_STEP);
      btnZoomStart = performance.now();
      btnZoomDurationMs = BTN_ZOOM_MS;
    };
    actionsRef.current.zoomMax = () => {
      if (geocoded) {
        const diff = ((targetLambdaC - lambdaC) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
        lambdaC = lambdaC + diff;
        phiC = targetPhiC;
      }
      btnZoomFrom  = currentScale;
      btnZoomTo    = zoomRadius;
      btnZoomStart = performance.now();
      btnZoomDurationMs = BTN_ZOOM_EXTREME_MS;
    };
    actionsRef.current.zoomMin = () => {
      btnZoomFrom  = currentScale;
      btnZoomTo    = baseRadius;
      btnZoomStart = performance.now();
      btnZoomDurationMs = BTN_ZOOM_EXTREME_MS;
    };

    // ── Drag / pan ─────────────────────────────────────────────────────────────
    let dragging = false;
    let dragX = 0, dragY = 0;
    let dragLambda = 0, dragPhi = 0;
    // Pinch zoom
    let pinching = false;
    let pinchDist0 = 1, pinchScale0 = 1;

    function onPointerDown(e: PointerEvent) {
      if (phase !== 'settled') return;
      if (e.pointerType === 'touch') return; // handled by touch events
      dragging = true;
      dragX = e.clientX; dragY = e.clientY;
      dragLambda = lambdaC; dragPhi = phiC;
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
    }
    function onPointerMove(e: PointerEvent) {
      if (!dragging) return;
      const dx = e.clientX - dragX;
      const dy = e.clientY - dragY;
      lambdaC = dragLambda - dx / currentScale;
      phiC    = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, dragPhi + dy / currentScale));
    }
    function onPointerUp() {
      dragging = false;
      canvas.style.cursor = 'grab';
    }

    function touchDist(t: TouchList) {
      const dx = t[0].clientX - t[1].clientX;
      const dy = t[0].clientY - t[1].clientY;
      return Math.hypot(dx, dy);
    }
    function onTouchStart(e: TouchEvent) {
      if (phase !== 'settled') return;
      if (e.touches.length === 1) {
        dragging = true;
        dragX = e.touches[0].clientX; dragY = e.touches[0].clientY;
        dragLambda = lambdaC; dragPhi = phiC;
      } else if (e.touches.length === 2) {
        dragging = false;
        pinching  = true;
        pinchDist0  = touchDist(e.touches);
        pinchScale0 = currentScale;
      }
    }
    function onTouchMove(e: TouchEvent) {
      e.preventDefault();
      if (e.touches.length === 1 && dragging) {
        const dx = e.touches[0].clientX - dragX;
        const dy = e.touches[0].clientY - dragY;
        lambdaC = dragLambda - dx / currentScale;
        phiC    = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, dragPhi + dy / currentScale));
      } else if (e.touches.length === 2 && pinching) {
        const ratio = touchDist(e.touches) / pinchDist0;
        const next  = clampScale(pinchScale0 * ratio);
        btnZoomFrom = btnZoomTo = currentScale = next; // bypass btn animation
      }
    }
    function onTouchEnd() { dragging = false; pinching = false; }

    canvas.style.cursor = 'grab';
    canvas.addEventListener('pointerdown',  onPointerDown);
    canvas.addEventListener('pointermove',  onPointerMove);
    canvas.addEventListener('pointerup',    onPointerUp);
    canvas.addEventListener('pointerleave', onPointerUp);
    canvas.addEventListener('touchstart', onTouchStart, {passive: false});
    canvas.addEventListener('touchmove',  onTouchMove,  {passive: false});
    canvas.addEventListener('touchend',   onTouchEnd);

    // ── Frame loop ─────────────────────────────────────────────────────────────
    function frame(now: number) {
      if (!alive) return;
      const elapsed = now - startTime;

      if (phase === 'spinning') {
        lambdaC = spinStartLambda + elapsed * spinOmega;
        currentScale = baseRadius;
        if (elapsed >= LAND_IN_MS) {
          phase = 'landing';
          landStartTime = now;
          landingDurationMs = geocoded ? DECEL_MS : QUICK_LAND_MS;
          landingStartLambda = lambdaC;
          landingStartPhi    = phiC;
          if (geocoded) {
            const diff = ((targetLambdaC - lambdaC) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
            targetLambdaC = lambdaC + diff;
          } else {
            targetLambdaC = lambdaC; targetPhiC = phiC;
          }
        }
      } else if (phase === 'landing') {
        const t = Math.min((now - landStartTime) / landingDurationMs, 1);
        const e = easeOut(t);
        lambdaC = landingStartLambda + (targetLambdaC - landingStartLambda) * e;
        phiC    = landingStartPhi    + (targetPhiC    - landingStartPhi)    * e;
        currentScale = baseRadius;
        if (t >= 1) { lambdaC = targetLambdaC; phiC = targetPhiC; phase = 'zooming'; zoomStartTime = now; }
      } else if (phase === 'zooming') {
        const t = Math.min((now - zoomStartTime) / ZOOM_DURATION_MS, 1);
        currentScale = baseRadius * Math.pow(TARGET_ZOOM_FACTOR, easeInOut(t));
        if (t >= 1) {
          currentScale = zoomRadius;
          btnZoomFrom = btnZoomTo = zoomRadius;
          phase = 'settled'; settledTime = now;
          setIsSettled(true);
        }
      } else {
        // Settled: animate button-triggered zoom
        const t = Math.min((now - btnZoomStart) / btnZoomDurationMs, 1);
        const e = easeInOut(t);
        currentScale = btnZoomFrom + (btnZoomTo - btnZoomFrom) * e;
        if (t >= 1) {
          currentScale = btnZoomTo;
          btnZoomFrom = btnZoomTo;
        }
      }

      let dotAlpha = 0;
      if (phase === 'zooming' && dotCoords) {
        const t = Math.min((now - zoomStartTime) / ZOOM_DURATION_MS, 1);
        dotAlpha = Math.max(0, (t - 0.4) / 0.6);
      } else if (phase === 'settled' && dotCoords) {
        const pulseT = ((now - settledTime) % PULSE_PERIOD_MS) / PULSE_PERIOD_MS;
        dotAlpha = 0.5 - 0.5 * Math.cos(pulseT * 2 * Math.PI);
      }

      const activeLand = (phase === 'zooming' || phase === 'settled') ? (land50 ?? land110) : land110;
      drawGlobe(ctx, activeLand, lakes, rivers, admin1, countries, lambdaC, phiC, currentScale,
                baseRadius, zoomRadius, vw, vh, dotCoords, dotAlpha, now);
      rafId = requestAnimationFrame(frame);
    }
    drawGlobe(
      ctx,
      land110,
      lakes,
      rivers,
      admin1,
      countries,
      lambdaC,
      phiC,
      currentScale,
      baseRadius,
      zoomRadius,
      vw,
      vh,
      dotCoords,
      0,
      performance.now(),
    );

    Promise.all([
      loadLandFeature('110m'),
      loadLandFeature('50m'),
      loadLakesData(),
      loadRiversData(),
      loadAdmin1Data(),
      loadCountriesData(),
    ]).then(([f110, f50, lakesData, riversData, adm1, ctryData]) => {
      if (!alive) return;
      land110   = f110;
      land50    = f50;
      lakes     = lakesData;
      rivers    = riversData;
      admin1    = adm1;
      countries = ctryData;
    });

    geocode(formattedLocation).then((geoResult) => {
      if (!alive) return;
      if (geoResult) {
        dotCoords     = geoResult;
        geocoded      = true;
        targetLambdaC = geoResult[1] * DEG;
        targetPhiC    = geoResult[0] * DEG;
      }
      // Start only after geocode resolves so the spin is pre-aligned and never zips abruptly.
      if (!animationStarted) {
        animationStarted = true;
        if (geocoded) {
          spinStartLambda = targetLambdaC - spinOmega * LAND_IN_MS;
        } else {
          spinStartLambda = 0;
        }
        lambdaC = spinStartLambda;
        phiC = 0;
        startTime = performance.now();
        rafId = requestAnimationFrame(frame);
      }
    });

    return () => {
      alive = false;
      cancelAnimationFrame(rafId);
      ro.disconnect();
      canvas.removeEventListener('pointerdown',  onPointerDown);
      canvas.removeEventListener('pointermove',  onPointerMove);
      canvas.removeEventListener('pointerup',    onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove',  onTouchMove);
      canvas.removeEventListener('touchend',   onTouchEnd);
    };
  }, [formattedLocation]);

  if (!formattedLocation) return null;

  const btnBase: React.CSSProperties = {
    width: 36, height: 36,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(10,22,40,0.82)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 8,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 22, lineHeight: 1,
    cursor: 'pointer',
    backdropFilter: 'blur(6px)',
    userSelect: 'none',
    WebkitUserSelect: 'none',
  };

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
        <canvas ref={canvasRef} style={{display: 'block', width: '100%', height: '100%'}} />

        {/* +/- zoom buttons — visible once animation settles */}
        {isSettled && (
          <div style={{
            position: 'absolute', bottom: 14, right: 14,
            display: 'flex', flexDirection: 'column', gap: 6,
            zIndex: 10,
          }}>
            <button
              style={{...btnBase, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em'}}
              onClick={() => actionsRef.current.zoomMax()}
            >
              MAX
            </button>
            <button style={btnBase} onClick={() => actionsRef.current.zoomIn()}>+</button>
            <button style={btnBase} onClick={() => actionsRef.current.zoomOut()}>−</button>
            <button
              style={{...btnBase, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em'}}
              onClick={() => actionsRef.current.zoomMin()}
            >
              MIN
            </button>
          </div>
        )}
      </div>
      <p className="mt-3 text-center text-sm text-muted-foreground tracking-wider uppercase">
        {formattedLocation}
      </p>
    </section>
  );
}

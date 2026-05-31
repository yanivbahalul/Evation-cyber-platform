'use strict';

const geoip = require('geoip-lite');
const { isPrivateIp, normalizeIp, attackLog } = require('@evation/shared-utils');

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const NEGATIVE_CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_CACHE_SIZE = 5000;
const LOOKUP_TIMEOUT_MS = 4000;

/** @type {Map<string, { geo: object, at: number, ttlMs: number }>} */
const cache = new Map();

/** @type {Map<string, Promise<object>>} */
const inFlight = new Map();

/** Geo of this deployment's public egress — used for LAN (192.168.x.x) attackers. */
let lanEgressGeo = null;

const ISRAEL_FALLBACK = {
  city: 'Tel Aviv',
  country: 'Israel',
  countryCode: 'IL',
  lat: 32.0853,
  lng: 34.7818,
  source: 'fallback',
  precision: 'city',
};

/** ISO 3166-1 alpha-2 → display name (geoip-lite stores 2-letter codes). */
const COUNTRY_NAMES = {
  HK: 'Hong Kong',
  SG: 'Singapore',
  TW: 'Taiwan',
  MO: 'Macau',
  US: 'United States',
  GB: 'United Kingdom',
  IL: 'Israel',
  CN: 'China',
  JP: 'Japan',
  KR: 'South Korea',
  DE: 'Germany',
  FR: 'France',
  NL: 'Netherlands',
  RU: 'Russia',
  IN: 'India',
  BR: 'Brazil',
  AU: 'Australia',
  CA: 'Canada',
  VN: 'Vietnam',
  ID: 'Indonesia',
  TH: 'Thailand',
  PH: 'Philippines',
  MY: 'Malaysia',
  AE: 'United Arab Emirates',
  SA: 'Saudi Arabia',
  TR: 'Turkey',
  UA: 'Ukraine',
  PL: 'Poland',
  IT: 'Italy',
  ES: 'Spain',
  SE: 'Sweden',
  NO: 'Norway',
  FI: 'Finland',
  DK: 'Denmark',
  CH: 'Switzerland',
  AT: 'Austria',
  BE: 'Belgium',
  PT: 'Portugal',
  IE: 'Ireland',
  NZ: 'New Zealand',
  ZA: 'South Africa',
  MX: 'Mexico',
  AR: 'Argentina',
  CO: 'Colombia',
  EG: 'Egypt',
  NG: 'Nigeria',
  PK: 'Pakistan',
  BD: 'Bangladesh',
};

function countryLabel(code) {
  if (!code) return '';
  const c = String(code).trim();
  if (!c) return '';
  return COUNTRY_NAMES[c.toUpperCase()] || c;
}

function hasValidCoords(lat, lng) {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0)
  );
}

function formatCity(city, region, country) {
  const c = String(city || '').trim();
  const r = String(region || '').trim();
  const co = String(country || '').trim();
  if (c && co && !c.toLowerCase().includes(co.toLowerCase())) return `${c}, ${co}`;
  if (c) return c;
  if (r && co) return `${r}, ${co}`;
  if (r) return r;
  if (co) return co;
  return 'Unknown';
}

function buildGeoResult({ city, country, countryCode, lat, lng, isp, source, precision }) {
  const resolvedCountry = country || (countryCode ? countryLabel(countryCode) : undefined);
  const resolvedCode = countryCode || undefined;
  const label = city || resolvedCountry || 'Unknown';
  return {
    city: label,
    country: resolvedCountry,
    countryCode: resolvedCode,
    lat: hasValidCoords(lat, lng) ? lat : null,
    lng: hasValidCoords(lat, lng) ? lng : null,
    isp: isp || undefined,
    source: source || 'unknown',
    precision: precision || (city && city !== resolvedCountry ? 'city' : 'country'),
  };
}

function fromGeoipLite(ip) {
  const geo = geoip.lookup(ip);
  if (!geo) return null;

  const countryCode = geo.country || undefined;
  const country = countryCode ? countryLabel(countryCode) : undefined;
  const lat = geo.ll?.[0] ?? null;
  const lng = geo.ll?.[1] ?? null;

  const cityLabel = formatCity(geo.city, geo.region, country || countryCode);

  if (cityLabel && cityLabel !== 'Unknown') {
    return buildGeoResult({
      city: cityLabel,
      country,
      countryCode,
      lat,
      lng,
      source: geo.city ? 'geoip-lite' : 'geoip-lite-country',
      precision: geo.city ? 'city' : 'country',
    });
  }

  // Country + coordinates without city (common for HK, SG, and coarse blocks).
  if (country && hasValidCoords(lat, lng)) {
    return buildGeoResult({
      city: country,
      country,
      countryCode,
      lat,
      lng,
      source: 'geoip-lite-country',
      precision: 'country',
    });
  }

  return null;
}

function fromIpWhoPayload(data) {
  if (!data?.success) return null;
  const countryCode = data.country_code || undefined;
  const country = data.country || (countryCode ? countryLabel(countryCode) : undefined);
  const city = formatCity(data.city, data.region, country || countryCode);
  if (!city || city === 'Unknown') return null;
  return buildGeoResult({
    city,
    country,
    countryCode,
    lat: typeof data.latitude === 'number' ? data.latitude : null,
    lng: typeof data.longitude === 'number' ? data.longitude : null,
    isp: data.connection?.isp || data.connection?.org || undefined,
    source: 'ipwho.is',
    precision: data.city ? 'city' : 'country',
  });
}

const HTTP_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'InnoTech-Honeypot/1.0 (+geo telemetry)',
};

function fromIpApiPayload(data) {
  if (data?.status !== 'success') return null;
  const countryCode = data.countryCode || undefined;
  const country = data.country || (countryCode ? countryLabel(countryCode) : undefined);
  const city = formatCity(data.city, data.regionName, country || countryCode);
  if (!city || city === 'Unknown') return null;
  return buildGeoResult({
    city,
    country,
    countryCode,
    lat: typeof data.lat === 'number' ? data.lat : null,
    lng: typeof data.lon === 'number' ? data.lon : null,
    isp: data.isp || data.org || data.as || undefined,
    source: 'ip-api.com',
    precision: data.city ? 'city' : 'country',
  });
}

async function fetchIpWho(path) {
  const url = `https://ipwho.is/${path}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    headers: HTTP_HEADERS,
  });
  if (!res.ok) throw new Error(`ipwho.is HTTP ${res.status}`);
  return res.json();
}

async function fetchIpApi(ip) {
  const path = ip ? `${encodeURIComponent(ip)}` : '';
  const url = `http://ip-api.com/json/${path}?fields=status,message,country,countryCode,regionName,city,lat,lon,isp,org,as`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    headers: HTTP_HEADERS,
  });
  if (!res.ok) throw new Error(`ip-api.com HTTP ${res.status}`);
  return res.json();
}

async function lookupOnline(ip) {
  try {
    const data = await fetchIpWho(encodeURIComponent(ip));
    const geo = fromIpWhoPayload(data);
    if (geo) return geo;
  } catch {
    // fall through to ip-api.com
  }

  const data = await fetchIpApi(ip);
  return fromIpApiPayload(data);
}

function evictCacheIfNeeded() {
  while (cache.size > MAX_CACHE_SIZE) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

function readCache(ip) {
  const hit = cache.get(ip);
  if (!hit) return null;
  const ttl = hit.ttlMs ?? CACHE_TTL_MS;
  if (Date.now() - hit.at > ttl) {
    cache.delete(ip);
    return null;
  }
  return hit.geo;
}

function writeCache(ip, geo) {
  const isUnknown = !geo?.city || geo.city === 'Unknown';
  const ttlMs = isUnknown ? NEGATIVE_CACHE_TTL_MS : CACHE_TTL_MS;
  cache.set(ip, { geo, at: Date.now(), ttlMs });
  evictCacheIfNeeded();
  return geo;
}

function privateLanGeo() {
  if (lanEgressGeo) {
    return { ...lanEgressGeo, source: 'lan-egress', precision: 'lan-egress' };
  }

  const envCity = process.env.GEO_PRIVATE_CITY?.trim();
  const envCountry = process.env.GEO_PRIVATE_COUNTRY?.trim();
  if (envCity) {
    return buildGeoResult({
      city: envCountry ? `${envCity}, ${envCountry}` : envCity,
      country: envCountry || undefined,
      lat: Number(process.env.GEO_PRIVATE_LAT) || ISRAEL_FALLBACK.lat,
      lng: Number(process.env.GEO_PRIVATE_LNG) || ISRAEL_FALLBACK.lng,
      source: 'env',
      precision: 'lan',
    });
  }

  return buildGeoResult({
    city: 'LAN / Local',
    lat: null,
    lng: null,
    source: 'private',
    precision: 'lan',
  });
}

async function resolveIpGeoImpl(rawIp) {
  const ip = normalizeIp(rawIp);
  if (!ip || ip === 'unknown') {
    return buildGeoResult({ city: 'Unknown', lat: null, lng: null, source: 'none', precision: 'none' });
  }

  const cached = readCache(ip);
  if (cached) return cached;

  let geo = null;

  if (isPrivateIp(ip)) {
    geo = privateLanGeo();
  } else {
    geo = fromGeoipLite(ip);
    if (!geo) {
      try {
        geo = await lookupOnline(ip);
      } catch (err) {
        attackLog.warn('TELEMETRY', 'geo_online_lookup_failed', {
          ip,
          error: err?.message || String(err),
        });
      }
    }
  }

  if (!geo) {
    geo = buildGeoResult({ city: 'Unknown', lat: null, lng: null, source: 'none', precision: 'none' });
  }

  return writeCache(ip, geo);
}

/**
 * Instant geo for live alerts — cache, LAN egress, or geoip-lite (no HTTP).
 * @param {string} rawIp
 */
function resolveIpGeoFast(rawIp) {
  const ip = normalizeIp(rawIp);
  if (!ip || ip === 'unknown') {
    return buildGeoResult({ city: 'Unknown', lat: null, lng: null, source: 'none', precision: 'none' });
  }

  const cached = readCache(ip);
  if (cached) return cached;

  if (isPrivateIp(ip)) {
    return privateLanGeo();
  }

  const geo = fromGeoipLite(ip);
  if (geo) {
    return writeCache(ip, geo);
  }

  return buildGeoResult({ city: 'Unknown', lat: null, lng: null, source: 'pending', precision: 'pending' });
}

/**
 * Resolve city + coordinates for an attacker IP (offline DB, online API, LAN egress).
 * @param {string} rawIp
 */
async function resolveIpGeo(rawIp) {
  const ip = normalizeIp(rawIp);
  if (!ip || ip === 'unknown') {
    return buildGeoResult({ city: 'Unknown', lat: null, lng: null, source: 'none', precision: 'none' });
  }

  const cached = readCache(ip);
  if (cached && cached.source !== 'pending') return cached;

  const pending = inFlight.get(ip);
  if (pending) return pending;

  const promise = resolveIpGeoImpl(rawIp).finally(() => {
    inFlight.delete(ip);
  });
  inFlight.set(ip, promise);
  return promise;
}

/** Apply resolved geo onto an attack payload (socket / DB). */
function applyGeoToPayload(body, geo) {
  const g = geo || buildGeoResult({ city: 'Unknown', lat: null, lng: null, source: 'none', precision: 'none' });
  return {
    ...body,
    city: g.city,
    country: g.country,
    countryCode: g.countryCode,
    lat: g.lat ?? 0,
    lng: g.lng ?? 0,
    geoSource: g.source,
    geoPrecision: g.precision,
    isp: g.isp ?? body?.isp,
  };
}

/** Warm LAN fallback from this host's public IP (e.g. Israel for campus demos). */
async function initLanEgressGeo() {
  const log = attackLog;

  /** @type {Error|null} */
  let ipWhoErr = null;

  try {
    const data = await fetchIpWho('');
    const geo = fromIpWhoPayload(data);
    if (geo) {
      lanEgressGeo = geo;
      clearGeoCache();
      log.info('TELEMETRY', 'lan_egress_geo_ready', {
        city: geo.city,
        country: geo.country,
        source: geo.source,
      });
      return;
    }
  } catch (err) {
    ipWhoErr = err;
  }

  await new Promise((r) => setTimeout(r, 500));

  try {
    const data = await fetchIpApi('');
    const geo = fromIpApiPayload(data);
    if (geo) {
      lanEgressGeo = geo;
      clearGeoCache();
      log.info('TELEMETRY', 'lan_egress_geo_ready', {
        city: geo.city,
        country: geo.country,
        source: geo.source,
      });
      return;
    }
  } catch (err) {
    if (ipWhoErr) {
      log.warn('TELEMETRY', 'lan_egress_geo_ipwho_failed', {
        error: ipWhoErr?.message || String(ipWhoErr),
      });
    }
    log.warn('TELEMETRY', 'lan_egress_geo_ipapi_failed', {
      error: err?.message || String(err),
    });
  }

  lanEgressGeo = { ...ISRAEL_FALLBACK };
  log.info('TELEMETRY', 'lan_egress_geo_using_fallback', {
    city: lanEgressGeo.city,
  });
}

/** Drop stale Unknown entries after deploy / egress warm-up. */
function clearGeoCache() {
  cache.clear();
  inFlight.clear();
}

module.exports = {
  resolveIpGeo,
  resolveIpGeoFast,
  initLanEgressGeo,
  clearGeoCache,
  formatCity,
  applyGeoToPayload,
  hasValidCoords,
  fromGeoipLite,
};

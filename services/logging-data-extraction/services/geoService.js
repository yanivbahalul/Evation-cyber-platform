'use strict';

const geoip = require('geoip-lite');
const { isPrivateIp, normalizeIp } = require('@evation/shared-utils');

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
};

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

function fromGeoipLite(ip) {
  const geo = geoip.lookup(ip);
  if (!geo?.city) return null;
  const city = formatCity(geo.city, geo.region, geo.country);
  if (!city || city === 'Unknown' || city === geo.country) return null;
  return {
    city,
    country: geo.country || undefined,
    countryCode: geo.country || undefined,
    lat: geo.ll?.[0] ?? null,
    lng: geo.ll?.[1] ?? null,
    source: 'geoip-lite',
  };
}

function fromIpWhoPayload(data) {
  if (!data?.success) return null;
  const city = formatCity(data.city, data.region, data.country);
  if (!city || city === 'Unknown') return null;
  return {
    city,
    country: data.country || undefined,
    countryCode: data.country_code || undefined,
    lat: typeof data.latitude === 'number' ? data.latitude : null,
    lng: typeof data.longitude === 'number' ? data.longitude : null,
    isp: data.connection?.isp || data.connection?.org || undefined,
    source: 'ipwho.is',
  };
}

const HTTP_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'InnoTech-Honeypot/1.0 (+geo telemetry)',
};

function fromIpApiPayload(data) {
  if (data?.status !== 'success') return null;
  const city = formatCity(data.city, data.regionName, data.country);
  if (!city || city === 'Unknown') return null;
  return {
    city,
    country: data.country || undefined,
    countryCode: data.countryCode || undefined,
    lat: typeof data.lat === 'number' ? data.lat : null,
    lng: typeof data.lon === 'number' ? data.lon : null,
    isp: data.isp || data.org || data.as || undefined,
    source: 'ip-api.com',
  };
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
    return { ...lanEgressGeo, source: 'lan-egress' };
  }

  const envCity = process.env.GEO_PRIVATE_CITY?.trim();
  const envCountry = process.env.GEO_PRIVATE_COUNTRY?.trim();
  if (envCity) {
    return {
      city: envCountry ? `${envCity}, ${envCountry}` : envCity,
      country: envCountry || undefined,
      lat: Number(process.env.GEO_PRIVATE_LAT) || ISRAEL_FALLBACK.lat,
      lng: Number(process.env.GEO_PRIVATE_LNG) || ISRAEL_FALLBACK.lng,
      source: 'env',
    };
  }

  return { ...ISRAEL_FALLBACK };
}

async function resolveIpGeoImpl(rawIp) {
  const ip = normalizeIp(rawIp);
  if (!ip || ip === 'unknown') {
    return { city: 'Unknown', lat: null, lng: null, source: 'none' };
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
        require('../utils/attackLog').warn('TELEMETRY', 'geo_online_lookup_failed', {
          ip,
          error: err?.message || String(err),
        });
      }
    }
  }

  if (!geo) {
    geo = { city: 'Unknown', lat: null, lng: null, source: 'none' };
  }

  return writeCache(ip, geo);
}

/**
 * Instant geo for live alerts — cache, LAN egress, or geoip-lite only (no HTTP).
 * @param {string} rawIp
 */
function resolveIpGeoFast(rawIp) {
  const ip = normalizeIp(rawIp);
  if (!ip || ip === 'unknown') {
    return { city: 'Unknown', lat: null, lng: null, source: 'none' };
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

  return { city: 'Unknown', lat: null, lng: null, source: 'pending' };
}

/**
 * Resolve city + coordinates for an attacker IP (offline DB, online API, LAN egress).
 * @param {string} rawIp
 * @returns {Promise<{ city: string, lat: number|null, lng: number|null, country?: string, source?: string }>}
 */
async function resolveIpGeo(rawIp) {
  const ip = normalizeIp(rawIp);
  if (!ip || ip === 'unknown') {
    return { city: 'Unknown', lat: null, lng: null, source: 'none' };
  }

  const cached = readCache(ip);
  if (cached) return cached;

  const pending = inFlight.get(ip);
  if (pending) return pending;

  const promise = resolveIpGeoImpl(rawIp).finally(() => {
    inFlight.delete(ip);
  });
  inFlight.set(ip, promise);
  return promise;
}

/** Warm LAN fallback from this host's public IP (e.g. Israel for campus demos). */
async function initLanEgressGeo() {
  const log = require('../utils/attackLog');

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

  // If the primary provider is blocked/rate-limited, wait briefly then fall back.
  // This prevents noisy "failed" logs when the fallback succeeds immediately after.
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
};

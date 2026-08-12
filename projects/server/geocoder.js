const DEFAULT_PHOTON_URL = 'https://photon.komoot.io';
const ISRAEL_BBOX = '34.2,29.3,35.9,33.4';
const CACHE_TTL = 15 * 60 * 1000;
const cache = new Map();

function normalizeBaseUrl(value) {
  try {
    const url = new URL(String(value || DEFAULT_PHOTON_URL));
    if (!['http:', 'https:'].includes(url.protocol)) return DEFAULT_PHOTON_URL;
    return url.toString().replace(/\/$/, '');
  } catch {
    return DEFAULT_PHOTON_URL;
  }
}

function displayAddress(properties = {}) {
  const street = [properties.street || properties.name, properties.housenumber].filter(Boolean).join(' ');
  const locality = properties.city || properties.locality || properties.district || properties.county;
  return [...new Set([street, locality, properties.postcode, properties.country].filter(Boolean))].join(', ');
}

function addressFromFeature(feature) {
  const [lng, lat] = feature.geometry?.coordinates || [];
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const properties = feature.properties || {};
  return {
    address: displayAddress(properties),
    city: properties.city || properties.locality || properties.district || '',
    lat,
    lng,
    placeId: `osm-${properties.osm_type || 'x'}-${properties.osm_id || `${lat}-${lng}`}`,
  };
}

export function createGeocoder(pool) {
  async function settings() {
    const result = await pool.query("SELECT value FROM app_settings WHERE key='map'");
    const value = result.rows[0]?.value || {};
    return { baseUrl: normalizeBaseUrl(value.photonUrl), language: value.addressLanguage || 'default' };
  }

  async function search(query, limit = 6) {
    const normalized = String(query || '').trim();
    if (normalized.length < 3) return [];
    const { baseUrl, language } = await settings();
    const cacheKey = `${baseUrl}|${language}|${normalized.toLocaleLowerCase('he-IL')}|${limit}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.createdAt < CACHE_TTL) return cached.items;

    const url = new URL(`${baseUrl}/api`);
    url.searchParams.set('q', normalized);
    url.searchParams.set('lang', language);
    url.searchParams.set('limit', String(Math.min(Math.max(Number(limit) || 6, 1), 10)));
    url.searchParams.set('bbox', ISRAEL_BBOX);
    url.searchParams.set('lat', '31.7683');
    url.searchParams.set('lon', '35.2137');
    const response = await fetch(url, {
      headers: { Accept: 'application/geo+json, application/json', 'User-Agent': 'PROJECTS-Smart-Project-Management/0.9' },
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) throw new Error(`Photon returned ${response.status}`);
    const data = await response.json();
    const items = (data.features || []).map(addressFromFeature).filter((item) => item?.address);
    cache.set(cacheKey, { createdAt: Date.now(), items });
    if (cache.size > 300) cache.delete(cache.keys().next().value);
    return items;
  }

  async function geocode(address) {
    const items = await search(address, 1);
    const first = items[0];
    return first ? { lat: first.lat, lng: first.lng, formattedAddress: first.address, city: first.city } : null;
  }

  return { search, geocode };
}

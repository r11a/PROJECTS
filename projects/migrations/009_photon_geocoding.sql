UPDATE app_settings
SET value = (value - 'googleApiKey') || jsonb_build_object(
  'provider', 'openstreetmap',
  'addressProvider', 'photon',
  'photonUrl', COALESCE(NULLIF(value->>'photonUrl', ''), 'https://photon.komoot.io'),
  'addressLanguage', CASE WHEN value->>'addressLanguage' IN ('default','de','en','fr') THEN value->>'addressLanguage' ELSE 'default' END
), updated_at = NOW()
WHERE key = 'map';

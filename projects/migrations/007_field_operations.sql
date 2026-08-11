ALTER TABLE equipment_catalog ADD COLUMN IF NOT EXISTS icon_image_stored_name TEXT;
ALTER TABLE client_files ADD COLUMN IF NOT EXISTS storage_path TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS client_equipment (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  catalog_item_id BIGINT NOT NULL REFERENCES equipment_catalog(id) ON DELETE RESTRICT,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  location TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS client_equipment_client_idx ON client_equipment(client_id);

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS dependency_task_id BIGINT REFERENCES tasks(id) ON DELETE SET NULL;

INSERT INTO app_settings(key,value) VALUES
('documentStorage','{"mode":"internal","relativePath":"PROJECTS","verified":true}'::jsonb)
ON CONFLICT(key) DO NOTHING;

DO $$
DECLARE
  category_id BIGINT;
  item RECORD;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('smart_home','בית חכם','#6957df','house-plug'),
    ('multimedia','מולטימדיה','#d95984','audio-lines'),
    ('cameras','מצלמות','#2987e6','camera'),
    ('alarm','מערכת אזעקה','#e05260','shield-alert'),
    ('communications','תקשורת','#12a594','network')
  ) AS categories(code,name,color,icon)
  LOOP
    INSERT INTO equipment_catalog(item_type,code,name,color,icon,unit,description)
    VALUES('system_type',item.code,item.name,item.color,item.icon,'מערכת','קטגוריה מובנית של PROJECTS')
    ON CONFLICT DO NOTHING;
  END LOOP;

  SELECT id INTO category_id FROM equipment_catalog WHERE item_type='system_type' AND code='smart_home' ORDER BY id LIMIT 1;
  FOR item IN SELECT * FROM (VALUES
    ('KNX','KNX','circuit-board'),('SWITCHBEE','SwitchBee','toggle-right'),('HOMEII','HOMEii','house-plug'),('SHELLY','Shelly','wifi'),
    ('SOMFY','משדר SOMFY','radio-tower'),('WALL_TABLET','ערכת טאבלט לקיר','tablet-smartphone'),('BASE_MODULE','מודול בסיס','box'),
    ('HVAC_MODULE','מודול מיזוג','snowflake'),('SECURITY_MODULE','מודול ביטחון','shield-check'),('MULTIMEDIA_MODULE','מודול מולטימדיה','audio-lines'),
    ('FACE_ID','זיהוי פנים','scan-face'),('NETWORK_MODULE','מודול רשת','network')
  ) AS items(code,name,icon) LOOP
    INSERT INTO equipment_catalog(item_type,parent_id,code,name,icon,unit) VALUES('system',category_id,item.code,item.name,item.icon,'יחידה') ON CONFLICT DO NOTHING;
  END LOOP;

  SELECT id INTO category_id FROM equipment_catalog WHERE item_type='system_type' AND code='multimedia' ORDER BY id LIMIT 1;
  FOR item IN SELECT * FROM (VALUES
    ('WIIM_AMP','מגבר WIIM','speaker'),('STREAMER','סטרימר','radio'),('SPEAKER_IN_8','רמקול שקוע 8″','circle-dot'),
    ('SPEAKER_IN_6','רמקול שקוע 6″','circle-dot'),('SPEAKER_OUT_8','רמקול חיצוני לגינה 8″','volume-2'),
    ('SPEAKER_OUT_6','רמקול חיצוני לגינה 6″','volume-2'),('ROCK_SPEAKER','רמקול חיצוני לגינה סלע','mountain')
  ) AS items(code,name,icon) LOOP
    INSERT INTO equipment_catalog(item_type,parent_id,code,name,icon,unit) VALUES('system',category_id,item.code,item.name,item.icon,'יחידה') ON CONFLICT DO NOTHING;
  END LOOP;

  SELECT id INTO category_id FROM equipment_catalog WHERE item_type='system_type' AND code='cameras' ORDER BY id LIMIT 1;
  FOR item IN SELECT * FROM (VALUES
    ('CAM_OUT','מצלמה חיצונית','camera'),('CAM_IN','מצלמה פנימית','camera'),('CAM_BULLET','מצלמת צינור','cctv'),('CAM_DOME','מצלמת כיפה','circle-dot'),
    ('CAM_PTZ','מצלמה ממונעת','rotate-3d'),('CAM_HIDDEN','מצלמה נסתרת','eye-off'),('FRIGATE','FRIGATE','scan-eye'),('SCRIPTED','Scrypted','blocks'),
    ('FACEID','FaceID','scan-face'),('INTERCOM','אינטרקום','door-open'),('NVR','NVR','server'),('ANALYTICS','אנליטיקה','chart-no-axes-combined')
  ) AS items(code,name,icon) LOOP
    INSERT INTO equipment_catalog(item_type,parent_id,code,name,icon,unit) VALUES('system',category_id,item.code,item.name,item.icon,'יחידה') ON CONFLICT DO NOTHING;
  END LOOP;

  SELECT id INTO category_id FROM equipment_catalog WHERE item_type='system_type' AND code='alarm' ORDER BY id LIMIT 1;
  FOR item IN SELECT * FROM (VALUES
    ('RISCO','ריסקו','shield'),('PARADOX','פרדוקס','shield'),('DETECTOR_IN','גלאי פנימי','radar'),('DETECTOR_OUT','גלאי חיצוני','radar'),
    ('SIREN','צופר','siren'),('KEYPAD','קיבורד','panel-top'),('MAGNET','מגנט','magnet'),('CURTAIN','גלאי וילון','panel-left'),
    ('CEILING','גלאי תקרתי','circle-dot'),('FLOOD','גלאי הצפה','waves'),('VOLUME','גלאי נפח','scan'),('SMOKE','גלאי עשן','smoke-detector'),
    ('EXPANDER','מרחיב','git-branch-plus'),('ADDRESSABLE','גלאי כתובתי','map-pin')
  ) AS items(code,name,icon) LOOP
    INSERT INTO equipment_catalog(item_type,parent_id,code,name,icon,unit) VALUES('system',category_id,item.code,item.name,item.icon,'יחידה') ON CONFLICT DO NOTHING;
  END LOOP;

  SELECT id INTO category_id FROM equipment_catalog WHERE item_type='system_type' AND code='communications' ORDER BY id LIMIT 1;
  FOR item IN SELECT * FROM (VALUES
    ('SW24POE','מתג 24 PoE','network'),('SW8POE','מתג 8 PoE','network'),('SW16','מתג 16','network'),('SW24','מתג 24','network'),('SW8','מתג 8','network'),
    ('POE_SPLITTER','מפצל PoE','split'),('POE_INJECTOR','מזרק PoE','plug-zap'),('EXTENDER_IN','מגדיל טווח פנימי','wifi'),('EXTENDER_OUT','מגדיל טווח חיצוני','radio-tower'),
    ('RACK10','ארון 10U','server'),('RACK6','ארון 6U','server'),('RACK25','ארון 25U','server'),('RACK32','ארון 32U','server'),('RACK40','ארון 40U','server'),
    ('PATCH_PANEL','Patch panel','panel-top'),('BLANK_PANEL','פאנל עיוור','rectangle-horizontal'),('BRUSH_PANEL','פאנל שערות','align-justify')
  ) AS items(code,name,icon) LOOP
    INSERT INTO equipment_catalog(item_type,parent_id,code,name,icon,unit) VALUES('system',category_id,item.code,item.name,item.icon,'יחידה') ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

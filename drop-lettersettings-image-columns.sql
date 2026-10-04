-- Purpose: remove duplicate image-source columns from lettersettings
-- Decision: Letter Template Editor is the single source for letterhead/signature images
-- Safe to run after deploying code that no longer reads/writes these columns

-- 1) Optional backup (recommended)
CREATE TABLE IF NOT EXISTS lettersettings_backup_before_drop AS
SELECT * FROM lettersettings;

-- 2) Drop duplicate image columns from lettersettings
ALTER TABLE lettersettings DROP COLUMN IF EXISTS letterhead_url;
ALTER TABLE lettersettings DROP COLUMN IF EXISTS signature_url;

-- 3) Verify result
SHOW COLUMNS FROM lettersettings;

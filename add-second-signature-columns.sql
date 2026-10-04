-- Add columns for second signature support to lettertemplate table
-- This is a backup SQL file that can be run directly in phpMyAdmin or MySQL CLI

-- Add signature label for first signature
ALTER TABLE lettertemplate 
ADD COLUMN IF NOT EXISTS signature_label VARCHAR(255) DEFAULT NULL COMMENT 'Label text for first signature';

-- Add second signature URL
ALTER TABLE lettertemplate 
ADD COLUMN IF NOT EXISTS signature2_url VARCHAR(500) DEFAULT NULL COMMENT 'Path to second signature image';

-- Add second signature positioning
ALTER TABLE lettertemplate 
ADD COLUMN IF NOT EXISTS signature2_x DECIMAL(10,2) DEFAULT 130.00 COMMENT 'X position of second signature (mm)';

ALTER TABLE lettertemplate 
ADD COLUMN IF NOT EXISTS signature2_y DECIMAL(10,2) DEFAULT 250.00 COMMENT 'Y position of second signature (mm)';

-- Add second signature dimensions
ALTER TABLE lettertemplate 
ADD COLUMN IF NOT EXISTS signature2_width DECIMAL(10,2) DEFAULT 40.00 COMMENT 'Width of second signature (mm)';

ALTER TABLE lettertemplate 
ADD COLUMN IF NOT EXISTS signature2_height DECIMAL(10,2) DEFAULT 20.00 COMMENT 'Height of second signature (mm)';

-- Add second signature label
ALTER TABLE lettertemplate 
ADD COLUMN IF NOT EXISTS signature2_label VARCHAR(255) DEFAULT NULL COMMENT 'Label text for second signature';

-- Add second signature control flags
ALTER TABLE lettertemplate 
ADD COLUMN IF NOT EXISTS signature2_lock_aspect BOOLEAN DEFAULT TRUE COMMENT 'Lock aspect ratio for second signature';

ALTER TABLE lettertemplate 
ADD COLUMN IF NOT EXISTS signature2_lock_position BOOLEAN DEFAULT FALSE COMMENT 'Lock position for second signature';

-- Show updated schema
SELECT '✅ Migration completed! New columns added to lettertemplate table.' AS status;

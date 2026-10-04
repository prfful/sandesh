-- Add content_start_margin column to lettersettings table
-- Run this SQL in your MySQL database

USE sandesh_data;

-- Check if column exists, if not add it
ALTER TABLE lettersettings 
ADD COLUMN IF NOT EXISTS content_start_margin DECIMAL(10,2) DEFAULT 90.00;

-- Update existing records
UPDATE lettersettings 
SET content_start_margin = 90.00 
WHERE content_start_margin IS NULL;

-- Verify the change
DESCRIBE lettersettings;

SELECT id, letterhead_height, content_start_margin, signature_height 
FROM lettersettings;

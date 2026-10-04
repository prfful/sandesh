-- =========================================
-- Add TEXT WhatsApp API Columns to AppSettings
-- For Bulk Text Message (Birthday/Anniversary)
-- =========================================

-- Check current columns
SELECT COLUMN_NAME, DATA_TYPE, COLUMN_COMMENT 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'appsettings' 
  AND TABLE_SCHEMA = DATABASE()
  AND COLUMN_NAME LIKE '%whatsapp%'
ORDER BY ORDINAL_POSITION;

-- Add new columns for TEXT API (if not exist)
ALTER TABLE `appsettings` 
ADD COLUMN IF NOT EXISTS `whatsapp_text_api_url` TEXT 
COMMENT 'WhatsApp TEXT template API URL for bulk text messages';

ALTER TABLE `appsettings` 
ADD COLUMN IF NOT EXISTS `whatsapp_text_template_name` VARCHAR(255) 
COMMENT 'WhatsApp TEXT template name (e.g., team_neenavverma_01)';

ALTER TABLE `appsettings` 
ADD COLUMN IF NOT EXISTS `whatsapp_text_api_enabled` TINYINT(1) DEFAULT 0 
COMMENT 'Enable/disable WhatsApp TEXT API for bulk messages';

-- Rename existing columns for clarity (UTILITY/PDF API)
-- Skip if already renamed
ALTER TABLE `appsettings` 
CHANGE COLUMN `whatsapp_api_url` `whatsapp_pdf_api_url` TEXT
COMMENT 'WhatsApp UTILITY template API URL for PDF invitations';

ALTER TABLE `appsettings` 
CHANGE COLUMN `whatsapp_api_enabled` `whatsapp_pdf_api_enabled` TINYINT(1) DEFAULT 0
COMMENT 'Enable/disable WhatsApp UTILITY API for PDF invitations';

-- View updated schema
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'appsettings' 
  AND TABLE_SCHEMA = DATABASE()
  AND COLUMN_NAME LIKE '%whatsapp%'
ORDER BY ORDINAL_POSITION;

-- =========================================
-- USAGE NOTES:
-- =========================================
-- 1. Run this SQL in phpMyAdmin or MySQL client
-- 2. After running, configure in WhatsApp Settings:
--    - PDF API: For Letter Generator (UTILITY template)
--    - TEXT API: For Birthday/Anniversary (TEXT template)
-- =========================================

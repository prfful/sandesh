-- Add whatsapp_template_name column to appsettings table
-- This column stores the name of the letter template to use for WhatsApp messages

-- Check if column exists first
SELECT COLUMN_NAME 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'u590837060_sandesh_data' 
  AND TABLE_NAME = 'appsettings' 
  AND COLUMN_NAME = 'whatsapp_template_name';

-- If the above query returns no results, run this ALTER TABLE command:
ALTER TABLE appsettings 
ADD COLUMN whatsapp_template_name VARCHAR(255) DEFAULT NULL 
COMMENT 'Letter template name to use for WhatsApp messages';

-- Verify the column was added
SHOW COLUMNS FROM appsettings;

-- Optional: Set a default template name (replace 'dharfc_one' with your template name)
-- UPDATE appsettings SET whatsapp_template_name = 'dharfc_one' WHERE id = 1;

-- Add template_type at end of lettertemplate table
ALTER TABLE lettertemplate
ADD COLUMN template_type VARCHAR(20) NOT NULL DEFAULT 'utility';

-- Classify existing birthday/anniversary text templates
UPDATE lettertemplate
SET template_type = 'text'
WHERE LOWER(COALESCE(program_type, '')) IN ('birthday', 'anniversary', 'simple_text');

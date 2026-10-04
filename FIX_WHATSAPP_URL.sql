-- Fix WhatsApp TEXT API URL Template
-- Execute this SQL in phpMyAdmin or your database GUI

UPDATE `appsettings` 
SET `whatsapp_text_api_url` = 'https://bhashsms.com/api/sendmsg.php?user=Dharfc_bwa&pass=123456&sender=BUZWAP&phone={{Mob}}&text=team_neena_verma9&params={{Name}},{{Message}}&priority=wa&stype=normal'
WHERE `id` = 1;

-- Verify the update:
SELECT `id`, `whatsapp_text_api_url` FROM `appsettings` WHERE `id` = 1;

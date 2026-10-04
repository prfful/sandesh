-- Adds per-template layout and typography fields so Visual Template Designer settings persist.
-- Run this against your MySQL database (e.g., `mysql -u user -p sandesh_data < add-lettertemplate-style-fields.sql`).

ALTER TABLE lettertemplate
  ADD COLUMN IF NOT EXISTS letterhead_url TEXT,
  ADD COLUMN IF NOT EXISTS signature_url TEXT,
  ADD COLUMN IF NOT EXISTS letterhead_x DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS letterhead_y DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS letterhead_width DECIMAL(10,2) DEFAULT 100,
  ADD COLUMN IF NOT EXISTS letterhead_height DECIMAL(10,2) DEFAULT 15,
  ADD COLUMN IF NOT EXISTS letterhead_lock_aspect TINYINT(1) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS letterhead_lock_position TINYINT(1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS letterhead_expand_width TINYINT(1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS signature_x DECIMAL(10,2) DEFAULT 70,
  ADD COLUMN IF NOT EXISTS signature_y DECIMAL(10,2) DEFAULT 75,
  ADD COLUMN IF NOT EXISTS signature_width DECIMAL(10,2) DEFAULT 25,
  ADD COLUMN IF NOT EXISTS signature_height DECIMAL(10,2) DEFAULT 10,
  ADD COLUMN IF NOT EXISTS signature_lock_aspect TINYINT(1) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS signature_lock_position TINYINT(1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS body_content_top_offset_mm DECIMAL(10,2) DEFAULT 40,
  ADD COLUMN IF NOT EXISTS signature_bottom_offset_mm DECIMAL(10,2) DEFAULT 60,
  ADD COLUMN IF NOT EXISTS font_family VARCHAR(255),
  ADD COLUMN IF NOT EXISTS font_size INT DEFAULT 16,
  ADD COLUMN IF NOT EXISTS line_height DECIMAL(5,2) DEFAULT 1.90,
  ADD COLUMN IF NOT EXISTS paragraph_left_mm DECIMAL(10,2) DEFAULT 5,
  ADD COLUMN IF NOT EXISTS paragraph_right_mm DECIMAL(10,2) DEFAULT 5,
  ADD COLUMN IF NOT EXISTS first_line_indent_mm DECIMAL(10,2) DEFAULT 0;

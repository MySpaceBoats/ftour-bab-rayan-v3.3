-- Add images array column to products table for multi-image carousel support
ALTER TABLE products ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';

-- Backfill existing single image into images array
UPDATE products SET images = ARRAY[image] WHERE image IS NOT NULL AND (images IS NULL OR array_length(images, 1) IS NULL);

COMMENT ON COLUMN products.images IS 'Array of image URLs for product carousel. The first image is treated as the primary image.';

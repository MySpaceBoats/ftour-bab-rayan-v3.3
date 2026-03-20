-- Fix: ensure the "images" storage bucket exists and is public
-- Without this, gallery photo URLs return 403 in the browser even though
-- getPublicUrl() generates them successfully on the server.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'images',
  'images',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Allow anonymous public read on the images bucket (needed when bucket has RLS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'gallery_images_public_read'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY gallery_images_public_read
        ON storage.objects FOR SELECT
        TO public
        USING (bucket_id = 'images')
    $policy$;
  END IF;
END;
$$;

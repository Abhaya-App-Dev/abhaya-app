-- Create the emergency-media bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('emergency-media', 'emergency-media', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the emergency-media bucket in storage.objects
-- Enable RLS on storage.objects if it is not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to prevent conflicts
DROP POLICY IF EXISTS "Allow public select from emergency-media" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated insert to emergency-media" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update to emergency-media" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete from emergency-media" ON storage.objects;
DROP POLICY IF EXISTS "Allow public insert to emergency-media" ON storage.objects;
DROP POLICY IF EXISTS "Allow public update to emergency-media" ON storage.objects;
DROP POLICY IF EXISTS "Allow public delete from emergency-media" ON storage.objects;

-- Allow public access to read files in the emergency-media bucket
CREATE POLICY "Allow public select from emergency-media"
ON storage.objects FOR SELECT
USING (bucket_id = 'emergency-media');

-- Allow public/authenticated users to upload files to emergency-media
CREATE POLICY "Allow public insert to emergency-media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'emergency-media');

-- Allow public/authenticated users to update their files (for upsert)
CREATE POLICY "Allow public update to emergency-media"
ON storage.objects FOR UPDATE
USING (bucket_id = 'emergency-media')
WITH CHECK (bucket_id = 'emergency-media');

-- Allow public/authenticated users to delete their files in emergency-media
CREATE POLICY "Allow public delete from emergency-media"
ON storage.objects FOR DELETE
USING (bucket_id = 'emergency-media');

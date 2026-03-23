-- Generate publicId for existing courses
UPDATE course SET public_id = lower(hex(randomblob(16))) WHERE public_id IS NULL OR public_id = '';

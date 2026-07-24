-- 설치건 완료 처리 시 설치완료사진을 남기기 위한 컬럼 (비고는 기존 notes 컬럼 재사용)
ALTER TABLE installations ADD COLUMN IF NOT EXISTS completion_photo_urls TEXT[];

-- 완료 사진 업로드용 Storage 버킷
INSERT INTO storage.buckets (id, name, public)
VALUES ('install-photos', 'install-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "install-photos authenticated upload" ON storage.objects;
CREATE POLICY "install-photos authenticated upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'install-photos');

DROP POLICY IF EXISTS "install-photos public read" ON storage.objects;
CREATE POLICY "install-photos public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'install-photos');

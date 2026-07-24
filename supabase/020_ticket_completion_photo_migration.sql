-- 기술지원 완료 처리 시 설치완료사진/비고를 작업 이력에 남기기 위한 컬럼
ALTER TABLE ticket_logs ADD COLUMN IF NOT EXISTS photo_urls TEXT[];

-- 완료 사진 업로드용 Storage 버킷 (Supabase 대시보드에서 만들어도 되고, 여기서 SQL로 만들어도 됨)
INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket-photos', 'ticket-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "ticket-photos authenticated upload" ON storage.objects;
CREATE POLICY "ticket-photos authenticated upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'ticket-photos');

DROP POLICY IF EXISTS "ticket-photos public read" ON storage.objects;
CREATE POLICY "ticket-photos public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'ticket-photos');

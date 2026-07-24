-- 서명 완료 시 원본 PDF에 서명 이미지를 합성한 최종본 파일 URL을 저장
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS signed_pdf_url TEXT;

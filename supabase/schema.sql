-- ============================================
-- POS 전산 시스템 DB 스키마
-- ============================================

-- 사용자 프로필 (Supabase Auth 연동)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('master', 'admin', 'sales', 'cs', 'tech')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 가맹점
CREATE TABLE merchants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_name TEXT NOT NULL,         -- 상호명
  owner_name TEXT NOT NULL,            -- 대표자명
  business_number TEXT,                -- 사업자번호
  phone TEXT NOT NULL,                 -- 연락처
  address TEXT NOT NULL,               -- 주소
  address_detail TEXT,                 -- 상세주소
  pos_model TEXT,                      -- 포스 기종
  service_type TEXT,                   -- 서비스 종류
  memo TEXT,                           -- 메모
  sales_id UUID REFERENCES profiles(id), -- 담당 영업
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 작업(이관 단위)
CREATE TABLE tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,                 -- 작업 제목
  type TEXT NOT NULL CHECK (type IN ('install', 'as', 'consult', 'other')), -- 설치/AS/상담/기타
  status TEXT NOT NULL DEFAULT 'sales' CHECK (status IN (
    'sales',      -- 영업 접수
    'cs_pending', -- CS 대기
    'cs_progress',-- CS 진행중
    'scheduled',  -- 일정 확정
    'tech_pending',-- 기사 배정 대기
    'in_progress',-- 작업중
    'done',       -- 완료
    'canceled'    -- 취소
  )),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  scheduled_at TIMESTAMPTZ,           -- 예약 일정
  sales_id UUID REFERENCES profiles(id),
  cs_id UUID REFERENCES profiles(id),
  tech_id UUID REFERENCES profiles(id),
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 작업 이력 (상태 변경 로그)
CREATE TABLE ticket_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id),
  from_status TEXT,
  to_status TEXT,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 고객 연락 이력
CREATE TABLE contact_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  method TEXT CHECK (method IN ('call', 'kakao', 'visit', 'other')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 내부 알림
CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  type TEXT NOT NULL,                  -- 'transfer', 'assign', 'schedule', 'done' 등
  title TEXT NOT NULL,
  body TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 첨부파일 (기사 현장 사진 등)
CREATE TABLE attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id),
  file_url TEXT NOT NULL,
  file_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- updated_at 자동 갱신 트리거
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER merchants_updated_at BEFORE UPDATE ON merchants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tickets_updated_at BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- RLS (Row Level Security)
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

-- 로그인한 사용자는 모두 조회 가능 (역할별 필터는 앱에서)
CREATE POLICY "authenticated read" ON profiles FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "authenticated read" ON merchants FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "authenticated read" ON tickets FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "authenticated read" ON ticket_logs FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "authenticated read" ON contact_logs FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "authenticated read" ON attachments FOR SELECT TO authenticated USING (TRUE);

-- 본인 알림만 조회
CREATE POLICY "own notifications" ON notifications FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 쓰기는 로그인 사용자 허용
CREATE POLICY "authenticated insert" ON merchants FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "authenticated update" ON merchants FOR UPDATE TO authenticated USING (TRUE);
CREATE POLICY "authenticated insert" ON tickets FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "authenticated update" ON tickets FOR UPDATE TO authenticated USING (TRUE);
CREATE POLICY "authenticated insert" ON ticket_logs FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "authenticated insert" ON contact_logs FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "authenticated insert" ON notifications FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "own notification update" ON notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "authenticated insert" ON attachments FOR INSERT TO authenticated WITH CHECK (TRUE);

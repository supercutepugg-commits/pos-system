-- 계약서 서명 기능의 기반 테이블. create/route.ts, sign/route.ts, ContractsClient.tsx,
-- ZoneEditor.tsx, SignClient.tsx에서 참조하는 컬럼을 모두 포함한다.
CREATE TABLE IF NOT EXISTS contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  pdf_url text NOT NULL,
  signed_pdf_url text,
  signer_name text NOT NULL,
  signer_email text,
  signer_phone text,
  status text NOT NULL DEFAULT 'pending',
  sign_token text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  token_expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  signed_at timestamptz,
  signature_zones jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contracts_sign_token_idx ON contracts (sign_token);
CREATE INDEX IF NOT EXISTS contracts_created_at_idx ON contracts (created_at DESC);

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

-- 서버 라우트는 전부 service-role 키(admin client)로 접근하므로 RLS를 우회한다.
-- 로그인한 스태프가 브라우저에서 직접 select/update(ZoneEditor 저장, 목록 조회)하는
-- 경로가 있으므로 인증된 사용자에게는 전체 열람/수정 권한을 부여한다.
CREATE POLICY contracts_select_authenticated ON contracts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY contracts_update_authenticated ON contracts
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY contracts_delete_authenticated ON contracts
  FOR DELETE TO authenticated USING (true);

-- 설치관리 삭제는 권한 보유자의 직접 등록 건에만 허용한다.
-- RESTRICTIVE 정책은 기존 DELETE 정책이 허용하더라도 아래 조건을 추가로 강제한다.
ALTER TABLE installations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "installation delete permission and linkage protection" ON installations;

CREATE POLICY "installation delete permission and linkage protection"
  ON installations
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (
    franchise_application_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND (
          profiles.role IN ('admin', 'master')
          OR profiles.can_delete = TRUE
        )
    )
  );

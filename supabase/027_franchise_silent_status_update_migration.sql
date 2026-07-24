-- 설치완료 시 가맹접수 상태를 card_done으로 "자동갱신"하는 처리가
-- updated_at까지 갱신시켜서 목록이 "최근 수정순" 정렬일 때 맨 위로 튀어오르는 문제 수정.
-- update_updated_at() 트리거를 세션 플래그로 우회할 수 있게 바꾸고,
-- 자동갱신 전용 RPC(set_franchise_status_silent)를 추가해서 이 경로에서만 플래그를 켠다.
-- 플래그를 켜지 않는 모든 기존 UPDATE(수동 수정 등)는 지금처럼 그대로 updated_at이 갱신된다.

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('app.skip_updated_at', true) IS DISTINCT FROM 'true' THEN
    NEW.updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_franchise_status_silent(p_id uuid, p_status text)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.skip_updated_at', 'true', true);
  UPDATE franchise_applications SET status = p_status WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

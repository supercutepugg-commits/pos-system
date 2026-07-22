-- 업무 원본이 삭제돼도 직원 활동 로그는 감사 이력으로 보존합니다.

ALTER TABLE franchise_application_logs
  ALTER COLUMN franchise_application_id DROP NOT NULL;
ALTER TABLE franchise_application_logs
  DROP CONSTRAINT IF EXISTS franchise_application_logs_franchise_application_id_fkey;
ALTER TABLE franchise_application_logs
  ADD CONSTRAINT franchise_application_logs_franchise_application_id_fkey
  FOREIGN KEY (franchise_application_id) REFERENCES franchise_applications(id) ON DELETE SET NULL;

ALTER TABLE installation_activity_logs
  ALTER COLUMN installation_id DROP NOT NULL;
ALTER TABLE installation_activity_logs
  DROP CONSTRAINT IF EXISTS installation_activity_logs_installation_id_fkey;
ALTER TABLE installation_activity_logs
  ADD CONSTRAINT installation_activity_logs_installation_id_fkey
  FOREIGN KEY (installation_id) REFERENCES installations(id) ON DELETE SET NULL;

ALTER TABLE ticket_logs
  ALTER COLUMN ticket_id DROP NOT NULL;
ALTER TABLE ticket_logs
  DROP CONSTRAINT IF EXISTS ticket_logs_ticket_id_fkey;
ALTER TABLE ticket_logs
  ADD CONSTRAINT ticket_logs_ticket_id_fkey
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL;

ALTER TABLE inventory_logs
  DROP CONSTRAINT IF EXISTS inventory_logs_item_id_fkey;
ALTER TABLE inventory_logs
  ADD CONSTRAINT inventory_logs_item_id_fkey
  FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE SET NULL;

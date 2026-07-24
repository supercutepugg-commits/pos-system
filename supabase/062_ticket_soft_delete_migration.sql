-- 작업(티켓) 삭제 시 즉시 영구삭제되지 않고 휴지통으로 이동시켜 복구할 수 있게 한다.
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES profiles(id);

CREATE INDEX IF NOT EXISTS idx_tickets_deleted_at ON tickets(deleted_at);

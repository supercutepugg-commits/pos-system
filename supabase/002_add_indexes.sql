-- 작업목록 조회 속도 개선용 인덱스
CREATE INDEX IF NOT EXISTS idx_tickets_sales_id ON tickets(sales_id);
CREATE INDEX IF NOT EXISTS idx_tickets_cs_id ON tickets(cs_id);
CREATE INDEX IF NOT EXISTS idx_tickets_tech_id ON tickets(tech_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_logs_ticket_id ON ticket_logs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_contact_logs_ticket_id ON contact_logs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_notifications_ticket_id ON notifications(ticket_id);
CREATE INDEX IF NOT EXISTS idx_attachments_ticket_id ON attachments(ticket_id);

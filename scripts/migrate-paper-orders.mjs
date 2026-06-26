// 용지요청 CSV 마이그레이션 스크립트
// 실행: node scripts/migrate-paper-orders.mjs
// 환경변수: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { parse } from 'csv-parse/sync'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars required')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const CSV_PATH = process.argv[2] || 'C:/Users/supuercutepug/Downloads/용지시트 - 용지요청 (1).csv'

const raw = readFileSync(CSV_PATH, 'utf-8')

const records = parse(raw, {
  columns: ['status', 'business_name', 'owner_name', 'phone', 'address', 'delivery_note', 'requested_at', 'shipped_at', '_bong', 'count', 'unit_standard', '_van', 'revenue', 'memo'],
  skip_empty_lines: false,
  relax_column_count: true,
  from_line: 2, // skip header
  trim: true,
})

function clean(v) {
  if (v === undefined || v === null) return null
  const s = String(v).trim().replace(/\n/g, ' ').replace(/\r/g, '')
  return s === '' ? null : s
}

const SHIPPED_VALUES = new Set(['발송완료', '완료'])

const rows = records.map((r, i) => ({
  sort_order: i + 1,
  shipped: SHIPPED_VALUES.has((r.status ?? '').trim()),
  business_name: clean(r.business_name),
  owner_name: clean(r.owner_name),
  phone: clean(r.phone),
  address: clean(r.address),
  delivery_note: clean(r.delivery_note),
  requested_at: clean(r.requested_at),
  shipped_at: clean(r.shipped_at),
  count: clean(r.count),
  unit_standard: clean(r.unit_standard),
  revenue: clean(r.revenue),
  memo: clean(r.memo),
})).filter(r => r.business_name || r.owner_name || r.phone)

console.log(`총 ${rows.length}건 마이그레이션 시작...`)

const BATCH = 200
let inserted = 0
for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH)
  const { error } = await supabase.from('paper_orders').insert(batch)
  if (error) {
    console.error(`배치 ${i}~${i + batch.length} 실패:`, error.message)
    process.exit(1)
  }
  inserted += batch.length
  console.log(`${inserted}/${rows.length} 완료`)
}

console.log('마이그레이션 완료!')

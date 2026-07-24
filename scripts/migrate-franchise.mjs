// 가맹접수 CSV 마이그레이션 스크립트
// 실행: node scripts/migrate-franchise.mjs
// 환경변수: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars required");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const CSV_PATH = process.argv[2] || "C:/Users/supuercutepug/Downloads/접수 현황 - 접수현황.csv";

const raw = readFileSync(CSV_PATH, "utf-8");

// CSV has 2 empty rows then header on row 3, data from row 4
const records = parse(raw, {
  skip_empty_lines: false,
  relax_column_count: true,
  from_line: 3, // skip 2 empty rows, start at header
  trim: true,
});

// records[0] = header row, records[1..] = data
const headers = records[0];
console.log("헤더:", headers.slice(0, 20));

const dataRows = records.slice(1);

function clean(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim().replace(/\n/g, " ").replace(/\r/g, "").replace(/\s+/g, " ");
  return s === "" ? null : s;
}

// Map 서류 접수 상태 → FranchiseStatus
function mapStatus(docStatus, progressStatus) {
  const s = (docStatus ?? "").trim();
  const p = (progressStatus ?? "").trim();
  if (s === "가맹 완료") return "card_done";
  if (s === "접수 완료") return "card_apply_done";
  if (s === "서류 대기") return "doc_waiting";
  if (s === "서류 미비") return "doc_incomplete";
  if (p === "서류 안내 완료" || p === "서류 안내 부재") return "doc_waiting";
  return "info_input";
}

// Parse 상품 column → equipment_items JSON
function parseEquipment(product) {
  if (!product) return [];
  // Split by comma or +
  const parts = product
    .split(/[,+]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const catalog = [
    "토스프론트",
    "포스기",
    "인터넷",
    "키오스크",
    "영수증프린터",
    "키오스크리더기",
    "무선단말기",
    "금전함",
    "태블릿",
    "테이블오더",
    "이동식단말기",
    "무선프린트",
    "원격",
  ];
  const items = [];
  for (const part of parts) {
    const matched = catalog.find((c) => part.includes(c));
    if (matched) {
      const existing = items.find((i) => i.name === matched);
      if (existing) existing.quantity++;
      else items.push({ name: matched, quantity: 1 });
    }
  }
  return items;
}

// Normalize VAN company
function normalizeVan(v) {
  if (!v) return null;
  const s = v.trim().replace(/\s/g, "");
  if (s.includes("코세스2") || s === "코세스2") return "코세스2";
  if (s.includes("코세스1") || s === "코세스1") return "코세스1";
  if (s.includes("코벤")) return "코벤";
  if (s.includes("기가맹")) return "기가맹";
  return clean(v);
}

// Normalize internet provider
function normalizeInternet(v) {
  if (!v) return null;
  const s = v.trim();
  if (s === "3S" || s === "3s") return "3S";
  if (s.includes("백매가") || s.includes("백메가") || s.includes("백M") || s.includes("백m"))
    return "백메가";
  if (s === "") return null;
  return s;
}

// Normalize reception channel
function normalizeChannel(v) {
  if (!v) return null;
  const s = v.trim();
  if (s.includes("토스")) return "토스 홈페이지";
  if (s.includes("직접")) return "직접 영업";
  if (s.includes("전환") || s.includes("승계") || s.includes("명변")) return "전환";
  return s;
}

// Column indices (0-based):
// 0:접수채널 1:영업담당 2:1차상담 3:진행상황 4:서류접수상태 5:설치/택배발송 6:2차담당자
// 7:대표자성함 8:상호명 9:비고 10:사업자번호 11:연락처 12:오픈예정 13:설치발송일
// 14:인터넷 15:상품 16:카드가맹접수일 17:VAN사접수일 18:VAN사 19:배민접수
// 20:간편결제 21:포스프로그램 22:상품2 23:주소 24:포스기예정 25:오픈예정2 26:비고2

const rows = dataRows
  .map((r, i) => {
    const businessName = clean(r[8]);
    const ownerName = clean(r[7]);
    const phone = clean(r[11]);
    // Skip rows with no identifying info
    if (!businessName && !ownerName && !phone) return null;

    const equipmentItems = parseEquipment(clean(r[15]));

    return {
      reception_channel: normalizeChannel(clean(r[0])),
      owner_name: ownerName,
      business_name: businessName,
      memo: [clean(r[9]), clean(r[26])].filter(Boolean).join(" / ") || null,
      business_number: clean(r[10]),
      phone: phone,
      open_date: clean(r[12]),
      install_date: clean(r[13]),
      internet: normalizeInternet(clean(r[14])),
      equipment:
        equipmentItems.length > 0
          ? equipmentItems.map((i) => `${i.name}×${i.quantity}`).join(", ")
          : clean(r[15]),
      equipment_items: equipmentItems.length > 0 ? equipmentItems : null,
      van_company: normalizeVan(clean(r[18])),
      address: clean(r[23]),
      status: mapStatus(clean(r[4]), clean(r[3])),
      applicant_type: "individual",
      title: clean(r[8]) || clean(r[7]) || "마이그레이션",
    };
  })
  .filter(Boolean);

console.log(`총 ${rows.length}건 마이그레이션 시작...`);

// Preview first 3
console.log("\n[미리보기 3건]");
rows.slice(0, 3).forEach((r, i) => console.log(i + 1, JSON.stringify(r, null, 2)));

const readline = await import("readline");
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
await new Promise((resolve) =>
  rl.question("\n계속 진행할까요? (y/N) ", (ans) => {
    rl.close();
    if (ans.trim().toLowerCase() !== "y") {
      console.log("취소됨");
      process.exit(0);
    }
    resolve();
  }),
);

const BATCH = 200;
let inserted = 0;
for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH);
  const { error } = await supabase.from("franchise_applications").insert(batch);
  if (error) {
    console.error(`배치 ${i}~${i + batch.length} 실패:`, error.message);
    process.exit(1);
  }
  inserted += batch.length;
  console.log(`${inserted}/${rows.length} 완료`);
}

console.log("마이그레이션 완료!");

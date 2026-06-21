'use server'

import { createAdminClient } from '@/lib/supabase/admin'

const CHUNK_SIZE = 100

export async function updateInboundRow(id: string, patch: Record<string, string | null>) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('crm_inbound').update(patch).eq('id', id)
  return { error: error?.message ?? null }
}

export async function deleteInboundRows(ids: string[]) {
  if (!ids.length) return { error: null }
  const supabase = createAdminClient()
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const chunk = ids.slice(i, i + CHUNK_SIZE)
    const { error } = await supabase.from('crm_inbound').delete().in('id', chunk)
    if (error) return { error: error.message }
  }
  return { error: null }
}

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions'
const DEEPSEEK_MODEL = 'deepseek-chat'

const EXTRACT_SYSTEM =
  '당신은 포스모스 포스기 고객센터의 CRM 데이터 입력 전문가입니다.\n' +
  '채팅 대화를 분석해 정확하고 일관된 CRM 데이터를 추출합니다.\n' +
  '절대 규칙:\n' +
  '- 대화에 명시된 내용만 추출하고, 없으면 반드시 빈 문자열로 남길 것\n' +
  '- 추측하거나 지어내지 말 것\n' +
  '- JSON 외 다른 텍스트 절대 출력 금지'

function buildExtractPrompt(chatText: string, nickname: string) {
  return (
    '아래 채팅 대화를 분석해 JSON으로만 응답하세요.\n\n' +
    '【추출 규칙】\n' +
    'representative: 닉네임 뒷부분 또는 대화에서 밝힌 성함. 대화 내용 우선.\n' +
    'storeName: 닉네임 앞부분 또는 대화에서 언급된 상호명. 괄호·수식어 제거 후 상호명만.\n' +
    "※ 닉네임이 '상호명 성함' 형식이면 앞부분→storeName, 뒷부분→representative로 분리.\n" +
    'phone: 고객이 말한 연락처. 반드시 010-0000-0000 형식. 없으면 빈 문자열.\n' +
    'inquiry: 고객의 핵심 문의를 30자 이내 한 줄. 조사·존댓말 없이 명사형으로.\n' +
    '  ※ 대화 전체를 읽고 고객이 처음 꺼낸 핵심 질문을 추출. 상담사 답변이 마지막이어도 반드시 채울 것.\n' +
    'reply: 상담사가 실제로 한 처리를 업무 일지 형태의 간결한 문장으로. 주어 생략, 동사형 종결.\n' +
    "  좋은 예: '용지 재고 소진 안내 후 입고 시 발송 예정 회신.'\n" +
    'summary: 아래 형식 정확히 따를 것(각 항목 줄바꿈 필수):\n' +
    '  【문의유형】AS요청/카드가맹/메뉴수정/용지요청/매출자료/기타 중 하나\n' +
    '  【문의내용】고객이 요청한 핵심 내용을 구체적으로.\n' +
    '  【처리내용】상담사 안내 내용을 업무 일지처럼 간결하게.\n' +
    '  【결과】접수완료/안내완료/추가확인필요/미해결 중 하나\n\n' +
    '응답 형식 (JSON만):\n' +
    '{\n' +
    '  "representative": "",\n' +
    '  "storeName": "",\n' +
    '  "phone": "",\n' +
    '  "inquiry": "",\n' +
    '  "reply": "",\n' +
    '  "summary": "【문의유형】...\\n【문의내용】...\\n【처리내용】...\\n【결과】..."\n' +
    '}\n\n' +
    `고객 카카오 닉네임: ${nickname}\n\n` +
    `대화 내용:\n${chatText}`
  )
}

function normalizePhone(raw: string) {
  const digits = (raw ?? '').replace(/[^0-9]/g, '')
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  return raw ?? ''
}

async function extractFromChat(chatText: string, nickname: string) {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) return { ok: false as const, error: 'DEEPSEEK_API_KEY가 설정되지 않았습니다.' }

  const payload = {
    model: DEEPSEEK_MODEL,
    messages: [
      { role: 'system', content: EXTRACT_SYSTEM },
      { role: 'user', content: buildExtractPrompt(chatText, nickname) },
    ],
    max_tokens: 1000,
    temperature: 0,
    stream: false,
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await fetch(DEEPSEEK_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const json = await resp.json()
      let text: string = json.choices?.[0]?.message?.content?.trim() ?? ''
      text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim()
      if (!text || text === '}') throw new Error('빈 응답')
      if (!text.endsWith('}')) {
        const last = text.lastIndexOf('}')
        text = last > 0 ? text.slice(0, last + 1) : text + '}'
      }
      const parsed = JSON.parse(text)
      const store = (parsed.storeName ?? '').replace(/\s*[\(（].*?[\)）]\s*/g, '').trim()
      return {
        ok: true as const,
        representative: parsed.representative ?? '',
        storeName: store,
        phone: normalizePhone(parsed.phone ?? ''),
        inquiry: parsed.inquiry ?? '',
        reply: parsed.reply ?? '',
        summary: parsed.summary ?? '',
      }
    } catch (e) {
      if (attempt === 0) await new Promise(r => setTimeout(r, 2000))
      else return { ok: false as const, error: e instanceof Error ? e.message : String(e) }
    }
  }
  return { ok: false as const, error: '알 수 없는 오류' }
}

export async function extractAndSaveInbound(params: {
  chatText: string
  nickname: string
  staff: string
  channel: string
  category: string
  status: string
}) {
  const { chatText, nickname, staff, channel, category, status } = params
  if (!chatText.trim()) return { error: '채팅 내용을 입력해주세요.' }

  const extracted = await extractFromChat(chatText, nickname || '알수없음')
  if (!extracted.ok) return { error: `분석 실패: ${extracted.error}` }

  const supabase = createAdminClient()
  const { error } = await supabase.from('crm_inbound').insert({
    date: new Date().toISOString().slice(0, 10),
    staff: staff || null,
    channel: channel || null,
    category: category || null,
    status: status || null,
    owner_name: extracted.representative || null,
    business_name: extracted.storeName || null,
    phone: extracted.phone || null,
    inquiry: extracted.inquiry || null,
    answer: extracted.reply || null,
    chat_log: chatText,
    ai_summary: extracted.summary || null,
  })

  return { error: error?.message ?? null }
}

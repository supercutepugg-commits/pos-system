import { SolapiMessageService } from 'solapi'
import type { ApplicantType } from '@/types'

const service = new SolapiMessageService(
  process.env.SOLAPI_API_KEY!,
  process.env.SOLAPI_API_SECRET!
)

function kakaoOptions(templateEnvKey: string, variables: Record<string, string>, buttons?: object[]) {
  const pfId = process.env.SOLAPI_KAKAO_PFID
  const templateId = process.env[templateEnvKey]
  if (!pfId || !templateId) {
    const msg = `알림톡 환경변수 누락: pfId=${!!pfId} ${templateEnvKey}=${!!templateId}`
    console.error('[solapi]', msg)
    throw new Error(msg)
  }
  console.log(`[solapi] sending pfId=${pfId} templateId=${templateId}`)
  return { pfId, templateId, variables, disableSms: true, ...(buttons ? { buttons } : {}) }
}

async function solapiSend(params: { to: string; from: string; text: string; kakaoOptions: object }) {
  try {
    const result = await (service as any).send(params)
    const failed = result?.failedMessageList ?? result?.failed
    if (failed?.length) {
      const firstErr = failed[0]
      const msg = firstErr?.resultMessage ?? firstErr?.statusMessage ?? firstErr?.reason ?? JSON.stringify(firstErr)
      console.error('[solapi] failedMessageList:', JSON.stringify(failed))
      throw Object.assign(new Error(msg), { failedMessageList: failed })
    }
  } catch (e: any) {
    if (e.failedMessageList) throw e
    try {
      const dump: Record<string, any> = {}
      for (const k of Object.getOwnPropertyNames(e)) dump[k] = e[k]
      console.error('[solapi] error dump:', JSON.stringify(dump, null, 2))
    } catch { console.error('[solapi] raw error:', String(e)) }
    throw e
  }
}

const origin = () => (process.env.NEXT_PUBLIC_APP_URL || 'https://pos-system.vercel.app').replace(/\/$/, '')

export async function sendSignRequest({
  signerPhone, signerName, contractTitle, signToken,
}: { signerPhone: string; signerName: string; contractTitle: string; signToken: string }) {
  if (!signerPhone) return
  const signUrl = `${origin()}/sign/${signToken}`
  const text = `[서명 요청]\n${signerName}님, "${contractTitle}" 계약서 서명을 요청드립니다.\n\n${signUrl}`
  const ko = kakaoOptions('SOLAPI_KAKAO_TEMPLATE_SIGN_REQUEST', {
    '#{고객명}': signerName,
    '#{계약서명}': contractTitle,
    '#{서명토큰}': signToken,
  })
  if (!ko) return
  await solapiSend({
    to: signerPhone,
    from: process.env.SOLAPI_SENDER!,
    text,
    kakaoOptions: ko,
  })
}

// 사업자 유형별 제출 서류 목록 — 유형마다 본문이 크게 달라서 알림톡 템플릿도 유형별로 따로 등록한다
const CORPORATE_DOCS = [
  '대표자 신분증',
  '사업자 통장 사본',
  '사업자등록증',
  '영업신고증 (음식점에 한함)',
  '법인 등기부등본 (3개월 이내 발급)',
  '법인 인감증명서 (3개월 이내 발급)',
  '주주명부 (3개월 이내 발급)',
  '사업장 외부 사진 2장',
  '사업장 내부 사진 2장',
]

const INDIVIDUAL_DOCS = [
  '대표자 신분증',
  '사업자 통장 사본',
  '사업자등록증',
  '영업신고증 (음식점에 한함)',
  '사업장 외부 사진 2장',
  '사업장 내부 사진 2장',
]

const FRANCHISE_DOCS: Record<ApplicantType, string[]> = {
  corporate: CORPORATE_DOCS,
  individual: INDIVIDUAL_DOCS,
  giga_corporate: CORPORATE_DOCS,
  giga_individual: INDIVIDUAL_DOCS,
}

// 발송 시점에 상호명/대표자명이 모두 입력돼 있지 않을 수도 있어서, 어떤 필드가 채워져 있는지에 따라
// 사업자유형별로 별도 템플릿을 쓴다 (4 사업자유형 x 4 케이스 = 16개 템플릿)
export type DocCase = 'both' | 'business_only' | 'owner_only' | 'phone_only'

export function docCaseOf(ownerName?: string, businessName?: string): DocCase {
  if (ownerName && businessName) return 'both'
  if (businessName) return 'business_only'
  if (ownerName) return 'owner_only'
  return 'phone_only'
}

const FRANCHISE_TEMPLATE_ENV_KEY: Record<ApplicantType, Record<DocCase, string>> = {
  individual: {
    both: 'SOLAPI_KAKAO_TEMPLATE_FRANCHISE_DOC_INDIVIDUAL_BOTH',
    business_only: 'SOLAPI_KAKAO_TEMPLATE_FRANCHISE_DOC_INDIVIDUAL_BUSINESS_ONLY',
    owner_only: 'SOLAPI_KAKAO_TEMPLATE_FRANCHISE_DOC_INDIVIDUAL_OWNER_ONLY',
    phone_only: 'SOLAPI_KAKAO_TEMPLATE_FRANCHISE_DOC_INDIVIDUAL_PHONE_ONLY',
  },
  corporate: {
    both: 'SOLAPI_KAKAO_TEMPLATE_FRANCHISE_DOC_CORPORATE_BOTH',
    business_only: 'SOLAPI_KAKAO_TEMPLATE_FRANCHISE_DOC_CORPORATE_BUSINESS_ONLY',
    owner_only: 'SOLAPI_KAKAO_TEMPLATE_FRANCHISE_DOC_CORPORATE_OWNER_ONLY',
    phone_only: 'SOLAPI_KAKAO_TEMPLATE_FRANCHISE_DOC_CORPORATE_PHONE_ONLY',
  },
  giga_individual: {
    both: 'SOLAPI_KAKAO_TEMPLATE_FRANCHISE_DOC_GIGA_INDIVIDUAL_BOTH',
    business_only: 'SOLAPI_KAKAO_TEMPLATE_FRANCHISE_DOC_GIGA_INDIVIDUAL_BUSINESS_ONLY',
    owner_only: 'SOLAPI_KAKAO_TEMPLATE_FRANCHISE_DOC_GIGA_INDIVIDUAL_OWNER_ONLY',
    phone_only: 'SOLAPI_KAKAO_TEMPLATE_FRANCHISE_DOC_GIGA_INDIVIDUAL_PHONE_ONLY',
  },
  giga_corporate: {
    both: 'SOLAPI_KAKAO_TEMPLATE_FRANCHISE_DOC_GIGA_CORPORATE_BOTH',
    business_only: 'SOLAPI_KAKAO_TEMPLATE_FRANCHISE_DOC_GIGA_CORPORATE_BUSINESS_ONLY',
    owner_only: 'SOLAPI_KAKAO_TEMPLATE_FRANCHISE_DOC_GIGA_CORPORATE_OWNER_ONLY',
    phone_only: 'SOLAPI_KAKAO_TEMPLATE_FRANCHISE_DOC_GIGA_CORPORATE_PHONE_ONLY',
  },
}

export async function sendFranchiseDocRequest({
  phone, ownerName, businessName, applicantType, docCase: docCaseOverride,
}: { phone: string; ownerName?: string; businessName?: string; applicantType: ApplicantType; docCase?: DocCase }) {
  if (!phone) return
  const docList = FRANCHISE_DOCS[applicantType].map(d => `- ${d}`).join('\n')
  const photoNote = '\n* 간판이 없는 경우, 건물에 부착된 도로명주소 표지판 사진으로 대체 가능합니다.'
  const greeting = ownerName && businessName
    ? `${ownerName}님, "${businessName}" 카드 가맹 신청을 위해 아래 서류를 준비해주세요.`
    : businessName
      ? `"${businessName}" 카드 가맹 신청을 위해 아래 서류를 준비해주세요.`
      : ownerName
        ? `${ownerName}님, 카드 가맹 신청을 위해 아래 서류를 준비해주세요.`
        : `카드 가맹 신청을 위해 아래 서류를 준비해주세요.`
  const text = `[가맹 서류 안내]\n${greeting}\n\n제출 서류\n${docList}${photoNote}`
  // 서류 목록은 사업자 유형별로 고정값(FRANCHISE_DOCS)이라 템플릿 본문에 직접 박아 넣고,
  // 변수는 고객명/상호명만 사용한다 (변수 비중이 크면 카카오 알림톡 심사에서 반려될 수 있음)
  // docCase는 발송 전 확인창에서 사용자가 직접 선택/검증할 수 있어 자동 추론값을 덮어쓸 수 있다
  const docCase = docCaseOverride ?? docCaseOf(ownerName, businessName)
  const ko = kakaoOptions(FRANCHISE_TEMPLATE_ENV_KEY[applicantType][docCase], {
    ...(ownerName ? { '#{고객명}': ownerName } : {}),
    ...(businessName ? { '#{상호명}': businessName } : {}),
  })
  if (!ko) return
  await solapiSend({
    to: phone,
    from: process.env.SOLAPI_SENDER!,
    text,
    kakaoOptions: ko,
  })
}

type FranchiseStatusUpdateKind =
  | 'doc_waiting'
  | 'doc_incomplete'
  | 'card_apply_done'
  | 'internet_apply_done'
  | 'card_done'
  | 'internet_done'
  | 'toss_review_done'

const FRANCHISE_STATUS_TEXT: Record<FranchiseStatusUpdateKind, string> = {
  doc_waiting: '가맹 신청이 접수되었습니다. 서류 준비를 부탁드립니다. 담당자가 곧 안내드리겠습니다.',
  doc_incomplete: '제출하신 서류에 보완이 필요합니다. 담당자에게 문의해주세요.',
  card_apply_done: '카드가맹 접수가 완료되었습니다. 심사가 진행됩니다.',
  internet_apply_done: '인터넷 가입 접수가 완료되었습니다.',
  card_done: '카드가맹이 완료되었습니다.',
  internet_done: '인터넷 가입이 완료되었습니다.',
  toss_review_done: '토스 심사가 완료되었습니다. 곧 기술지원팀에서 설치 일정을 안내드립니다.',
}

const FRANCHISE_STATUS_TEMPLATE_ENV_KEY: Record<FranchiseStatusUpdateKind, string> = {
  doc_waiting: 'SOLAPI_KAKAO_TEMPLATE_FRANCHISE_DOC_WAITING',
  doc_incomplete: 'SOLAPI_KAKAO_TEMPLATE_FRANCHISE_DOC_INCOMPLETE',
  card_apply_done: 'SOLAPI_KAKAO_TEMPLATE_FRANCHISE_CARD_APPLY_DONE',
  internet_apply_done: 'SOLAPI_KAKAO_TEMPLATE_FRANCHISE_INTERNET_APPLY_DONE',
  card_done: 'SOLAPI_KAKAO_TEMPLATE_FRANCHISE_CARD_DONE',
  internet_done: 'SOLAPI_KAKAO_TEMPLATE_FRANCHISE_INTERNET_DONE',
  toss_review_done: 'SOLAPI_KAKAO_TEMPLATE_FRANCHISE_DONE',
}

export async function sendFranchiseStatusUpdate({
  phone, ownerName, businessName, status,
}: { phone: string; ownerName?: string | null; businessName?: string | null; status: FranchiseStatusUpdateKind }) {
  if (!phone) return
  const name = ownerName || businessName || '고객'
  const biz = businessName || ownerName || name
  const text = `[가맹 진행 안내]\n${name}님, "${biz}" 가맹 진행상황을 안내드립니다.\n${FRANCHISE_STATUS_TEXT[status]}`
  const variables: Record<string, string> = { '#{고객명}': name, '#{상호명}': biz }
  const ko = kakaoOptions(FRANCHISE_STATUS_TEMPLATE_ENV_KEY[status], variables)
  if (!ko) return
  await solapiSend({
    to: phone,
    from: process.env.SOLAPI_SENDER!,
    text,
    kakaoOptions: ko,
  })
}

// 설치관리 상태 알림톡
// preparing/in_transit은 기본 템플릿 없이 아래 버튼/시각 포함 버전만 사용한다.
const INSTALL_STATUS_TEMPLATE: Record<string, string> = {
  scheduled: 'SOLAPI_KAKAO_TEMPLATE_INSTALL_SCHEDULED',
  completed: 'SOLAPI_KAKAO_TEMPLATE_INSTALL_COMPLETED',
  delivery_sent: 'SOLAPI_KAKAO_TEMPLATE_INSTALL_DELIVERY_SENT',
}

const INSTALL_STATUS_TEXT: Record<string, string> = {
  preparing: '제품 준비가 시작되었습니다. 곧 배송 또는 설치 일정을 안내드리겠습니다.',
  scheduled: '설치 일정이 확정되었습니다.',
  in_transit: '기사님이 이동 중입니다. 잠시 후 방문 예정입니다.',
  completed: '설치가 완료되었습니다. 이용해 주셔서 감사합니다.',
  delivery_sent: '제품이 발송되었습니다. 영업일 기준 1~3일 내 도착 예정입니다.\n배송조회: https://www.ilogen.com/web/personal/tkSearch\n포스기 토스프론트 연결 방법: https://www.youtube.com/watch?v=fXNyqMBNEcI\n태블릿 토스프론트 설치 방법: https://www.youtube.com/watch?v=Hib-gY38TQg\n다른 문의사항 영상보기: https://www.youtube.com/@posmos',
}

// 시각 변수(#{예정시각})가 포함된 템플릿. preparing에서는 아래 버튼 포함 버전만 사용한다.
const INSTALL_IN_TRANSIT_ETA_TEMPLATE_ENV = 'SOLAPI_KAKAO_TEMPLATE_INSTALL_IN_TRANSIT_ETA'
// 일정변경/희망시간대 요청 버튼(WL)이 포함된 템플릿. in_transit에서는 위 시각 포함 버전만 사용한다.
const INSTALL_PREPARING_SCHEDULE_TEMPLATE_ENV = 'SOLAPI_KAKAO_TEMPLATE_INSTALL_PREPARING_SCHEDULE'

export async function sendInstallStatusUpdate({
  phone, customerName, status, eta, statusToken, scheduledDate, scheduledTime, trackingNumber,
}: {
  phone: string; customerName: string; status: string; eta?: string; statusToken?: string
  scheduledDate?: string; scheduledTime?: string; trackingNumber?: string
}) {
  if (!phone || !INSTALL_STATUS_TEXT[status]) return
  const etaNote = status === 'in_transit' && eta ? ` (도착 예정 시각: ${eta})` : ''
  const scheduleNote = status === 'scheduled' && (scheduledDate || scheduledTime)
    ? ` (${[scheduledDate, scheduledTime].filter(Boolean).join(' ')})`
    : ''
  const text = `[설치/배송 안내]\n${customerName}님, ${INSTALL_STATUS_TEXT[status]}${etaNote}${scheduleNote}`

  let ko
  if (status === 'in_transit') {
    // 예정시각 포함 버전만 사용 — 시각이 없으면 발송하지 않는다.
    if (!eta) { console.warn('[solapi] 이동중 알림톡: 예정시각 없이는 발송하지 않음'); return }
    ko = kakaoOptions(INSTALL_IN_TRANSIT_ETA_TEMPLATE_ENV, { '#{고객명}': customerName, '#{예정시각}': eta })
  } else if (status === 'preparing') {
    // 일정변경 버튼 포함 버전만 사용 — statusToken이 없으면 발송하지 않는다.
    if (!statusToken) { console.warn('[solapi] 제품준비 알림톡: statusToken 없이는 발송하지 않음'); return }
    // 버튼(WL)은 템플릿에 "https://#{링크}" 형태로 등록되어 있으므로, 프로토콜을 뺀 나머지 주소만 변수로 전달한다
    const linkNoProtocol = `${origin().replace(/^https?:\/\//, '')}/install-status/${statusToken}`
    ko = kakaoOptions(INSTALL_PREPARING_SCHEDULE_TEMPLATE_ENV, { '#{고객명}': customerName, '#{링크}': linkNoProtocol })
  } else if (status === 'scheduled') {
    // '일정확정' 템플릿은 아직 승인 신청 전이라 env가 비어있을 수 있음 — 그 경우 조용히 스킵 (오발송/에러 방지)
    if (!process.env[INSTALL_STATUS_TEMPLATE.scheduled]) {
      console.warn('[solapi] 설치 일정확정 알림톡 템플릿 미설정 — 발송 스킵 (상태 변경은 정상 반영됨)')
      return
    }
    // 템플릿에 #{예정일} #{예정시각}이 항상 함께 노출되므로, 하나만 입력된 경우에도
    // 두 변수 모두 값을 채워 보낸다 (누락 시 카카오 쪽에서 변수 미치환 오류가 날 수 있음)
    ko = kakaoOptions(INSTALL_STATUS_TEMPLATE.scheduled, {
      '#{고객명}': customerName,
      '#{예정일}': scheduledDate || '',
      '#{예정시각}': scheduledTime || '',
    })
  } else if (status === 'delivery_sent') {
    // 송장번호 변수가 포함된 새 템플릿 승인 전이라면 env에 등록된 기존 템플릿에는
    // #{송장번호} 변수가 없을 수 있음 — kakaoOptions는 넘겨받은 변수만 그대로 전달하므로
    // 템플릿이 그 변수를 쓰지 않으면 무시되고, 쓰는데 안 보내면 카카오 쪽에서 오류가 날 수 있다.
    const trackingLabel = trackingNumber ? `로젠택배 ${trackingNumber}` : ''
    ko = kakaoOptions(INSTALL_STATUS_TEMPLATE.delivery_sent, { '#{고객명}': customerName, '#{송장번호}': trackingLabel })
  } else {
    ko = kakaoOptions(INSTALL_STATUS_TEMPLATE[status], { '#{고객명}': customerName })
  }
  if (!ko) return
  await solapiSend({
    to: phone,
    from: process.env.SOLAPI_SENDER!,
    text,
    kakaoOptions: ko,
  })
}

export async function sendSignComplete({
  signerPhone, signerName, contractTitle,
}: { signerPhone: string; signerName: string; contractTitle: string }) {
  if (!signerPhone) return
  const text = `[서명 완료]\n${signerName}님, "${contractTitle}" 계약서 서명이 완료되었습니다.`
  const ko = kakaoOptions('SOLAPI_KAKAO_TEMPLATE_SIGN_COMPLETE', {
    '#{고객명}': signerName,
    '#{계약서명}': contractTitle,
  })
  if (!ko) return
  await solapiSend({
    to: signerPhone,
    from: process.env.SOLAPI_SENDER!,
    text,
    kakaoOptions: ko,
  })
}

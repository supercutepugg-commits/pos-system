import { SolapiMessageService } from 'solapi'
import type { ApplicantType } from '@/types'

const service = new SolapiMessageService(
  process.env.SOLAPI_API_KEY!,
  process.env.SOLAPI_API_SECRET!
)

function kakaoOptions(templateEnvKey: string, variables: Record<string, string>) {
  const pfId = process.env.SOLAPI_KAKAO_PFID
  const templateId = process.env[templateEnvKey]
  if (!pfId || !templateId) return null
  return { pfId, templateId, variables, disableSms: true }
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
  await (service as any).send({
    to: signerPhone,
    from: process.env.SOLAPI_SENDER!,
    text,
    ...(ko ? { kakaoOptions: ko } : {}),
  })
}

// 사업자 유형별 제출 서류 목록 — 유형마다 본문이 크게 달라서 알림톡 템플릿도 유형별로 따로 등록한다
const FRANCHISE_DOCS: Record<ApplicantType, string[]> = {
  corporate: [
    '대표자 신분증',
    '사업자 통장 사본',
    '사업자등록증',
    '영업신고증 (음식점에 한함)',
    '법인 등기부등본 (3개월 이내 발급)',
    '법인 인감증명서 (3개월 이내 발급)',
    '주주명부 (3개월 이내 발급)',
    '사업장 외부 사진 2장',
    '사업장 내부 사진 2장',
  ],
  individual: [
    '대표자 신분증',
    '사업자 통장 사본',
    '사업자등록증',
    '영업신고증 (음식점에 한함)',
    '사업장 외부 사진 2장',
    '사업장 내부 사진 2장',
  ],
  existing: [
    '대표자 신분증',
    '사업자 통장 사본',
    '사업자등록증',
    '영업신고증 (음식점에 한함)',
  ],
}

const FRANCHISE_TEMPLATE_ENV_KEY: Record<ApplicantType, string> = {
  corporate: 'SOLAPI_KAKAO_TEMPLATE_FRANCHISE_DOC_CORPORATE',
  individual: 'SOLAPI_KAKAO_TEMPLATE_FRANCHISE_DOC_INDIVIDUAL',
  existing: 'SOLAPI_KAKAO_TEMPLATE_FRANCHISE_DOC_EXISTING',
}

export async function sendFranchiseDocRequest({
  phone, ownerName, businessName, applicantType,
}: { phone: string; ownerName: string; businessName: string; applicantType: ApplicantType }) {
  if (!phone) return
  const docList = FRANCHISE_DOCS[applicantType].map(d => `- ${d}`).join('\n')
  const photoNote = applicantType !== 'existing'
    ? '\n* 간판이 없는 경우, 건물에 부착된 도로명주소 표지판 사진으로 대체 가능합니다.'
    : ''
  const receiptNote = applicantType === 'existing'
    ? '\n\n접수 방법: 이메일 주소와 연락처를 함께 기재하여 담당자에게 회신해주세요.'
    : ''
  const text = `[가맹 서류 안내]\n${ownerName}님, "${businessName}" 카드 가맹 신청을 위해 아래 서류를 준비해주세요.\n\n제출 서류\n${docList}${photoNote}${receiptNote}`
  const ko = kakaoOptions(FRANCHISE_TEMPLATE_ENV_KEY[applicantType], {
    '#{고객명}': ownerName,
    '#{상호명}': businessName,
    '#{서류목록}': docList,
  })
  await (service as any).send({
    to: phone,
    from: process.env.SOLAPI_SENDER!,
    text,
    ...(ko ? { kakaoOptions: ko } : {}),
  })
}

type FranchiseStatusUpdateKind = 'doc_incomplete' | 'doc_complete' | 'franchise_done'

const FRANCHISE_STATUS_TEXT: Record<FranchiseStatusUpdateKind, string> = {
  doc_incomplete: '제출하신 서류에 보완이 필요합니다. 담당자에게 문의해주세요.',
  doc_complete: '서류 접수가 완료되었습니다. 가맹 심사가 진행됩니다.',
  franchise_done: '가맹이 완료되었습니다. 곧 기술지원팀에서 설치 일정을 안내드립니다.',
}

const FRANCHISE_STATUS_TEMPLATE_ENV_KEY: Record<FranchiseStatusUpdateKind, string> = {
  doc_incomplete: 'SOLAPI_KAKAO_TEMPLATE_FRANCHISE_DOC_INCOMPLETE',
  doc_complete: 'SOLAPI_KAKAO_TEMPLATE_FRANCHISE_DOC_COMPLETE',
  franchise_done: 'SOLAPI_KAKAO_TEMPLATE_FRANCHISE_DONE',
}

export async function sendFranchiseStatusUpdate({
  phone, ownerName, businessName, status,
}: { phone: string; ownerName: string; businessName: string; status: FranchiseStatusUpdateKind }) {
  if (!phone) return
  const text = `[가맹 진행 안내]\n${ownerName}님, "${businessName}" 가맹 진행상황을 안내드립니다.\n${FRANCHISE_STATUS_TEXT[status]}`
  const ko = kakaoOptions(FRANCHISE_STATUS_TEMPLATE_ENV_KEY[status], {
    '#{고객명}': ownerName,
    '#{상호명}': businessName,
  })
  await (service as any).send({
    to: phone,
    from: process.env.SOLAPI_SENDER!,
    text,
    ...(ko ? { kakaoOptions: ko } : {}),
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
  await (service as any).send({
    to: signerPhone,
    from: process.env.SOLAPI_SENDER!,
    text,
    ...(ko ? { kakaoOptions: ko } : {}),
  })
}

import { SolapiMessageService } from 'solapi'

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

export async function sendFranchiseDocRequest({
  phone, ownerName, businessName, docTemplate,
}: { phone: string; ownerName: string; businessName: string; docTemplate?: string }) {
  if (!phone) return
  const text = `[가맹 서류 안내]\n${ownerName}님, "${businessName}" 가맹 접수를 위해 서류 제출이 필요합니다.\n${docTemplate ? `필요 서류: ${docTemplate}\n` : ''}서류를 준비하여 담당자에게 전달해주세요.`
  const ko = kakaoOptions('SOLAPI_KAKAO_TEMPLATE_FRANCHISE_DOC_REQUEST', {
    '#{고객명}': ownerName,
    '#{상호명}': businessName,
    '#{필요서류}': docTemplate ?? '',
  })
  await (service as any).send({
    to: phone,
    from: process.env.SOLAPI_SENDER!,
    text,
    ...(ko ? { kakaoOptions: ko } : {}),
  })
}

export async function sendFranchiseStatusUpdate({
  phone, ownerName, businessName, status,
}: { phone: string; ownerName: string; businessName: string; status: 'doc_incomplete' | 'doc_complete' | 'franchise_done' }) {
  if (!phone) return
  const STATUS_TEXT: Record<typeof status, string> = {
    doc_incomplete: '제출하신 서류에 보완이 필요합니다. 담당자에게 문의해주세요.',
    doc_complete: '서류 접수가 완료되었습니다. 가맹 심사가 진행됩니다.',
    franchise_done: '가맹이 완료되었습니다. 곧 기술지원팀에서 설치 일정을 안내드립니다.',
  }
  const text = `[가맹 진행 안내]\n${ownerName}님, "${businessName}" 가맹 진행상황을 안내드립니다.\n${STATUS_TEXT[status]}`
  const ko = kakaoOptions('SOLAPI_KAKAO_TEMPLATE_FRANCHISE_STATUS', {
    '#{고객명}': ownerName,
    '#{상호명}': businessName,
    '#{진행상태}': STATUS_TEXT[status],
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

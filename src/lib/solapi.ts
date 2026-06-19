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

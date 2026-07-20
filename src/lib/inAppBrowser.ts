export type InAppBrowser = 'kakaotalk' | 'naver' | 'line' | 'facebook' | 'instagram'

export function detectInAppBrowser(userAgent: string): InAppBrowser | null {
  const ua = userAgent.toLowerCase()
  if (ua.includes('kakaotalk')) return 'kakaotalk'
  if (ua.includes('naver')) return 'naver'
  if (ua.includes('line/')) return 'line'
  if (ua.includes('fban') || ua.includes('fbav')) return 'facebook'
  if (ua.includes('instagram')) return 'instagram'
  return null
}

function isAndroid(userAgent: string) {
  return /android/i.test(userAgent)
}

// 인앱 브라우저를 외부 기본 브라우저로 강제 이동시키기 위한 URL.
// 카카오톡은 OS와 무관하게 자체 스킴으로 외부 브라우저를 열어주지만,
// 그 외 인앱 브라우저는 Android에서만 intent 스킴으로 크롬을 강제할 수 있고
// iOS에서는 자동 이동 방법이 없어 null을 반환한다 (수동 안내 필요).
export function buildExternalBrowserUrl(browser: InAppBrowser, currentUrl: string, userAgent: string): string | null {
  if (browser === 'kakaotalk') {
    return `kakaotalk://web/openExternal?url=${encodeURIComponent(currentUrl)}`
  }
  if (isAndroid(userAgent)) {
    const withoutScheme = currentUrl.replace(/^https?:\/\//, '')
    return `intent://${withoutScheme}#Intent;scheme=https;package=com.android.chrome;end`
  }
  return null
}

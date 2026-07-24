# 개발 환경 세팅

## 1. 저장소 클론 & 패키지 설치

```bash
git clone <repo-url>
cd pos-system
npm install
```

`npm install` 시 `husky`가 자동으로 git hook을 설치합니다 (`prepare` 스크립트).

## 2. 개발용 Supabase 프로젝트 만들기

**주의: 운영(prod) Supabase 프로젝트의 키를 로컬 `.env`에 절대 사용하지 마세요.** 로컬 개발은 반드시 본인 소유의 별도 Supabase 프로젝트를 사용합니다.

1. [supabase.com](https://supabase.com)에서 새 프로젝트 생성 (무료 티어로 충분)
2. 프로젝트 대시보드 → `SQL Editor`에서 `supabase/` 폴더의 `NNN_*.sql` 파일을 번호 순서대로 실행 (`001_schema.sql`부터 시작)
   - 파일명 앞 번호는 실제 적용된 시간순(git 히스토리 기준)이며, 새 마이그레이션을 추가할 때는 가장 큰 번호 다음 번호를 이어서 사용
   - 현재는 자동화된 마이그레이션 러너가 없어 수동 적용
3. `Project Settings → API`에서 아래 값을 확인
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` 키 → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` 키 → `SUPABASE_SERVICE_ROLE_KEY` (절대 클라이언트 코드/커밋에 노출 금지)

## 3. 환경 변수 설정

```bash
cp .env.example .env
```

`.env`에 위에서 발급받은 Supabase 값과 필요한 Solapi(카카오 알림톡) 값을 채웁니다. Solapi 값이 없어도 로컬 개발은 대부분 가능하지만, 알림톡 발송 관련 기능은 동작하지 않습니다.

## 4. 개발 서버 실행

```bash
npm run dev
```

http://localhost:3000 에서 확인합니다.

## 5. 커밋 전 체크

`husky` pre-commit 훅이 스테이징된 파일에 대해 `prettier --write`(lint-staged)를 자동 실행합니다. 커밋 메시지 형식은 [commit-convention.md](./commit-convention.md)를 따르며 `commit-msg` 훅이 형식을 검사합니다.

ESLint는 pre-commit에서 강제하지 않습니다. 기존 코드에 남아있는 lint 오류가 많아 매 커밋을 막아버리기 때문이며, 이 부채가 정리되면 `eslint --fix`를 다시 lint-staged에 포함할 수 있습니다. 대신 PR 전에 수동/CI로 확인해주세요:

```bash
npm run lint
npm run format:check
```

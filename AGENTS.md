<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 리팩토링 / DB 스키마 변경 작업 규칙

코드 리팩토링과 DB 스키마 변경을 함께 진행할 때는 아래 순서를 따른다.

1. **코드 및 DB 스키마 확인** — 손대려는 영역의 현재 코드와 관련 테이블 구조를 먼저 파악
2. **계획 수립** — 코드 리팩토링 계획과 DB 변경 계획을 세우고 공유
3. **진행** — 실제 구현. dev Supabase 프로젝트에서 먼저 검증한 뒤 운영에 반영 (docs/dev-environment.md 참고)
4. **flow 및 문서 작성** — 진행하면서 결정 사항을 그때그때 기록. 다 끝난 뒤 몰아서 쓰지 않기 (이유를 잊어버리기 쉬움)
5. **마이그레이션 정리** — 작업 중엔 새 스키마 변경을 `supabase/`에 다음 번호(현재 090부터)로 계속 이어 붙인다. 리팩토링/DB 변경이 라이브에 반영되어 안정화되면, 그 시점 스키마를 스냅샷 떠서 `001_user.sql`, `002_franchise.sql`처럼 도메인별 클린 스키마 세트를 새로 작성하고, 기존 번호 매긴 마이그레이션 전체는 삭제하지 않고 `supabase/archive/`로 이동해 운영 반영 이력으로 보존한다.

**DB 스키마 변경 원칙**

- 컬럼 삭제/타입 변경보다 추가 위주로 먼저 진행하고, 삭제는 되돌리기 어려우니 가장 마지막에
- 커밋 컨벤션은 [docs/commit-convention.md](./docs/commit-convention.md) 따름

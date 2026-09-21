# Travel Archive - Codex 実装指示書

> 対象: AI coding agent / Codex  
> 前提資料: `travel-archive-basic-design.md`  
> 目的: 基本設計を崩さず、MVPを段階的に実装する

---

## 1. 最重要ルール

このプロジェクトでは、AIエージェントが独自判断で技術選定・プロダクト方針を変更してはならない。

迷った場合は以下を優先する。

1. 基本設計書
2. 既存コードの意図
3. Security / Privacy
4. Simplicity
5. Portability
6. Performance
7. Convenience

「より一般的だから」「実装が簡単だから」という理由だけで、
既決定のArchitectureを別サービスへ置き換えないこと。

---

## 2. 固定技術

以下は明示的な変更指示がない限り固定。

### Web
- Next.js
- App Router
- React
- TypeScript
- Vercel

### Backend
- Hono
- TypeScript
- Cloudflare Workers

### Database
- PostgreSQL
- Supabase PostgreSQL hosting
- PostGIS
- SQL migration

### Storage
- Cloudflare R2

### Map
- MapLibre GL JS

### Auth
- Auth0
- Google
- Apple
- Provider間Merge / Linkなし

### Security
- Cloudflare Turnstile
- Rate Limit
- RLS
- Private by default

### Contract
- REST
- OpenAPI
- `/v1`

### Tooling
- mise
- Biome
- Vitest
- Playwright
- GitHub Actions

---

## 3. MVPで実装しないもの

明示的な追加指示がない限り実装しない。

- Wishlist
- AI旅行計画
- Social Feed
- Follow
- Like
- Comment
- Native Mobile App
- Push Notification
- GPS常時追跡
- Passkey
- Journey Playback
- Year in Travel
- 高度なOffline Sync
- Provider account merge
- Email/Password login
- Email Magic Link
- SMS login

READMEの「Future」等へ勝手に大量追加する必要もない。

---

## 4. Architecture Boundary

WebとBackendを明確に分離する。

```text
apps/web
  ↓ HTTP
apps/api
  ↓
Domain / Repository
  ↓
PostgreSQL / R2
```

禁止:

```text
Next.js Component
  ↓
Supabase DB Direct Access
```

禁止:

```text
Next Server Action
  ↓
R2 / DB
```

をDomain処理の正本とすること。

Next.js Server Actions / Route Handlersは
Next固有UI用途・callback等に限定する。

---

## 5. Go移行可能性

初期実装はTypeScriptで行う。

ただしBackendを将来Goへ交換可能にするため:

- API ContractをOpenAPIで保持
- SQL MigrationをSchema正本とする
- Hono ContextをDomainへ渡さない
- Infrastructure型をDomainへ漏らさない
- API ClientはHTTP Contractに依存
- Business logicをNext.jsへ置かない

Go用のコードを先に書く必要はない。

---

## 6. Monorepo構成

原則以下をベースに構築する。

```text
apps/
  web/
  api/

packages/
  domain/
  api-client/
  auth/
  storage/
  geo/
  validation/
  config/

openapi/
  openapi.yaml

db/
  migrations/
  seeds/
  tests/

infra/

docs/
```

必要に応じて細分化してよいが、
責務境界を崩さないこと。

---

## 7. Data Model

中核Entity:

- User
- AuthIdentity
- Country
- Place
- Trip
- Visit
- Memory
- Photo
- MemoryPhoto
- ShareConfiguration / PublicProfile

### 中心Entity

`Visit`

```text
User
 ├ Trip
 │   └ Visit
 │
 └ Visit
     ├ Memory
     └ Photo
```

Tripはoptional。

Tripを作らずVisitだけを作れること。

同じPlaceへ複数回訪問できること。

---

## 8. Place / Geo

- Country masterはISO 3166ベース
- Place内部IDは自前UUID
- External Provider IDをPKにしない
- PostGISを使用可能な設計にする
- Place Providerはadapter境界を持つ
- 特定Map/Places providerへDomainを依存させない

---

## 9. Guest Mode

Guest dataはIndexedDB。

Guest状態で本番DBへUser-like anonymous recordを乱造しない。

### Save Flow

```text
Guest
 ↓
Save
 ↓
Turnstile
 ↓
Google / Apple Login
 ↓
Guest Import
```

Guest Importはidempotent。

必ずimport transaction / import key等を用いて
リトライによる重複作成を防ぐ。

---

## 10. Auth

MVPではGoogle / Appleのみ。

Auth0 IdentityとInternal Userを分離する。

Provider間で同メールでも同一Userに統合しない。

MVPではAccount Linking機能を作らない。

Passkeyは実装しない。
正式ドメイン確定後の別タスクとする。

---

## 11. Turnstile

Turnstileはserver-side verify必須。

主な利用対象:

- Guest save/import
- abuse-sensitive public write
- report
- suspicious signup flow

通常のauthenticated CRUDへ毎回Turnstileを要求しない。

Turnstileだけでbot/abuse対策を完結させずRate Limitも実装する。

---

## 12. Photo

StorageはR2。

### Upload

原則:

```text
Client
  ↓ request upload
API
  ↓ temporary upload URL
Client
  ↓
R2
  ↓
Complete API
```

写真本体をNext.js/Vercel経由で常時proxyしない。

Bucketはprivate。

配信用URLは期限付き / controlされた配信経路を使う。

EXIFは配信用画像から除去する。

---

## 13. Privacy / Authorization

旅行履歴はLocation History相当の機微性を持つものとして扱う。

必須:

- Private by default
- 全private resourceでownership確認
- Cross-user relationを禁止
- RLS
- DB constraint
- Signed URL
- Data minimization
- Sensitive valuesをlogしない

IDが分かるだけで他Userのresourceへアクセスできる実装を禁止する。

---

## 14. Share

ShareはPrivate entityへ `is_public` を乱立させず、
Share Configurationを介する。

DefaultはOFF。

MVP public profileの基本公開対象:

- Display name
- Map
- Visited countries
- Aggregate stats

Exact location / exact date / memory body / original photoは
明示的許可なしで公開しない。

---

## 15. API

Base:

```text
/v1
```

主要resource:

- `/me`
- `/trips`
- `/visits`
- `/memories`
- `/photos`
- `/places`
- `/map`
- `/stats`
- `/share`

OpenAPI documentと実装を常に同期すること。

API変更時は:

1. OpenAPI更新
2. Generated/client type更新
3. Implementation更新
4. Contract test更新

を行う。

---

## 16. Map API

初回Map表示で全Photo/Memoryを返さない。

Progressive loading:

```text
World
  ↓
Country Summary
  ↓
City Summary
  ↓
Place / Memory / Photo detail
```

Viewport/zoomに応じて必要な情報のみ取得する。

---

## 17. Frontend UX

最重要Aha Moment:

> ユーザー自身の写真が世界地図上に初めて表示される

Onboardingはこの体験まで最短化する。

ログインを先に要求しない。

入力必須項目を増やしすぎない。

Memoryは長文日記を強制しない。

---

## 18. Responsive Design

Desktop:
- Map中心
- Side / Detail Panel
- Timeline / Recent Memories

Mobile Web:
- Map中心
- Bottom Sheet
- Bottom Navigation
- Quick add導線

Desktop UIを単純縮小しない。

Native Mobile用UIはMVPで実装しない。

---

## 19. SEO / LLMO / Agent Compatibility

Public面:

- sitemap.xml
- robots.txt
- canonical
- OpenGraph
- structured data
- semantic HTML
- accessibility
- public profile metadata
- LLMO
- MCP
- WebMCP

Private App面:

- noindex
- sensitive private dataを検索/AI向けに公開しない

PublicとPrivateのindexabilityを混在させない。

---

## 20. Testing Priority

必須重点:

1. Auth
2. Authorization
3. Cross-user access denial
4. Guest import idempotency
5. Visit / Trip
6. Photo upload
7. Share privacy
8. Account delete
9. DB migration
10. API contract

Visual regressionを過剰に増やさない。

---

## 21. CI

PR:

```text
install
lint
format check
typecheck
unit test
DB migration test
API contract test
web build
api build
preview
```

Production deployはDB migrationとの互換性を考慮する。

破壊的migrationと新codeを一発で同時適用しない。

---

## 22. Migration Rule

原則:

```text
Expand
 ↓
Deploy compatible code
 ↓
Migrate data
 ↓
Contract
```

DB変更中に旧Web/APIが短時間存在しても壊れないことを優先。

---

## 23. Observability

最低限追跡:

- API error rate
- API latency
- Auth failures
- DB failures
- R2 failures
- Photo upload failures
- Guest import failures

禁止:

- Memory body
- GPS
- raw EXIF
- auth token
- email
- photo contents

を通常ログへ送ること。

---

## 24. 実装フェーズ

### Phase 0: Foundation
- Monorepo
- mise
- Next.js
- Hono Worker
- OpenAPI
- DB migration infrastructure
- CI
- Environment structure

### Phase 1: Auth / User
- Auth0 Google
- Auth0 Apple
- Internal User mapping
- Turnstile
- `/me`
- Auth tests

### Phase 2: Geo / Visit
- Country master
- Place
- PlaceProvider abstraction
- Visit
- World map basic rendering

### Phase 3: Guest
- IndexedDB
- Guest visited country/place
- Save flow
- Idempotent import

### Phase 4: Photo / Memory
- R2 upload flow
- Photo metadata
- EXIF handling
- Memory
- Photo marker

### Phase 5: Trip / Detail
- Trip
- Country detail
- Trip detail
- Visit grouping

### Phase 6: Timeline / Stats
- Timeline
- Aggregate stats

### Phase 7: Share
- Share configuration
- Public profile
- Privacy controls
- Report/minimum abuse path

### Phase 8: Hardening
- RLS
- Cross-user tests
- Rate limiting
- Delete account
- Logging review
- Performance review
- Security review

---

## 25. Done Definition

MVPは以下が通るまで完了扱いにしない。

```text
Guest
 ↓
Map
 ↓
Visit
 ↓
Photo
 ↓
Memory
 ↓
Save
 ↓
Turnstile
 ↓
Google / Apple
 ↓
Import
 ↓
Re-login
 ↓
Own Map
 ↓
Trip / Timeline / Stats
 ↓
Optional Share
```

加えて:

- 他Userのprivate dataを取得できない
- account deleteが成立
- photo private storageが成立
- API/OpenAPIが一致
- Production migration procedureが成立
- Public/Private indexabilityが分離
- Required tests green

---

## 26. エージェントの判断禁止事項

以下を「改善」と称して勝手に変更しない。

- Astro化
- Firebase化
- D1化
- Supabase Storage化
- Next API Routes一本化
- Google Maps中心化
- Login method追加
- Google/Apple自動Merge
- Wishlist追加
- Social機能追加
- Passkey先行追加
- Mobile先行実装
- Go先行実装
- Vercel Blob/KV等への中核依存
- Supabase SDKへのDomain依存

変更が必要と思われる場合は、
実装前に理由・影響・代替案を報告し、明示的な承認を待つこと。

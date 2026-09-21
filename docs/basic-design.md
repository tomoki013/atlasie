# Travel Archive 基本設計書

> Status: Draft / implementation-ready  
> Product name: TBD  
> Internal codename: `Travel Archive`  
> Initial domain placeholder: `<app>.tmkch.io`

---

## 1. プロダクト定義

### 1.1 コンセプト

**自分が見てきた世界を、写真と思い出で育てる Personal Travel Archive。**

本プロダクトは旅行計画、旅行検索、SNSを主目的としない。
中心体験は以下の4要素とする。

- **Map**
- **Photo**
- **Memory**
- **Time**

旅行先を「管理する」のではなく、長期間使うことで
**自分が見てきた世界そのものが育っていく体験**を提供する。

### 1.2 競争軸

BeenBeen等の旅行トラッカーと機能数で競争しない。

本プロダクトの差別化軸は以下。

1. 写真が世界地図そのものを作る
2. 時間とともに地図が育つ
3. TrackerではなくArchive / Memory-first
4. Private by default
5. 自分の旅データをユーザー自身が所有・Export・削除できる

---

## 2. MVPスコープ

### 2.1 MVPに含める

- 世界地図
- 訪問国・都市・場所の登録
- Trip
- Visit
- Memory
- Photo
- Country Detail
- Trip Detail
- Timeline
- Stats
- Guest Mode
- Google Login
- Apple Login
- Cloudflare Turnstile
- Private by default
- Share
- Public Profile
- Account / Privacy Settings
- Responsive Web
- SEO / LLMO / sitemap / robots / WebMCP / MCPに配慮した公開面設計

### 2.2 MVPに含めない

- Wishlist
- AI旅行プラン
- Discover
- Social Feed
- Follow
- Like
- Comment
- GPS常時追跡
- Native Mobile App
- Push Notification
- Journey Playback
- Year in Travel
- 高度なOffline Sync
- Passkey
- Provider間Account Merge / Linking

---

## 3. 認証・アカウント方針

### 3.1 MVP認証

認証プロバイダーは **Google / Appleのみ** とする。

提供しないもの:

- Password login
- Email OTP
- Magic Link
- SMS login

### 3.2 Provider間マージ

GoogleとAppleは**別アカウントとして扱う**。

- 同じメールアドレスでも自動マージしない
- Account Linking UIをMVPでは提供しない
- Provider Aで作成したデータをProvider Bで自動復旧しない

### 3.3 Auth Provider

MVPでは **Auth0** を利用する。

アプリ内部User IDをAuth0のUser IDから分離する。

```text
Auth0 Identity
    ↓
Auth Identity Mapping
    ↓
Internal User UUID
    ↓
Trips / Visits / Memories / Photos
```

Auth0固有IDをTrip等のFKとして直接使わない。

### 3.4 Passkey

Passkeyは**正式ドメイン確定後に追加**する。

初期公開:

```text
<app>.tmkch.io
api.<app>.tmkch.io
```

この段階ではPasskeyを提供しない。

正式ドメイン確定後:

```text
example.com
api.example.com
auth.example.com
```

等の最終構成を決定し、その段階でPasskeyを実装する。

既存Google / Appleユーザーはログイン後にPasskeyを追加できる構成とする。

---

## 4. Guest Mode

### 4.1 方針

初回ユーザーにログインを要求しない。

体験順:

```text
Landing
  ↓
World Map
  ↓
訪問国を選択
  ↓
場所を追加
  ↓
写真を追加
  ↓
自分の地図ができる
  ↓
Save my world
  ↓
Turnstile
  ↓
Google / Apple Login
  ↓
Guest Data Import
```

### 4.2 Guest Data

未ログイン状態のデータは **IndexedDB** に保持する。

未ログインデータをサーバーへ常時保存しない。

Guest Import APIは **idempotent** にする。
再送しても重複Trip / Visit / Memory / Photoを作らない。

---

## 5. フロントエンド

### 5.1 採用

- Next.js
- App Router
- React
- TypeScript
- Vercel

Astroは採用しない。

理由:
本プロダクトは静的コンテンツ中心ではなく、Map / Auth / Upload / Timeline / Panel / Global State等を中心としたWeb Applicationだから。

### 5.2 Next.jsの責務

- UI
- Rendering
- Public Profile
- SEO Metadata
- Client state
- Guest UX
- Map UI
- Auth UI
- API Client

### 5.3 Next.jsに持たせない責務

以下をアプリケーションの正本処理にしない。

- DB直接操作
- R2直接操作
- Domain Logicの正本
- 認可ルールの正本
- Server Actionsのみで完結するCRUD

---

## 6. Backend

### 6.1 採用

- Hono
- TypeScript
- Cloudflare Workers

### 6.2 API設計

FrontendとBackendをHTTP境界で分離する。

```text
Next.js
   ↓ HTTPS
Own API
   ↓
Domain Logic
   ↓
PostgreSQL / R2
```

Base URL:

```text
https://api.<app>.tmkch.io/v1/*
```

正式ドメイン移行後も `/v1` Contractを維持する。

### 6.3 将来Go移行

初期はGoを採用しない。

ただし将来的に:

```text
Hono / TypeScript
      ↓
     Go
```

へ置換可能にする。

そのため:

- OpenAPIをAPI Contractの正本とする
- SQL MigrationをDB Schemaの正本とする
- Hono固有型をDomain層へ漏らさない
- Next.jsからBackend実装言語を意識させない

---

## 7. Database

### 7.1 採用

- PostgreSQL
- Supabase PostgreSQL
- PostGIS

Supabaseは**PostgreSQLのホスティング先**として利用する。
Supabase固有SDKやDB APIへプロダクト中核を依存させない。

### 7.2 DB接続

Cloudflare Workers → Cloudflare Hyperdrive → Supabase PostgreSQL

ただしHyperdriveはInfrastructure Detailとし、Domain層へ漏らさない。

### 7.3 主要Entity

- User
- AuthIdentity
- Country
- Place
- Trip
- Visit
- Memory
- Photo
- MemoryPhoto
- PublicProfile / ShareConfiguration

### 7.4 中心モデル

**Visitを旅行記録の中心Entityとする。**

```text
User
 ├─ Trip
 │   └─ Visit
 │
 └─ Visit
     ├─ Memory
     └─ Photo
```

Tripはoptional。

例:
「京都に行った」だけならTripを作成せずVisitだけで成立する。

### 7.5 Place

概念階層:

```text
Country
  ↓
Region
  ↓
City
  ↓
Place
```

MVP UIでは主に:

- Country
- City
- Place

を扱う。

Placeの内部IDは自前UUIDとし、Google / OSM等のExternal IDをPrimary Keyにしない。

### 7.6 地理データ

- Country master: ISO 3166ベース
- Location: PostGIS
- World border data: GeoJSON / vector dataを自前管理
- 外部Place Providerはadapter経由で利用

---

## 8. Place Provider

Place検索は外部サービスにロックインしない。

概念Interface:

```text
PlaceProvider
- search()
- get()
```

MVP Providerは実装時に選定してよいが、
Provider IDを自前Place IDの代替として使用してはならない。

---

## 9. Map

### 9.1 Engine

**MapLibre GL JS**

理由:

- 独自Style
- Photo Marker
- Animation
- Overlay
- Country styling
- Provider lock-in低減

### 9.2 Zoom階層

World:
- Visited Countries
- Country representative photo
- Country summary

Country:
- Cities
- Trip routes
- Photo summaries

City:
- Places
- Memories
- Photos

初期ロードで全Memory / 全Photoを返さない。

### 9.3 Aha Moment

最優先UX:

> **自分の写真が世界地図上に初めて現れる瞬間**

初回体験はここへ最短距離で到達させる。

---

## 10. Photos

### 10.1 Storage

**Cloudflare R2**

Bucketはprivate。

### 10.2 保存形式

概念的に:

```text
original
display
thumbnail
```

DBには以下のみ保持:

- storage key
- dimensions
- mime type
- file size
- captured time
- optional location
- upload status

### 10.3 Upload Flow

```text
Client
  ↓
APIにUpload Request
  ↓
一時Upload URL発行
  ↓
Client → R2直接Upload
  ↓
APIへComplete通知
```

巨大画像をVercelやWorkerで常時中継しない。

### 10.4 EXIF

Upload時に必要情報のみ抽出する。

利用候補:
- 撮影日時
- GPS

配信用画像からEXIFを削除する。

Originalはprivate。

---

## 11. Timeline / Stats

### 11.1 Timeline

MVPに含める。

例:

```text
2026
 ├ Shanghai
 ├ Egypt
 └ Singapore

2025
 └ France
```

Photo-centric UIとする。

### 11.2 Timeline Map Slider

時間スライダーで地図が育つ機能は **V1.1**。

### 11.3 Stats

MVP:

- Countries
- Cities
- Places
- Trips
- Memories
- Photos
- Continents

「世界の○%」は補助表示。

---

## 12. Share / Public Profile

### 12.1 Default

**完全Private**

Public Profile / Shareはdefault OFF。

### 12.2 MVP公開可能情報

- Display name
- World Map
- Visited Countries
- Aggregate Stats

### 12.3 Default非公開

- Exact coordinates
- Exact visit dates
- Memory body
- Original photos
- Detailed trip data

写真やMemoryはユーザーが明示的に公開した場合のみ公開。

### 12.4 Share設計

Private entityに単純な `is_public` を乱立させない。

```text
Private Data
   ↓
Share Configuration
   ↓
Public View
```

という境界を設ける。

---

## 13. Security

Travel historyはLocation historyとして扱う。

原則:

- Private by default
- Least privilege
- Data minimization
- HTTPS only
- Signed URL
- Private R2
- Every private request requires authorization
- Cross-user access prevention
- DB constraints
- RLS
- Secrets never exposed to client
- Sensitive content excluded from logs

### 13.1 Turnstile

Cloudflare Turnstile Managed Mode。

主な利用箇所:

- Guest → Account保存
- 不審なSignup
- Public write endpoint
- Report / Abuse-sensitive action

通常の閲覧・Memory編集等では毎回表示しない。

Server-side verificationを必須とする。

### 13.2 Rate Limit

Turnstileと別に実装する。

対象:

- Auth周辺
- Guest import
- Upload URL発行
- Public write
- Report

### 13.3 Logging

ログへ出さない:

- Memory本文
- GPS
- Original filename
- Photo content
- OAuth/JWT token
- Email
- Raw EXIF

イベント中心:

```text
memory.created
photo.upload.failed
trip.deleted
share.enabled
```

---

## 14. Delete / Export

### Account Delete

ユーザーがUIから実行可能。

最終的に以下をHard Deleteする。

- User
- Trips
- Visits
- Memories
- Photos metadata
- R2 files
- Public Share
- Auth Mapping

### Export

V1.xでJSON / ZIP Exportを提供可能にする。

初期DB設計段階からExport可能な正規データモデルを維持する。

---

## 15. Mobile

MVPでは実装しない。

### Webの役割

**Browse / Organize / Reflect**

- Map
- Timeline
- Trip editing
- Photo organization
- Stats

### Mobileの役割

**Capture / Record**

- Camera
- Location
- Quick Memory
- Photo import
- Offline Draft
- Push Notification

Webの縮小コピーにはしない。

Native technologyは現時点で固定しない。

---

## 16. Deployment

### Web

- Next.js
- Vercel

### API

- Hono
- Cloudflare Workers

### DB

- Supabase PostgreSQL
- PostGIS
- Hyperdrive

### Storage

- Cloudflare R2

### DNS

- Cloudflare DNS

### Initial Production

```text
<app>.tmkch.io
api.<app>.tmkch.io
```

Passkeyは未提供。

---

## 17. Environment

3環境:

- Local
- Staging
- Production

Production DB / R2 / AuthをLocal開発で使用しない。

PR PreviewはVercel Preview。
Previewは基本Shared Staging API / Staging DBを利用する。

---

## 18. Repository

Monorepo。

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

将来:

```text
apps/mobile/
services/api-go/
```

を追加可能。

---

## 19. Toolchain

基本:

- mise
- TypeScript
- Biome
- Vitest
- Playwright
- GitHub Actions

必要に応じてOxlint / Oxfmt等を追加する。
ESLintは要件上必要な場合のみ。

---

## 20. CI/CD

### Pull Request

- Install
- Lint / Format check
- Typecheck
- Unit Test
- DB Migration Test
- API Contract Test
- Next Build
- Worker Build
- Vercel Preview

### Main / Release

- Staging migration
- Staging API deploy
- Staging Web deploy
- Smoke Test
- Production migration
- Production API
- Production Web

DB migrationは原則:

```text
Expand
  ↓
Deploy
  ↓
Migrate
  ↓
Contract
```

の互換性維持方式を採用する。

---

## 21. Testing重点領域

特に強くテストする。

- Auth
- Authorization
- Cross-user access prevention
- Guest import idempotency
- Visit / Trip creation
- Photo upload
- Account delete
- Public / Private boundary
- Share settings
- DB migration

見た目すべてをE2E化しない。

---

## 22. Web共通要件

公開面には以下を設計段階から含める。

- sitemap.xml
- robots.txt
- canonical
- structured data
- OpenGraph
- SEO
- LLMO
- MCP
- WebMCP
- semantic HTML
- accessibility
- AI agent discoverability

Private app領域はindex対象外。

Public landing / public profile等のみ検索・AI発見対象にする。

---

## 23. MVP完成条件

以下が一連で成立すること。

```text
未登録ユーザー
 ↓
世界地図を触る
 ↓
訪問場所を登録
 ↓
写真を追加
 ↓
Memoryを残す
 ↓
Save
 ↓
Turnstile
 ↓
Google / Apple Login
 ↓
Guest Data Import
 ↓
後日再ログイン
 ↓
自分の世界地図を閲覧
 ↓
Trip / Timeline / Stats確認
 ↓
必要ならShare
```

---

## 24. 実装時に再判断しない項目

AI実装エージェントは、明示的な変更指示がない限り以下を変更しない。

- Next.js → Astro等への変更
- Vercel → 別Web Hostingへの変更
- Hono/Workers → Next API Routes一本化
- PostgreSQL → D1 / Firestoreへの変更
- R2 → Supabase Storageへの変更
- MapLibre → Google Maps中心設計への変更
- Google / Apple以外のLogin追加
- Wishlistの追加
- PasskeyのMVP追加
- Social機能の追加
- Auth provider間の自動マージ
- Provider固有IDを内部Primary Keyとして利用
- Supabase SDKへの強い依存
- Vercel固有Storage/DBへの依存

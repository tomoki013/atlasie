# tomokichi-diary / Travel Archive

添付デザインに沿った、写真と地図で旅を振り返るWebアプリです。

```sh
npm ci
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開いてください。サンプルの世界地図を閲覧し、「場所を追加」から写真・メモを登録できます。「自分の旅」はIndexedDBに保存されます。

## 構成

- apps/web: Next.js App Router / React / TypeScript / MapLibre
- apps/api: Hono / Cloudflare Workers、独立した `/v1` REST API
- packages: domain / validation / auth / storage / api-client
- db: PostgreSQL / PostGISのSQL migration、RLS、ISO国マスタ、セキュリティテスト
- openapi/openapi.yaml: API契約

Google / Apple (Auth0)、Turnstile、Supabase PostgreSQL / Hyperdrive、R2は環境設定が必要です。未設定の保存画面は「準備中」を表示します。

実装・接続状況、検証方法、公開前の残タスクは [運用手順](docs/operations.md) を参照してください。ゲストUIは動作しますが、MVP全体の本番完成・デプロイを示すものではありません。

[基本設計](docs/basic-design.md) / [実装指示](docs/implementation-instructions.md)

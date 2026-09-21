# 環境構築と公開手順

## ローカル

Node 24（mise.toml）を使用します。

```sh
npm ci
npm run dev
```

Web は http://localhost:3000。外部サービス未設定でも、サンプル閲覧とゲスト保存は動作します。ゲストデータはブラウザごとの IndexedDB に保存され、写真はJPEGに変換し最大辺1600pxに縮小します。カメラロールからはファイル選択で追加できます。HEICは未対応です。

API は `npm run dev -w apps/api`。`apps/api/wrangler.jsonc` はローカル用の未接続設定です。Hyperdrive のゼロIDはプレースホルダーなので、このままデプロイしないでください。

## データベース

1. Docker環境で `docker compose -f infra/compose.yaml up -d` を実行します。
2. 専用DBに migration role（PostGIS作成権限・BYPASSRLSを持つ管理用ロール）で `db/migrations/` 内の全SQLを番号順に実行します。
3. `db/seeds/001_countries_places.sql` を実行します。ISO 3166の249か国・地域と、国だけの記録に使う249地点と初期の9都市を投入します。
4. `infra/api-role.sql` を実行し、別途LOGINロールに archive_api ロールを付与します。パスワードはシークレット管理で設定します。
5. API接続は必ず **非所有者、非superuser、NOBYPASSRLS** のロールを使います。テーブルの所有者をAPIロールにしないでください。
6. 同じ制限ロールの接続をHyperdriveに設定します。公開用の集計とAuthIdentityの解決のみ、移行ロール所有の小さな SECURITY DEFINER 関数を使います。

RLSの所有者コンテキストはリクエスト内トランザクションの `set_config(..., true)` で設定するため、プールの別リクエストへ流用されません。関連テーブルは複合外部キーでcross-user relationを拒否します。

`npm run db:test` は **空の専用テストDB** への `MIGRATION_DATABASE_URL` が必要です。既存の共有・本番DBに対して実行しないでください。GitHub ActionsはPostGISコンテナでこれを実行します。

## Auth0 / Turnstile

- Auth0にSPAアプリとAPI audienceを作成。RS256を使用。
- 接続は google-oauth2 と apple のみ。自動アカウント統合・同メールアドレスによるリンクを設定しないこと。
- callback / logout / web originsに各環境のWeb originを登録。Google / Appleのプロバイダー設定を完了すること。
- Webは `apps/web/.env.example` を `.env.local` にコピーして値を設定。アクセストークンはメモリ保持、Authorization Code + PKCEはAuth0 SDKが処理します。
- API側は AUTH0_DOMAIN、AUTH0_AUDIENCE、WEB_ORIGIN を設定。TURNSTILE_HOSTNAMEはホスト名のみ。
- Turnstile Managed widgetを作成し `NEXT_PUBLIC_TURNSTILE_SITE_KEY` と `TURNSTILE_SECRET_KEY` を設定。
- SAVE_INTENT_SECRET に32バイト以上のランダムシークレットを設定。ブラウザのTurnstile tokenをサーバー検証し、importKeyに紐付く15分のgrantを発行します。期限切れ時は保存フローから再検証します。
- DBにAuth0 subjectを旅行エンティティの外部キーとして使いません。GoogleとAppleは同メールでも別の内部UUIDになります。

## R2

- 環境ごとにprivate bucketを作成。公開のr2.dev URLとpublic custom domainは無効のままにします。
- R2_ACCOUNT_ID / R2_BUCKET_NAME と PHOTOS binding のバケットを揃えます。
- R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY は対象バケットに限定したS3 credentialをシークレットとして設定します。
- CORSはWeb originを厳密に指定、methods GET/PUT、allowed headers Content-Type。
- PUT/GET URLは5分。写真は直接R2に送信し、completeでサイズとJPEG構造を検証。配信ファイルからAPP/COM（EXIF/GPSを含む）を除去します。
- 15分ごとのCronで、24時間以上未完了の写真と削除時の遅延清掃ジョブを処理します。削除から10分待って再清掃し、発行済みPUT URLによる再作成にも対応します。失敗ジョブは次回に再試行します。実R2でのCron動作はstagingで確認してください。

## デプロイ

WebはVercel。root directoryを apps/web、installはリポジトリルートで `npm ci`、buildは `npm run build -w apps/web`。MapLibre 6のESM workerはpostinstallでpublicへコピーします。APIをNextに統合しないでください。

APIはCloudflare Workers。staging/production別のWrangler設定に、Hyperdrive、R2、originとAuth0設定を明記し、`wrangler types` で型を再生成します。秘密値は `wrangler secret put` で投入。`npm run api:build` はdry runです。

本番デプロイや外部リソース作成はこのリポジトリの実装時点では実行していません。

DB変更はExpand → 互換コードdeploy → data migrate → 後続リリースでContract。現在の001は空DB向けで、移行履歴の運用に取り込んだうえで一度だけ実行してください。デプロイ前にバックアップ・staging適用・旧APIとの互換確認を実施します。

## テストと現状

- `npm run lint` / `npm run typecheck`
- `npm test`: domain、Auth0 JWT、API auth、IndexedDB永続化、JPEGメタデータ除去、OpenAPIルート整合
- `npm run build` / `npm run api:build`
- `npm run test:e2e`: Desktop/Mobileのゲスト登録→写真→メモ→再読み込み
- `npm run db:test`: migration、RLS、cross-user外部キー、公開境界、アカウントcascade delete

実装済み: 国だけの登録（249か国・地域）、都市・観光地の検索（Photon adapter）、ゲストの写真・メモの保存と編集、Tripの作成・割り当て・表示、アカウント取り込み、段階読み込み、署名URL更新、孤立写真清掃、公開プロフィール・公開停止・通報、公開情報だけのMCP/WebMCP。

2026-09-06のローカル検証: 独立したPostgreSQL 17 / PostGIS 3.6テストDBで全4 migrationとRLS検証に成功。非所有者・NOBYPASSRLS接続で取り込みの並行再試行、ロールバック、cross-user拒否、Trip一括取り込みを検証しました。単体・結合36件、PC/スマートフォンの画面操作8件、lint・型検査・Web/APIビルドが成功しています。

**外部サービス未接続のため、本番稼働の確認は未完了です。** Auth0 / Turnstile / Supabase・Hyperdrive / private R2を設定後、stagingでログイン→取り込み→再ログイン、実写真アップロード、公開停止、削除とCron清掃を確認してください。秘密値は環境ファイル・シークレット管理に設定します。

制限: HEIC非対応。写真は縮小JPEGで保存し、原本・EXIF抽出は扱いません。設定のJSONエクスポートはブラウザ内のゲスト記録が対象で、クラウド全件の写真バックアップは未実装です。地図の国集計は世界全体を取得し、ズームに応じたサーバー範囲更新は未接続です。通報はDB保存までで、管理者の確認・対応画面は未実装です。

## 公開情報・エージェント向けインターフェース

- `NEXT_PUBLIC_SITE_URL` にWebの公開originを設定します。未設定ではcanonical/sitemapの本番URLを生成しません。
- 私有アプリはnoindex。公開プロフィールは明示的に有効化されたslugだけ表示し、表示名・訪問国・集計以外を返しません。
- `/v1/mcp` はStreamable HTTPの **2025-11-25** 互換実装です（2026-07-28の新ハンドシェイク方式は未対応）。公開プロフィールの読み取りツールのみ提供します。
- WebMCPは対応ブラウザで公開プロフィール画面に登録します。未対応ブラウザでも通常表示は動作します。
- 通報はTurnstile・レート制限付き。理由のみを保存し、次の通報時に30日超を削除します。

## アセット

- UIは添付参考画像をもとに独自実装。画像全体を画面の背景として貼り付けていません。
- サンプル写真はUnsplashの外部画像。ゲストの実写真はローカルに保存。
- 国境GeoJSONは Natural Earth（public domain）、datasets/geo-countries経由で取得・簡略化。`public/data/countries.geojson` を自前配信します。
- フォントはGoogle Fonts。公開前に自前配信へ変更可能です。

## 時間スライダー（追加実装）

設計書でV1.1としていた時間スライダーを実装。地図下で訪問日ごとに累積表示し、再生・一時停止・全期間表示を操作できます。サンプルとゲストの写真を時点で絞り込みます。クラウドでは訪問メタデータを100件ずつ読み、過去時点は場所のプレースホルダーを表示します。右パネルを閉じると案内カードを出さず地図が全幅になります。PC/スマホの操作テスト12件が成功。

## アルバム・思い出のブラッシュアップ（2026-09-22）

- 地図上部に訪問国・場所・写真の集計と、写真付きの過去の思い出を開くカードを追加。ゲスト記録がないときは最初の記録への案内を表示します。
- 写真アルバムは場所・国・タイトル・メモの検索、年／国の組み合わせ絞り込み、新しい順／古い順の並び替えに対応します。
- 写真を開くと拡大ビューで日付・メモを閲覧できます。前後ボタンと左右矢印キーで移動し、Escapeで閉じて元の写真へフォーカスを戻します。国の思い出への移動もできます。
- タイムラインは写真のない記録も検索できます。年の条件と組み合わせ、検索結果がない場合は条件を解除できます。
- クラウドの検索・写真フィルターは読み込み済みの記録が対象です。追加の記録は画面下部から読み込めます。
- E2Eは専用ポート3107でアプリを起動します。別プロジェクトの3000番サーバーを誤って再利用しないよう、既存サーバーの再利用を無効にしています。

検証結果: lint・型検査・Web本番ビルド成功。単体テスト28件成功、DB接続が必要な8件は未実行。PC／スマホのE2Eは13件成功後、地図読み込み待ちと再生テストの時刻制御を調整し、該当4件を再実行して全件成功（全16シナリオを確認）。PC／スマホの地図・アルバム・拡大ビューを画像でも確認しました。本番の外部サービス接続・デプロイは今回行っていません。

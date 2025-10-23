# プロジェクト構成メモ（2024-10-08 時点）

## ルートディレクトリ
- `package.json` / `package-lock.json`  
  - ルート全体の npm 設定。`build:functions`（Functions 用 TypeScript ビルド）と `test`（Vitest）を定義。
  - `test:integration` で Firebase Emulator Suite を起動しつつ Vitest 統合テストを実行。
- `tsconfig.json`  
  - ドメイン層向け TypeScript 設定。`@domain/*` エイリアスで `packages/domain/src` を参照。
- `vitest.config.ts`  
  - ドメイン層テスト用の Vitest 設定。
- `KiraraAcademy_*`.md  
  - ゲーム仕様・設計・実装方針のドキュメント。
- `docs/emulator_requests.md`  
  - Functions エミュレーター向け `curl` サンプル集。
- `firebase.json` / `.firebaserc`  
  - Firebase プロジェクト設定とエミュレーター設定（Functions=127.0.0.1:5002、Firestore=127.0.0.1:8085、UI=127.0.0.1:4001）。
- `firestore.rules` / `firestore.indexes.json`  
  - Firestore セキュリティルールとインデックス定義（`firebase init firestore` により生成）。
- `firebase-debug.log` / `firestore-debug.log`  
  - エミュレーター実行時のログ（調査用）。

## apps/web
- Next.js ベースのデバッグ UI。`createSessionClient` と `FunctionsGateway` を用いてルーム状態を操作できる。
- `src/hooks/useSessionClient.ts` で React 用の接続フックを提供し、`src/app/page.tsx` が UI 実装例。
- `.env.local.example` に Functions Base URL のテンプレートを定義。
- `npm run dev` でローカルサーバーを起動。

## packages/domain
### `packages/domain/src`
- `types.ts`  
  - ドメインで共有するインターフェース/型定義（`GameState`, `PlayerAction`, `Ruleset` など）。
- `phaseManager.ts`  
  - フェーズ遷移ロジック。ラウンド開始準備、メインフェーズ処理、最終得点計算を担当。
- `turnOrder.ts`  
  - 手番管理クラス。パス／根回し処理や次手番算出を実装。
- `actionHandlers.ts`  
  - 各アクション（ラボ起動、レンズ起動、移動、意思、課題、パス等）の検証・適用ロジック。
- `actionResolver.ts`  
  - ハンドラーの登録・ディスパッチを担当。アクション結果のエラーハンドリングもここで集約。
- `gameSession.ts`  
  - `GameSessionImpl`。PhaseManager・TurnOrder を連携させ、アクション処理やログ出力を調整。
- `firestoreAdapter.ts`  
  - Firestore との橋渡しインターフェースと実装。`FirestoreLike` 抽象化でテストを容易にする構成。
- `roomService.ts`  
  - ルームの作成/参加/離脱とターン順ランダム化を Firestore 経由で行うサービス。
- `triggerEngine.ts`  
  - キャラクターのトリガー効果を集約・評価するユーティリティ。
- `sessionStore.ts`  
  - セッション状態を保持するインメモリ実装（`InMemorySessionStore`、`GameStatePatch`）。

### `packages/domain/test`
- `actionHandlers.test.ts` / `phaseManager.test.ts`  
  - アクション処理やフェーズ遷移の単体テスト。Vitest 用。

### `tests/integration`
- `roomFlow.test.ts`  
  - Firebase Emulator Suite（Functions + Firestore）と連携した統合テスト。ルーム作成→参加→アクション実行までを HTTP 経由で検証。

## functions
### 設定ファイル
- `functions/package.json`  
  - Functions 専用の npm 設定。`build`・`clean` スクリプトや `firebase-admin`, `firebase-functions` 依存を定義。
- `functions/tsconfig.json`  
  - Functions ビルド用 TypeScript 設定。`module: "CommonJS"`、`outDir: lib`。

### ソース (`functions/src`)
- `handlers.ts`  
  - RoomService に基づくハンドラー生成関数。HTTP ラッパーから共通ロジックを呼び出す。
- `invokeHandlers.ts`  
  - Firebase HTTPS 関数用ラッパー。`onRequest` で HTTP エンドポイント化。
- `index.ts`  
  - Functions エントリポイント。Firebase Admin 初期化、FirestoreAdapter→RoomService→GameSession の依存構築、デフォルト Ruleset や `createGameSession` ヘルパーを定義し、`exports.createRoom` 等を公開。

### ビルド成果物 (`functions/lib`)
- `functions/lib/functions/src/*.js`  
  - 上記 TypeScript のトランスパイル結果（CommonJS）。Firebase CLI がこの出力を読み込む。
- `functions/lib/packages/domain/...`  
  - ドメイン層のトランスパイル結果（Functions ビルド時に併せて生成）。

## その他
- `node_modules/`  
  - ルート依存（ドメイン層、Vitest 等）。
- `functions/node_modules/`  
  - Functions 専用依存（Firebase Admin / Functions SDK）。

---

このファイルはローカル環境の進行状況を記録するためのメモです。最新の構造を反映する場合は `npm run clean && npm run build:functions` 後に手動で更新してください。

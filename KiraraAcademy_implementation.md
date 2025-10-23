# Kirara Academy 実装メモ

## TypeScriptドメインインターフェース方針
- 共通型ファイル `packages/domain/src/types.ts` を想定し、サーバー/クライアントで共有。
- **GameSession**
  ```ts
  interface GameSession {
    roomId: string;
    currentRound: number;
    currentPhase: GamePhase;
    start(): Promise<void>;
    advancePhase(): Promise<void>;
    endRoundIfNeeded(): Promise<void>;
  }
  ```
- **PhaseManager**
  ```ts
  interface PhaseManager {
    preparePhase(state: MutableGameState): Promise<void>;
    mainPhase(state: MutableGameState): Promise<void>;
    endPhase(state: MutableGameState): Promise<void>;
    finalScoring(state: MutableGameState): Promise<void>;
  }
  ```
- **TurnOrder**
  ```ts
  interface TurnOrder {
    setInitialOrder(order: PlayerId[]): void;
    current(): PlayerId;
    nextPlayer(): PlayerId | null;
    markPass(playerId: PlayerId): void;
    registerRooting(playerId: PlayerId): void;
    hasAllPassed(): boolean;
  }
  ```
- **ActionResolver**
  ```ts
  interface ActionResolver {
    resolve(action: PlayerAction, context: ActionContext): Promise<ActionResult>;
  }
  ```
- **State モデル**
  ```ts
  interface PlayerState { /* Player 資源・VP 等 */ }
  interface BoardState { /* 研究日誌・ロビー配置 */ }
  interface GameState {
    players: Record<PlayerId, PlayerState>;
    board: BoardState;
    logs: ActionLogEntry[];
    snapshotId?: string;
  }
  ```
- 実装 (`GameSessionImpl` など) は `packages/domain/src/` 配下に配置し、Vercel Serverless Functions と Next.js 双方から import。
- Firestore 入出力は `FirestoreAdapters` で分離し、ドメイン層を純粋ロジックとして保つ。

## Firestoreセキュリティルール草案
- ルールファイルは `firebase/firestore.rules`。`rules_version = '2';`。
- 共通関数
  - `isAuthenticated()` : `request.auth != null`
  - `isRoomMember(roomId)` : 認証済みかつ `rooms/{roomId}/players/{uid}` が存在
  - `isHost(roomDoc)` : `roomDoc.data.hostId == request.auth.uid`
  - `allowServerWrite()` : `request.auth.token.admin == true`（管理者ロールが必要な場合。通常は Vercel 側から Admin SDK で書き込み、ルールをバイパス）
- `rooms`
  - 読み取り: `allow read: if isRoomMember(roomId);`
  - 作成: 認証済みユーザーのみ。`hostId == uid` を検証。
  - 更新/削除: Vercel 側の API かホストのみ許可。
- `players`
  - 読み取り: ルーム参加者。
  - 書き込み: 自分の `displayName` 等最小限のみ直接許可。その他はサーバー API 経由。
- `board` / `logs` / `snapshots` / `settings`
  - 読み取り: ルーム参加者。
  - 書き込み: サーバー API のみ（クライアントからは不可）。
- 公開ルーム一覧（`rooms_public` など）は `allow read: if true;` として必要情報のみ露出。
- CI で emulator によるルールテスト、デプロイは `firebase deploy --only firestore:rules`。

## Vercel Serverless API 雛形構成
- `functions/` ディレクトリのロジックは Vercel の `api/`（Edge/Node runtime）へ順次移行する。
- エンドポイントの想定
  - `POST /api/createRoom`
  - `POST /api/performAction`
  - `POST /api/updateTurnOrder`
  - `POST /api/selectCharacter`
  - `POST /api/listDevelopmentCards`
- 実装方針
  - 各ハンドラー内で `firebase-admin` を初期化し、FirestoreAdapter／RoomService を呼び出す。
  - 認証は当面シンプルな API キー（ヘッダ）で管理し、将来的に Firebase Auth 等へ置き換える。
  - 共通コード（ドメイン層）は `packages/domain` から import。
- ローカルでは `vercel dev` または `pnpm vercel dev` と Firebase emulator を併用して検証。
- デプロイは `vercel --prod`（無料 Hobby プラン想定）。


## 実装進捗メモ
- `packages/domain/src/types.ts` を作成し、GameSession/PhaseManager/TurnOrder/ActionResolver を含む共有インターフェースとドメインモデル型を定義。
- `packages/domain/src/gameSession.ts`: `GameSessionImpl` を追加。PhaseManager と TurnOrder を注入し、フェーズ進行とラウンド終了判定の骨組みを実装。
- `packages/domain/src/turnOrder.ts`: `TurnOrderImpl` を追加。手番順列の管理、パス処理、根回しホルダ、次ラウンド開始プレイヤー決定を実装。
- `packages/domain/src/phaseManager.ts`: `PhaseManagerImpl` を追加。TurnOrder を利用しフェーズ遷移の更新と今後実装予定の処理ポイントをスタブ化。
- `packages/domain/src/actionResolver.ts`: `ActionResolverImpl` を追加。アクション種別に応じたハンドラー呼び出しとエラーハンドリングを集約。
- `packages/domain/src/firestoreAdapter.ts`: FirestoreAdapter インターフェースとスナップショットラッパを定義し、ドメイン層と永続化層の境界を整理。
- `packages/domain/src/actionHandlers.ts`: 各 ActionType 用のバリデータ／適用関数のプレースホルダと共通ハンドラー生成 util を追加。

## 行動コスト・初期配布確認メモ
- 行動コスト（`KiraraAcademy_summary.md:21`）
  - ラボ起動: 行動力1
  - レンズ起動: 行動力1
  - 移動: 行動力2
  - 再起動: 行動力3
  - 収集: 行動力2
  - 意思: キャラクター固有の創造力等コスト
  - 課題達成: コストなし
- 初期配布（`KiraraAcademy_summary.md:32`）
  - 光/虹/淀み 各2個、行動力2、創造力0
  - カラートークン: ストック4、ロビー4、成長ツリー1、課題3（計12）
- リソース上限（`KiraraAcademy_design.md:270`）
  - デフォルト上限は暫定値 6 とし、最終値は `ruleset` 定義で確定する
  - キャラ効果で解除された上限はラウンド終了後も維持
- 特殊能力例（`KiraraAcademy_design.md:137` 等）
  - 黄昏灯純⑦: 【意思】創造-2 でロビー1体生成＆手元資源上限解除
- `packages/domain/src/types.ts`: `LabId` と `LabDefinition` を追加し、`Ruleset.labs` を定義。
- `packages/domain/src/actionHandlers.ts`:
  - ラボ起動の検証/効果を実装し、行動力消費・資源上限チェック・報酬適用を処理。
  - レンズ起動の検証/効果を実装し、資源/創造力消費、ロビー利用判定、レンズの使用済み化を追加。
  - 共通ユーティリティ（資源容量判定、報酬適用、コスト支払い）を拡充。
- `packages/domain/src/actionHandlers.ts`:
  - 移動（move）: 行動力2消費、他者レンズへのロビー空きチェック、占有処理を実装。
  - 再起動（refresh）: 行動力3、所有レンズのみ、使用済み状態から available へ戻す処理を実装。
  - 収集（collect）: 行動力2、公開開発カードのスロット判定と山札補充処理を追加。
  - 意思（will）/課題（task）: ルール検証の骨組みと報酬付与を追加（詳細は後続実装予定）。
## テスト方針メモ
- ドメイン層は Vitest を想定し、`packages/domain/test` に各アクションの単体テストを配置予定。
- ハンドラー単位で行動力消費・資源減算・上限チェック・デッキ補充などを検証するケースを用意する。
- ルールセットのスタブデータをテスト用に軽量 JSON で作成し、CI で再利用する。
- `packages/domain/src/actionResolver.ts`: `createDefaultActionResolver` で各アクションハンドラーを登録し、初期化用ヘルパーを追加。
- `packages/domain/src/phaseManager.ts`: 準備フェーズで行動力初期化・公開列補充・ロビーリセットを実装し、簡易的なターン順決定と終了フェーズの補充処理を追加（ルールセット連携は TODO）。
- `packages/domain/src/phaseManager.ts`: ルールセットから初期行動力と公開スロット数を受け取れるようにし、根回し（isRooting）/最初にパスしたプレイヤーに基づくターン順決定を追加。
- `packages/domain/src/types.ts`: `PlayerState` に `isRooting` フラグを追加し、根回し状態を明示的に管理。
- `packages/domain/src/phaseManager.ts`: 根回しフラグ優先でターン順を計算し、各ラウンド開始時に `isRooting` をリセットするよう調整。
- `packages/domain/src/actionHandlers.ts`: 根回し（rooting）アクションを追加し、ラウンド内1回の制約・光+1付与・`isRooting` フラグ設定を実装。
- `packages/domain/src/actionResolver.ts`: `rooting` ハンドラーを `createDefaultActionResolver` に登録。
- `packages/domain/src/actionHandlers.ts`: パス（pass）アクションを追加し、TurnOrder への通知と `currentPlayerId` 更新処理を実装。
- `packages/domain/src/actionResolver.ts`: `pass` ハンドラーを登録。
- `packages/domain/src/phaseManager.ts`: 準備フェーズ前に開発カードデッキ初期化フックを呼び出し、外部ソースからデッキを差し込めるようにした。
- `functions/src/developmentDeckLoader.ts` / `functions/src/index.ts`: `card_foundation/cards_normal` の Firestore ドキュメントからカードID一覧を取得し、5分キャッシュのテンプレートをシャッフルしてデッキを生成。

## 次の作業候補
1. ~~`ActionResolver` 呼び出し元で `turnOrder` を渡すよう整備し、pass/rooting 処理をゲームループに組み込む。~~
2. `PhaseManagerImpl` の TODO（リソース補充、最終得点計算）をルールセットに基づいて具体化する。
3. `ruleset` 用のスタブデータと Vitest による単体テストを用意し、アクションハンドラーの挙動を検証する。
4. FirestoreAdapter の実装および Vercel Serverless Functions（Firebase Admin SDK 経由）との接続コードを作成し、オンライン同期の土台を整備する。
- `packages/domain/src/gameSession.ts`: `processAction` を追加し、`ActionResolver` を注入して `turnOrder` を含むコンテキストでアクションを解決・保存できるようにした。
- `packages/domain/src/gameSession.ts`: ラウンド終了時に最大ラウンド（デフォルト4）へ到達したら `PhaseManager.finalScoring` を呼び、`currentPhase` を `finalScoring` に設定するよう調整。
- ルートに `package.json`/`tsconfig.json`/`vitest.config.ts` を整備し、`@domain/*` エイリアスと Vitest 実行環境を用意。
- `packages/domain/test/actionHandlers.test.ts`: 根回し・パス・ラボ起動の振る舞いを検証する初期テストを追加（依存パッケージは後で `npm install` が必要）。
- `packages/domain/src/phaseManager.ts`: メインフェーズ開始時に TurnOrder の現在プレイヤーを `currentPlayerId` に設定し、全プレイヤーの `hasPassed` をリセットするように変更。
- `packages/domain/src/phaseManager.ts`: 最終得点で資源換算後に淀みトークン1つあたり-2VP（設定可）を適用し、テストを追加。
- `packages/domain/src/types.ts`: プレイヤーの成長進捗 (`unlockedCharacterNodes`) とエンドゲーム効果ペイロードを定義。
- `packages/domain/src/phaseManager.ts`: キャラクターのエンドゲーム効果（定義済ノード）を反映する処理を追加し、対応テストを作成。
- `packages/domain/src/actionHandlers.ts`: 意思 (`will`) のコスト・報酬処理を実装し、容量解除など一部効果に対応。テストを追加。
- `packages/domain/src/actionHandlers.ts`: `growth` リワードで成長ノード解放やVP付与を処理し、意思テストを更新。
- `packages/domain/src/triggerEngine.ts`: キャラが保持するトリガー効果を評価する仕組みを追加し、レンズ起動・収集・スロット空きイベントでVP加算を実装。
- `packages/domain/src/actionHandlers.ts`: レンズ起動／収集／意思発動時にトリガーイベントを発火させ、対応テストを追加。
- `packages/domain/src/firestoreAdapter.ts`: Firebase SDK に依存しない `FirestoreLike` インターフェースで GameState 保存とログ書き込みを実装。
- `packages/domain/src/roomService.ts`: ルーム作成/参加/離脱とランダムなターン順決定を FirestoreAdapter 経由で行うサービスを追加。
- `packages/domain/src/sessionStore.ts`: セッション状態をローカルに保持する `SessionStore` インターフェースとインメモリ実装を追加。
- `functions/src/index.ts`: RoomService と GameSession を組み合わせたハンドラー群を提供し、将来的な Vercel Serverless への移行元として利用。
- `functions/src/invokeHandlers.ts`: 既存の Firebase Functions v2 エントリポイント（エミュレーター動作確認用）を維持。
- `firebase.json` / `.firebaserc`: Firebase プロジェクト設定を追加し、Firestore 用の接続情報のみ管理。
- `functions/src/index.ts`: `listDevelopmentCards` エンドポイントを追加し、Firestore の `cards_normal` からカードメタデータを取得してクライアントへ返却。

### Firestore 開発カードテンプレートメモ
- パス: `card_foundation/cards_normal`。`cards` / `cardIds` / `deck` のいずれかにカードID配列、もしくは `{ id, count }` オブジェクト配列、または `{ cardId: string, count: number }` 形式のマップを格納する。
- Functions 起動時に 5 分キャッシュでテンプレートを読み込み、ゲーム開始フェーズでシャッフルした一覧を `GameState.developmentDeck` に設定。公開列は `PhaseManager.preparePhase` の補充処理で自動的に 8 枚まで配られる。
- Firestore を直接更新する場合は `gcloud auth print-access-token` でトークンを取得し、`curl -X PATCH "https://firestore.googleapis.com/v1/projects/bgsample-b0ab4/databases/(default)/documents/card_foundation/cards_normal?updateMask.fieldPaths=cards"` のように REST API で反映するか、Console から編集する。
- フロントエンドの `apps/web/src/app/play/page.tsx` は `FunctionsGateway.listDevelopmentCards()` を呼び、`cards_normal` に格納した `cardId` / `cost_*` / `extras` 情報をもとに公開開発カードの表示を組み立てる。

## 作業状況サマリー
- FirestoreAdapterImpl / RoomService / SessionStore まで実装し、Functions 側のエントリポイントを整備済み。
- アクションハンドラーはラボ起動～意思・トリガー処理を網羅し、テストがグリーン。ランダム手番やログ出力の仕組みも追加済み。
- 未実装: Vercel デプロイ用ビルド設定、Firebase Admin SDK 用のサービスアカウント管理、フロントエンドと Vercel API の接続確認。

### セッション復帰ガイド
- `functions/src/index.ts` に `getRoomState` を追加し、HTTP 経由で最新 `GameState` を取得可能にした。
- フロント層は `packages/domain/src/client/functionsGateway.ts` を利用して Functions 群を呼び出す。`baseUrl` はエミュレーター（例: `http://127.0.0.1:5003/bgsample-b0ab4/us-central1`）や本番エンドポイントに合わせて設定。
- `packages/domain/src/client/sessionManager.ts` は `SessionStore<GameState>` と `fetchLatestState(roomId)` を受け取り、キャッシュ済みスナップショットの取得／リフレッシュ／パッチ適用を支援する。
- 初回ロード手順例: `SessionManager.getOrLoad(roomId)` → ストアにキャッシュ → 画面へ反映。アクション解決後は `SessionManager.replaceSnapshot(updatedState)` を呼び、再接続時は `getOrLoad` で即座に復元。
- `packages/domain/src/client/sessionController.ts` を追加。`initialize` / `refresh` / `performAction` とリスナー通知をまとめたフロント用窓口として利用できる。
- `packages/domain/src/client/sessionClient.ts` で `createSessionClient` を提供し、`SessionController` 周りの初期化を一括化。利用手順は `docs/frontend_integration.md` を参照。
- `apps/web/src/hooks/useSessionClient.ts` で React 向けのカスタムフックを用意し、Next.js ページから接続・アクション送信を呼び出しやすく整理。

### テストコマンド
- ユニットテスト: `npm test`（Vitest、ドメイン層テストのみ実行）
- 統合テスト: `npm run test:integration`（エミュレーター起動 + `VITEST_INCLUDE_INTEGRATION=true` で HTTP 経路を検証）

## 次のステップ
1. フロントエンド側の状態管理に `SessionManager` を組み込み、UI へキャッシュ済み GameState を反映するフローを整備。
2. リアルタイム更新の検討（例: Firestore リスナーやポーリング）と、`SessionManager.refresh` を使った差分反映の実装。
3. Vercel に `listDevelopmentCards` / `performAction` などのサーバーサイド API を移行・デプロイし、環境変数で `FunctionsGateway` の `baseUrl` を切り替えられるように仕組み化。

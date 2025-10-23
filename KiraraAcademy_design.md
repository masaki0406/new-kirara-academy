# KiraraAcademy_基本設計書_詳細版 — Markdown出力

_元ファイル: KiraraAcademy_基本設計書_詳細版 (1)_更新済_機能修正済.xlsx_



# 1_概要

| 項目       | 内容                   |
|:-----------|:-----------------------|
| タイトル   | Kirara Academy（仮）   |
| ジャンル   | デジタルボードゲーム   |
| 目的       | VPを稼いで卒業を目指す |
| 対象年齢   | 10歳以上               |
| プレイ人数 | 2～6人                 |
| プレイ時間 | 約60分                 |



# 2_コンポーネント

| 名称                                                   | 個数                     | 説明                                                                 |
|:-------------------------------------------------------|:-------------------------|:---------------------------------------------------------------------|
| キャラクターカード                                     | 6枚                      | 各プレイヤーが使用する成長ツリー付きのキャラカード                   |
| 色付き六角形トークン（カラートークン／ロビーマーカー） | 各色12個 × 6色（計72個） | 使用用途によって名前が変わる共通トークン。起動用または報酬として使用 |
| レンズカード                                           | 多数（20～30枚以上）     | 資源を消費して生成、VPや資源を得るカード                             |
| 開発カード                                             | 47枚                     | 資源を得たりVPを獲得するためのカード、主に収集アクションで獲得       |
| 点数表（スコアシート）                                 | 1枚                      | VPを記録するためのスコア記録シート                                   |
| 共通ボード（研究日誌）                                 | 1枚                      | 生成したレンズを配置する共通ボード。他人のレンズも起動可能           |
| ラボ案内図                                             | 1枚                      | ラボの効果や報酬、課題達成条件などが記載された案内図                 |
| 光トークン（アイコンチップ）                           | 25個                     | ラボ起動やレンズ生成などで使用する光資源トークン                     |
| 虹トークン（アイコンチップ）                           | 20個                     | 特定の成長やレンズで使用される希少資源トークン                       |
| 淀みトークン（アイコンチップ）                         | 20個                     | 課題などで使用される特殊資源。扱いが難しいものとして描写             |
| 成長マーカー                                           | 各1個（プレイヤー数分）  | キャラの成長状況を記録するマーカー。ツリーに配置する                 |
| 学生手帳カード（未使用）                               | 16枚                     | ゲームでは使用しない、装飾／世界観演出用カード                       |



# 3_プレイヤー行動

| アクション名   | コスト     | 効果                       |
|:---------------|:-----------|:---------------------------|
| ラボ起動       | 1 行動力   | 光・創造などの資源を得る   |
| レンズ起動     | 1 行動力   | 資源を消費してVP・成長     |
| 移動           | 2 行動力   | 他人のロビーを利用して起動 |
| 再起動         | 3 行動力   | 既に使ったレンズを再度起動 |
| 収集           | 2 行動力   | 開発カードを入手する       |
| 意見           | 条件により | 能力を発動（例：収集+1）   |
| 課題達成       | なし       | 条件達成で報酬を得る       |



# 4_ゲームの流れ

| フェーズ       | 内容                                                                                                |
|:---------------|:----------------------------------------------------------------------------------------------------|
| 準備フェーズ   | ・キャラクターを選択し、各自キャラボードを受け取る                                                  |
|                | ・初期資源として光・虹・淀みトークンを各2個、行動力2、創造力0を所持                                 |
|                | ・カラートークン：ストックに4つ、ロビー置き場に4つ、成長ツリーに1つ、課題に3つ配置                  |
|                | ・開発カードを山札にして研究日誌に配置、さらに山札の周囲に8枚めくって置く                           |
| メインフェーズ | ・時計回りに各プレイヤーが1アクションずつ実行                                                       |
|                | 　（ラボ起動、レンズ起動、説得、意思、課題達成）                                                    |
|                | ・行動後は未行動ロビーを配置またはリソース取得などの処理                                            |
|                | ・最初にパスしたプレイヤーが次のスタートプレイヤーになる                                            |
|                | 　※ただし、根回しを行ったプレイヤーがいる場合はそのプレイヤーが次ラウンドのスタートプレイヤーとなる |
| 終了フェーズ   | ・ラボに置かれたロビーを各自のロビー置き場に戻す                                                    |
|                | ・レンズ上に置かれているロビーはそのままにし、状態を未行動に戻す                                    |
|                | ・その他必要に応じてカードの補充等を行い、次ラウンドの準備を整える                                  |
| ゲーム終了     | ・4ラウンド終了後、VPを集計し、最も多くのVPを獲得したプレイヤーが勝利                               |



# 5_キャラクター

| キャラ名   | 初期能力                                    | 成長能力（例）                                                                                  |
|:-----------|:--------------------------------------------|:------------------------------------------------------------------------------------------------|
| 例：白神幽 | 創造+1、光+1                                | レンズ生成で+4VP / ゲーム終了時光+10 = +10VP など                                               |
| 白神幽     | 創造+0、光+0、行動力2、虹+2、淀み+2（共通） | S: ゲーム終了時-10VP → ①: ゲーム終了時-5VP → ③: 自分のレンズが起動されるたびに+3VP              |
|            |                                             | S → ②: 自レンズ起動時、素材と報酬が一致しなければ+2VP → ⑥: 【意思】創造-3で+13VP                |
|            |                                             | ①または③ → ④: ゲーム終了時-10VP → ⑤: 他プレイヤー全員の光・虹を1つずつ奪い、ロビーを1体戻させる |
|            |                                             | ③ → ⑦: ゲーム終了時、ロビー1体につき+3VP                                                        |
|            |                                             | ③または④ → ⑧: 光・虹を1つも持っていなければ+20VP                                                |
|            |                                             | ⑦または⑧ → ⑨: マイナス換算されるVPをすべてプラス換算にする                                      |



# 6_リソース

| 名称       | 使い道                   |
|:-----------|:-------------------------|
| 光         | レンズで消費しVP獲得     |
| 創造       | レンズや意見で使用       |
| 意見       | 能力の発動に使用         |
| 気合       | 主に起動時の効果で獲得   |
| レインボー | レア資源、課題達成に必要 |



# 7_データ構造

| エンティティ   | 属性                                                   |
|:---------------|:-------------------------------------------------------|
| Player         | id, name, actions, resources, lobbyTokens, growthTrack |
| Lens           | id, cost, result, createdBy                            |
| Resource       | light, creation, opinion, spirit, rainbow              |
| Character      | id, name, growthTree, abilities                        |
| Room           | id, players[], turnOrder, round                        |



# 5_キャラクター成長詳細

| キャラ名   | 成長段階   | 効果                                                                   | 分岐                    | 条件・備考                                   |
|:-----------|:-----------|:-----------------------------------------------------------------------|:------------------------|:---------------------------------------------|
| 白神幽     | S（開始）  | ゲーム終了時に−10VP、【意思】創造力-2 淀み+1 光+1 虹+1                 | 起点                    | マイナス効果（このままだと損）＋意思起動効果 |
| 白神幽     | ①          | ゲーム終了時に−5VP                                                     | Sから                   | 少し軽減（完全な補填ではない）               |
| 白神幽     | ②          | 自分のレンズを自分で起動し、素材と報酬が一致しない場合+2VP             | Sから右へ               | 資源増加の即時効果（意思使用）               |
| 白神幽     | ③          | 自分のレンズが他者に起動されるたびに+3VP                               | ②から下へ               | 条件達成時のVP加算（持続効果）               |
| 白神幽     | ④          | ゲーム終了時に−10VP                                                    | ①または③から下へ        | 追加のペナルティ                             |
| 白神幽     | ⑤          | 他プレイヤー全員から光1・虹1を奪い、ロビー1体を戻させる                | ④から下へ               | 強制妨害／即時効果                           |
| 白神幽     | ⑥          | 【意思】創造-3で+13VP                                                  | ②から下へ               | 重めのコストで高得点                         |
| 白神幽     | ⑦          | ゲーム終了時にロビー1体につき+3VP                                      | ③から右へ               | ロビー活用の最大化                           |
| 白神幽     | ⑧          | 光・虹を持っていなければ+20VP                                          | ③または④から下へ        | 資源保持ゼロが条件のリスク報酬               |
| 白神幽     | ⑨          | ゲーム終了時にマイナス換算VPをすべてプラス換算にする                   | ⑦または⑧から下へ        | 負のスコアを正に変換（超強力）               |
| 橙堂アキラ | S          | 他人のレンズを起動するたびに+2VP                                       | 起点                    | 継続効果でVP獲得のチャンスを増やす           |
| 橙堂アキラ | ①          | 説得に必要な行動力-1                                                   | Sから下へ               | 説得アクションを強化                         |
| 橙堂アキラ | ②          | もう成長できない。ゲーム終了時に+10VP                                  | Sから右へ               | 打ち止め効果と終了時ボーナス                 |
| 橙堂アキラ | ③          | 他人が自分に説得を行うたびに+2VP、淀み+1                               | Sから右下へ             | 受け身の説得でも得点機会に                   |
| 橙堂アキラ | ④          | なにもなし                                                             | ①または③または⑤から下へ | 分岐接続用（効果なし）                       |
| 橙堂アキラ | ⑤          | 自分が他人に説得を行うたびに+2VP                                       | ①または③から下へ        | 能動的な説得でVP獲得                         |
| 橙堂アキラ | ⑥          | なにもなし                                                             | ④から下へ               | 分岐接続用（効果なし）                       |
| 橙堂アキラ | ⑦          | 【意思】創造-1、他人のレンズに限り説得または再起動を1回行う            | ④または⑤から下へ        | 相手のレンズに追加アクションが可能           |
| 橙堂アキラ | ⑧          | なにもしない                                                           | ⑥から下へ               | ただの接続（効果なし）                       |
| 橙堂アキラ | ⑨          | ゲーム終了時にVPが1.5倍になる（端数切り上げ）                          | ⑧から下へ               | 終了時にVP大幅強化                           |
| 黄昏灯純   | S          | ロビー生成時に淀み-1光+1か、光-1虹+1を選べる。【意思】創造-2成長       | 起点                    |                                              |
| 黄昏灯純   | ①          | 各ラウンド終了時、手元の淀み1個につきVP+1                              | Sから下                 |                                              |
| 黄昏灯純   | ②          | もう成長できない。ゲーム終了時に+10VP                                  | Sから右                 |                                              |
| 黄昏灯純   | ③          | 各ラウンド終了時、手元の光1個につきVP+1                                | Sから右下               |                                              |
| 黄昏灯純   | ④          | なにもなし                                                             | Sから右下               |                                              |
| 黄昏灯純   | ⑤          | 各ラウンド終了時、手元の虹1個につき+2VP                                | ①または③から下          |                                              |
| 黄昏灯純   | ⑥          | なにもなし                                                             | ①または③から下          |                                              |
| 黄昏灯純   | ⑦          | 【意思】創造-2：ロビーを1体未行動で生成、手元資源上限解除              | ④から下                 |                                              |
| 黄昏灯純   | ⑧          | なにもしない                                                           | ⑥から下                 |                                              |
| 黄昏灯純   | ⑨          | 各ラウンド終了時、他者より手持ちが少ない資源を渡しVP獲得（光+3、虹+5） | ⑧から下                 |                                              |
| 翠川燐名   | S          | 【意思】創造-1収集を１回行う                                           | 起点                    |                                              |
| 翠川燐名   | ①          | なにもなし                                                             | Sから下                 |                                              |
| 翠川燐名   | ②          | もう成長できない。ゲーム終了時に+10VP                                  | Sから右                 |                                              |
| 翠川燐名   | ③          | コスト3以上のレンズ起動時（自他問わず）+3VP                            | Sから右下               |                                              |
| 翠川燐名   | ④          | 【意思】創造-1 淀み+1〜+3、1個につき+2VP                               | Sから右下               |                                              |
| 翠川燐名   | ⑤          | レンズで淀みを得る／使うたび淀み1個につき+1VP                          | ①から下                 |                                              |
| 翠川燐名   | ⑥          | なにもなし                                                             | ③または④または⑤から下   |                                              |
| 翠川燐名   | ⑦          | なにもなし                                                             | ⑥または⑧から下          |                                              |
| 翠川燐名   | ⑧          | 自他問わず、4枠以上のレンズ起動時+4VP                                  | ⑥から下                 |                                              |
| 翠川燐名   | ⑨          | ゲーム終了時に自レンズを行動力不要で順に1回ずつ起動                    | ⑦から下                 |                                              |
| 青野春陽   | S          | 【意思】創造-1行動力+2                                                 | 起点                    |                                              |
| 青野春陽   | ①          | 自分が自分のレンズを起動するたびに+2VP                                 | Sから下                 |                                              |
| 青野春陽   | ②          | もう成長できない。ゲーム終了時に+10VP                                  | Sから右                 |                                              |
| 青野春陽   | ③          | 成長するたびに行動力+2                                                 | Sから右下               |                                              |
| 青野春陽   | ④          | なにもなし                                                             | ①または③から下          |                                              |
| 青野春陽   | ⑤          | 他人のレンズを起動できない。自分のレンズ起動で+2VP                     | ④から下                 |                                              |
| 青野春陽   | ⑥          | 光が得られるレンズ起動時：光+1 VP+2                                    | ④から下                 |                                              |
| 青野春陽   | ⑦          | 虹が得られるレンズ起動時：虹+1 VP+2                                    | ④から下                 |                                              |
| 青野春陽   | ⑧          | 得られるVPが1.5倍（端数切上）                                          | ⑥または⑦から下          |                                              |
| 青野春陽   | ⑨          | 自レンズの説得／再起動コスト0                                          | ⑥または⑦から下          |                                              |
| 青野春陽   | ⑩          | 自分のレンズを起動するたびに+2VP                                       | ⑤から下                 |                                              |
| 赤嶺ひより | S          | 【意思】創造-1光+1                                                     | 起点                    |                                              |
| 赤嶺ひより | ①          | レンズ完成時+4VP                                                       | Sから下                 |                                              |
| 赤嶺ひより | ②          | もう成長できない。ゲーム終了時に+10VP                                  | Sから右                 |                                              |
| 赤嶺ひより | ③          | 成長するたびに虹+1                                                     | Sから右下               |                                              |
| 赤嶺ひより | ④          | なにもなし                                                             | ①または③から下          |                                              |
| 赤嶺ひより | ⑤          | 光を消費するレンズ起動時+3VP                                           | ①または③から下          |                                              |
| 赤嶺ひより | ⑥          | なにもなし                                                             | ④から⑦下                |                                              |
| 赤嶺ひより | ⑦          | 虹を消費するレンズ起動時+4VP                                           | ④から下                 |                                              |
| 赤嶺ひより | ⑧          | ゲーム終了時に虹7個所持で+30VP                                         | ⑥から下                 |                                              |
| 赤嶺ひより | ⑨          | 【意思】創造-1：虹+1 or 行動済ロビーを1体生成                          | ⑤から下                 |                                              |



# 6_画面仕様・機能要件

| 画面                 | 機能                   | 詳細説明                                                                                                                           | 備考                                       |
|:---------------------|:-----------------------|:-----------------------------------------------------------------------------------------------------------------------------------|:-------------------------------------------|
| ゲーム開始画面       | 新規ゲーム作成ボタン   | プレイヤーが新しいゲームルームを作成できる                                                                                         | ホストがルーム名またはIDを共有             |
| 新規ゲーム作成後     | 順番決定               | ランダムまたはホストが手動で順番を決定                                                                                             | 自動決定と手動選択の切替ができるとよい     |
| キャラクター選択画面 | キャラ選択機能         | 選ばれたキャラは以後他プレイヤーが選べない                                                                                         | 選択済ステータスの視認が必要               |
| ゲーム画面           | ボード表示とプレイ     | 研究日誌（山札・カード）、ラボ案内図（トークン）、キャラクターボード、作成済レンズ、自分の手札を画面に表示。行動に応じて更新される | UIは領域ごとに分割し、状態更新と連動が必要 |
| オンライン同期       | 状態のリアルタイム同期 | 複数人が同時にプレイし、状態を同期する                                                                                             | Firebaseなどの導入を想定                   |
| ブラウザ更新耐性     | 状態復元               | ブラウザ更新や切断後に状態を復元できる                                                                                             | セッション管理・状態永続化が必要           |

## Firestore構成とセキュリティルール決定事項
- **rooms/{roomId}**: 状態、タイムスタンプ、ラウンド情報、ルーム設定を保持
  - `status`, `createdAt`, `startedAt`, `endedAt`, `currentRound`, `currentPhase`, `turnOrder`, `settings`
- **rooms/{roomId}/players/{playerId}**: プレイヤー固有データとリソースを格納
  - `displayName`, `characterId`, `isHost`, `isReady`, `actionPoints`, `resources`, `vp`, `hand`, `ownedLenses`
- **rooms/{roomId}/board**: 研究日誌やロビー配置、公開中の開発カードなど共有状態を管理
- **rooms/{roomId}/logs/{logId}**: アクション履歴（`timestamp`, `actorId`, `actionType`, `payload`）
- **rooms/{roomId}/snapshots/{snapshotId}**: 復帰用スナップショット（`createdAt`, `state`）を一定間隔で保存
- **rooms/{roomId}/settings**: UI から変更可能な詳細設定（タイマー、拡張ルールなど）
- **セキュリティルール方針**
  - 読み取りは参加済みプレイヤーに限定
  - 書き込みは原則 Cloud Functions 経由。クライアントからの直接書き込みは自身のプレイヤードキュメントに限定し、`request.auth.uid == playerId` を必須化
  - Functions 書き込みには管理クレームを付与し、`rooms/{roomId}` 配下更新時に検証処理を実施
  - スナップショットの書き込みは管理者のみ許可、クライアントは読み取りのみ
  - ルーム作成・設定変更は認証済みホスト（または管理者）のみに制限

## フェーズ遷移とラウンド管理決定事項
- **ラウンド数**: 基本ゲームは4ラウンド固定。エクストララウンドを導入する場合は別設定として扱う
- **フェーズ順**: `準備フェーズ → メインフェーズ → 終了フェーズ` を1ラウンドとし、最終ラウンド後に `最終得点集計` を実行
  - 準備フェーズ: 初期資源配布、開発カード公開、ロビー配置の初期化を実施
  - メインフェーズ: TurnOrder で管理される手番ループを実行。各プレイヤーは1手番1アクションを宣言し、ActionResolver が処理
  - 終了フェーズ: ロビーを未行動状態で戻し、開発カードやレンズの公開列を補充、次ラウンドの準備を行う
  - 最終得点集計: Player・CharacterProfile のボーナス計算、レンズ/課題のVP、残資源換算をまとめて処理
- **手番進行**: TurnOrder は現在プレイヤーを返し、手番終了後に `nextPlayer()` で次手番を計算
  - プレイヤーが「パス」を宣言すると `markPass()` でフラグ化し、そのラウンド中は以後行動不可
  - 「根回し」を行ったプレイヤーがいる場合、次ラウンド開始プレイヤーは根回しプレイヤー。いなければ最初にパスしたプレイヤーが次ラウンドの開始
- **ラウンド終了条件**: 全プレイヤーがパス状態になった時点でメインフェーズを終了。PhaseManager が終了フェーズ処理を起動し、終了処理後に Round カウンタを +1
- **タイムライン管理**: GameSession は `currentRound` と `currentPhase` を Firestore の `rooms/{roomId}` に保存し、クライアントがフェーズ遷移に追従できるようにする

## アクション解決仕様決定事項

### ActionType 定義
- `labActivate`: ラボ起動。行動力1でラボ案内図に従い資源・ボーナスを獲得
- `lensActivate`: レンズ起動。行動力1で対象レンズのコストを支払い、VPや成長などの効果を解決
- `move`: 移動。行動力2でロビーマーカーを他プレイヤーのロビーへ移し共有レンズを利用可能にする
- `refresh`: 再起動。行動力3で使用済みレンズを再度使用可能状態に戻す
- `collect`: 収集。行動力2で開発カードを獲得し公開列を補充
- `will`: 意思（キャラクター固有能力）。創造力などの条件を満たすと特殊効果を発動
- `task`: 課題達成。コストなしで条件達成を宣言し、課題報酬やVPを獲得
- `rooting`: 根回し。コストなしで光+1と次ラウンドの開始権を得る（ラウンドにつき1回）
- `pass`: パス。他プレイヤーに手番を移し、自身はそのラウンドで行動不可になる

- **入力フォーマット**: クライアントは `actionType`（例: `labActivate`, `lensActivate`, `move`, `refresh`, `collect`, `will`, `task`）と `payload` を Cloud Functions 経由で送信。`payload` にはターゲットID、コスト支払い選択、追加パラメータ（例: ロビー移動先）を含める
- **バリデーション基準**
  - 該当プレイヤーが手番中かを `TurnOrder` / `rooms/{roomId}` の `currentPlayerId` で検証
  - 必要行動力・資源 (`ResourceWallet`) を `canAfford` でチェックし、支払い可能な場合のみ処理続行
  - レンズや開発カードの操作時は `BoardState` / `CardInventory` でターゲットが利用可能か確認（使用済み状態、他プレイヤーロックなど）
  - 特殊効果やキャラ能力の追加リソース消費は `CharacterProfile` の定義に従って `EffectEngine` が判定
- **処理シーケンス**
  1. `ActionResolver.resolve` が入力を受領し、`validate<Action>` を通過させる
  2. 消費リソースや行動力を `Player` / `ResourceWallet` から減算
  3. `apply<Action>` で VP/資源/成長などのリワードを付与
  4. 追加トリガー（他プレイヤーの反応、キャラパッシブ）の発火を `EffectEngine` が処理
  5. 結果を `rooms/{roomId}/logs` と `rooms/{roomId}/board` / `players` に記録し、Firestore onSnapshot を通じてクライアントへ同期
- **エラー処理**: 検証に失敗した場合は Functions が `invalid-action` コードでレスポンスし、UI にリトライやエラーメッセージを返す
- **データ整合性**: すべての更新は Functions 内でトランザクションを使用し、同時アクセスでの二重消費や二重起動を防ぐ

## キャラクター・カード効果データスキーマ決定事項
- **キャラクター成長ツリー**
  - `CharacterProfile` は `characterId`, `name`, `nodes` を保有
  - `nodes` は `nodeId`, `position`（S/①/②などツリー内識別）, `cost`（創造力・資源など）, `effect`（パッシブ/アクティブの定義）, `prerequisites`（解放条件）を持つ
  - `effect` は `type`（`passive`/`active`/`endGame` 等）と `payload`（効果詳細）を JSON で表現
  - アクティブ能力（意思）は `payload.cost` と `payload.result` を持ち、ActionResolver の `will` で利用
- **レンズカード**
  - `Lens` データは `lensId`, `name`, `cost`（使用資源）, `slots`（起動時のロビースロット数）, `rewards`（VP・資源・成長など）, `tags`（光/虹/淀みなど属性）
  - `rewards` は `type` により `vp`, `resources`, `growth`, `triggers` を別フィールドで表現
  - 特殊条件は `conditions` に格納（例: 他プレイヤーが起動時に発動、光トークン消費必須など）
- **開発カード**
  - `DevelopmentCard` は `cardId`, `name`, `category`（獲得系/継続系/即時系など）, `cost`, `effect` を持つ
  - `effect` は `onCollect`, `onAction`, `ongoing` などフェーズ別に効果を分割し、EffectEngine が参照
- **課題定義**
  - `Task` データは `taskId`, `description`, `requirement`, `reward`, `isShared`（共有か個人か）を持ち、`ActionResolver` の `task` 処理で使用
- **データ保持場所**
  - これら定義は Firestore ではなく、バージョン管理された静的 JSON / TypeScript モジュールとしてホストし、デプロイ時に Functions/フロントへ同梱
  - 将来的なバランス調整はバージョン番号を付与して管理し、セッション開始時に `rulesetVersion` を `rooms/{roomId}` に記録

## 資源・キャパシティ管理ルール決定事項
- **基本リソース**: 光・虹・淀み。`Player` は `ResourceWallet` で保持し、`maxCapacity` を持つ
- **初期状態**: ゲーム開始時に光/虹/淀み各2個、行動力2、創造力0を配布。`rooms/{roomId}/players` に初期値を保存
- **リソース操作**
  - 増減処理はすべて `ResourceWallet.add/remove` を経由し、負数や上限超過は内部チェックで防止
  - キャパシティ解除はキャラクター効果やレンズ報酬で `ResourceWallet.setCapacityUnlimited(True)` を呼び、解除状態を Firestore に保持
- **トークン上限**
  - デフォルト上限は 6（例）など設定しておき、上限値はゲームバランスに応じて `ruleset` で定義
  - キャラ固有能力で解除された上限はラウンド終了時も維持
- **創造力・行動力**
  - 創造力は意思発動等のコストとして使用し、`Player.spendCreativity(amount)` を通じて変動
  - 行動力は毎ラウンド開始時にフェーズ処理で初期値へリセットし、TurnOrder で手番毎に減算
- **残資源換算**
  - ゲーム終了時の残資源 → VP 換算ルールを `ActionResolver.finalScoring`（または PhaseManager）で共通化。`ruleset` に換算表を定義

## UI画面遷移と同期ポリシー決定事項
- **画面遷移フロー**
  1. `StartScreen`（ルーム作成/参加）→ 2. `TurnOrderScreen`（順番決定）→ 3. `CharacterSelectScreen` → 4. `GameBoardScreen`（メインプレイ）
  5. `SummaryScreen`（最終結果）をラウンド終了後に表示
- **購読対象ドキュメント**
  - `StartScreen`: 公開ルーム一覧（必要なら `rooms` コレクションの一部のみ）と `rooms/{roomId}` の `status`/`settings`
  - `TurnOrderScreen`: `rooms/{roomId}` の `turnOrder`, `settings`, `players`
  - `CharacterSelectScreen`: `rooms/{roomId}/players` の `characterId` 状態
  - `GameBoardScreen`: `rooms/{roomId}`（ラウンド・フェーズ情報）、`players`, `board`, `logs` を onSnapshot 購読
  - `SummaryScreen`: `snapshots` から最終状態を読込み、`logs` でハイライト表示
- **アクション送信経路**
  - 各画面からの操作は Cloud Functions (`callable`) を介して送信し、ActionResolver が一元的に処理
  - UI 側の楽観更新は行わず、Firestore 更新を待って反映（ラグ許容）
- **切断復帰**
  - クライアントは再接続時に `rooms/{roomId}` を再購読し、`snapshots` の最新をロードしてローカル状態を復元
  - `SessionStore`（ローカルストレージ）に最後に見た `snapshotId` を保持し、差分同期を実装
- **UI 状態管理**
  - React + Zustand/Recoil で `GameState` をキャッシュ。onSnapshot で得た差分をマージし、ActionResolver 呼び出し時に一時的フラグ（送信中など）を設定

## TypeScriptドメインインターフェース方針
- 共通型ファイル `packages/domain/src/types.ts` を想定し、サーバー/クライアントで共有
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
- **Stateモデル**
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
- 具体実装 (`GameSessionImpl` 等) は `packages/domain/src/` 配下に配置し、Cloud Functions と Next.js 双方から import して利用
- Firestore ドキュメント入出力用に `FirestoreAdapters` を別ファイルで用意し、ドメインロジックから永続化層を切り離す

## Firestoreセキュリティルール草案
- ルールファイルは `firebase/firestore.rules` に配置し、`rules_version = '2';` を利用
- **共通関数**
  - `isAuthenticated()` : `request.auth != null`
  - `isRoomMember(roomId)` : `isAuthenticated()` かつ `exists(/databases/$(database)/documents/rooms/$(roomId)/players/$(request.auth.uid))`
  - `isHost(roomDoc)` : `roomDoc.data.hostId == request.auth.uid`
  - `allowFunctionsWrite()` : `request.auth.token.admin == true` （Functions からの書き込み）
- **rooms コレクション**
  - 読み取り: `allow read: if isRoomMember(roomId);`
  - 作成: `allow create: if isAuthenticated();` → ルール内で `request.resource.data.hostId == request.auth.uid` を検証
  - 更新/削除: `allow update, delete: if allowFunctionsWrite() || isHost(resource)`
- **players サブコレクション**
  - 読み取り: `allow read: if isRoomMember(roomId);`
  - 書き込み: `allow write: if request.auth.uid == playerId && request.resource.data.keys().hasOnly(['displayName'])` など自己プロフィール変更のみ許可
  - 全体更新は Functions 経由（`allowFunctionsWrite()`）で処理
- **board / logs / snapshots / settings**
  - 読み取り: `allow read: if isRoomMember(roomId);`
  - 書き込み: `allow write: if allowFunctionsWrite();`
- **公開ルーム一覧**
  - `rooms_public` コレクション等を別途用意し、`allow read: if true;` として最小限の情報のみ掲載
- デプロイ時は `firebase deploy --only firestore:rules` でルールを反映し、CIで `firebase emulators:exec` を用いたルールテストを実行

## Cloud Functions雛形構成方針
- プロジェクトルートに `functions/` ディレクトリを作成し、TypeScript 設定（`tsconfig.json`）と ESLint を導入
- エントリーファイル `functions/src/index.ts` で各 callable / firestore trigger をエクスポート
- **主要 callable**
  - `createRoom(data, context)` : ルーム作成と `rooms/{roomId}` 初期化、ホスト登録
  - `performAction(data, context)` : `PlayerAction` を受け取り、ドメインの `ActionResolver` を実行
  - `updateTurnOrder(data, context)` : 順番決定画面の結果を反映
  - `selectCharacter(data, context)` : キャラクター選択のロック処理
- **定期トリガー**
  - `onRoomWrite`（`functions.firestore.document('rooms/{roomId}').onWrite`）でゲーム終了検知・スナップショット保存を実行
  - `onPlayerWrite` で不正更新検知やログ蓄積を行う（必要に応じて）
- **モジュール構成**
  - `functions/src/app/` にドメインラッパ（`GameSessionService`）を配置し、Firestore アダプタ経由でデータ取得/更新
  - `functions/src/infra/` に `FirestoreAdapter`, `Logger`, `RulesetLoader` などの実装を分離
  - `functions/src/types/` で共有インターフェースを import (`packages/domain` から)
- **テスト**
  - `functions/test/` に Jest + firebase-functions-test で callable/trigger のユニットテストを用意
- デプロイは `firebase deploy --only functions`、ローカル実行は `firebase emulators:start --only functions,firestore`

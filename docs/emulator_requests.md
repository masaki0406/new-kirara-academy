# Firebase Emulator リクエストサンプル

ローカルで `npx firebase emulators:start --only functions,firestore` を起動した状態を前提に、HTTP 経由で各 Cloud Functions を叩くための `curl` サンプルをまとめています。`PROJECT_ID` には `.firebaserc` のデフォルトプロジェクト（例: `bgsample-b0ab4`）を用いてください。

## 1. ルーム作成
```bash
curl -X POST \
  http://127.0.0.1:5002/PROJECT_ID/us-central1/createRoom \
  -H "Content-Type: application/json" \
  -d '{
    "roomId": "room-1",
    "hostId": "host-1",
    "hostName": "Host Player"
  }'
```

## 2. プレイヤー参加
```bash
curl -X POST \
  http://127.0.0.1:5002/PROJECT_ID/us-central1/joinRoom \
  -H "Content-Type: application/json" \
  -d '{
    "roomId": "room-1",
    "playerId": "player-2",
    "playerName": "Player Two"
  }'
```

## 3. プレイヤー離脱
```bash
curl -X POST \
  http://127.0.0.1:5002/PROJECT_ID/us-central1/leaveRoom \
  -H "Content-Type: application/json" \
  -d '{
    "roomId": "room-1",
    "playerId": "player-2"
  }'
```

## 4. 手番ランダム化
```bash
curl -X POST \
  http://127.0.0.1:5002/PROJECT_ID/us-central1/randomizeTurnOrder \
  -H "Content-Type: application/json" \
  -d '{
    "roomId": "room-1"
  }'
```

## 5. アクション実行（例: pass）
```bash
curl -X POST \
  http://127.0.0.1:5002/PROJECT_ID/us-central1/performAction \
  -H "Content-Type: application/json" \
  -d '{
    "roomId": "room-1",
    "action": {
      "playerId": "host-1",
      "actionType": "pass",
      "payload": {}
    },
    "timestamp": 1728400000000
  }'
```

## 6. ルーム状態取得
```bash
curl -X POST \
  http://127.0.0.1:5002/PROJECT_ID/us-central1/getRoomState \
  -H "Content-Type: application/json" \
  -d '{
    "roomId": "room-1"
  }'
```

### 参考
- Firestore エミュレーター UI: http://127.0.0.1:4001/firestore  
- Functions エミュレーター UI: http://127.0.0.1:4001/functions

環境を再起動する際は、占有ポート（例: 5002/8085/4001）が残っていないか `lsof -i :PORT` で確認し、不要プロセスを終了してから `npx firebase emulators:start --only functions,firestore` を実行してください。

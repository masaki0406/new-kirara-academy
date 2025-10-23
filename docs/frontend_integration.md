# フロントエンド統合ガイド

`SessionController` と `createSessionClient` を用いることで、Firebase Functions を経由したゲーム状態の取得・更新を単純化できます。ここではローカルエミュレーター／本番環境双方での接続例を示します。  
実装例: `apps/web/src/hooks/useSessionClient.ts` / `apps/web/src/app/page.tsx`

## 1. クライアント初期化

```ts
import { createSessionClient } from '@domain/client/sessionClient';

const controller = createSessionClient({
  roomId: 'room-1',
  baseUrl: 'http://127.0.0.1:5003/bgsample-b0ab4/us-central1', // エミュレーター
});
```

プロダクションでは `https://us-central1-<project-id>.cloudfunctions.net` をベース URL とし、`fetchImpl` や `defaultHeaders` を必要に応じて差し替えてください。

## 2. 初期ロードとリスナー登録

```ts
controller.onStateChange((state) => {
  render(state); // 任意のレンダリング処理
});

await controller.initialize();
```

- すでに `SessionManager` にスナップショットがある場合はそれを返し、なければ `getRoomState` を呼びます。
- 失敗した場合は例外が投げられるので、UI 側でリトライ／エラー表示を実装してください。

## 3. アクション送信

```ts
await controller.performAction({
  playerId: currentPlayerId,
  actionType: 'pass',
  payload: {},
});
```

成功時には自動的に最新状態を取得し直し、登録済みリスナーへ通知します。エラー時は `ActionResult` 内の `errors` を参照してください。

## 4. 手動更新・クリーンアップ

- 再接続や定期更新では `await controller.refresh()` を呼び、最新のサーバー状態を強制的に取得できます。
- ルーム離脱時などは `await controller.clear()` でキャッシュを破棄します。

## 5. ストレージの差し替え

`createSessionClient` の `store` オプションに独自実装を渡すことで、`localStorage` や IndexedDB にスナップショットを保存できます。

```ts
const store = new LocalStorageSessionStore<GameState>('kirara-session');
const controller = createSessionClient({
  roomId,
  baseUrl,
  store,
});
```

`SessionStore` インターフェースは `packages/domain/src/sessionStore.ts` を参照してください。

---

開発中は `npm test`（ユニット）、`npm run test:integration`（エミュレーター経由）で動作確認ができます。 Functions 側へのデプロイ後も同じ API で利用可能です。

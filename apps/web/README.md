## Kirara Academy Web Console

`apps/web` は Firebase Functions を経由してゲームルームを操作できる Next.js アプリです。`@domain/client` の `createSessionClient` と `FunctionsGateway` を利用し、中断復帰やアクション送信をブラウザから確認できます。

## セットアップ

```bash
cd apps/web
cp .env.local.example .env.local
npm install
```

`.env.local` の `NEXT_PUBLIC_FUNCTIONS_BASE_URL` を、利用する環境（ローカルエミュレーター / 本番）に合わせて更新してください。

## 開発サーバー

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開くと、接続設定・ルーム操作・アクション送信・状態表示を行えるデバッグ UI が表示されます。

## ディレクトリ構成

- `src/app/page.tsx` - デバッグ UI のメイン画面。`SessionController` を通じて状態管理を行います。
- `src/hooks/useSessionClient.ts` - React から接続制御を扱うカスタムフック。
- `src/app/page.module.css` - 画面スタイル。
- `.env.local.example` - Functions Base URL のテンプレート。

## 関連ドキュメント

- ルート `docs/frontend_integration.md` に、`SessionController` / `createSessionClient` の使い方をまとめています。

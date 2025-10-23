"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { GameState, PlayerId } from "@domain/types";
import styles from "./page.module.css";
import {
  DEFAULT_FUNCTIONS_BASE_URL,
  useSession,
} from "../../context/SessionContext";

function deriveServerOrder(state: GameState): PlayerId[] {
  const players = Object.keys(state.players);
  const stored = Array.isArray(state.turnOrder) ? state.turnOrder : [];
  const seen = new Set<PlayerId>();
  const order: PlayerId[] = [];

  stored.forEach((playerId) => {
    if (players.includes(playerId) && !seen.has(playerId)) {
      order.push(playerId);
      seen.add(playerId);
    }
  });

  players.forEach((playerId) => {
    if (!seen.has(playerId)) {
      order.push(playerId);
    }
  });

  return order;
}

export default function TurnOrderPage(): JSX.Element {
  const searchParams = useSearchParams();
  const {
    baseUrl,
    setBaseUrl,
    roomId: sessionRoomId,
    setRoomId: setSessionRoomId,
    localPlayer,
    status,
    gameState,
    isConnected,
    connect,
    disconnect,
    refresh,
    randomizeTurnOrder,
    updateTurnOrder,
    beginCharacterSelection,
  } = useSession();

  const [baseUrlInput, setBaseUrlInput] = useState<string>(
    baseUrl || DEFAULT_FUNCTIONS_BASE_URL,
  );
  const [roomIdInput, setRoomIdInput] = useState<string>(sessionRoomId ?? "");
  const [localPlayerId, setLocalPlayerId] = useState<string>(
    localPlayer?.id ?? "",
  );
  const [draftOrder, setDraftOrder] = useState<PlayerId[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  const isBusy = status.type === "info";

  useEffect(() => {
    const queryBaseUrl = searchParams.get("baseUrl");
    const queryRoomId = searchParams.get("roomId");
    const queryPlayerId = searchParams.get("playerId");
    if (queryBaseUrl) {
      setBaseUrlInput(queryBaseUrl);
      setBaseUrl(queryBaseUrl);
    }
    if (queryRoomId) {
      setRoomIdInput(queryRoomId);
      setSessionRoomId(queryRoomId);
    }
    if (queryPlayerId) {
      setLocalPlayerId(queryPlayerId);
    } else if (localPlayer?.id) {
      setLocalPlayerId(localPlayer.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setBaseUrlInput(baseUrl || DEFAULT_FUNCTIONS_BASE_URL);
  }, [baseUrl]);

  useEffect(() => {
    if (sessionRoomId) {
      setRoomIdInput(sessionRoomId);
    }
  }, [sessionRoomId]);

  useEffect(() => {
    if (localPlayer?.id) {
      setLocalPlayerId(localPlayer.id);
    }
  }, [localPlayer?.id]);

  useEffect(() => {
    if (!gameState) {
      if (!isDirty) {
        setDraftOrder([]);
      }
      return;
    }

    const players = Object.keys(gameState.players);
    if (players.length === 0) {
      setDraftOrder([]);
      setIsDirty(false);
      return;
    }

    if (!isDirty) {
      setDraftOrder(deriveServerOrder(gameState));
      return;
    }

    setDraftOrder((current) => {
      const filtered = current.filter((playerId) =>
        players.includes(playerId),
      );
      players.forEach((playerId) => {
        if (!filtered.includes(playerId)) {
          filtered.push(playerId);
        }
      });
      return filtered;
    });
  }, [gameState, isDirty]);

  const orderedPlayers = useMemo(() => {
    if (!gameState) {
      return [];
    }
    const players = gameState.players;
    const order = draftOrder.filter((playerId) => players[playerId]);
    Object.keys(players).forEach((playerId) => {
      if (!order.includes(playerId)) {
        order.push(playerId);
      }
    });
    return order.map((playerId) => ({
      id: playerId,
      state: players[playerId],
    }));
  }, [draftOrder, gameState]);

  const lifecycleStage = gameState?.lifecycleStage ?? "lobby";
  const localPlayerIsHost = Boolean(
    localPlayerId && gameState?.players?.[localPlayerId]?.isHost,
  );
  const canBeginCharacterSelection =
    localPlayerIsHost && lifecycleStage === "lobby";
  const handleBeginCharacterSelection = useCallback(async () => {
    if (!localPlayerId) {
      return;
    }
    try {
      await beginCharacterSelection({ requesterId: localPlayerId });
    } catch (error) {
      console.error(error);
    }
  }, [beginCharacterSelection, localPlayerId]);
  const hasEnoughPlayers = orderedPlayers.length >= 2;

  const handleConnect = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmedBaseUrl = baseUrlInput.trim();
      const trimmedRoomId = roomIdInput.trim();
      if (!trimmedBaseUrl || !trimmedRoomId) {
        return;
      }
      try {
        setBaseUrl(trimmedBaseUrl);
        setSessionRoomId(trimmedRoomId);
        await connect({ baseUrl: trimmedBaseUrl, roomId: trimmedRoomId });
        setIsDirty(false);
      } catch (error) {
        console.error(error);
      }
    },
    [baseUrlInput, roomIdInput, connect, setBaseUrl, setSessionRoomId],
  );

  const handleDisconnect = useCallback(async () => {
    await disconnect();
    setDraftOrder([]);
    setIsDirty(false);
  }, [disconnect]);

  const handleMove = useCallback((playerId: PlayerId, offset: number) => {
    setDraftOrder((current) => {
      const index = current.indexOf(playerId);
      if (index === -1) {
        return current;
      }
      const nextIndex = index + offset;
      if (nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }
      const copy = [...current];
      [copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]];
      return copy;
    });
    setIsDirty(true);
  }, []);

  const handleRandomize = useCallback(async () => {
    try {
      const order = await randomizeTurnOrder();
      if (order.length > 0) {
        setDraftOrder(order);
      }
      setIsDirty(false);
    } catch (error) {
      console.error(error);
    }
  }, [randomizeTurnOrder]);

  const handleConfirm = useCallback(async () => {
    try {
      if (draftOrder.length === 0) {
        throw new Error("プレイヤーが設定されていません。");
      }
      await updateTurnOrder(draftOrder);
      setIsDirty(false);
    } catch (error) {
      console.error(error);
    }
  }, [draftOrder, updateTurnOrder]);

  const handleReset = useCallback(() => {
    if (gameState) {
      setDraftOrder(deriveServerOrder(gameState));
    } else {
      setDraftOrder([]);
    }
    setIsDirty(false);
  }, [gameState]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>手番順の決定</h1>
          <p className={styles.subtitle}>
            ルームに参加しているプレイヤーの順番を確認し、必要に応じてランダム化または手動で並び替えます。
          </p>
        </div>
        <Link href="/" className={styles.linkButton}>
          ルームロビーへ戻る
        </Link>
      </header>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>接続情報</h2>
        <p className={styles.cardDescription}>
          ルームの Functions エンドポイントと ID を入力し、接続してください。
        </p>
        <form className={styles.form} onSubmit={handleConnect}>
          <label className={styles.label}>
            <span>Functions Base URL</span>
            <input
              className={styles.input}
              value={baseUrlInput}
              onChange={(event) => setBaseUrlInput(event.target.value)}
              placeholder="http://127.0.0.1:5002/PROJECT_ID/us-central1"
            />
          </label>
          <label className={styles.label}>
            <span>Room ID</span>
            <input
              className={styles.input}
              value={roomIdInput}
              onChange={(event) => setRoomIdInput(event.target.value)}
              placeholder="room-xxxx"
            />
          </label>
          <label className={styles.label}>
            <span>自分のプレイヤーID</span>
            <input
              className={styles.input}
              value={localPlayerId}
              onChange={(event) => setLocalPlayerId(event.target.value)}
              placeholder="host-xxxx"
            />
          </label>
          <div className={styles.buttonRow}>
            <button
              type="submit"
              className={`${styles.button} ${styles.primary}`}
              disabled={isBusy}
            >
              接続
            </button>
            <button
              type="button"
              className={styles.button}
              onClick={refresh}
              disabled={!isConnected || isBusy}
            >
              最新状態を取得
            </button>
            <button
              type="button"
              className={styles.button}
              onClick={handleDisconnect}
              disabled={!isConnected || isBusy}
            >
              切断
            </button>
          </div>
        </form>
        <div
          className={`${styles.status} ${styles[`status-${status.type}`] ?? ""}`}
        >
          {status.message}
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>プレイヤー順番</h2>
          <div className={styles.tags}>
            <span className={styles.tag}>
              接続: {isConnected ? "済み" : "未接続"}
            </span>
            <span className={styles.tag}>
              権限: {localPlayerIsHost ? "ホスト" : "閲覧のみ"}
            </span>
            <span className={styles.tag}>
              プレイヤー数: {orderedPlayers.length}
            </span>
          </div>
        </div>
        {orderedPlayers.length === 0 ? (
          <p className={styles.muted}>
            プレイヤーがまだ参加していません。ルームロビーで参加者を招待してください。
          </p>
        ) : (
          <ul className={styles.playerList}>
            {orderedPlayers.map(({ id, state }, index) => {
              const isLocal = localPlayerId === id;
              const isHost = state.isHost;
              return (
                <li key={id} className={styles.playerItem}>
                  <div className={styles.playerHeader}>
                    <span className={styles.orderBadge}>{index + 1}</span>
                    <div className={styles.playerMetaHeader}>
                      <span className={styles.playerName}>
                        {state.displayName}
                      </span>
                      <span className={styles.playerId}>{id}</span>
                    </div>
                    <div className={styles.playerTags}>
                      {isHost && (
                        <span className={`${styles.badge} ${styles.badgeHost}`}>
                          ホスト
                        </span>
                      )}
                      {isLocal && (
                        <span
                          className={`${styles.badge} ${styles.badgeLocal}`}
                        >
                          あなた
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={styles.playerMeta}>
                    <span>VP: {state.vp}</span>
                    <span>行動力: {state.actionPoints}</span>
                    <span>
                      資源: 光 {state.resources.light} / 虹{" "}
                      {state.resources.rainbow} / 淀み{" "}
                      {state.resources.stagnation}
                    </span>
                  </div>
                  <div className={styles.playerControls}>
                    <button
                      type="button"
                      className={styles.iconButton}
                      onClick={() => handleMove(id, -1)}
                      disabled={!localPlayerIsHost || index === 0 || isBusy}
                      aria-label="順位を一つ上げる"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className={styles.iconButton}
                      onClick={() => handleMove(id, 1)}
                      disabled={
                        !localPlayerIsHost ||
                        index === orderedPlayers.length - 1 ||
                        isBusy
                      }
                      aria-label="順位を一つ下げる"
                    >
                      ↓
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.button}
            onClick={handleReset}
            disabled={!isConnected || isBusy || !isDirty}
          >
            サーバー順へ戻す
          </button>
          <button
            type="button"
            className={styles.button}
            onClick={handleRandomize}
            disabled={!isConnected || !localPlayerIsHost || isBusy}
          >
            ランダムに決定
          </button>
          <button
            type="button"
            className={`${styles.button} ${styles.primary}`}
            onClick={handleConfirm}
            disabled={
              !isConnected ||
              !localPlayerIsHost ||
              !hasEnoughPlayers ||
              isBusy ||
              draftOrder.length === 0
            }
          >
            この順番で確定
          </button>
        </div>
        {!hasEnoughPlayers && (
          <p className={styles.muted}>
            2人以上のプレイヤーが参加している必要があります。
          </p>
        )}
        {!localPlayerIsHost && (
          <p className={styles.muted}>
            順番の確定やランダム決定はホストのみが行えます。ホストで接続していることを確認してください。
          </p>
        )}
        {isConnected && (
          <Link href="/character-select" className={styles.navLink}>
            キャラクター選択へ進む
          </Link>
        )}
        {isConnected && (
          <button
            type="button"
            className={styles.navLink}
            onClick={handleBeginCharacterSelection}
            disabled={!canBeginCharacterSelection}
          >
            キャラクター選択を開始
          </button>
        )}
        {isConnected && (
          <Link href="/play" className={styles.navLink}>
            メインボードへ進む
          </Link>
        )}
      </section>
    </div>
  );
}

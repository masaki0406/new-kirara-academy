"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";
import {
  DEFAULT_FUNCTIONS_BASE_URL,
  useSession,
} from "../../context/SessionContext";
import { CHARACTER_CATALOG } from "../../data/characters";

export default function CharacterSelectPage(): JSX.Element {
  const router = useRouter();
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
    selectCharacter,
    startGame,
  } = useSession();

  const [baseUrlInput, setBaseUrlInput] = useState(
    baseUrl || DEFAULT_FUNCTIONS_BASE_URL,
  );
  const [roomIdInput, setRoomIdInput] = useState(sessionRoomId ?? "");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setBaseUrlInput(baseUrl || DEFAULT_FUNCTIONS_BASE_URL);
  }, [baseUrl]);

  useEffect(() => {
    if (sessionRoomId) {
      setRoomIdInput(sessionRoomId);
    }
  }, [sessionRoomId]);

  const isBusy = status.type === "info";
  const localGamePlayer =
    localPlayer?.id && gameState
      ? gameState.players[localPlayer.id]
      : undefined;

  const selections = useMemo(() => {
    const map = new Map<string, { playerId: string; displayName: string }>();
    if (!gameState) {
      return map;
    }
    Object.values(gameState.players).forEach((player) => {
      if (player.characterId) {
        map.set(player.characterId, {
          playerId: player.playerId,
          displayName: player.displayName,
        });
      }
    });
    return map;
  }, [gameState]);

  const players = useMemo(() => {
    return gameState ? Object.values(gameState.players) : [];
  }, [gameState]);

  const allSelected = players.length > 0 && players.every((player) => !!player.characterId);
  const localIsHost = Boolean(localPlayer?.id && localGamePlayer?.isHost);
  const lifecycleStage = gameState?.lifecycleStage ?? "lobby";

  const handleConnect = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmedBaseUrl = baseUrlInput.trim();
      const trimmedRoomId = roomIdInput.trim();
      if (!trimmedBaseUrl || !trimmedRoomId) {
        setFeedback("Base URL と Room ID を入力してください。");
        return;
      }
      try {
        setFeedback(null);
        setBaseUrl(trimmedBaseUrl);
        setSessionRoomId(trimmedRoomId);
        await connect({ baseUrl: trimmedBaseUrl, roomId: trimmedRoomId });
      } catch (error) {
        console.error(error);
        setFeedback(
          error instanceof Error ? error.message : "接続に失敗しました。",
        );
      }
    },
    [baseUrlInput, roomIdInput, connect, setBaseUrl, setSessionRoomId],
  );

  const handleSelect = useCallback(
    async (characterId: string) => {
      if (!localPlayer?.id) {
        setFeedback("先にロビーでプレイヤーとして参加してください。");
        return;
      }
      setFeedback(null);
      setIsSubmitting(true);
      try {
        await selectCharacter({ playerId: localPlayer.id, characterId });
        setFeedback("キャラクター選択リクエストを送信しました。");
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "キャラクター選択はまだ実装されていません。";
        setFeedback(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [localPlayer?.id, selectCharacter],
  );

  const handleStartGame = useCallback(async () => {
    if (!localPlayer?.id) {
      setFeedback("先にロビーでプレイヤーとして参加してください。");
      return;
    }
    setFeedback(null);
    setIsSubmitting(true);
    try {
      await startGame({ requesterId: localPlayer.id });
      setFeedback("ゲームを開始しました。メインボードへ移動します。");
      router.push("/play");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "ゲーム開始に失敗しました";
      setFeedback(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [localPlayer?.id, startGame, router]);

  const localCharacterId = localGamePlayer?.characterId;
  const connectedRoomId = gameState?.roomId ?? sessionRoomId ?? null;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>キャラクター選択</h1>
          <p className={styles.subtitle}>
            各プレイヤーは異なるキャラクターを選択します。選択済みのキャラクターは他プレイヤーには利用できません。
          </p>
        </div>
        <Link href="/" className={styles.linkButton}>
          ルームロビーへ戻る
        </Link>
      </header>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>接続情報</h2>
        <p className={styles.description}>
          Functions Base URL と Room ID を指定して接続します。既にロビーで接続している場合はその状態が引き継がれます。
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
              onClick={disconnect}
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
        <div className={styles.sessionMeta}>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>接続中ルーム</span>
            <span className={styles.metaValue}>
              {connectedRoomId ?? "未接続"}
            </span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>ローカルプレイヤー</span>
            <span className={styles.metaValue}>
              {localPlayer
                ? `${localPlayer.name} (${
                    localPlayer.role === "host" ? "ホスト" : "参加者"
                  })`
                : "未登録"}
            </span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>選択状況</span>
            <span className={styles.metaValue}>
              {localCharacterId
                ? `選択済み: ${localCharacterId}`
                : "未選択"}
            </span>
          </div>
        </div>
        {feedback && <p className={styles.feedback}>{feedback}</p>}
      </section>

      <section className={styles.gridCard}>
        <h2 className={styles.cardTitle}>キャラクター一覧</h2>
        <div className={styles.catalog}>
          {CHARACTER_CATALOG.map((character) => {
            const selection = selections.get(character.id);
            const selectedByLocal = selection?.playerId === localPlayer?.id;
            const selectedByOther =
              selection && selection.playerId !== localPlayer?.id;
            const disabled =
              !isConnected ||
              isBusy ||
              isSubmitting ||
              selectedByOther ||
              !localPlayer;
            const statusLabel = selectedByLocal
              ? "あなたが選択済み"
              : selectedByOther
                ? `${selection.displayName} が使用中`
                : "選択可能";

            return (
              <article key={character.id} className={styles.characterCard}>
                <div className={styles.characterHeader}>
                  <h3 className={styles.characterName}>{character.name}</h3>
                  <span className={styles.characterTitle}>
                    {character.title}
                  </span>
                </div>
                <div className={styles.characterBody}>
                  <p className={styles.characterTheme}>{character.theme}</p>
                  <p className={styles.characterOverview}>
                    {character.overview}
                  </p>
                </div>
                <div className={styles.characterFooter}>
                  <span className={styles.characterStatus}>{statusLabel}</span>
                  <button
                    type="button"
                    className={`${styles.button} ${styles.primary}`}
                    onClick={() => handleSelect(character.id)}
                    disabled={disabled}
                  >
                    {selectedByLocal ? "選択を再送信" : "このキャラを選ぶ"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
        {isConnected && lifecycleStage !== "characterSelect" && (
          <p className={styles.hint}>
            ※ ホストがキャラクター選択を開始するまで待機しています。
          </p>
        )}
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>プレイヤーの選択状況</h2>
        {players.length === 0 ? (
          <p className={styles.description}>まだプレイヤーが参加していません。</p>
        ) : (
          <ul className={styles.playerList}>
            {players.map((player) => (
              <li key={player.playerId} className={styles.playerItem}>
                <span className={styles.playerName}>{player.displayName}</span>
                <span className={styles.playerStatus}>
                  {player.characterId ? `選択: ${player.characterId}` : "未選択"}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className={styles.buttonRow}>
          <button
            type="button"
            className={`${styles.button} ${styles.primary}`}
            onClick={handleStartGame}
            disabled=
              {!isConnected ||
                !localIsHost ||
                !allSelected ||
                lifecycleStage !== "characterSelect" ||
                isBusy ||
                isSubmitting}
          >
            ゲームを開始する
          </button>
        </div>
        {!localIsHost && (
          <p className={styles.hint}>ゲーム開始はホストのみ実行できます。</p>
        )}
        {!allSelected && (
          <p className={styles.hint}>すべてのプレイヤーがキャラクターを選択するまで開始できません。</p>
        )}
      </section>
    </div>
  );
}

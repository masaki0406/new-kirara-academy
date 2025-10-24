"use client";

import type { JSX } from "react";
import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import styles from "./page.module.css";
import {
  DEFAULT_FUNCTIONS_BASE_URL,
  useSession,
} from "../context/SessionContext";

function createRoomCode(): string {
  const base = Date.now().toString(36).slice(-4);
  const random = Math.random().toString(36).slice(2, 6);
  return `room-${base}${random}`;
}

function createLocalId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 6)}`;
}

export default function HomePage(): JSX.Element {
  const {
    baseUrl,
    setBaseUrl,
    roomId: sessionRoomId,
    setRoomId: setSessionRoomId,
    localPlayer,
    setLocalPlayer,
    status,
    gameState,
    isConnected,
    connect,
    refresh,
    disconnect,
    createRoom,
    joinRoom,
    beginCharacterSelection,
  } = useSession();

  const [localBaseUrlInput, setLocalBaseUrlInput] = useState(
    baseUrl || DEFAULT_FUNCTIONS_BASE_URL,
  );
  const [roomIdInput, setRoomIdInput] = useState(sessionRoomId || "room-1");

  const [hostRoomId, setHostRoomId] = useState(() => createRoomCode());
  const [hostPlayerId, setHostPlayerId] = useState(() =>
    createLocalId("host"),
  );
  const [hostPlayerName, setHostPlayerName] = useState("ホストプレイヤー");

  const [joinRoomId, setJoinRoomId] = useState(sessionRoomId ?? "");
  const [joinPlayerId, setJoinPlayerId] = useState(() =>
    localPlayer?.id ?? createLocalId("player"),
  );
  const [joinPlayerName, setJoinPlayerName] = useState(
    localPlayer?.name ?? "プレイヤー",
  );

  const [hostFormError, setHostFormError] = useState<string | null>(null);
  const [joinFormError, setJoinFormError] = useState<string | null>(null);

  useEffect(() => {
    setLocalBaseUrlInput(baseUrl || DEFAULT_FUNCTIONS_BASE_URL);
  }, [baseUrl]);

  useEffect(() => {
    if (sessionRoomId) {
      setRoomIdInput(sessionRoomId);
      setJoinRoomId(sessionRoomId);
    }
  }, [sessionRoomId]);

  useEffect(() => {
    if (!localPlayer?.id) {
      return;
    }
    setJoinPlayerId((current) => {
      if (!current.trim()) {
        return localPlayer.id;
      }
      return current;
    });
    setJoinPlayerName((current) => {
      if (!current.trim()) {
        return localPlayer.name;
      }
      return current;
    });
  }, [localPlayer?.id, localPlayer?.name]);

  const isBusy = status.type === "info";

  const players = useMemo(() => {
    if (!gameState) {
      return [];
    }
    const order = Array.isArray(gameState.turnOrder)
      ? gameState.turnOrder
      : [];
    const seen = new Set<string>();
    const ordered: typeof gameState.players[keyof typeof gameState.players][] =
      [];

    order.forEach((playerId) => {
      const player = gameState.players[playerId];
      if (player && !seen.has(playerId)) {
        ordered.push(player);
        seen.add(playerId);
      }
    });

    Object.values(gameState.players).forEach((player) => {
      if (!seen.has(player.playerId)) {
        ordered.push(player);
        seen.add(player.playerId);
      }
    });

    return ordered;
  }, [gameState]);

  const localGamePlayer = useMemo(() => {
    if (!localPlayer?.id || !gameState) {
      return undefined;
    }
    return gameState.players[localPlayer.id];
  }, [localPlayer?.id, gameState]);

  const localIsHost = Boolean(localGamePlayer?.isHost);
  const lifecycleStage = gameState?.lifecycleStage ?? "lobby";
  const canBeginCharacterSelection =
    localIsHost && lifecycleStage === "lobby";

  const phaseLabel = useMemo(() => {
    if (!gameState) {
      return "-";
    }
    switch (gameState.currentPhase) {
      case "setup":
        return "準備フェーズ";
      case "main":
        return "メインフェーズ";
      case "end":
        return "終了フェーズ";
      case "finalScoring":
        return "最終得点計算";
      default:
        return gameState.currentPhase;
    }
  }, [gameState]);

  const handleRegenerateRoomId = useCallback(() => {
    const generated = createRoomCode();
    setHostRoomId(generated);
    setJoinRoomId(generated);
  }, []);

  const handleCreateRoom = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setHostFormError(null);

      const trimmedBaseUrl = localBaseUrlInput.trim();
      const roomId = hostRoomId.trim() || createRoomCode();
      const playerId = hostPlayerId.trim();
      const playerName = hostPlayerName.trim();

      if (!trimmedBaseUrl) {
        setHostFormError("Functions のベース URL を入力してください。");
        return;
      }
      if (!roomId) {
        setHostFormError("ルームIDを入力してください。");
        return;
      }
      if (!playerId || !playerName) {
        setHostFormError("ホストIDと表示名を入力してください。");
        return;
      }

      try {
        await createRoom({
          baseUrl: trimmedBaseUrl,
          roomId,
          hostId: playerId,
          hostName: playerName,
        });
        await connect({ baseUrl: trimmedBaseUrl, roomId });
        setBaseUrl(trimmedBaseUrl);
        setSessionRoomId(roomId);
        setLocalPlayer({ id: playerId, name: playerName, role: "host" });
        setJoinRoomId(roomId);
        setJoinPlayerId(createLocalId("player"));
        setJoinPlayerName("プレイヤー");
      } catch (error) {
        // エラーメッセージは status に表示済み
      }
    },
    [
      localBaseUrlInput,
      hostRoomId,
      hostPlayerId,
      hostPlayerName,
      createRoom,
      connect,
      setBaseUrl,
      setSessionRoomId,
      setLocalPlayer,
    ],
  );

  const handleJoinRoom = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setJoinFormError(null);

      const trimmedBaseUrl = localBaseUrlInput.trim();
      const roomId = joinRoomId.trim();
      const playerId = joinPlayerId.trim();
      const playerName = joinPlayerName.trim();

      if (!trimmedBaseUrl) {
        setJoinFormError("Functions のベース URL を入力してください。");
        return;
      }
      if (!roomId) {
        setJoinFormError("参加するルームIDを入力してください。");
        return;
      }
      if (!playerId || !playerName) {
        setJoinFormError("プレイヤーIDと表示名を入力してください。");
        return;
      }

      try {
        await joinRoom({
          baseUrl: trimmedBaseUrl,
          roomId,
          playerId,
          playerName,
        });
        await connect({ baseUrl: trimmedBaseUrl, roomId });
        setBaseUrl(trimmedBaseUrl);
        setSessionRoomId(roomId);
        setLocalPlayer({ id: playerId, name: playerName, role: "guest" });
      } catch (error) {
        console.error(error);
        setJoinFormError("参加に失敗しました。入力内容を確認してください。");
      }
    },
    [
      localBaseUrlInput,
      joinRoomId,
      joinPlayerId,
      joinPlayerName,
      joinRoom,
      connect,
      setBaseUrl,
      setSessionRoomId,
      setLocalPlayer,
    ],
  );

  const handleRefresh = useCallback(async () => {
    await refresh();
  }, [refresh]);

  const handleDisconnect = useCallback(async () => {
    await disconnect();
    setLocalPlayer(null);
  }, [disconnect, setLocalPlayer]);

  const handleBeginCharacterSelection = useCallback(async () => {
    if (!localPlayer?.id) {
      return;
    }
    try {
      await beginCharacterSelection({ requesterId: localPlayer.id });
    } catch (error) {
      console.error(error);
    }
  }, [beginCharacterSelection, localPlayer?.id]);

  const connectedRoomId = gameState?.roomId ?? sessionRoomId ?? null;

  const turnOrderHref = useMemo(() => {
    const params = new URLSearchParams();
    if (baseUrl) {
      params.set("baseUrl", baseUrl);
    }
    if (connectedRoomId) {
      params.set("roomId", connectedRoomId);
    }
    if (localPlayer?.id) {
      params.set("playerId", localPlayer.id);
    }
    const query = params.toString();
    return query.length > 0 ? `/turn-order?${query}` : "/turn-order";
  }, [baseUrl, connectedRoomId, localPlayer]);

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <h1 className={styles.heroTitle}>Kirara Academy ロビー</h1>
        <p className={styles.heroDescription}>
          Firebase Functions を介してルームを作成・参加し、ゲーム進行の準備を整えます。
        </p>
      </header>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>接続設定</h2>
        <p className={styles.description}>
          ローカルエミュレーターまたは本番環境の HTTPS Functions エンドポイントを入力します。
        </p>
        <div className={styles.fieldRow}>
          <label className={styles.label}>
            <span>Functions Base URL</span>
            <input
              className={styles.input}
              value={localBaseUrlInput}
              onChange={(event) => setLocalBaseUrlInput(event.target.value)}
              placeholder="http://127.0.0.1:5003/PROJECT_ID/us-central1"
            />
          </label>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={handleRefresh}
            disabled={!isConnected || isBusy}
          >
            最新状態を取得
          </button>
        </div>
        <div className={styles.fieldRow}>
          <label className={styles.label}>
            <span>Room ID</span>
            <input
              className={styles.input}
              value={roomIdInput}
              onChange={(event) => setRoomIdInput(event.target.value)}
            />
          </label>
        </div>
        <div className={styles.buttonRow}>
          <button
            type="button"
            onClick={async () => {
              const trimmedBaseUrl = localBaseUrlInput.trim();
              const trimmedRoomId = roomIdInput.trim();
              if (!trimmedBaseUrl || !trimmedRoomId) {
                return;
              }
              setBaseUrl(trimmedBaseUrl);
              setSessionRoomId(trimmedRoomId);
              await connect({
                baseUrl: trimmedBaseUrl,
                roomId: trimmedRoomId,
              });
            }}
            className={`${styles.button} ${styles.buttonPrimary}`}
          >
            接続
          </button>
          <button type="button" onClick={handleRefresh} className={styles.button}>
            状態更新
          </button>
          <button type="button" onClick={handleDisconnect} className={styles.button}>
            切断
          </button>
        </div>
      </section>

      <section className={styles.cardGrid}>
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>新しいルームを作成</h3>
          <p className={styles.description}>
            ルームIDを決めてホストを登録します。作成後は自動で接続し、ルームを共有できます。
          </p>
          <form className={styles.form} onSubmit={handleCreateRoom}>
            <div className={styles.fieldRow}>
              <label className={styles.label}>
                <span>ルームID</span>
                <input
                  className={styles.input}
                  value={hostRoomId}
                  onChange={(event) => setHostRoomId(event.target.value)}
                  placeholder="room-xxxx"
                />
              </label>
              <button
                type="button"
                className={styles.smallButton}
                onClick={handleRegenerateRoomId}
              >
                IDを再生成
              </button>
            </div>
            <div className={styles.fieldRow}>
              <label className={styles.label}>
                <span>ホストID</span>
                <input
                  className={styles.input}
                  value={hostPlayerId}
                  onChange={(event) => setHostPlayerId(event.target.value)}
                  placeholder="host-xxxx"
                />
              </label>
              <label className={styles.label}>
                <span>表示名</span>
                <input
                  className={styles.input}
                  value={hostPlayerName}
                  onChange={(event) => setHostPlayerName(event.target.value)}
                  placeholder="ホストプレイヤー"
                />
              </label>
            </div>
            {hostFormError && (
              <p className={styles.formError}>{hostFormError}</p>
            )}
            <button
              type="submit"
              className={`${styles.button} ${styles.buttonPrimary}`}
              disabled={isBusy}
            >
              ルームを作成して接続
            </button>
          </form>
        </div>

        <div className={styles.card}>
          <h3 className={styles.cardTitle}>既存ルームに参加</h3>
          <p className={styles.description}>
            共有されたルームIDを入力し、プレイヤーとして参加します。参加後は自動でルームに接続します。
          </p>
          <form className={styles.form} onSubmit={handleJoinRoom}>
            <div className={styles.fieldRow}>
              <label className={styles.label}>
                <span>ルームID</span>
                <input
                  className={styles.input}
                  value={joinRoomId}
                  onChange={(event) => setJoinRoomId(event.target.value)}
                  placeholder="room-xxxx"
                />
              </label>
            </div>
            <div className={styles.fieldRow}>
              <label className={styles.label}>
                <span>プレイヤーID</span>
                <input
                  className={styles.input}
                  value={joinPlayerId}
                  onChange={(event) => setJoinPlayerId(event.target.value)}
                  placeholder="player-xxxx"
                />
              </label>
              <label className={styles.label}>
                <span>表示名</span>
                <input
                  className={styles.input}
                  value={joinPlayerName}
                  onChange={(event) => setJoinPlayerName(event.target.value)}
                  placeholder="プレイヤー名"
                />
              </label>
            </div>
            {joinFormError && (
              <p className={styles.formError}>{joinFormError}</p>
            )}
            <button
              type="submit"
              className={styles.button}
              disabled={isBusy}
            >
              参加して接続
            </button>
          </form>
        </div>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>接続ステータス</h2>
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
            <span className={styles.metaLabel}>フェーズ</span>
            <span className={styles.metaValue}>{phaseLabel}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>ラウンド</span>
            <span className={styles.metaValue}>
              {gameState ? gameState.currentRound : "-"}
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
        </div>
        <div className={styles.buttonRow}>
          <button
            type="button"
            className={styles.button}
            onClick={handleRefresh}
            disabled={!isConnected || isBusy}
          >
            状態更新
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
        {isConnected && (
          <div className={styles.buttonRow}>
            <Link href={turnOrderHref} className={styles.linkButton}>
              手番順の設定に進む
            </Link>
            <button
              type="button"
              className={styles.linkButton}
              onClick={handleBeginCharacterSelection}
              disabled={!canBeginCharacterSelection}
            >
              キャラクター選択を開始
            </button>
            <Link href="/play" className={styles.linkButton}>
              メインボードを見る
            </Link>
          </div>
        )}
      </section>

      {isConnected && gameState && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>プレイヤー構成</h2>
          {players.length === 0 ? (
            <p className={styles.mutedText}>まだプレイヤーが登録されていません。</p>
          ) : (
            <ul className={styles.playerList}>
              {players.map((player, index) => {
                const isLocal = localPlayer?.id === player.playerId;
                const isHost = player.isHost;
                return (
                  <li key={player.playerId} className={styles.playerItem}>
                    <div className={styles.playerHeader}>
                      <span className={styles.orderBadge}>{index + 1}</span>
                      <span className={styles.playerName}>
                        {player.displayName}
                      </span>
                      <div className={styles.badgeRow}>
                        {isHost && (
                          <span
                            className={`${styles.badge} ${styles.badgeHost}`}
                          >
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
                      <span>VP: {player.vp}</span>
                      <span>行動力: {player.actionPoints}</span>
                      <span>
                        資源: 光 {player.resources.light} / 虹{" "}
                        {player.resources.rainbow} / 淀み{" "}
                        {player.resources.stagnation}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <details className={styles.stateDetails}>
            <summary>GameState の詳細を表示</summary>
            <pre className={styles.stateViewer}>
              {JSON.stringify(gameState, null, 2)}
            </pre>
          </details>
        </section>
      )}
    </div>
  );
}

"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";
import {
  DEFAULT_FUNCTIONS_BASE_URL,
  useSession,
} from "../../context/SessionContext";
import { CHARACTER_CATALOG, type CharacterGrowthNode } from "../../data/characters";
import {
  buildUnlockedSetWithAuto,
  canUnlockGrowthNode,
  getGrowthNode,
  type GrowthNodeDefinition,
} from "@domain/characterGrowth";
import { FunctionsGateway } from "@domain/client/functionsGateway";
import type { CatalogDevelopmentCard } from "@domain/types";

type LabActionSide = "left" | "right";

interface LabActionDefinition {
  id: string;
  name: string;
  nameEn: string;
  side: LabActionSide;
  material: string;
  cost: string[];
  result: string[];
}

const LAB_ACTIONS: LabActionDefinition[] = [
  {
    id: "polish",
    name: "研磨",
    nameEn: "POLISH",
    side: "left",
    material: "共有設備が揃う研究棟で、レンズ改良を進めるための研磨機を利用できます。",
    cost: ["行動力 1", "淀みトークン ×1"],
    result: ["未完成のレンズを研究進捗 +1", "共有レンズのロビーを整理"],
  },
  {
    id: "focus-light",
    name: "集光",
    nameEn: "FOCUS LIGHT",
    side: "left",
    material: "光の収束を行う観測装置を稼働し、研究に必要な光資源を生成します。",
    cost: ["行動力 1", "追加コストなし"],
    result: ["光トークン ×1 を獲得", "必要に応じて虹トークンへ変換"],
  },
  {
    id: "negotiation",
    name: "根回し",
    nameEn: "NEGOTIATION",
    side: "right",
    material: "講義棟で教員と調整し、次の研究予定に優先枠を確保します。",
    cost: ["行動力 1", "創造力 ×1"],
    result: ["次ラウンド開始時の手番候補に登録", "ロビー 1 体を即時再配置"],
  },
  {
    id: "spirit",
    name: "気合",
    nameEn: "SPIRIT",
    side: "right",
    material: "学生ラウンジで気持ちを整え、集中力と士気を高めます。",
    cost: ["行動力 1", "創造力 ×1"],
    result: ["創造力 +1", "淀みトークン ×1 を浄化して光へ変換"],
  },
];

interface TaskDefinition {
  id: string;
  label: string;
  target: number;
  color: "rainbow" | "light" | "lens";
  description: string;
}

const LAB_TASKS: TaskDefinition[] = [
  {
    id: "rainbow",
    label: "虹トークン",
    target: 5,
    color: "rainbow",
    description: "希少な虹トークンを 5 個集めると特別課題を完了できます。",
  },
  {
    id: "light",
    label: "光トークン",
    target: 7,
    color: "light",
    description: "安定した光資源を 7 個確保すると共有研究が進展します。",
  },
  {
    id: "lens",
    label: "完成レンズ",
    target: 3,
    color: "lens",
    description: "完成したレンズを 3 枚揃えると卒業課題に挑戦可能です。",
  },
];

type JournalSlotRole = "development" | "developmentDeck" | "vp" | "vpDeck";

interface JournalSlotDefinition {
  position: number;
  role: JournalSlotRole;
  label: string;
}

interface JournalSlotData extends JournalSlotDefinition {
  cardId: string | null;
  count?: number;
}

interface LobbySummary {
  stock: number;
  unused: number;
  used: number;
  totalDeployed: number;
  totalTokens?: number;
}

const JOURNAL_SLOT_LAYOUT: JournalSlotDefinition[] = [
  { position: 1, role: "development", label: "開発カード置き場" },
  { position: 2, role: "development", label: "開発カード置き場" },
  { position: 3, role: "development", label: "開発カード置き場" },
  { position: 4, role: "vp", label: "VPカード置き場" },
  { position: 5, role: "development", label: "開発カード置き場" },
  { position: 6, role: "developmentDeck", label: "開発カード山札置き場" },
  { position: 7, role: "development", label: "開発カード置き場" },
  { position: 8, role: "vpDeck", label: "VPカード山札置き場" },
  { position: 9, role: "development", label: "開発カード置き場" },
  { position: 10, role: "development", label: "開発カード置き場" },
  { position: 11, role: "development", label: "開発カード置き場" },
  { position: 12, role: "vp", label: "VPカード置き場" },
];

const JOURNAL_DEVELOPMENT_SLOT_COUNT = JOURNAL_SLOT_LAYOUT.filter(
  (slot) => slot.role === "development",
).length;

const FOUNDATION_CARD_COSTS = [0, 1, 2, 3, 4] as const;
// デザイン資料の初期セットアップに基づき、ロビーマーカーの基本ストック数を 4 と想定
const DEFAULT_LOBBY_STOCK = 4;
const BASE_LOBBY_STOCK_DISPLAY = 4;

type FoundationCost = (typeof FOUNDATION_CARD_COSTS)[number];

interface FoundationSlot {
  cost: FoundationCost;
  cardId: string | null;
}

interface CharacterGrowthNodeWithStatus extends CharacterGrowthNode {
  isUnlocked: boolean;
  definition?: GrowthNodeDefinition;
  unlockable: boolean;
}

function formatCostMap(costs?: Record<string, number>): string {
  if (!costs) {
    return "-";
  }
  const entries = Object.entries(costs).filter(
    ([, value]) => typeof value === "number" && Number.isFinite(value),
  );
  if (entries.length === 0) {
    return "-";
  }
  return entries.map(([key, value]) => `${key}: ${value}`).join(" / ");
}

function formatExtras(extras?: Record<string, unknown>): string | null {
  if (!extras) {
    return null;
  }
  const entries = Object.entries(extras);
  if (entries.length === 0) {
    return null;
  }
  return entries
    .map(([key, value]) =>
      `${key}: ${
        typeof value === "object" && value !== null ? JSON.stringify(value) : String(value)
      }`,
    )
    .join(" / ");
}

export default function PlayPage(): JSX.Element {
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
    performAction,
    adjustPlayerForTest,
  } = useSession();

  const [baseUrlInput, setBaseUrlInput] = useState(
    baseUrl || DEFAULT_FUNCTIONS_BASE_URL,
  );
  const [roomIdInput, setRoomIdInput] = useState(sessionRoomId ?? "");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [taskRewardDialog, setTaskRewardDialog] = useState<{
    taskId: string;
    choice: "growth" | "lobby";
    nodeId?: string;
  } | null>(null);
  const [developmentCardCatalog, setDevelopmentCardCatalog] = useState<
    Map<string, CatalogDevelopmentCard>
  >(new Map());
  const [isLoadingDevelopmentCards, setIsLoadingDevelopmentCards] = useState(false);
  const [developmentCardError, setDevelopmentCardError] = useState<string | null>(null);

  useEffect(() => {
    setBaseUrlInput(baseUrl || DEFAULT_FUNCTIONS_BASE_URL);
  }, [baseUrl]);

  useEffect(() => {
    if (sessionRoomId) {
      setRoomIdInput(sessionRoomId);
    }
  }, [sessionRoomId]);

  useEffect(() => {
    const trimmedBaseUrl = baseUrl?.trim();
    if (!trimmedBaseUrl) {
      setDevelopmentCardCatalog(new Map());
      setDevelopmentCardError(null);
      return;
    }

    let cancelled = false;
    const gateway = new FunctionsGateway({ baseUrl: trimmedBaseUrl, fetchImpl: fetch });
    setIsLoadingDevelopmentCards(true);
    setDevelopmentCardError(null);

    gateway
      .listDevelopmentCards()
      .then((cards) => {
        if (cancelled) {
          return;
        }
        const map = new Map<string, CatalogDevelopmentCard>();
        cards.forEach((card) => {
          const resolvedId = (card.cardId || card.id).trim();
          map.set(resolvedId, card);
          if (card.id && card.id !== resolvedId) {
            map.set(card.id, card);
          }
        });
        setDevelopmentCardCatalog(map);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        console.error("Failed to load development cards", error);
        setDevelopmentCardCatalog(new Map());
        setDevelopmentCardError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingDevelopmentCards(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [baseUrl]);

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

  const handlePass = useCallback(async () => {
    if (!localPlayer?.id) {
      setFeedback("先にロビーでプレイヤーとして参加してください。");
      return;
    }
    setIsSubmitting(true);
    setFeedback(null);
    try {
      await performAction({
        action: {
          playerId: localPlayer.id,
          actionType: "pass",
          payload: {},
        },
      });
      setFeedback("パスを宣言しました。");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "アクション送信に失敗しました";
      setFeedback(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [localPlayer?.id, performAction]);

  const players = useMemo(() => {
    if (!gameState) {
      return [];
    }
    return Object.values(gameState.players);
  }, [gameState]);

  const localGamePlayer = useMemo(() => {
    if (!localPlayer?.id || !gameState) {
      return undefined;
    }
    return gameState.players[localPlayer.id];
  }, [localPlayer?.id, gameState]);

  const playerLensCount = useMemo(() => {
    if (!localPlayer?.id || !gameState) {
      return 0;
    }
    const boardLenses = Object.values(gameState.board?.lenses ?? {});
    const ownedOnBoard = boardLenses.filter(
      (lens) => lens.ownerId === localPlayer.id,
    ).length;
    const ownedFromState = localGamePlayer?.ownedLenses?.length ?? 0;
    return Math.max(ownedOnBoard, ownedFromState);
  }, [gameState, localPlayer?.id, localGamePlayer?.ownedLenses?.length]);

  const debugEnabled = process.env.NODE_ENV !== "production";

  const effectiveResources = localGamePlayer?.resources ?? null;

  const effectiveLensCount = playerLensCount;

  const handleAdjustDebug = useCallback(
    async (target: "light" | "rainbow" | "lens", delta: number) => {
      if (!localPlayer?.id) {
        setFeedback("先にロビーでプレイヤーとして参加してください。");
        return;
      }
      try {
        if (target === "lens") {
          const next = Math.max(0, playerLensCount + delta);
          await adjustPlayerForTest({
            playerId: localPlayer.id,
            lensCount: next,
          });
        } else {
          if (!localGamePlayer?.resources) {
            return;
          }
          const next = Math.max(0, localGamePlayer.resources[target] + delta);
          await adjustPlayerForTest({
            playerId: localPlayer.id,
            resources: { [target]: next },
          });
        }
        setFeedback(null);
      } catch (error) {
        console.error(error);
        setFeedback(
          error instanceof Error
            ? error.message
            : "デバッグ調整に失敗しました。",
        );
      }
    },
    [adjustPlayerForTest, localPlayer?.id, localGamePlayer?.resources, playerLensCount],
  );

  const localCharacterProfile = useMemo(() => {
    if (!localGamePlayer?.characterId) {
      return undefined;
    }
    return CHARACTER_CATALOG.find(
      (profile) => profile.id === localGamePlayer.characterId,
    );
  }, [localGamePlayer?.characterId]);

  const currentPlayer = gameState?.currentPlayerId
    ? gameState.players[gameState.currentPlayerId]
    : null;

  const isLocalTurn = Boolean(
    currentPlayer && localPlayer?.id === currentPlayer.playerId,
  );

  const developmentCardCount = gameState?.board?.publicDevelopmentCards.length ?? 0;
  const visibleDevelopmentCount = Math.min(
    developmentCardCount,
    JOURNAL_DEVELOPMENT_SLOT_COUNT,
  );

  const lobbySummary = useMemo<LobbySummary>(() => {
    if (!gameState || !localGamePlayer) {
      return { stock: 0, unused: 0, used: 0, totalDeployed: 0 };
    }

    const lobbySlots = gameState.board?.lobbySlots ?? [];
    const playerSlots = lobbySlots.filter(
      (slot) => slot.occupantId === localGamePlayer.playerId,
    );
    const unused = playerSlots.filter((slot) => slot.isActive).length;
    const used = playerSlots.length - unused;

    const dynamicStockSource = localGamePlayer as Partial<{
      lobbyStock: number;
      lobbyReserve: number;
      lobbyTokens: number;
    }>;
    const configuredStock =
      typeof dynamicStockSource.lobbyStock === "number"
        ? dynamicStockSource.lobbyStock
        : typeof dynamicStockSource.lobbyReserve === "number"
          ? dynamicStockSource.lobbyReserve
          : typeof dynamicStockSource.lobbyTokens === "number"
            ? dynamicStockSource.lobbyTokens
            : undefined;

    const baselineStock = configuredStock ?? DEFAULT_LOBBY_STOCK;
    const displayStock = Math.max(0, BASE_LOBBY_STOCK_DISPLAY - playerSlots.length);

    return {
      stock: displayStock,
      unused,
      used,
      totalDeployed: playerSlots.length,
      totalTokens: baselineStock,
    };
  }, [gameState, localGamePlayer]);

  const growthNodes = localCharacterProfile?.growthNodes ?? [];

  const growthNodesWithStatus = useMemo<CharacterGrowthNodeWithStatus[]>(() => {
    if (!growthNodes.length || !localGamePlayer?.characterId) {
      return growthNodes.map((node) => ({
        ...node,
        isUnlocked: false,
        unlockable: false,
      }));
    }

    const unlockedSet = buildUnlockedSetWithAuto(
      localGamePlayer.characterId,
      localGamePlayer.unlockedCharacterNodes ?? [],
    );

    return growthNodes.map((node) => {
      const definition = getGrowthNode(localGamePlayer.characterId!, node.id);
      const isUnlocked = unlockedSet.has(node.id);
      const unlockable =
        !!definition &&
        !definition.autoUnlock &&
        !isUnlocked &&
        canUnlockGrowthNode(localGamePlayer.characterId!, node.id, unlockedSet);
      return {
        ...node,
        isUnlocked,
        definition,
        unlockable,
      };
    });
  }, [growthNodes, localGamePlayer?.characterId, localGamePlayer?.unlockedCharacterNodes]);
  const availableGrowthNodes = useMemo(
    () => growthNodesWithStatus.filter((node) => node.unlockable),
    [growthNodesWithStatus],
  );
  const growthNodeMap = useMemo(() => {
    const map = new Map<string, CharacterGrowthNodeWithStatus>();
    growthNodesWithStatus.forEach((node) => {
      map.set(node.id, node);
    });
    return map;
  }, [growthNodesWithStatus]);

  const formatPrerequisites = useCallback(
    (definition?: GrowthNodeDefinition) => {
      if (!definition) {
        return null;
      }
      const parts: string[] = [];
      if (definition.prerequisitesAny && definition.prerequisitesAny.length > 0) {
        const labels = definition.prerequisitesAny.map((id) =>
          growthNodeMap.get(id)?.position ?? id,
        );
        parts.push(`条件: ${labels.join(', ')}`);
      }
      return parts.length > 0 ? parts.join(' / ') : null;
    },
    [growthNodeMap],
  );
  const completedTasks = useMemo(() => {
    return new Set(localGamePlayer?.tasksCompleted ?? []);
  }, [localGamePlayer?.tasksCompleted]);

  const getTaskRequirementStatus = useCallback(
    (taskId: string) => {
      if (!localGamePlayer) {
        return { met: false, hint: null };
      }
      const effective = effectiveResources ?? localGamePlayer.resources;

      if (!effective) {
        return { met: false, hint: null };
      }
      switch (taskId) {
        case "rainbow": {
          const current = effective.rainbow;
          const required = 5;
          return {
            met: current >= required,
            hint: current >= required
              ? null
              : `虹トークンが ${required} 個必要です（現在 ${current} 個）。`,
          };
        }
        case "light": {
          const current = effective.light;
          const required = 7;
          return {
            met: current >= required,
            hint: current >= required
              ? null
              : `光トークンが ${required} 個必要です（現在 ${current} 個）。`,
          };
        }
        case "lens": {
          const current = effectiveLensCount;
          const required = 3;
          return {
            met: current >= required,
            hint: current >= required
              ? null
              : `完成済みレンズが ${required} 枚必要です（現在 ${current} 枚）。`,
          };
        }
        default:
          return { met: true, hint: null };
      }
    },
    [localGamePlayer, effectiveResources, effectiveLensCount],
  );

  const openTaskRewardDialog = useCallback(
    (taskId: string) => {
      if (!localPlayer?.id) {
        setFeedback("先にロビーでプレイヤーとして参加してください。");
        return;
      }
      if (!gameState?.tasks || !gameState.tasks[taskId]) {
        setFeedback("この課題は現在達成できません。");
        return;
      }
      if (pendingTaskId) {
        return;
      }
      const hasGrowthOption = availableGrowthNodes.length > 0;
      setTaskRewardDialog({
        taskId,
        choice: hasGrowthOption ? "growth" : "lobby",
        nodeId: hasGrowthOption ? availableGrowthNodes[0]?.id : undefined,
      });
      setFeedback(null);
    },
    [localPlayer?.id, gameState?.tasks, pendingTaskId, availableGrowthNodes],
  );

  const confirmTaskReward = useCallback(async () => {
    if (!taskRewardDialog) {
      return;
    }
    if (!localPlayer?.id) {
      setFeedback("先にロビーでプレイヤーとして参加してください。");
      return;
    }
    if (pendingTaskId) {
      return;
    }
    const { taskId, choice, nodeId } = taskRewardDialog;
    if (choice === "growth" && (!nodeId || nodeId.trim().length === 0)) {
      setFeedback("成長させるノードを選択してください。");
      return;
    }
    if (choice === "growth") {
      if (!localGamePlayer?.characterId) {
        setFeedback("キャラクターが未設定です。");
        return;
      }
      const unlockedSet = buildUnlockedSetWithAuto(
        localGamePlayer.characterId,
        localGamePlayer.unlockedCharacterNodes ?? [],
      );
      if (!nodeId || !canUnlockGrowthNode(localGamePlayer.characterId, nodeId, unlockedSet)) {
        setFeedback("成長条件を満たしていません。");
        return;
      }
    }
    setPendingTaskId(taskId);
    setFeedback(null);
    try {
      await performAction({
        action: {
          playerId: localPlayer.id,
          actionType: "task",
          payload: {
            taskId,
            rewardChoice:
              choice === "growth"
                ? { type: "growth", nodeId }
                : { type: "lobby" },
          },
        },
      });
      setFeedback("課題を達成しました。");
      setTaskRewardDialog(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "課題の達成送信に失敗しました";
      setFeedback(message);
    } finally {
      setPendingTaskId(null);
    }
  }, [taskRewardDialog, localPlayer?.id, pendingTaskId, performAction]);

  const cancelTaskReward = useCallback(() => {
    if (pendingTaskId) {
      return;
    }
    setTaskRewardDialog(null);
  }, [pendingTaskId]);

  const taskRewardDialogTask = taskRewardDialog
    ? gameState?.tasks?.[taskRewardDialog.taskId]
    : undefined;
  const growthOptionDisabled = availableGrowthNodes.length === 0;

  const journalSlots = useMemo<JournalSlotData[]>(() => {
    const developmentCards = gameState?.board?.publicDevelopmentCards ?? [];
    const developmentDeckCount = gameState?.developmentDeck.length ?? 0;
    let developmentIndex = 0;

    return JOURNAL_SLOT_LAYOUT.map((slot) => {
      if (slot.role === "development") {
        const cardId = developmentCards[developmentIndex] ?? null;
        developmentIndex += 1;
        return { ...slot, cardId };
      }

      if (slot.role === "developmentDeck") {
        return { ...slot, cardId: null, count: developmentDeckCount };
      }

      return { ...slot, cardId: null };
    });
  }, [gameState]);

  const foundationSlots = useMemo<FoundationSlot[]>(() => {
    const foundationCards =
      (
        gameState?.board as {
          foundationCards?: Partial<Record<FoundationCost, string | null>>;
        } | null
      )?.foundationCards ?? {};

    return FOUNDATION_CARD_COSTS.map((cost) => ({
      cost,
      cardId: foundationCards[cost] ?? null,
    }));
  }, [gameState]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Kirara Academy メインボード</h1>
          <p className={styles.subtitle}>
            ゲーム進行中の状態を確認し、アクションを送信できます。これはデバッグ用の簡易 UI
            です。
          </p>
        </div>
        <nav className={styles.navLinks}>
          <Link href="/" className={styles.navLink}>
            ロビー
          </Link>
          <Link href="/turn-order" className={styles.navLink}>
            手番順
          </Link>
          <Link href="/character-select" className={styles.navLink}>
            キャラクター
          </Link>
        </nav>
      </header>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>接続情報</h2>
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
              disabled={isSubmitting}
            >
              接続
            </button>
            <button
              type="button"
              className={styles.button}
              onClick={refresh}
              disabled={!isConnected || isSubmitting}
            >
              最新状態を取得
            </button>
            <button
              type="button"
              className={styles.button}
              onClick={disconnect}
              disabled={!isConnected || isSubmitting}
            >
              切断
            </button>
          </div>
        </form>
        <div className={`${styles.status} ${styles[`status-${status.type}`] ?? ""}`}>
          {status.message}
        </div>
        <div className={styles.sessionMeta}>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>ルーム</span>
            <span className={styles.metaValue}>
              {gameState?.roomId ?? sessionRoomId ?? "未接続"}
            </span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>フェーズ</span>
            <span className={styles.metaValue}>{gameState?.currentPhase ?? "-"}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>ラウンド</span>
            <span className={styles.metaValue}>{gameState?.currentRound ?? "-"}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>現在の手番</span>
            <span className={styles.metaValue}>
              {currentPlayer ? currentPlayer.displayName : "-"}
            </span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>ローカルプレイヤー</span>
            <span className={styles.metaValue}>
              {localPlayer
                ? `${localPlayer.name} (${localPlayer.role === "host" ? "ホスト" : "参加者"})`
                : "未登録"}
            </span>
          </div>
        </div>
        {feedback && <p className={styles.feedback}>{feedback}</p>}
      </section>

      <section className={styles.grid}>
        <div className={`${styles.column} ${styles.playersColumn}`}>
          <h3 className={styles.sectionTitle}>プレイヤー一覧</h3>
          {players.length === 0 ? (
            <p className={styles.muted}>プレイヤーが参加していません。</p>
          ) : (
            <ul className={styles.playerList}>
              {players.map((player) => {
                const isCurrent =
                  currentPlayer?.playerId === player.playerId;
                const isLocal = localPlayer?.id === player.playerId;
                return (
                  <li
                    key={player.playerId}
                    className={`${styles.playerItem} ${
                      isCurrent ? styles.playerItemActive : ""
                    }`}
                  >
                    <div className={styles.playerRow}>
                      <span className={styles.playerName}>
                        {player.displayName}
                      </span>
                      <div className={styles.badgeRow}>
                        {player.isHost && (
                          <span className={`${styles.badge} ${styles.badgeHost}`}>
                            ホスト
                          </span>
                        )}
                        {isLocal && (
                          <span className={`${styles.badge} ${styles.badgeLocal}`}>
                            あなた
                          </span>
                        )}
                        {player.characterId && (
                          <span className={`${styles.badge} ${styles.badgeCharacter}`}>
                            {player.characterId}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={styles.playerStats}>
                      <span>VP: {player.vp}</span>
                      <span>行動力: {player.actionPoints}</span>
                      <span>
                        資源: 光 {player.resources.light} / 虹 {player.resources.rainbow} / 淀み {player.resources.stagnation}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className={`${styles.column} ${styles.sharedColumn}`}>
          <h3 className={styles.sectionTitle}>共有ボード</h3>
          {gameState ? (
            <>
              <div className={styles.boardSection}>
                <div>
                  <h4 className={styles.boardTitle}>公開開発カード</h4>
                  {isLoadingDevelopmentCards && (
                    <p className={styles.muted}>カード情報を取得中です...</p>
                  )}
                  {developmentCardError && (
                    <p className={`${styles.status} ${styles["status-error"]}`}>
                      カード情報の取得に失敗しました: {developmentCardError}
                    </p>
                  )}
                  {gameState.board.publicDevelopmentCards.length === 0 ? (
                    <p className={styles.muted}>カードは公開されていません。</p>
                  ) : (
                    <div className={styles.developmentGallery}>
                      {gameState.board.publicDevelopmentCards.map((cardId) => {
                        const card =
                          developmentCardCatalog.get(cardId) ??
                          developmentCardCatalog.get(cardId.trim());
                        if (!card) {
                          return (
                            <div key={cardId} className={styles.developmentCardFallback}>
                              <strong>{cardId}</strong>
                              <p>カード情報が未登録です。</p>
                            </div>
                          );
                        }
                        const extrasSummary = formatExtras(card.extras);
                        return (
                          <div key={cardId} className={styles.developmentCard}>
                            <div className={styles.developmentCategory}>
                              {card.costItem ?? "未分類"}
                            </div>
                            <h5 className={styles.developmentTitle}>{card.cardId}</h5>
                            <div className={styles.developmentBody}>
                              <div className={styles.developmentColumn}>
                                <div className={styles.developmentRow}>
                                  コスト位置: {card.costPosition ?? "-"}
                                </div>
                                <div className={styles.developmentRow}>
                                  必要数: {card.costNumber ?? "-"}
                                </div>
                                <div className={styles.developmentRow}>
                                  左上: {formatCostMap(card.costLeftUp)}
                                </div>
                                <div className={styles.developmentRow}>
                                  左下: {formatCostMap(card.costLeftDown)}
                                </div>
                              </div>
                            </div>
                            {extrasSummary && (
                              <p className={styles.developmentNotes}>{extrasSummary}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div>
                  <h4 className={styles.boardTitle}>ロビー配置</h4>
                  {gameState.board.lobbySlots.length === 0 ? (
                    <p className={styles.muted}>ロビーは空です。</p>
                  ) : (
                    <ul className={styles.simpleList}>
                      {gameState.board.lobbySlots.map((slot, index) => (
                        <li key={slot.lensId ?? index}>
                          {slot.lensId ?? "-"} : {slot.occupantId ?? "空席"} ({
                            slot.isActive ? "未使用" : "使用済"
                          })
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <article className={`${styles.card} ${styles.labBoard}`}>
                <div className={styles.labHeader}>
                  <div>
                    <h4 className={styles.boardTitle}>ラボ案内図</h4>
                    <p className={styles.boardCaption}>
                      行動力を消費して各設備を利用し、資源獲得や手番調整を行うエリアです。
                    </p>
                  </div>
                </div>
                <div className={styles.labMap}>
                  <div className={styles.labColumn}>
                    {LAB_ACTIONS.filter((action) => action.side === "left").map((action) => (
                      <section key={action.id} className={styles.labCard}>
                        <header className={styles.labCardHeader}>
                          <span className={styles.labName}>{action.name}</span>
                          <span className={styles.labNameEn}>{action.nameEn}</span>
                        </header>
                        <div className={styles.labCardBody}>
                          <p className={styles.labMaterial}>{action.material}</p>
                          <div className={styles.labDetail}>
                            <span className={styles.labDetailLabel}>Cost</span>
                            <ul className={styles.labList}>
                              {action.cost.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          </div>
                          <div className={styles.labDetail}>
                            <span className={styles.labDetailLabel}>Result</span>
                            <ul className={styles.labList}>
                              {action.result.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </section>
                    ))}
                  </div>
                  <div className={styles.labColumn}>
                    {LAB_ACTIONS.filter((action) => action.side === "right").map((action) => (
                      <section key={action.id} className={styles.labCard}>
                        <header className={styles.labCardHeader}>
                          <span className={styles.labName}>{action.name}</span>
                          <span className={styles.labNameEn}>{action.nameEn}</span>
                        </header>
                        <div className={styles.labCardBody}>
                          <p className={styles.labMaterial}>{action.material}</p>
                          <div className={styles.labDetail}>
                            <span className={styles.labDetailLabel}>Cost</span>
                            <ul className={styles.labList}>
                              {action.cost.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          </div>
                          <div className={styles.labDetail}>
                            <span className={styles.labDetailLabel}>Result</span>
                            <ul className={styles.labList}>
                              {action.result.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </section>
                    ))}
                  </div>
                </div>
                <div className={styles.labTasks}>
                  <h5 className={styles.labTasksTitle}>課題ボード</h5>
                  <div className={styles.labTaskRows}>
                    {LAB_TASKS.map((task) => (
                      <div key={task.id} className={styles.labTaskRow}>
                        <div className={`${styles.taskMarker} ${styles[`taskMarker-${task.color}`]}`}>
                          {task.target}
                        </div>
                        <div className={styles.taskInfo}>
                          <span className={styles.taskLabel}>{task.label}</span>
                          <span className={styles.taskDescription}>{task.description}</span>
                          <div className={styles.taskActions}>
                            {(() => {
                              const { met, hint } = getTaskRequirementStatus(task.id);
                              const definitionMissing = !gameState?.tasks?.[task.id];
                              const disabled =
                                isSubmitting ||
                                pendingTaskId === task.id ||
                                completedTasks.has(task.id) ||
                                !localPlayer ||
                                !isConnected ||
                                definitionMissing ||
                                !met ||
                                taskRewardDialog !== null;
                              return (
                                <>
                                  <button
                                    type="button"
                                    className={styles.taskButton}
                                    onClick={() => openTaskRewardDialog(task.id)}
                                    disabled={disabled}
                                  >
                                    {completedTasks.has(task.id)
                                      ? "達成済み"
                                      : pendingTaskId === task.id
                                        ? "送信中..."
                                        : "課題達成"}
                                  </button>
                                  {definitionMissing ? (
                                    <span className={styles.taskHint}>未設定の課題です</span>
                                  ) : !met && hint ? (
                                    <span className={styles.taskHint}>{hint}</span>
                                  ) : null}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </article>

              <article className={`${styles.card} ${styles.journalBoard}`}>
                <div className={styles.journalHeader}>
                  <div>
                    <h4 className={styles.boardTitle}>研究日誌</h4>
                    <p className={styles.boardCaption}>
                      公開中の開発カードをノート形式で整理し、進捗を確認できます。
                    </p>
                  </div>
                  <div className={styles.journalMeta}>
                    <span>
                      開発カードスロット {visibleDevelopmentCount} / {JOURNAL_DEVELOPMENT_SLOT_COUNT}
                    </span>
                  </div>
                </div>
                <div className={styles.journalBody}>
                  <div className={styles.journalGrid}>
                    {journalSlots.map((slot) => {
                      const slotRoleClass =
                        (styles as Record<string, string>)[`journalSlot-${slot.role}`] ?? "";
                      const className = [styles.journalSlot, slotRoleClass]
                        .filter((name) => Boolean(name))
                        .join(" ");

                      let value: string;
                      let hint: string | null = null;

                      switch (slot.role) {
                        case "development": {
                          value = slot.cardId ?? "空スロット";
                          hint = slot.cardId ? "公開中の開発カード" : "補充待ち";
                          break;
                        }
                        case "developmentDeck": {
                          const remaining = slot.count ?? 0;
                          value = `残り ${remaining} 枚`;
                          hint = "公開スロットへ補充する山札";
                          break;
                        }
                        case "vp": {
                          value = slot.cardId ?? "空スロット";
                          hint = slot.cardId ? "VPカードを配置中" : "VPカードを配置してください";
                          break;
                        }
                        case "vpDeck": {
                          const remaining =
                            typeof slot.count === "number" ? `（残り ${slot.count} 枚）` : "";
                          value = `VPカード山札${remaining}`;
                          hint = "VPカードを引く際に使用します";
                          break;
                        }
                        default: {
                          value = "未設定";
                          break;
                        }
                      }

                      return (
                        <div key={slot.position} className={className}>
                          <div className={styles.journalSlotHeader}>
                            <span className={styles.journalSlotIndex}>
                              No.{slot.position.toString().padStart(2, "0")}
                            </span>
                            <span className={styles.journalSlotType}>{slot.label}</span>
                          </div>
                          <div className={styles.journalSlotBody}>
                            <span className={styles.journalSlotValue}>{value}</span>
                            {hint ? (
                              <span className={styles.journalSlotHint}>{hint}</span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <aside className={styles.journalSidebar}>
                    <h5 className={styles.journalSidebarTitle}>土台カード置き場</h5>
                    <p className={styles.journalSidebarNote}>
                      コスト 0 〜 4 の土台カードを管理します。
                    </p>
                    <ul className={styles.foundationList}>
                      {foundationSlots.map(({ cost, cardId }) => (
                        <li key={cost} className={styles.foundationItem}>
                          <span className={styles.foundationCost}>コスト {cost}</span>
                          <span className={styles.foundationLabel}>
                            {cardId ?? "カード未配置"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </aside>
                </div>
              </article>

              <article className={`${styles.card} ${styles.characterCard}`}>
                <div className={styles.boardPreviewHeader}>
                  <h4 className={styles.boardTitle}>自分のキャラクターボード</h4>
                  <p className={styles.boardCaption}>
                    ラウンド中に参照しやすいよう、現在の成長状況とステータスをまとめました。
                  </p>
                </div>
                {localGamePlayer ? (
                  <div className={styles.characterContent}>
                    <div className={styles.characterHeader}>
                      <span className={styles.characterPlayer}>
                        {localGamePlayer.displayName}
                      </span>
                      <span className={styles.characterRole}>
                        {localPlayer?.role === "host" ? "ホスト" : "参加者"}
                      </span>
                    </div>
                    <div className={styles.characterMeta}>
                      <span className={styles.characterLabel}>キャラクター</span>
                      <span className={styles.characterValue}>
                        {localCharacterProfile
                          ? `${localCharacterProfile.name}（${localCharacterProfile.title}）`
                          : localGamePlayer.characterId ?? "未選択"}
                      </span>
                    </div>
                    <div className={styles.characterMeta}>
                      <span className={styles.characterLabel}>VP</span>
                      <span className={styles.characterValue}>
                        {localGamePlayer.vp}
                      </span>
                    </div>
                    <div className={styles.characterMeta}>
                      <span className={styles.characterLabel}>創造力 / 行動力</span>
                      <span className={styles.characterValue}>
                        {localGamePlayer.creativity} / {localGamePlayer.actionPoints}
                      </span>
                    </div>
                    <div className={styles.characterMeta}>
                      <span className={styles.characterLabel}>資源</span>
                      <span className={styles.characterValue}>
                        光 {effectiveResources?.light ?? localGamePlayer.resources.light}
                        {" / "}
                        虹 {effectiveResources?.rainbow ?? localGamePlayer.resources.rainbow}
                        {" / 淀み "}
                        {localGamePlayer.resources.stagnation}
                      </span>
                    </div>
                    <div className={styles.characterMeta}>
                      <span className={styles.characterLabel}>ロビー管理</span>
                      <span className={styles.characterValue}>
                        ストック {lobbySummary.stock} / ロビー {lobbySummary.totalTokens}
                      </span>
                    </div>
                    <div className={styles.characterMeta}>
                      <span className={styles.characterLabel}>開放ノード</span>
                      <span className={styles.characterValue}>
                        {(localGamePlayer.unlockedCharacterNodes?.length ?? 0).toString()}
                      </span>
                    </div>
                    {localCharacterProfile ? (
                      <>
                        <p className={styles.characterOverview}>
                          {localCharacterProfile.overview}
                        </p>
                        {growthNodesWithStatus.length > 0 ? (
                          <div className={styles.growthSection}>
                            <h5 className={styles.growthTitle}>成長能力一覧</h5>
                            <ul className={styles.growthList}>
                              {growthNodesWithStatus.map((node) => (
                                <li
                                  key={node.id}
                                  className={`${styles.growthItem} ${
                                    node.isUnlocked
                                      ? styles.growthItemUnlocked
                                      : styles.growthItemLocked
                                  }`}
                                >
                                  <div className={styles.growthHeader}>
                                    <span className={styles.growthPosition}>{node.position}</span>
                                    <span className={styles.growthName}>{node.name}</span>
                                    <span
                                      className={`${styles.growthStatus} ${
                                        node.isUnlocked
                                          ? styles.growthStatusUnlocked
                                          : styles.growthStatusLocked
                                      }`}
                                    >
                                      {node.isUnlocked ? "解放済み" : "未解放"}
                                    </span>
                                  </div>
                                  <p className={styles.growthDescription}>{node.description}</p>
                                  {!node.isUnlocked ? (
                                    <p className={styles.growthPrereq}>
                                      {formatPrerequisites(node.definition) ?? "条件なし"}
                                    </p>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <p className={styles.muted}>
                            このキャラクターの成長能力データはまだ登録されていません。
                          </p>
                        )}
                      </>
                    ) : null}
                    {debugEnabled && localGamePlayer ? (
                      <details className={styles.debugPanel}>
                        <summary>デバッグ調整</summary>
                        <div className={styles.debugControls}>
                          <div className={styles.debugRow}>
                            <span>虹トークン</span>
                            <div className={styles.debugButtonRow}>
                              <button
                                type="button"
                                className={styles.debugButton}
                                onClick={() => void handleAdjustDebug("rainbow", -1)}
                              >
                                -1
                              </button>
                              <button
                                type="button"
                                className={styles.debugButton}
                                onClick={() => void handleAdjustDebug("rainbow", 1)}
                              >
                                +1
                              </button>
                              <button
                                type="button"
                                className={styles.debugButton}
                                onClick={() => void handleAdjustDebug("rainbow", 5)}
                              >
                                +5
                              </button>
                              <span className={styles.debugValue}>
                                現在 {effectiveResources?.rainbow ?? localGamePlayer.resources.rainbow}
                              </span>
                            </div>
                          </div>
                          <div className={styles.debugRow}>
                            <span>光トークン</span>
                            <div className={styles.debugButtonRow}>
                              <button
                                type="button"
                                className={styles.debugButton}
                                onClick={() => void handleAdjustDebug("light", -1)}
                              >
                                -1
                              </button>
                              <button
                                type="button"
                                className={styles.debugButton}
                                onClick={() => void handleAdjustDebug("light", 1)}
                              >
                                +1
                              </button>
                              <button
                                type="button"
                                className={styles.debugButton}
                                onClick={() => void handleAdjustDebug("light", 5)}
                              >
                                +5
                              </button>
                              <span className={styles.debugValue}>
                                現在 {effectiveResources?.light ?? localGamePlayer.resources.light}
                              </span>
                            </div>
                          </div>
                          <div className={styles.debugRow}>
                            <span>完成レンズ</span>
                            <div className={styles.debugButtonRow}>
                              <button
                                type="button"
                                className={styles.debugButton}
                                onClick={() => void handleAdjustDebug("lens", -1)}
                              >
                                -1
                              </button>
                              <button
                                type="button"
                                className={styles.debugButton}
                                onClick={() => void handleAdjustDebug("lens", 1)}
                              >
                                +1
                              </button>
                              <span className={styles.debugValue}>現在 {effectiveLensCount}</span>
                            </div>
                          </div>
                        </div>
                      </details>
                    ) : null}
                  </div>
                ) : (
                  <p className={styles.muted}>
                    自分のキャラクターはまだ選択されていません。キャラクター選択後にステータスが表示されます。
                  </p>
                )}
              </article>
            </>
          ) : (
            <p className={styles.muted}>未接続のためデータがありません。</p>
          )}
        </div>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>アクション</h2>
        <p className={styles.description}>
          現在はパスのみ送信できます。今後の実装で他のアクション選択 UI を追加予定です。
        </p>
        <div className={styles.buttonRow}>
          <button
            type="button"
            className={`${styles.button} ${styles.primary}`}
            onClick={handlePass}
            disabled={!isConnected || isSubmitting || !isLocalTurn}
          >
            パスする
          </button>
          {!isLocalTurn && (
            <span className={styles.inlineHint}>
              現在の手番ではありません。手番が来ると有効になります。
            </span>
          )}
        </div>
        <details className={styles.stateDetails}>
          <summary>GameState の詳細を表示</summary>
          <pre className={styles.stateViewer}>
            {JSON.stringify(gameState, null, 2)}
          </pre>
        </details>
      </section>
      {taskRewardDialog && (
        <div className={styles.taskRewardOverlay}>
          <div className={styles.taskRewardModal}>
            <h4 className={styles.taskRewardTitle}>課題報酬を選択</h4>
            <p className={styles.taskRewardDescription}>
              {taskRewardDialogTask?.description ?? `課題ID: ${taskRewardDialog.taskId}`}
            </p>
            <div className={styles.rewardOptionList}>
              <label
                className={`${styles.rewardOption} ${
                  taskRewardDialog.choice === "growth" ? styles.rewardOptionActive : ""
                } ${growthOptionDisabled ? styles.rewardOptionDisabled : ""}`}
              >
                <input
                  type="radio"
                  name="taskRewardChoice"
                  value="growth"
                  checked={taskRewardDialog.choice === "growth"}
                  disabled={growthOptionDisabled}
                  onChange={() =>
                    setTaskRewardDialog((prev) =>
                      prev
                        ? {
                            ...prev,
                            choice: "growth",
                            nodeId:
                              prev.nodeId &&
                              availableGrowthNodes.some((node) => node.id === prev.nodeId)
                                ? prev.nodeId
                                : availableGrowthNodes[0]?.id,
                          }
                        : prev,
                    )
                  }
                />
                <span>成長ツリーに配置</span>
              </label>
              {taskRewardDialog.choice === "growth" ? (
                growthOptionDisabled ? (
                  <p className={styles.rewardHelp}>成長可能なノードがありません。</p>
                ) : (
                  <div className={styles.rewardSelect}>
                    <label htmlFor="growthNodeSelect">ノード選択</label>
                    <select
                      id="growthNodeSelect"
                      value={taskRewardDialog.nodeId ?? ""}
                      onChange={(event) =>
                        setTaskRewardDialog((prev) =>
                          prev ? { ...prev, nodeId: event.target.value } : prev,
                        )
                      }
                    >
                      {availableGrowthNodes.map((node) => (
                        <option key={node.id} value={node.id}>
                          {node.position} {node.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              ) : null}
              <label
                className={`${styles.rewardOption} ${
                  taskRewardDialog.choice === "lobby" ? styles.rewardOptionActive : ""
                }`}
              >
                <input
                  type="radio"
                  name="taskRewardChoice"
                  value="lobby"
                  checked={taskRewardDialog.choice === "lobby"}
                  onChange={() =>
                    setTaskRewardDialog((prev) =>
                      prev ? { ...prev, choice: "lobby", nodeId: undefined } : prev,
                    )
                  }
                />
                <span>ロビーを獲得</span>
              </label>
            </div>
            <div className={styles.rewardActions}>
              <button
                type="button"
                className={`${styles.rewardButton} ${styles.rewardButtonPrimary}`}
                onClick={confirmTaskReward}
                disabled={pendingTaskId === taskRewardDialog.taskId}
              >
                決定
              </button>
              <button
                type="button"
                className={`${styles.rewardButton} ${styles.rewardButtonSecondary}`}
                onClick={cancelTaskReward}
                disabled={pendingTaskId === taskRewardDialog.taskId}
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useCallback, useRef, useState } from "react";
import type {
  AdjustPlayerForTestPayload,
  GameState,
  PlayerAction,
  PlayerId,
} from "@domain/types";
import { FunctionsGateway } from "@domain/client/functionsGateway";
import type { SessionController } from "@domain/client/sessionController";
import { createSessionClient } from "@domain/client/sessionClient";

export type SessionStatus =
  | { type: "idle"; message: string }
  | { type: "info"; message: string }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

export interface ConnectOptions {
  baseUrl: string;
  roomId: string;
}

export interface CreateRoomOptions {
  baseUrl?: string;
  roomId: string;
  hostId: string;
  hostName: string;
}

export interface JoinRoomOptions {
  baseUrl?: string;
  roomId: string;
  playerId: string;
  playerName: string;
}

export interface PerformActionOptions {
  action: PlayerAction;
}

export interface SessionClientHook {
  status: SessionStatus;
  gameState: GameState | null;
  isConnected: boolean;
  connect(options: ConnectOptions): Promise<void>;
  refresh(options?: { silent?: boolean }): Promise<void>;
  disconnect(): Promise<void>;
  createRoom(options: CreateRoomOptions): Promise<void>;
  joinRoom(options: JoinRoomOptions): Promise<void>;
  performAction(options: PerformActionOptions): Promise<void>;
  randomizeTurnOrder(): Promise<PlayerId[]>;
  updateTurnOrder(order: PlayerId[]): Promise<PlayerId[]>;
  selectCharacter(options: { playerId: PlayerId; characterId: string }): Promise<void>;
  startGame(options: { requesterId: PlayerId }): Promise<void>;
  beginCharacterSelection(options: { requesterId: PlayerId }): Promise<void>;
  adjustPlayerForTest(payload: AdjustPlayerForTestPayload): Promise<void>;
}

export function useSessionClient(): SessionClientHook {
  const [status, setStatus] = useState<SessionStatus>({
    type: "idle",
    message: "未接続",
  });
  const [gameState, setGameState] = useState<GameState | null>(null);

  const controllerRef = useRef<SessionController | null>(null);
  const gatewayRef = useRef<FunctionsGateway | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const baseUrlRef = useRef<string | null>(null);
  const roomIdRef = useRef<string | null>(null);

  const setController = useCallback((controller: SessionController | null) => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    controllerRef.current = controller;

    if (controller) {
      unsubscribeRef.current = controller.onStateChange(setGameState);
    } else {
      setGameState(null);
    }
  }, []);

  const ensureGateway = useCallback((baseUrl?: string) => {
    const targetBaseUrl = baseUrl ?? baseUrlRef.current;
    if (!targetBaseUrl) {
      throw new Error("Base URL を設定してください");
    }

    if (
      gatewayRef.current == null ||
      baseUrlRef.current == null ||
      baseUrlRef.current !== targetBaseUrl
    ) {
      gatewayRef.current = new FunctionsGateway({
        baseUrl: targetBaseUrl,
        fetchImpl: fetch,
      });
      baseUrlRef.current = targetBaseUrl;
    }

    return gatewayRef.current;
  }, []);

  const ensureConnected = useCallback(() => {
    if (!controllerRef.current || !gatewayRef.current || !roomIdRef.current) {
      throw new Error("先に接続してください");
    }
  }, []);

  const connect = useCallback(
    async ({ baseUrl, roomId }: ConnectOptions) => {
      if (!baseUrl || !roomId) {
        setStatus({
          type: "error",
          message: "Base URL と Room ID を入力してください",
        });
        return;
      }

      try {
        setStatus({ type: "info", message: "接続中..." });
        const gateway = ensureGateway(baseUrl);
        const controller = createSessionClient({
          roomId,
          baseUrl: baseUrlRef.current ?? baseUrl,
          fetchImpl: fetch,
        });

        gatewayRef.current = gateway;
        baseUrlRef.current = baseUrl;
        roomIdRef.current = roomId;
        setController(controller);

        const state = await controller.initialize();
        setGameState(state);
        setStatus({ type: "success", message: "接続しました" });
      } catch (error) {
        console.error(error);
        setController(null);
        gatewayRef.current = null;
        baseUrlRef.current = null;
        roomIdRef.current = null;
        setStatus({
          type: "error",
          message: error instanceof Error ? error.message : "接続に失敗しました",
        });
        throw error instanceof Error
          ? error
          : new Error("接続に失敗しました");
      }
    },
    [ensureGateway, setController],
  );

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    try {
      ensureConnected();
      const state = await controllerRef.current!.refresh();
      setGameState(state);
      if (!options?.silent) {
        setStatus({ type: "success", message: "最新状態を取得しました" });
      }
    } catch (error) {
      console.error(error);
      setStatus({
        type: "error",
        message:
          error instanceof Error ? error.message : "状態取得に失敗しました",
      });
    }
  }, [ensureConnected]);

  const disconnect = useCallback(async () => {
    if (!controllerRef.current) {
      setStatus({ type: "info", message: "既に未接続です" });
      return;
    }
    try {
      await controllerRef.current.clear();
    } catch (error) {
      console.error(error);
    } finally {
      setController(null);
      gatewayRef.current = null;
      roomIdRef.current = null;
      setStatus({ type: "idle", message: "切断しました" });
    }
  }, [setController]);

  const createRoom = useCallback(
    async ({ roomId, hostId, hostName, baseUrl }: CreateRoomOptions) => {
      try {
        const gateway = ensureGateway(baseUrl);
        await gateway.createRoom({ roomId, hostId, hostName });
        setStatus({ type: "success", message: "ルームを作成しました" });
        if (
          controllerRef.current &&
          roomIdRef.current === roomId
        ) {
          const state = await controllerRef.current.refresh();
          setGameState(state);
        }
      } catch (error) {
        console.error(error);
        setStatus({
          type: "error",
          message:
            error instanceof Error ? error.message : "ルーム作成に失敗しました",
        });
        throw error instanceof Error
          ? error
          : new Error("ルーム作成に失敗しました");
      }
    },
    [ensureGateway],
  );

  const joinRoom = useCallback(
    async ({ roomId, playerId, playerName, baseUrl }: JoinRoomOptions) => {
      try {
        const gateway = ensureGateway(baseUrl);
        await gateway.joinRoom({ roomId, playerId, playerName });
        setStatus({ type: "success", message: "プレイヤーが参加しました" });
        if (
          controllerRef.current &&
          roomIdRef.current === roomId
        ) {
          const state = await controllerRef.current.refresh();
          setGameState(state);
        }
      } catch (error) {
        console.error(error);
        setStatus({
          type: "error",
          message: error instanceof Error ? error.message : "参加に失敗しました",
        });
        throw error instanceof Error
          ? error
          : new Error("参加に失敗しました");
      }
    },
    [ensureGateway],
  );

  const performAction = useCallback(
    async ({ action }: PerformActionOptions) => {
      try {
        ensureConnected();
        const result = await controllerRef.current!.performAction(action);

        if (result.success) {
          setStatus({ type: "success", message: "アクションを送信しました" });
          await refresh();
        } else {
          setStatus({
            type: "error",
            message: result.errors?.join(", ") ?? "アクションに失敗しました",
          });
        }
      } catch (error) {
        console.error(error);
        setStatus({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "アクション送信に失敗しました",
        });
        throw error instanceof Error
          ? error
          : new Error("アクション送信に失敗しました");
      }
    },
    [ensureConnected, refresh],
  );

  const randomizeTurnOrder = useCallback(async () => {
    try {
      ensureConnected();
      setStatus({ type: "info", message: "順番をランダムに決定しています..." });
      const roomId = roomIdRef.current!;
      const order =
        (await gatewayRef.current!.randomizeTurnOrder(roomId)) ?? [];
      if (controllerRef.current) {
        const state = await controllerRef.current.refresh();
        setGameState(state);
      }
      setStatus({ type: "success", message: "手番順を更新しました" });
      return order;
    } catch (error) {
      console.error(error);
      setStatus({
        type: "error",
        message:
          error instanceof Error ? error.message : "順番決定に失敗しました",
      });
      throw error instanceof Error
        ? error
        : new Error("順番決定に失敗しました");
    }
  }, [ensureConnected]);

  const updateTurnOrder = useCallback(
    async (order: PlayerId[]) => {
      try {
        ensureConnected();
        if (!order || order.length === 0) {
          throw new Error("プレイヤーの順番が設定されていません。");
        }
        setStatus({ type: "info", message: "手番順を確定しています..." });
        const roomId = roomIdRef.current!;
        const nextOrder = await gatewayRef.current!.updateTurnOrder(
          roomId,
          order,
        );
        if (controllerRef.current) {
          const state = await controllerRef.current.refresh();
          setGameState(state);
        }
        setStatus({ type: "success", message: "手番順を確定しました" });
        return nextOrder;
      } catch (error) {
        console.error(error);
        setStatus({
          type: "error",
          message:
            error instanceof Error ? error.message : "手番順の更新に失敗しました",
        });
        throw error instanceof Error
          ? error
          : new Error("手番順の更新に失敗しました");
      }
    },
    [ensureConnected],
  );

  const selectCharacter = useCallback(
    async ({ playerId, characterId }: { playerId: PlayerId; characterId: string }) => {
      try {
        ensureConnected();
        await gatewayRef.current!.selectCharacter({
          roomId: roomIdRef.current!,
          playerId,
          characterId,
        });
        if (controllerRef.current) {
          const state = await controllerRef.current.refresh();
          setGameState(state);
        }
        setStatus({ type: "success", message: "キャラクターを選択しました" });
      } catch (error) {
        console.error(error);
        setStatus({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "キャラクター選択に失敗しました",
        });
        throw error instanceof Error
          ? error
          : new Error("キャラクター選択に失敗しました");
      }
    },
    [ensureConnected],
  );

  const startGame = useCallback(
    async ({ requesterId }: { requesterId: PlayerId }) => {
      try {
        ensureConnected();
        setStatus({ type: "info", message: "ゲームを開始しています..." });
        await gatewayRef.current!.startGame({
          roomId: roomIdRef.current!,
          requesterId,
        });
        if (controllerRef.current) {
          const state = await controllerRef.current.refresh();
          setGameState(state);
        }
        setStatus({ type: "success", message: "ゲームを開始しました" });
      } catch (error) {
        console.error(error);
        setStatus({
          type: "error",
          message:
            error instanceof Error ? error.message : "ゲーム開始に失敗しました",
        });
        throw error instanceof Error
          ? error
          : new Error("ゲーム開始に失敗しました");
      }
    },
    [ensureConnected],
  );

  const beginCharacterSelection = useCallback(
    async ({ requesterId }: { requesterId: PlayerId }) => {
      try {
        ensureConnected();
        setStatus({ type: "info", message: "キャラクター選択へ進めています..." });
        await gatewayRef.current!.beginCharacterSelection({
          roomId: roomIdRef.current!,
          requesterId,
        });
        if (controllerRef.current) {
          const state = await controllerRef.current.refresh();
          setGameState(state);
        }
        setStatus({ type: "success", message: "キャラクター選択へ進みました" });
      } catch (error) {
        console.error(error);
        setStatus({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "キャラクター選択への移行に失敗しました",
        });
        throw error instanceof Error
          ? error
          : new Error("キャラクター選択への移行に失敗しました");
      }
    },
    [ensureConnected],
  );

  const adjustPlayerForTest = useCallback(
    async (payload: AdjustPlayerForTestPayload) => {
      try {
        ensureConnected();
        setStatus({ type: "info", message: "テスト用にプレイヤー状態を調整しています..." });
        await controllerRef.current!.adjustPlayerForTest(payload);
        setStatus({ type: "success", message: "プレイヤーの状態を調整しました" });
      } catch (error) {
        console.error(error);
        setStatus({
          type: "error",
          message:
            error instanceof Error ? error.message : "テスト用調整に失敗しました",
        });
        throw error instanceof Error
          ? error
          : new Error("テスト用調整に失敗しました");
      }
    },
    [ensureConnected],
  );

  const isConnected = controllerRef.current !== null;

  return {
    status,
    gameState,
    isConnected,
    connect,
    refresh,
    disconnect,
    createRoom,
    joinRoom,
    performAction,
    randomizeTurnOrder,
    updateTurnOrder,
    selectCharacter,
    startGame,
    beginCharacterSelection,
    adjustPlayerForTest,
  };
}

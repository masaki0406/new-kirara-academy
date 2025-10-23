"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import type { GameState } from "@domain/types";
import type { SessionStatus } from "../hooks/useSessionClient";
import { useSessionClient } from "../hooks/useSessionClient";

const STORAGE_KEY = "kirara.session.v1";

export const DEFAULT_FUNCTIONS_BASE_URL =
  process.env.NEXT_PUBLIC_FUNCTIONS_BASE_URL ?? "/api/functions";

export type LocalRole = "host" | "guest";

export interface LocalPlayerInfo {
  id: string;
  name: string;
  role: LocalRole;
}

interface SessionContextValue {
  baseUrl: string;
  setBaseUrl(value: string): void;
  roomId: string;
  setRoomId(value: string): void;
  localPlayer: LocalPlayerInfo | null;
  setLocalPlayer(info: LocalPlayerInfo | null): void;
  status: SessionStatus;
  gameState: GameState | null;
  isConnected: boolean;
  connect(options?: { baseUrl?: string; roomId?: string }): Promise<void>;
  refresh(options?: { silent?: boolean }): Promise<void>;
  disconnect(): Promise<void>;
  createRoom(options: {
    baseUrl?: string;
    roomId: string;
    hostId: string;
    hostName: string;
  }): Promise<void>;
  joinRoom(options: {
    baseUrl?: string;
    roomId: string;
    playerId: string;
    playerName: string;
  }): Promise<void>;
  performAction: ReturnType<typeof useSessionClient>["performAction"];
  randomizeTurnOrder(): Promise<string[]>;
  updateTurnOrder(order: string[]): Promise<string[]>;
  selectCharacter(options: { playerId: string; characterId: string }): Promise<void>;
  startGame(options: { requesterId: string }): Promise<void>;
  beginCharacterSelection(options: { requesterId: string }): Promise<void>;
  adjustPlayerForTest(
    options: Omit<AdjustPlayerForTestPayload, "playerId"> & { playerId?: string },
  ): Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const client = useSessionClient();
  const isClientConnected = client.isConnected;
  const clientRefresh = client.refresh;
  const [baseUrl, setBaseUrlState] = useState(DEFAULT_FUNCTIONS_BASE_URL);
  const [roomId, setRoomIdState] = useState("");
  const [localPlayer, setLocalPlayerState] = useState<LocalPlayerInfo | null>(
    null,
  );
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          baseUrl?: string;
          roomId?: string;
          localPlayer?: LocalPlayerInfo | null;
        };
        if (parsed.baseUrl) {
          setBaseUrlState(parsed.baseUrl);
        }
        if (parsed.roomId) {
          setRoomIdState(parsed.roomId);
        }
        if (parsed.localPlayer) {
          setLocalPlayerState(parsed.localPlayer);
        }
      }
    } catch (error) {
      console.warn("Failed to load session from storage", error);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ baseUrl, roomId, localPlayer }),
      );
    } catch (error) {
      console.warn("Failed to persist session to storage", error);
    }
  }, [baseUrl, roomId, localPlayer, isHydrated]);

  const setBaseUrl = useCallback((value: string) => {
    setBaseUrlState(value);
  }, []);

  const setRoomId = useCallback((value: string) => {
    setRoomIdState(value);
  }, []);

  const setLocalPlayer = useCallback((info: LocalPlayerInfo | null) => {
    setLocalPlayerState(info);
  }, []);

  const connect = useCallback(
    async (options?: { baseUrl?: string; roomId?: string }) => {
      const nextBaseUrl = (options?.baseUrl ?? baseUrl).trim();
      const nextRoomId = (options?.roomId ?? roomId).trim();
      if (!nextBaseUrl || !nextRoomId) {
        throw new Error("Base URL と Room ID を設定してください。");
      }
      if (options?.baseUrl) {
        setBaseUrlState(nextBaseUrl);
      }
      if (options?.roomId) {
        setRoomIdState(nextRoomId);
      }
      await client.connect({ baseUrl: nextBaseUrl, roomId: nextRoomId });
    },
    [baseUrl, roomId, client],
  );

  const disconnect = useCallback(async () => {
    await client.disconnect();
  }, [client]);

  const createRoom = useCallback(
    async ({
      baseUrl: overrideBaseUrl,
      roomId: targetRoomId,
      hostId,
      hostName,
    }: {
      baseUrl?: string;
      roomId: string;
      hostId: string;
      hostName: string;
    }) => {
      const resolvedBaseUrl = (overrideBaseUrl ?? baseUrl).trim();
      const trimmedRoomId = targetRoomId.trim();
      if (!resolvedBaseUrl) {
        throw new Error("Functions Base URL を設定してください。");
      }
      if (!trimmedRoomId) {
        throw new Error("ルームIDを入力してください。");
      }
      setBaseUrlState(resolvedBaseUrl);
      setRoomIdState(trimmedRoomId);
      await client.createRoom({
        baseUrl: resolvedBaseUrl,
        roomId: trimmedRoomId,
        hostId,
        hostName,
      });
    },
    [baseUrl, client],
  );

  const joinRoom = useCallback(
    async ({
      baseUrl: overrideBaseUrl,
      roomId: targetRoomId,
      playerId,
      playerName,
    }: {
      baseUrl?: string;
      roomId: string;
      playerId: string;
      playerName: string;
    }) => {
      const resolvedBaseUrl = (overrideBaseUrl ?? baseUrl).trim();
      const trimmedRoomId = targetRoomId.trim();
      if (!resolvedBaseUrl) {
        throw new Error("Functions Base URL を設定してください。");
      }
      if (!trimmedRoomId) {
        throw new Error("ルームIDを入力してください。");
      }
      setBaseUrlState(resolvedBaseUrl);
      setRoomIdState(trimmedRoomId);
      await client.joinRoom({
        baseUrl: resolvedBaseUrl,
        roomId: trimmedRoomId,
        playerId,
        playerName,
      });
    },
    [baseUrl, client],
  );

  const refresh = useCallback(async () => {
    await clientRefresh({ silent: false });
  }, [clientRefresh]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!isClientConnected) {
      return;
    }
    const interval = window.setInterval(() => {
      clientRefresh({ silent: true }).catch((error) => {
        console.warn("Auto refresh failed", error);
      });
    }, 5000);
    return () => {
      window.clearInterval(interval);
    };
  }, [isClientConnected, clientRefresh]);

  const randomizeTurnOrder = useCallback(async () => {
    return client.randomizeTurnOrder();
  }, [client]);

  const updateTurnOrder = useCallback(
    async (order: string[]) => {
      return client.updateTurnOrder(order);
    },
    [client],
  );

  const selectCharacter = useCallback(
    async ({ playerId, characterId }: { playerId: string; characterId: string }) => {
      await client.selectCharacter({ playerId, characterId });
    },
    [client],
  );

  const startGame = useCallback(
    async ({ requesterId }: { requesterId: string }) => {
      await client.startGame({ requesterId });
    },
    [client],
  );

  const beginCharacterSelection = useCallback(
    async ({ requesterId }: { requesterId: string }) => {
      await client.beginCharacterSelection({ requesterId });
    },
    [client],
  );

  const adjustPlayerForTest = useCallback(
    async (
      options: Omit<AdjustPlayerForTestPayload, "playerId"> & { playerId?: string },
    ) => {
      const targetPlayerId = options.playerId ?? localPlayer?.id;
      if (!targetPlayerId) {
        throw new Error("調整するプレイヤーIDが設定されていません。");
      }
      await client.adjustPlayerForTest({
        playerId: targetPlayerId,
        resources: options.resources,
        lobbyStock: options.lobbyStock,
        lensCount: options.lensCount,
      });
    },
    [client, localPlayer?.id],
  );

  const value = useMemo<SessionContextValue>(
    () => ({
      baseUrl,
      setBaseUrl,
      roomId,
      setRoomId,
      localPlayer,
      setLocalPlayer,
      status: client.status,
      gameState: client.gameState,
      isConnected: client.isConnected,
      connect,
      refresh,
      disconnect,
      createRoom,
      joinRoom,
      performAction: client.performAction,
      randomizeTurnOrder,
      updateTurnOrder,
      selectCharacter,
      startGame,
      beginCharacterSelection,
      adjustPlayerForTest,
    }),
    [
      baseUrl,
      setBaseUrl,
      roomId,
      setRoomId,
      localPlayer,
      setLocalPlayer,
      client.status,
      client.gameState,
      client.isConnected,
      connect,
      refresh,
      disconnect,
      createRoom,
      joinRoom,
      client.performAction,
      randomizeTurnOrder,
      updateTurnOrder,
      selectCharacter,
      startGame,
      beginCharacterSelection,
      adjustPlayerForTest,
    ],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}

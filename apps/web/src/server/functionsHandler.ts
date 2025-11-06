import { firestoreAdmin } from "./firebaseAdmin";
import { FirestoreAdapterImpl, type FirestoreLike } from "@domain/firestoreAdapter";
import { RoomService, type CreateRoomParams, type JoinRoomParams, type LeaveRoomParams, type UpdateTurnOrderParams, type SelectCharacterParams } from "@domain/roomService";
import { GameSessionImpl } from "@domain/gameSession";
import { PhaseManagerImpl } from "@domain/phaseManager";
import { TurnOrderImpl } from "@domain/turnOrder";
import { createDefaultActionResolver } from "@domain/actionResolver";
import type {
  ActionResult,
  GameSession,
  GameState,
  PlayerAction,
  PlayerId,
  Ruleset,
} from "@domain/types";
import {
  buildRoomHandlers,
  type HandlersDeps,
  type PerformActionRequest,
  type StartGameRequest,
  type BeginCharacterSelectionRequest,
  type AdjustPlayerForTestParams,
} from "@functions/handlers";
import {
  createDevelopmentDeckInitializer,
  createVpDeckInitializer,
  loadDevelopmentCardCatalog,
  loadVpCardCatalog,
} from "@functions/developmentDeckLoader";
import type { CatalogDevelopmentCard } from "@domain/types";

interface HandlerResult {
  status: number;
  body: Record<string, unknown>;
}

function asPayload<T>(value: Record<string, unknown>): T {
  return value as unknown as T;
}

const firestoreLike = createFirestoreLike(firestoreAdmin);

const firestoreAdapter = new FirestoreAdapterImpl(firestoreLike, {
  createInitialState,
  collectionPath: "rooms",
  logsCollectionName: "logs",
  timestampProvider: () => Date.now(),
});

const roomService = new RoomService(firestoreAdapter);
const initializeDevelopmentDeck = createDevelopmentDeckInitializer(firestoreAdmin);
const initializeVpDeck = createVpDeckInitializer(firestoreAdmin);

const defaultLabs: Ruleset['labs'] = {
  polish: {
    labId: 'polish',
    name: '研磨',
    description: '開発カードを加工し、レンズ製作の準備を進めます。',
    cost: { actionPoints: 1, lobby: 1 },
    rewards: [],
  },
  'focus-light': {
    labId: 'focus-light',
    name: '集光',
    description: '創造力とロビーを使って光資源を生成します。',
    cost: { actionPoints: 1, creativity: 1, lobby: 1 },
    rewards: [
      { type: 'resource', value: { light: 1 } },
    ],
  },
  negotiation: {
    labId: 'negotiation',
    name: '根回し',
    description: '教員との調整で光を得つつ次の展開の先手番を確保します。',
    cost: { lobby: 1 },
    rewards: [
      { type: 'resource', value: { light: 1 } },
    ],
  },
  spirit: {
    labId: 'spirit',
    name: '気合',
    description: '士気を高め、行動力を回復しながら淀みを整えます。',
    cost: { lobby: 1 },
    rewards: [
      { type: 'resource', value: { actionPoints: 1, stagnation: 1 } },
    ],
  },
};

const defaultRuleset: Ruleset = {
  version: "prototype",
  resourceCaps: { light: 6, rainbow: 6, stagnation: 6 },
  endgameConversions: { light: 1, rainbow: 2, stagnation: 0 },
  characters: {},
  labs: defaultLabs,
  lenses: {},
  developmentCards: {},
  tasks: createSharedTasks(),
};

const deps: HandlersDeps = {
  roomService,
  ruleset: defaultRuleset,
  timestampProvider: () => Date.now(),
  createGameSession: (roomId: string) => createGameSession(roomId),
};

const handlers = buildRoomHandlers(deps);

export async function handleFunctionsAction(action: string, body: Record<string, unknown>): Promise<HandlerResult> {
  try {
    switch (action) {
      case "createRoom": {
        await handlers.createRoom(asPayload<CreateRoomParams>(body));
        return ok();
      }
      case "joinRoom": {
        await handlers.joinRoom(asPayload<JoinRoomParams>(body));
        return ok();
      }
      case "leaveRoom": {
        await handlers.leaveRoom(asPayload<LeaveRoomParams>(body));
        return ok();
      }
      case "randomizeTurnOrder": {
        const { roomId } = body as { roomId: string };
        const order = await handlers.randomizeTurnOrder(roomId);
        return ok({ order: order ?? [] });
      }
      case "updateTurnOrder": {
        const order = await handlers.updateTurnOrder(asPayload<UpdateTurnOrderParams>(body));
        return ok({ order });
      }
      case "selectCharacter": {
        await handlers.selectCharacter(asPayload<SelectCharacterParams>(body));
        return ok();
      }
      case "beginCharacterSelection": {
        await handlers.beginCharacterSelection(
          asPayload<BeginCharacterSelectionRequest>(body),
        );
        return ok();
      }
      case "startGame": {
        await handlers.startGame(asPayload<StartGameRequest>(body));
        return ok();
      }
      case "performAction": {
        const result = await handlers.performAction(asPayload<PerformActionRequest>(body));
        return ok({ result });
      }
      case "getRoomState": {
        const { roomId } = body as { roomId: string };
        const state = await handlers.getRoomState(roomId);
        return ok({ state });
      }
      case "adjustPlayerForTest": {
        await handlers.adjustPlayerForTest(asPayload<AdjustPlayerForTestParams>(body));
        return ok();
      }
      case "listDevelopmentCards": {
        const cards = await loadDevelopmentCardCatalog(firestoreAdmin);
        return ok({ cards: cards as CatalogDevelopmentCard[] });
      }
      case "listVpCards": {
        const cards = await loadVpCardCatalog(firestoreAdmin);
        return ok({ cards: cards as CatalogDevelopmentCard[] });
      }
      default:
        return error(404, `Unknown action: ${action}`);
    }
  } catch (err) {
    console.error(`[functions][${action}]`, err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return error(500, message);
  }
}

function ok(body: Record<string, unknown> = {}): HandlerResult {
  return { status: 200, body: { status: "ok", ...body } };
}

function error(status: number, message: string): HandlerResult {
  return {
    status,
    body: {
      status: "error",
      result: { errors: [message] },
    },
  };
}

function createGameSession(roomId: string): GameSession {
  const turnOrder = new TurnOrderImpl();
  const phaseManager = new PhaseManagerImpl({
    turnOrder,
    ruleset: defaultRuleset,
    rulesetConfig: {
      initialActionPoints: 7,
      supplyCreativity: 1,
      publicDevelopmentSlots: 8,
      stagnationPenalty: 2,
      publicVpSlots: 2,
    },
    initializeDevelopmentDeck,
    initializeVpDeck,
  });

  const actionResolver = createDefaultActionResolver();

  return new GameSessionImpl(roomId, {
    phaseManager,
    turnOrder,
    actionResolver,
    stateLoader: async () => {
      const snapshot = await firestoreAdapter.loadGameState(roomId);
      syncTurnOrderFromState(turnOrder, snapshot.state);
      return snapshot;
    },
    logWriter: (entry) => firestoreAdapter.appendLog(roomId, entry),
  });
}

function createInitialState(roomId: string): GameState {
  return {
    roomId,
    currentRound: 1,
    currentPhase: "setup",
    currentPlayerId: null,
    lifecycleStage: "lobby",
    turnOrder: [],
    players: {},
    board: {
      lenses: {},
      lobbySlots: [],
      publicDevelopmentCards: [],
      publicVpCards: [],
    },
    developmentDeck: [],
    vpDeck: [],
    lensDeck: [],
    tasks: createSharedTasks(),
    logs: [],
    labPlacements: [],
    developmentDeckInitialized: false,
    vpDeckInitialized: false,
  };
}

function createSharedTasks(): Ruleset["tasks"] {
  return {
    rainbow: {
      taskId: "rainbow",
      description: "虹トークンを 5 個集める",
      requirement: { type: "resource", resource: "rainbow", amount: 5 },
      reward: [],
      isShared: true,
    },
    light: {
      taskId: "light",
      description: "光トークンを 7 個集める",
      requirement: { type: "resource", resource: "light", amount: 7 },
      reward: [],
      isShared: true,
    },
    lens: {
      taskId: "lens",
      description: "完成レンズを 3 枚揃える",
      requirement: { type: "lens", amount: 3 },
      reward: [],
      isShared: true,
    },
  };
}

function syncTurnOrderFromState(turnOrder: TurnOrderImpl, gameState: GameState): void {
  const playerIds = Object.keys(gameState.players) as PlayerId[];
  if (playerIds.length === 0) {
    turnOrder.setInitialOrder([]);
    gameState.turnOrder = [];
    return;
  }

  const seen = new Set<PlayerId>();
  const baseOrder: PlayerId[] = [];
  const storedOrder = Array.isArray(gameState.turnOrder) ? gameState.turnOrder : [];

  storedOrder.forEach((playerId) => {
    if (playerIds.includes(playerId) && !seen.has(playerId)) {
      baseOrder.push(playerId);
      seen.add(playerId);
    }
  });

  playerIds.forEach((playerId) => {
    if (!seen.has(playerId)) {
      baseOrder.push(playerId);
      seen.add(playerId);
    }
  });

  let ordered = baseOrder;
  const currentPlayer = gameState.currentPlayerId;
  if (currentPlayer && ordered.includes(currentPlayer)) {
    const currentIndex = ordered.indexOf(currentPlayer);
    ordered = [...ordered.slice(currentIndex), ...ordered.slice(0, currentIndex)];
  } else {
    gameState.currentPlayerId = ordered[0] ?? null;
  }

  gameState.turnOrder = ordered;

  turnOrder.setInitialOrder(ordered);
  ordered.forEach((playerId) => {
    const player = gameState.players[playerId];
    if (player?.hasPassed) {
      turnOrder.markPass(playerId);
    }
    if (player?.isRooting) {
      turnOrder.registerRooting(playerId);
    }
  });
}

function createFirestoreLike(db: FirebaseFirestore.Firestore): FirestoreLike {
  return {
    doc(path: string) {
      const ref = db.doc(path);
      return {
        async get() {
          const snapshot = await ref.get();
          return {
            exists: snapshot.exists,
            data: () => snapshot.data() as unknown,
          };
        },
        async set(data: unknown, options?: { merge?: boolean }) {
          if (options?.merge) {
            await ref.set(data as FirebaseFirestore.DocumentData, { merge: true });
          } else {
            await ref.set(data as FirebaseFirestore.DocumentData);
          }
        },
        collection(collectionPath: string) {
          const collectionRef = ref.collection(collectionPath);
          return {
            async add(data: unknown) {
              await collectionRef.add(data as FirebaseFirestore.DocumentData);
            },
          };
        },
      };
    },
  };
}

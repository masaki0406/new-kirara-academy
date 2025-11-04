import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { Firestore as AdminFirestore, DocumentData } from 'firebase-admin/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { FirestoreAdapterImpl, FirestoreLike } from '../../packages/domain/src/firestoreAdapter';
import { RoomService } from '../../packages/domain/src/roomService';
import { GameSession, GameState, PlayerId, Ruleset } from '../../packages/domain/src/types';
import { GameSessionImpl } from '../../packages/domain/src/gameSession';
import { PhaseManagerImpl } from '../../packages/domain/src/phaseManager';
import { TurnOrderImpl } from '../../packages/domain/src/turnOrder';
import { createDefaultActionResolver } from '../../packages/domain/src/actionResolver';
import {
  createDevelopmentDeckInitializer,
  createVpDeckInitializer,
  loadDevelopmentCardCatalog,
  loadVpCardCatalog,
} from './developmentDeckLoader';
import {
  createRoomFunction,
  joinRoomFunction,
  leaveRoomFunction,
  randomizeTurnOrderFunction,
  updateTurnOrderFunction,
  selectCharacterFunction,
  startGameFunction,
  performActionFunction,
  getRoomStateFunction,
  beginCharacterSelectionFunction,
  adjustPlayerForTestFunction,
} from './invokeHandlers';
import { HandlersDeps } from './handlers';

if (getApps().length === 0) {
  initializeApp();
}

const firestore = getFirestore();
const firestoreLike = createFirestoreLike(firestore);

const firestoreAdapter = new FirestoreAdapterImpl(firestoreLike, {
  createInitialState,
  collectionPath: 'rooms',
  logsCollectionName: 'logs',
  timestampProvider: () => Date.now(),
});

const roomService = new RoomService(firestoreAdapter);
const initializeDevelopmentDeck = createDevelopmentDeckInitializer(firestore);
const initializeVpDeck = createVpDeckInitializer(firestore);

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
    description: '教員と調整し、次のラウンドに備えます。',
    cost: { actionPoints: 1, creativity: 1, lobby: 1 },
    rewards: [],
  },
  spirit: {
    labId: 'spirit',
    name: '気合',
    description: '士気を高め、創造力を取り戻します。',
    cost: { actionPoints: 1, creativity: 1, lobby: 1 },
    rewards: [
      { type: 'resource', value: { creativity: 1 } },
    ],
  },
};

const defaultRuleset: Ruleset = {
  version: 'prototype',
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

export const createRoom = createRoomFunction(deps);
export const joinRoom = joinRoomFunction(deps);
export const leaveRoom = leaveRoomFunction(deps);
export const randomizeTurnOrder = randomizeTurnOrderFunction(deps);
export const updateTurnOrder = updateTurnOrderFunction(deps);
export const selectCharacter = selectCharacterFunction(deps);
export const beginCharacterSelection = beginCharacterSelectionFunction(deps);
export const startGame = startGameFunction(deps);
export const performAction = performActionFunction(deps);
export const getRoomState = getRoomStateFunction(deps);
export const adjustPlayerForTest = adjustPlayerForTestFunction(deps);
export const listDevelopmentCards = onRequest(async (request, response) => {
  if (request.method !== 'POST') {
    response.status(405).json({
      status: 'error',
      result: { errors: ['Method not allowed. Use POST.'] },
    });
    return;
  }
  try {
    const cards = await loadDevelopmentCardCatalog(firestore);
    response.json({ status: 'ok', cards });
  } catch (error) {
    console.error('[listDevelopmentCards] Failed to load cards', error);
    response.status(500).json({
      status: 'error',
      result: {
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      },
    });
  }
});

export const listVpCards = onRequest(async (request, response) => {
  if (request.method !== 'POST') {
    response.status(405).json({
      status: 'error',
      result: { errors: ['Method not allowed. Use POST.'] },
    });
    return;
  }
  try {
    const cards = await loadVpCardCatalog(firestore);
    response.json({ status: 'ok', cards });
  } catch (error) {
    console.error('[listVpCards] Failed to load cards', error);
    response.status(500).json({
      status: 'error',
      result: {
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      },
    });
  }
});

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
    currentPhase: 'setup',
    currentPlayerId: null,
    lifecycleStage: 'lobby',
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

function createSharedTasks(): Ruleset['tasks'] {
  return {
    rainbow: {
      taskId: 'rainbow',
      description: '虹トークンを 5 個集める',
      requirement: { type: 'resource', resource: 'rainbow', amount: 5 },
      reward: [],
      isShared: true,
    },
    light: {
      taskId: 'light',
      description: '光トークンを 7 個集める',
      requirement: { type: 'resource', resource: 'light', amount: 7 },
      reward: [],
      isShared: true,
    },
    lens: {
      taskId: 'lens',
      description: '完成レンズを 3 枚揃える',
      requirement: { type: 'lens', amount: 3 },
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

function createFirestoreLike(db: AdminFirestore): FirestoreLike {
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
          const documentData = data as DocumentData;
          if (options?.merge) {
            await ref.set(documentData, { merge: true });
          } else {
            await ref.set(documentData);
          }
        },
        collection(collectionPath: string) {
          const collectionRef = ref.collection(collectionPath);
          return {
            async add(data: unknown) {
              await collectionRef.add(data as DocumentData);
            },
          };
        },
      };
    },
  };
}

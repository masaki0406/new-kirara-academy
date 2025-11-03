"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listVpCards = exports.listDevelopmentCards = exports.adjustPlayerForTest = exports.getRoomState = exports.performAction = exports.startGame = exports.beginCharacterSelection = exports.selectCharacter = exports.updateTurnOrder = exports.randomizeTurnOrder = exports.leaveRoom = exports.joinRoom = exports.createRoom = void 0;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const firestoreAdapter_1 = require("../../packages/domain/src/firestoreAdapter");
const roomService_1 = require("../../packages/domain/src/roomService");
const gameSession_1 = require("../../packages/domain/src/gameSession");
const phaseManager_1 = require("../../packages/domain/src/phaseManager");
const turnOrder_1 = require("../../packages/domain/src/turnOrder");
const actionResolver_1 = require("../../packages/domain/src/actionResolver");
const developmentDeckLoader_1 = require("./developmentDeckLoader");
const invokeHandlers_1 = require("./invokeHandlers");
if ((0, app_1.getApps)().length === 0) {
    (0, app_1.initializeApp)();
}
const firestore = (0, firestore_1.getFirestore)();
const firestoreLike = createFirestoreLike(firestore);
const firestoreAdapter = new firestoreAdapter_1.FirestoreAdapterImpl(firestoreLike, {
    createInitialState,
    collectionPath: 'rooms',
    logsCollectionName: 'logs',
    timestampProvider: () => Date.now(),
});
const roomService = new roomService_1.RoomService(firestoreAdapter);
const initializeDevelopmentDeck = (0, developmentDeckLoader_1.createDevelopmentDeckInitializer)(firestore);
const initializeVpDeck = (0, developmentDeckLoader_1.createVpDeckInitializer)(firestore);
const defaultRuleset = {
    version: 'prototype',
    resourceCaps: { light: 6, rainbow: 6, stagnation: 6 },
    endgameConversions: { light: 1, rainbow: 2, stagnation: 0 },
    characters: {},
    labs: {},
    lenses: {},
    developmentCards: {},
    tasks: createSharedTasks(),
};
const deps = {
    roomService,
    ruleset: defaultRuleset,
    timestampProvider: () => Date.now(),
    createGameSession: (roomId) => createGameSession(roomId),
};
exports.createRoom = (0, invokeHandlers_1.createRoomFunction)(deps);
exports.joinRoom = (0, invokeHandlers_1.joinRoomFunction)(deps);
exports.leaveRoom = (0, invokeHandlers_1.leaveRoomFunction)(deps);
exports.randomizeTurnOrder = (0, invokeHandlers_1.randomizeTurnOrderFunction)(deps);
exports.updateTurnOrder = (0, invokeHandlers_1.updateTurnOrderFunction)(deps);
exports.selectCharacter = (0, invokeHandlers_1.selectCharacterFunction)(deps);
exports.beginCharacterSelection = (0, invokeHandlers_1.beginCharacterSelectionFunction)(deps);
exports.startGame = (0, invokeHandlers_1.startGameFunction)(deps);
exports.performAction = (0, invokeHandlers_1.performActionFunction)(deps);
exports.getRoomState = (0, invokeHandlers_1.getRoomStateFunction)(deps);
exports.adjustPlayerForTest = (0, invokeHandlers_1.adjustPlayerForTestFunction)(deps);
exports.listDevelopmentCards = (0, https_1.onRequest)(async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).json({
            status: 'error',
            result: { errors: ['Method not allowed. Use POST.'] },
        });
        return;
    }
    try {
        const cards = await (0, developmentDeckLoader_1.loadDevelopmentCardCatalog)(firestore);
        response.json({ status: 'ok', cards });
    }
    catch (error) {
        console.error('[listDevelopmentCards] Failed to load cards', error);
        response.status(500).json({
            status: 'error',
            result: {
                errors: [error instanceof Error ? error.message : 'Unknown error'],
            },
        });
    }
});
exports.listVpCards = (0, https_1.onRequest)(async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).json({
            status: 'error',
            result: { errors: ['Method not allowed. Use POST.'] },
        });
        return;
    }
    try {
        const cards = await (0, developmentDeckLoader_1.loadVpCardCatalog)(firestore);
        response.json({ status: 'ok', cards });
    }
    catch (error) {
        console.error('[listVpCards] Failed to load cards', error);
        response.status(500).json({
            status: 'error',
            result: {
                errors: [error instanceof Error ? error.message : 'Unknown error'],
            },
        });
    }
});
function createGameSession(roomId) {
    const turnOrder = new turnOrder_1.TurnOrderImpl();
    const phaseManager = new phaseManager_1.PhaseManagerImpl({
        turnOrder,
        ruleset: defaultRuleset,
        rulesetConfig: {
            initialActionPoints: 2,
            publicDevelopmentSlots: 8,
            stagnationPenalty: 2,
            publicVpSlots: 2,
        },
        initializeDevelopmentDeck,
        initializeVpDeck,
    });
    const actionResolver = (0, actionResolver_1.createDefaultActionResolver)();
    return new gameSession_1.GameSessionImpl(roomId, {
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
function createInitialState(roomId) {
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
        developmentDeckInitialized: false,
        vpDeckInitialized: false,
    };
}
function createSharedTasks() {
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
function syncTurnOrderFromState(turnOrder, gameState) {
    const playerIds = Object.keys(gameState.players);
    if (playerIds.length === 0) {
        turnOrder.setInitialOrder([]);
        gameState.turnOrder = [];
        return;
    }
    const seen = new Set();
    const baseOrder = [];
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
    }
    else {
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
function createFirestoreLike(db) {
    return {
        doc(path) {
            const ref = db.doc(path);
            return {
                async get() {
                    const snapshot = await ref.get();
                    return {
                        exists: snapshot.exists,
                        data: () => snapshot.data(),
                    };
                },
                async set(data, options) {
                    const documentData = data;
                    if (options?.merge) {
                        await ref.set(documentData, { merge: true });
                    }
                    else {
                        await ref.set(documentData);
                    }
                },
                collection(collectionPath) {
                    const collectionRef = ref.collection(collectionPath);
                    return {
                        async add(data) {
                            await collectionRef.add(data);
                        },
                    };
                },
            };
        },
    };
}

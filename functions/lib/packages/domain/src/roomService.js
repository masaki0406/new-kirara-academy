"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomService = void 0;
function ensureStateDefaults(state) {
    if (!Array.isArray(state.labPlacements)) {
        state.labPlacements = [];
    }
}
class RoomService {
    constructor(adapter) {
        this.adapter = adapter;
    }
    async createRoom(params) {
        const snapshot = await this.adapter.loadGameState(params.roomId);
        const state = snapshot.state;
        ensureStateDefaults(state);
        if (!Array.isArray(state.turnOrder)) {
            state.turnOrder = [];
        }
        state.lifecycleStage = 'lobby';
        const existingResources = state.players[params.hostId]?.resources;
        state.players[params.hostId] = {
            playerId: params.hostId,
            displayName: params.hostName,
            isHost: true,
            isReady: false,
            actionPoints: 0,
            creativity: 0,
            vp: 0,
            resources: existingResources ?? {
                light: 0,
                rainbow: 0,
                stagnation: 0,
                maxCapacity: { light: 6, rainbow: 6, stagnation: 6 },
            },
            hand: [],
            ownedLenses: [],
            tasksCompleted: [],
            hasPassed: false,
            isRooting: false,
            unlockedCharacterNodes: [],
            lobbyStock: state.players[params.hostId]?.lobbyStock ?? RoomService.DEFAULT_LOBBY_STOCK,
        };
        if (!state.currentPlayerId) {
            state.currentPlayerId = params.hostId;
        }
        sanitizeTurnOrder(state);
        await snapshot.save();
        return state;
    }
    async beginCharacterSelection(params) {
        const snapshot = await this.adapter.loadGameState(params.roomId);
        const state = snapshot.state;
        ensureStateDefaults(state);
        const requester = state.players[params.requesterId];
        if (!requester) {
            throw new Error('Player not found.');
        }
        if (!requester.isHost) {
            throw new Error('Only the host can initiate character selection.');
        }
        if (state.lifecycleStage === 'inGame') {
            throw new Error('Game already started.');
        }
        state.lifecycleStage = 'characterSelect';
        await snapshot.save();
        return state;
    }
    async updateLifecycleStage(params) {
        const snapshot = await this.adapter.loadGameState(params.roomId);
        const state = snapshot.state;
        ensureStateDefaults(state);
        state.lifecycleStage = params.stage;
        await snapshot.save();
        return state;
    }
    async joinRoom(params) {
        const snapshot = await this.adapter.loadGameState(params.roomId);
        const state = snapshot.state;
        ensureStateDefaults(state);
        if (!Array.isArray(state.turnOrder)) {
            state.turnOrder = [];
        }
        if (!state.players[params.playerId]) {
            const resources = state.players[params.playerId]?.resources ?? {
                light: 0,
                rainbow: 0,
                stagnation: 0,
                maxCapacity: { light: 6, rainbow: 6, stagnation: 6 },
            };
            state.players[params.playerId] = {
                playerId: params.playerId,
                displayName: params.playerName,
                isHost: false,
                isReady: false,
                actionPoints: 0,
                creativity: 0,
                vp: 0,
                resources,
                hand: [],
                ownedLenses: [],
                tasksCompleted: [],
                hasPassed: false,
                isRooting: false,
                unlockedCharacterNodes: [],
                lobbyStock: RoomService.DEFAULT_LOBBY_STOCK,
            };
        }
        if (!state.turnOrder.includes(params.playerId)) {
            state.turnOrder.push(params.playerId);
        }
        sanitizeTurnOrder(state);
        await snapshot.save();
        return state;
    }
    async leaveRoom(params) {
        const snapshot = await this.adapter.loadGameState(params.roomId);
        const state = snapshot.state;
        ensureStateDefaults(state);
        delete state.players[params.playerId];
        if (Array.isArray(state.turnOrder)) {
            state.turnOrder = state.turnOrder.filter((id) => id !== params.playerId);
        }
        else {
            state.turnOrder = [];
        }
        const remainingPlayers = Object.keys(state.players);
        if (remainingPlayers.length === 0) {
            state.currentPlayerId = null;
        }
        else if (state.currentPlayerId === params.playerId) {
            state.currentPlayerId = this.pickRandomPlayer(remainingPlayers);
        }
        sanitizeTurnOrder(state);
        await snapshot.save();
        return state;
    }
    async randomizeTurnOrder(roomId) {
        const snapshot = await this.adapter.loadGameState(roomId);
        const state = snapshot.state;
        ensureStateDefaults(state);
        const playerIds = Object.keys(state.players);
        if (playerIds.length === 0) {
            state.turnOrder = [];
            state.currentPlayerId = null;
            return null;
        }
        shuffle(playerIds);
        state.turnOrder = [...playerIds];
        state.currentPlayerId = playerIds[0];
        sanitizeTurnOrder(state);
        await snapshot.save();
        return state.turnOrder;
    }
    async updateTurnOrder(params) {
        const snapshot = await this.adapter.loadGameState(params.roomId);
        const state = snapshot.state;
        ensureStateDefaults(state);
        const playerIds = new Set(Object.keys(state.players));
        const nextOrder = [];
        params.order.forEach((playerId) => {
            if (playerIds.has(playerId) && !nextOrder.includes(playerId)) {
                nextOrder.push(playerId);
            }
        });
        playerIds.forEach((playerId) => {
            if (!nextOrder.includes(playerId)) {
                nextOrder.push(playerId);
            }
        });
        state.turnOrder = nextOrder;
        state.currentPlayerId = nextOrder[0] ?? null;
        sanitizeTurnOrder(state);
        await snapshot.save();
        return state.turnOrder;
    }
    async adjustPlayerForTest(params) {
        const snapshot = await this.adapter.loadGameState(params.roomId);
        const state = snapshot.state;
        ensureStateDefaults(state);
        const player = state.players[params.playerId];
        if (!player) {
            throw new Error('Player not found.');
        }
        if (typeof player.lobbyStock !== 'number' || Number.isNaN(player.lobbyStock)) {
            player.lobbyStock = RoomService.DEFAULT_LOBBY_STOCK;
        }
        if (params.resources) {
            ['light', 'rainbow', 'stagnation'].forEach((resource) => {
                const value = params.resources?.[resource];
                if (typeof value === 'number' && Number.isFinite(value)) {
                    player.resources[resource] = Math.max(0, Math.floor(value));
                }
            });
        }
        if (typeof params.lobbyStock === 'number' && Number.isFinite(params.lobbyStock)) {
            player.lobbyStock = Math.max(0, Math.floor(params.lobbyStock));
        }
        if (typeof params.lensCount === 'number' && Number.isFinite(params.lensCount)) {
            const target = Math.max(0, Math.floor(params.lensCount));
            if (!Array.isArray(player.ownedLenses)) {
                player.ownedLenses = [];
            }
            const realLenses = player.ownedLenses.filter((lensId) => !lensId.startsWith('debug-lens-'));
            let nextOwned = realLenses.slice(0, Math.min(realLenses.length, target));
            if (target > nextOwned.length) {
                const needed = target - nextOwned.length;
                const timestamp = Date.now();
                const debugLenses = Array.from({ length: needed }, (_, index) => `debug-lens-${timestamp}-${index}`);
                nextOwned = nextOwned.concat(debugLenses);
            }
            player.ownedLenses = nextOwned;
        }
        await snapshot.save();
    }
    async selectCharacter(params) {
        const snapshot = await this.adapter.loadGameState(params.roomId);
        const state = snapshot.state;
        ensureStateDefaults(state);
        const player = state.players[params.playerId];
        if (!player) {
            throw new Error('Player not found.');
        }
        const conflicting = Object.values(state.players).find((p) => p.playerId !== params.playerId && p.characterId === params.characterId);
        if (conflicting) {
            throw new Error('Selected character is already taken.');
        }
        player.characterId = params.characterId;
        await snapshot.save();
        return state;
    }
    async getRoomState(roomId) {
        const snapshot = await this.adapter.loadGameState(roomId);
        const state = snapshot.state;
        ensureStateDefaults(state);
        if (!state.lifecycleStage) {
            state.lifecycleStage = 'lobby';
        }
        sanitizeTurnOrder(state);
        return state;
    }
    pickRandomPlayer(playerIds) {
        if (playerIds.length === 0) {
            throw new Error('Cannot pick a player from an empty list.');
        }
        const index = Math.floor(Math.random() * playerIds.length);
        return playerIds[index];
    }
}
exports.RoomService = RoomService;
RoomService.DEFAULT_LOBBY_STOCK = 4;
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}
function sanitizeTurnOrder(state) {
    const players = Object.keys(state.players);
    if (!Array.isArray(state.turnOrder)) {
        state.turnOrder = [];
    }
    const playerSet = new Set(players);
    const newOrder = [];
    state.turnOrder.forEach((playerId) => {
        if (playerSet.has(playerId) && !newOrder.includes(playerId)) {
            newOrder.push(playerId);
        }
    });
    players.forEach((playerId) => {
        if (!newOrder.includes(playerId)) {
            newOrder.push(playerId);
        }
    });
    state.turnOrder = newOrder;
    if (newOrder.length === 0) {
        state.currentPlayerId = null;
        return;
    }
    if (!newOrder.includes(state.currentPlayerId ?? '')) {
        state.currentPlayerId = newOrder[0];
    }
}

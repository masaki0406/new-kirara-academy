"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRoomHandlers = buildRoomHandlers;
function buildRoomHandlers(deps) {
    const timestampProvider = deps.timestampProvider ?? (() => Date.now());
    return {
        async createRoom(data) {
            await deps.roomService.createRoom(data);
            await deps.roomService.randomizeTurnOrder(data.roomId);
        },
        async joinRoom(data) {
            await deps.roomService.joinRoom(data);
        },
        async leaveRoom(data) {
            await deps.roomService.leaveRoom(data);
        },
        async randomizeTurnOrder(roomId) {
            return deps.roomService.randomizeTurnOrder(roomId);
        },
        async updateTurnOrder(data) {
            return deps.roomService.updateTurnOrder(data);
        },
        async selectCharacter(data) {
            await deps.roomService.selectCharacter(data);
        },
        async beginCharacterSelection(request) {
            await deps.roomService.beginCharacterSelection(request);
        },
        async startGame(request) {
            const state = await deps.roomService.getRoomState(request.roomId);
            const requester = state.players[request.requesterId];
            if (!requester) {
                throw new Error('Player not found.');
            }
            if (!requester.isHost) {
                throw new Error('Only the host can start the game.');
            }
            const players = Object.values(state.players);
            if (players.length === 0) {
                throw new Error('No players in the room.');
            }
            const pending = players.filter((player) => !player.characterId);
            if (pending.length > 0) {
                throw new Error('All players must select a character before starting.');
            }
            await deps.roomService.updateLifecycleStage({ roomId: request.roomId, stage: 'inGame' });
            const session = deps.createGameSession(request.roomId);
            await session.start();
        },
        async performAction(request) {
            const session = deps.createGameSession(request.roomId);
            return session.processAction(request.action, deps.ruleset, request.timestamp ?? timestampProvider());
        },
        async getRoomState(roomId) {
            return deps.roomService.getRoomState(roomId);
        },
        async adjustPlayerForTest(request) {
            await deps.roomService.adjustPlayerForTest(request);
        },
    };
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRoomFunction = createRoomFunction;
exports.joinRoomFunction = joinRoomFunction;
exports.leaveRoomFunction = leaveRoomFunction;
exports.randomizeTurnOrderFunction = randomizeTurnOrderFunction;
exports.updateTurnOrderFunction = updateTurnOrderFunction;
exports.selectCharacterFunction = selectCharacterFunction;
exports.beginCharacterSelectionFunction = beginCharacterSelectionFunction;
exports.startGameFunction = startGameFunction;
exports.performActionFunction = performActionFunction;
exports.adjustPlayerForTestFunction = adjustPlayerForTestFunction;
exports.getRoomStateFunction = getRoomStateFunction;
const https_1 = require("firebase-functions/v2/https");
const handlers_1 = require("./handlers");
function createRoomFunction(deps) {
    const handlers = (0, handlers_1.buildRoomHandlers)(deps);
    return (0, https_1.onRequest)(async (request, response) => {
        const params = request.body;
        await handlers.createRoom(params);
        response.json({ status: 'ok' });
    });
}
function joinRoomFunction(deps) {
    const handlers = (0, handlers_1.buildRoomHandlers)(deps);
    return (0, https_1.onRequest)(async (request, response) => {
        const params = request.body;
        await handlers.joinRoom(params);
        response.json({ status: 'ok' });
    });
}
function leaveRoomFunction(deps) {
    const handlers = (0, handlers_1.buildRoomHandlers)(deps);
    return (0, https_1.onRequest)(async (request, response) => {
        const params = request.body;
        await handlers.leaveRoom(params);
        response.json({ status: 'ok' });
    });
}
function randomizeTurnOrderFunction(deps) {
    const handlers = (0, handlers_1.buildRoomHandlers)(deps);
    return (0, https_1.onRequest)(async (request, response) => {
        const { roomId } = request.body;
        const order = await handlers.randomizeTurnOrder(roomId);
        response.json({ status: 'ok', order });
    });
}
function updateTurnOrderFunction(deps) {
    const handlers = (0, handlers_1.buildRoomHandlers)(deps);
    return (0, https_1.onRequest)(async (request, response) => {
        const params = request.body;
        const order = await handlers.updateTurnOrder(params);
        response.json({ status: 'ok', order });
    });
}
function selectCharacterFunction(deps) {
    const handlers = (0, handlers_1.buildRoomHandlers)(deps);
    return (0, https_1.onRequest)(async (request, response) => {
        const params = request.body;
        await handlers.selectCharacter(params);
        response.json({ status: 'ok' });
    });
}
function beginCharacterSelectionFunction(deps) {
    const handlers = (0, handlers_1.buildRoomHandlers)(deps);
    return (0, https_1.onRequest)(async (request, response) => {
        const params = request.body;
        await handlers.beginCharacterSelection(params);
        response.json({ status: 'ok' });
    });
}
function startGameFunction(deps) {
    const handlers = (0, handlers_1.buildRoomHandlers)(deps);
    return (0, https_1.onRequest)(async (request, response) => {
        const params = request.body;
        await handlers.startGame(params);
        response.json({ status: 'ok' });
    });
}
function performActionFunction(deps) {
    const handlers = (0, handlers_1.buildRoomHandlers)(deps);
    return (0, https_1.onRequest)(async (request, response) => {
        const body = request.body;
        const result = await handlers.performAction(body);
        response.json({
            status: result.success ? 'ok' : 'error',
            result,
        });
    });
}
function adjustPlayerForTestFunction(deps) {
    const handlers = (0, handlers_1.buildRoomHandlers)(deps);
    return (0, https_1.onRequest)(async (request, response) => {
        if (process.env.NODE_ENV === 'production' && process.env.ALLOW_TEST_ENDPOINT !== 'true') {
            response.status(403).json({
                status: 'error',
                result: { errors: ['Test endpoint is disabled in production.'] },
            });
            return;
        }
        try {
            const params = request.body;
            await handlers.adjustPlayerForTest(params);
            response.json({ status: 'ok' });
        }
        catch (error) {
            response.status(500).json({
                status: 'error',
                result: {
                    errors: [error instanceof Error ? error.message : 'Unknown error'],
                },
            });
        }
    });
}
function getRoomStateFunction(deps) {
    const handlers = (0, handlers_1.buildRoomHandlers)(deps);
    return (0, https_1.onRequest)(async (request, response) => {
        const { roomId } = request.body;
        const state = await handlers.getRoomState(roomId);
        response.json({ status: 'ok', state });
    });
}

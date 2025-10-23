import { HttpsFunction, onRequest } from 'firebase-functions/v2/https';
import type { Request, Response } from 'express';
import {
  HandlersDeps,
  buildRoomHandlers,
  PerformActionRequest,
  StartGameRequest,
  BeginCharacterSelectionRequest,
  AdjustPlayerForTestParams,
} from './handlers';
import {
  CreateRoomParams,
  JoinRoomParams,
  LeaveRoomParams,
  UpdateTurnOrderParams,
  SelectCharacterParams,
} from '../../packages/domain/src/roomService';

export function createRoomFunction(deps: HandlersDeps): HttpsFunction {
  const handlers = buildRoomHandlers(deps);
  return onRequest(async (request: Request, response: Response) => {
    const params = request.body as CreateRoomParams;
    await handlers.createRoom(params);
    response.json({ status: 'ok' });
  });
}

export function joinRoomFunction(deps: HandlersDeps): HttpsFunction {
  const handlers = buildRoomHandlers(deps);
  return onRequest(async (request: Request, response: Response) => {
    const params = request.body as JoinRoomParams;
    await handlers.joinRoom(params);
    response.json({ status: 'ok' });
  });
}

export function leaveRoomFunction(deps: HandlersDeps): HttpsFunction {
  const handlers = buildRoomHandlers(deps);
  return onRequest(async (request: Request, response: Response) => {
    const params = request.body as LeaveRoomParams;
    await handlers.leaveRoom(params);
    response.json({ status: 'ok' });
  });
}

export function randomizeTurnOrderFunction(deps: HandlersDeps): HttpsFunction {
  const handlers = buildRoomHandlers(deps);
  return onRequest(async (request: Request, response: Response) => {
    const { roomId } = request.body as { roomId: string };
    const order = await handlers.randomizeTurnOrder(roomId);
    response.json({ status: 'ok', order });
  });
}

export function updateTurnOrderFunction(deps: HandlersDeps): HttpsFunction {
  const handlers = buildRoomHandlers(deps);
  return onRequest(async (request: Request, response: Response) => {
    const params = request.body as UpdateTurnOrderParams;
    const order = await handlers.updateTurnOrder(params);
    response.json({ status: 'ok', order });
  });
}

export function selectCharacterFunction(deps: HandlersDeps): HttpsFunction {
  const handlers = buildRoomHandlers(deps);
  return onRequest(async (request: Request, response: Response) => {
    const params = request.body as SelectCharacterParams;
    await handlers.selectCharacter(params);
    response.json({ status: 'ok' });
  });
}

export function beginCharacterSelectionFunction(deps: HandlersDeps): HttpsFunction {
  const handlers = buildRoomHandlers(deps);
  return onRequest(async (request: Request, response: Response) => {
    const params = request.body as BeginCharacterSelectionRequest;
    await handlers.beginCharacterSelection(params);
    response.json({ status: 'ok' });
  });
}

export function startGameFunction(deps: HandlersDeps): HttpsFunction {
  const handlers = buildRoomHandlers(deps);
  return onRequest(async (request: Request, response: Response) => {
    const params = request.body as StartGameRequest;
    await handlers.startGame(params);
    response.json({ status: 'ok' });
  });
}

export function performActionFunction(deps: HandlersDeps): HttpsFunction {
  const handlers = buildRoomHandlers(deps);
  return onRequest(async (request: Request, response: Response) => {
    const body = request.body as PerformActionRequest;
    const result = await handlers.performAction(body);
    response.json({
      status: result.success ? 'ok' : 'error',
      result,
    });
  });
}

export function adjustPlayerForTestFunction(deps: HandlersDeps): HttpsFunction {
  const handlers = buildRoomHandlers(deps);
  return onRequest(async (request: Request, response: Response) => {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_TEST_ENDPOINT !== 'true') {
      response.status(403).json({
        status: 'error',
        result: { errors: ['Test endpoint is disabled in production.'] },
      });
      return;
    }

    try {
      const params = request.body as AdjustPlayerForTestParams;
      await handlers.adjustPlayerForTest(params);
      response.json({ status: 'ok' });
    } catch (error) {
      response.status(500).json({
        status: 'error',
        result: {
          errors: [error instanceof Error ? error.message : 'Unknown error'],
        },
      });
    }
  });
}

export function getRoomStateFunction(deps: HandlersDeps): HttpsFunction {
  const handlers = buildRoomHandlers(deps);
  return onRequest(async (request: Request, response: Response) => {
    const { roomId } = request.body as { roomId: string };
    const state = await handlers.getRoomState(roomId);
    response.json({ status: 'ok', state });
  });
}

import { describe, it, expect } from 'vitest';
import { createSessionClient } from '../src/client/sessionClient';
import type { GameState } from '../src/types';

describe('createSessionClient', () => {
  it('creates a controller that can initialize and perform actions', async () => {
    const roomId = 'room-xyz';
    const baseUrl = 'http://localhost/mock';
    let storedState = createState(roomId);

    const fetchImpl: typeof fetch = async (url, init) => {
      const normalizedUrl =
        typeof url === 'string'
          ? url
          : url instanceof URL
            ? url.toString()
            : url.url;
      const path = new URL(normalizedUrl).pathname;
      const body = init?.body ? JSON.parse(init.body as string) : {};

      if (path.endsWith('/getRoomState')) {
        return createResponse({
          status: 'ok',
          state: storedState,
        });
      }

      if (path.endsWith('/performAction')) {
        if (body.action?.actionType === 'pass') {
          storedState = {
            ...storedState,
            players: {
              ...storedState.players,
              [body.action.playerId]: {
                ...storedState.players[body.action.playerId],
                hasPassed: true,
              },
            },
          };
          return createResponse({
            status: 'ok',
            result: { success: true },
          });
        }
        return createResponse({
          status: 'error',
          result: { success: false, errors: ['unknown action'] },
        }, 400);
      }

      throw new Error(`Unhandled path: ${path}`);
    };

    const controller = createSessionClient({
      roomId,
      baseUrl,
      fetchImpl,
    });

    const initial = await controller.initialize();
    expect(initial.roomId).toBe(roomId);
    expect(initial.players['player-1'].hasPassed).toBe(false);

    const result = await controller.performAction({
      playerId: 'player-1',
      actionType: 'pass',
      payload: {},
    });

    expect(result.success).toBe(true);
    const state = controller.getState();
    expect(state?.players['player-1'].hasPassed).toBe(true);
  });
});

function createState(roomId: string): GameState {
  return {
    roomId,
    currentRound: 1,
    currentPhase: 'setup',
    currentPlayerId: 'player-1',
    lifecycleStage: 'lobby',
    turnOrder: ['player-1'],
    players: {
      'player-1': {
        playerId: 'player-1',
        displayName: 'Player One',
        isHost: true,
        isReady: false,
        actionPoints: 0,
        creativity: 0,
        vp: 0,
        resources: {
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
      },
    },
    board: {
      lenses: {},
      lobbySlots: [],
      publicDevelopmentCards: [],
      publicVpCards: [],
    },
    developmentDeck: [],
    vpDeck: [],
    lensDeck: [],
    tasks: {},
    logs: [],
  };
}

function createResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    },
  } as Response;
}

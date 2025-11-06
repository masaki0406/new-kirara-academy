import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateRooting,
  applyRooting,
  validatePass,
  applyPass,
  validateLabActivate,
  applyLabActivate,
  validateLensActivate,
  applyLensActivate,
  validateCollect,
  applyCollect,
  validateWill,
  applyWill,
  validatePersuasion,
  applyPersuasion,
} from '@domain/actionHandlers';
import { TurnOrderImpl } from '@domain/turnOrder';
import {
  ActionContext,
  DEFAULT_FOUNDATION_STOCK,
  GameState,
  PlayerAction,
  Ruleset,
  PlayerId,
} from '@domain/types';

const baseRuleset: Ruleset = {
  version: 'test',
  resourceCaps: { light: 6, rainbow: 6, stagnation: 6 },
  endgameConversions: { light: 0, rainbow: 0, stagnation: 0 },
  characters: {
    hero: {
      characterId: 'hero',
      name: 'Hero',
      nodes: [
        {
          nodeId: 'will-resource',
          position: '①',
          effect: {
            type: 'active',
            payload: {
              cost: { creativity: 2 },
              rewards: [
                {
                  type: 'resource',
                  value: { light: 1, rainbow: 1 },
                },
                {
                  type: 'growth',
                  value: { unlockNodeId: 'nxt', vp: 5 },
                },
              ],
            },
          },
        },
        {
          nodeId: 'will-capacity',
          position: '②',
          effect: {
            type: 'active',
            payload: {
              cost: { creativity: 1 },
              setCapacityUnlimited: ['rainbow'],
              rewards: [
                {
                  type: 'resource',
                  value: { rainbow: 3 },
                },
              ],
            },
          },
        },
        {
          nodeId: 'trigger-lens-owner',
          position: '③',
          effect: {
            type: 'trigger',
            payload: {
              event: 'lensActivatedByOther',
              amount: 3,
            },
          },
        },
        {
          nodeId: 'trigger-lens-actor',
          position: '④',
          effect: {
            type: 'trigger',
            payload: {
              event: 'actionPerformed',
              actionType: 'lensActivate',
              amount: 2,
            },
          },
        },
        {
          nodeId: 'trigger-collect',
          position: '⑤',
          effect: {
            type: 'trigger',
            payload: {
              event: 'actionPerformed',
              actionType: 'collect',
              amount: 1,
            },
          },
        },
        {
          nodeId: 'trigger-slot',
          position: '⑥',
          effect: {
            type: 'trigger',
            payload: {
              event: 'developmentSlotFreed',
              amount: 1,
            },
          },
        },
      ],
    },
  },
  labs: {
    'lab-1': {
      labId: 'lab-1',
      name: 'Starter Lab',
      cost: { actionPoints: 1 },
      rewards: [
        {
          type: 'resource',
          value: { light: 1 },
        },
      ],
    },
    'focus-light': {
      labId: 'focus-light',
      name: '集光',
      cost: { actionPoints: 1, creativity: 1, lobby: 1 },
      rewards: [
        {
          type: 'resource',
          value: { light: 1 },
        },
      ],
    },
    'resource-burst': {
      labId: 'resource-burst',
      name: '資源供給',
      cost: { actionPoints: 1 },
      rewards: [
        {
          type: 'resource',
          value: { light: 6, rainbow: 6, stagnation: 6 },
        },
      ],
    },
    'reward-boost': {
      labId: 'reward-boost',
      name: '精神統一',
      cost: { actionPoints: 1 },
      rewards: [
        {
          type: 'resource',
          value: { actionPoints: 5, creativity: 5 },
        },
      ],
    },
    negotiation: {
      labId: 'negotiation',
      name: '根回し',
      cost: { lobby: 1 },
      rewards: [
        {
          type: 'resource',
          value: { light: 1 },
        },
      ],
    },
    spirit: {
      labId: 'spirit',
      name: '気合',
      cost: { actionPoints: 0, lobby: 1 },
      rewards: [
        {
          type: 'resource',
          value: { actionPoints: 1, stagnation: 1 },
        },
      ],
    },
  },
  lenses: {},
  developmentCards: {},
  tasks: {},
};

function createGameState(overrides?: Partial<GameState>): GameState {
  const players: GameState['players'] = {
    a: {
      playerId: 'a',
      displayName: 'Player A',
      characterId: 'hero',
      actionPoints: 2,
      creativity: 3,
      vp: 0,
      resources: {
        light: 0,
        rainbow: 0,
        stagnation: 0,
        maxCapacity: { light: 6, rainbow: 6, stagnation: 6 },
      },
      collectedDevelopmentCards: [],
      collectedVpCards: [],
      collectedFoundationCards: {},
      ownedLenses: [],
      tasksCompleted: [],
      hasPassed: false,
      unlockedCharacterNodes: [],
    },
    b: {
      playerId: 'b',
      displayName: 'Player B',
      characterId: 'hero',
      actionPoints: 2,
      creativity: 0,
      vp: 0,
      resources: {
        light: 0,
        rainbow: 0,
        stagnation: 0,
        maxCapacity: { light: 6, rainbow: 6, stagnation: 6 },
      },
      collectedDevelopmentCards: [],
      collectedVpCards: [],
      collectedFoundationCards: {},
      ownedLenses: [],
      tasksCompleted: [],
      hasPassed: false,
      unlockedCharacterNodes: [],
    },
  };

  const state: GameState = {
    roomId: 'room-1',
    currentRound: 1,
    currentPhase: 'main',
    currentPlayerId: 'a',
    lifecycleStage: 'lobby',
    turnOrder: ['a', 'b'],
    players,
    board: {
      lenses: {},
      lobbySlots: [],
      publicDevelopmentCards: ['dev-1'],
      publicVpCards: [],
      foundationStock: { ...DEFAULT_FOUNDATION_STOCK },
    },
    developmentDeck: [],
    vpDeck: [],
    lensDeck: [],
    tasks: {},
    logs: [],
    labPlacements: [],
  };

  return {
    ...state,
    ...overrides,
    board: {
      ...state.board,
      ...(overrides?.board ?? {}),
    },
    players: {
      ...state.players,
      ...(overrides?.players ?? {}),
    },
  };
}

function createContext(gameState: GameState, turnOrder?: TurnOrderImpl): ActionContext {
  return {
    gameState,
    ruleset: baseRuleset,
    timestamp: Date.now(),
    turnOrder,
  };
}

describe('labActivate focus-light', () => {
  it('consumes creativity and lobby stock while granting light', async () => {
    const baseState = createGameState();
    const gameState = createGameState({
      players: {
        a: {
          ...baseState.players.a,
          actionPoints: 2,
          creativity: 2,
          lobbyStock: 2,
        },
      },
      labPlacements: [],
    });
    const action: PlayerAction = {
      playerId: 'a',
      actionType: 'labActivate',
      payload: { labId: 'focus-light' },
    };

    const errors = await validateLabActivate(action, createContext(gameState));
    expect(errors).toHaveLength(0);

    await applyLabActivate(action, createContext(gameState));

    const player = gameState.players.a;
    expect(player.actionPoints).toBe(1);
    expect(player.creativity).toBe(1);
    expect(player.resources.light).toBe(1);
    expect(player.lobbyStock).toBe(1);
    expect(gameState.labPlacements).toEqual([
      { labId: 'focus-light', playerId: 'a', count: 1 },
    ]);
  });

  it('rejects when creativity or lobby stock are insufficient', async () => {
    const baseState = createGameState();
    const gameState = createGameState({
      players: {
        a: {
          ...baseState.players.a,
          creativity: 0,
          lobbyStock: 0,
        },
      },
    });
    const action: PlayerAction = {
      playerId: 'a',
      actionType: 'labActivate',
      payload: { labId: 'focus-light' },
    };

    const errors = await validateLabActivate(action, createContext(gameState));
    expect(errors).toContain('創造力が不足しています');
    expect(errors).toContain('ロビー在庫が不足しています');
  });

  it('prevents exceeding light capacity', async () => {
    const baseState = createGameState();
    const gameState = createGameState({
      players: {
        a: {
          ...baseState.players.a,
          resources: {
            ...baseState.players.a.resources,
            light: 6,
          },
          lobbyStock: 2,
        },
      },
    });
    const action: PlayerAction = {
      playerId: 'a',
      actionType: 'labActivate',
      payload: { labId: 'focus-light' },
    };

    const errors = await validateLabActivate(action, createContext(gameState));
    expect(errors).toContain('light の上限を超えます');
  });
});

describe('labActivate negotiation', () => {
  it('grants light and rooting when available', async () => {
    const baseState = createGameState();
    const gameState = createGameState({
      players: {
        a: {
          ...baseState.players.a,
          lobbyStock: 3,
        },
      },
      labPlacements: [],
    });
    const turnOrder = new TurnOrderImpl();
    turnOrder.setInitialOrder(['a', 'b']);
    const action: PlayerAction = {
      playerId: 'a',
      actionType: 'labActivate',
      payload: { labId: 'negotiation' },
    };

    const errors = await validateLabActivate(action, createContext(gameState, turnOrder));
    expect(errors).toHaveLength(0);

    await applyLabActivate(action, createContext(gameState, turnOrder));

    const player = gameState.players.a;
    expect(player.isRooting).toBe(true);
    expect(player.resources.light).toBe(1);
    expect(player.lobbyStock).toBe(2);
    expect(gameState.labPlacements).toEqual([
      { labId: 'negotiation', playerId: 'a', count: 1 },
    ]);
  });

  it('rejects when negotiation already used', async () => {
    const gameState = createGameState({
      labPlacements: [{ labId: 'negotiation', playerId: 'a', count: 1 }],
    });
    const action: PlayerAction = {
      playerId: 'b',
      actionType: 'labActivate',
      payload: { labId: 'negotiation' },
    };

    const errors = await validateLabActivate(action, createContext(gameState));
    expect(errors).toContain('根回しは既に利用されています');
  });

  it('rejects when another player already rooted', async () => {
    const baseState = createGameState();
    const gameState = createGameState({
      players: {
        ...baseState.players,
        a: {
          ...baseState.players.a,
          isRooting: true,
        },
      },
    });
    const action: PlayerAction = {
      playerId: 'b',
      actionType: 'labActivate',
      payload: { labId: 'negotiation' },
    };

    const errors = await validateLabActivate(action, createContext(gameState));
    expect(errors).toContain('根回しはこのラウンドで既に行われています');
  });
});

describe('persuasion action', () => {
  it('activates a lens using an opponent lobby', async () => {
    const baseState = createGameState();
    const gameState = createGameState({
      players: {
        a: {
          ...baseState.players.a,
          actionPoints: 5,
          resources: {
            ...baseState.players.a.resources,
            light: 2,
          },
        },
        b: {
          ...baseState.players.b,
          lobbyUsed: 0,
        },
      },
      board: {
        ...baseState.board,
        lenses: {
          'lens-1': {
            lensId: 'lens-1',
            ownerId: 'b',
            cost: { light: 1 },
            rewards: [
              {
                type: 'resource',
                value: { rainbow: 1 },
              },
            ],
            slots: 1,
            tags: [],
            status: 'available',
          },
        },
        lobbySlots: [
          {
            lensId: 'lens-1',
            ownerId: 'b',
            occupantId: 'b',
            isActive: true,
          },
        ],
      },
    });
    const action: PlayerAction = {
      playerId: 'a',
      actionType: 'persuasion',
      payload: { lensId: 'lens-1' },
    };

    const errors = await validatePersuasion(action, createContext(gameState));
    expect(errors).toHaveLength(0);

    await applyPersuasion(action, createContext(gameState));

    const player = gameState.players.a;
    expect(player.actionPoints).toBe(3);
    expect(player.resources.light).toBe(1);
    expect(player.resources.rainbow).toBe(1);

    const lens = gameState.board.lenses['lens-1'];
    expect(lens.status).toBe('exhausted');

    const slot = gameState.board.lobbySlots.find((item) => item.lensId === 'lens-1');
    expect(slot?.occupantId).toBeUndefined();

    const opponent = gameState.players.b;
    expect(opponent.lobbyUsed).toBe(1);
  });

  it('rejects when no opponent lobby is present', async () => {
    const baseState = createGameState({
      board: {
        lenses: {
          'lens-1': {
            lensId: 'lens-1',
            ownerId: 'b',
            cost: {},
            rewards: [],
            slots: 1,
            tags: [],
            status: 'available',
          },
        },
        lobbySlots: [],
        publicDevelopmentCards: [],
        publicVpCards: [],
      },
    });
    const action: PlayerAction = {
      playerId: 'a',
      actionType: 'persuasion',
      payload: { lensId: 'lens-1' },
    };

    const errors = await validatePersuasion(action, createContext(baseState));
    expect(errors).toContain('相手のロビーが配置されていません');
  });

  it('rejects when action points are insufficient', async () => {
    const baseState = createGameState({
      players: {
        a: {
          actionPoints: 1,
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
          unlockedCharacterNodes: [],
        },
        b: createGameState().players.b,
      },
      board: {
        lenses: {
          'lens-1': {
            lensId: 'lens-1',
            ownerId: 'b',
            cost: {},
            rewards: [],
            slots: 1,
            tags: [],
            status: 'available',
          },
        },
        lobbySlots: [
          {
            lensId: 'lens-1',
            ownerId: 'b',
            occupantId: 'b',
            isActive: true,
          },
        ],
        publicDevelopmentCards: [],
        publicVpCards: [],
      },
    });
    const action: PlayerAction = {
      playerId: 'a',
      actionType: 'persuasion',
      payload: { lensId: 'lens-1' },
    };

    const errors = await validatePersuasion(action, createContext(baseState));
    expect(errors).toContain('行動力が不足しています');
  });
});

describe('labActivate resource handling', () => {
  it('limits total resources gained to the global cap', async () => {
    const baseState = createGameState();
    const gameState = createGameState({
      players: {
        a: {
          ...baseState.players.a,
          actionPoints: 3,
          creativity: 0,
        },
      },
    });

    const action: PlayerAction = {
      playerId: 'a',
      actionType: 'labActivate',
      payload: { labId: 'resource-burst' },
    };

    const errors = await validateLabActivate(action, createContext(gameState));
    expect(errors).toHaveLength(0);

    await applyLabActivate(action, createContext(gameState));

    const resources = gameState.players.a.resources;
    expect(resources.light).toBe(6);
    expect(resources.rainbow).toBe(6);
    expect(resources.stagnation).toBe(0);
    expect(resources.light + resources.rainbow + resources.stagnation).toBeLessThanOrEqual(12);
  });

  it('clamps action points and creativity gained from rewards', async () => {
    const baseState = createGameState();
    const gameState = createGameState({
      players: {
        a: {
          ...baseState.players.a,
          actionPoints: 9,
          creativity: 4,
        },
      },
    });

    const action: PlayerAction = {
      playerId: 'a',
      actionType: 'labActivate',
      payload: { labId: 'reward-boost' },
    };

    const errors = await validateLabActivate(action, createContext(gameState));
    expect(errors).toHaveLength(0);

    await applyLabActivate(action, createContext(gameState));

    const player = gameState.players.a;
    expect(player.actionPoints).toBeLessThanOrEqual(10);
    expect(player.creativity).toBeLessThanOrEqual(5);
    expect(player.actionPoints).toBe(10);
    expect(player.creativity).toBe(5);
  });
});

describe('rooting action', () => {
  it('allows rooting when no one has rooted yet', async () => {
    const gameState = createGameState();
    const result = await validateRooting({
      playerId: 'a',
      actionType: 'rooting',
      payload: {},
    }, createContext(gameState));

    expect(result).toHaveLength(0);
  });

  it('prevents rooting if another player already rooted', async () => {
    const gameState = createGameState({
      players: {
        a: {
          ...createGameState().players.a,
          isRooting: true,
        },
      },
    });

    const result = await validateRooting({
      playerId: 'b',
      actionType: 'rooting',
      payload: {},
    }, createContext(gameState));

    expect(result).toContain('根回しはこのラウンドで既に行われています');
  });

  it('applies rooting effects (flag + light gain)', async () => {
    const gameState = createGameState();
    await applyRooting({
      playerId: 'a',
      actionType: 'rooting',
      payload: {},
    }, createContext(gameState));

    expect(gameState.players.a.isRooting).toBe(true);
    expect(gameState.players.a.resources.light).toBe(1);
  });
});

describe('pass action', () => {
  let turnOrder: TurnOrderImpl;
  let gameState: GameState;

  beforeEach(() => {
    turnOrder = new TurnOrderImpl();
    turnOrder.setInitialOrder(['a', 'b']);
    gameState = createGameState();
  });

  it('validates current player and prevents double pass', async () => {
    const context = createContext(gameState, turnOrder);
    const action: PlayerAction = {
      playerId: 'a',
      actionType: 'pass',
      payload: {},
    };

    expect(await validatePass(action, context)).toHaveLength(0);

    // mark pass once and try again
    await applyPass(action, context);
    expect(gameState.players.a.hasPassed).toBe(true);
    const secondAttempt = await validatePass(action, context);
    expect(secondAttempt).toContain('既にパスしています');
  });

  it('advances turn order to next player when passing', async () => {
    const context = createContext(gameState, turnOrder);
    await applyPass({ playerId: 'a', actionType: 'pass', payload: {} }, context);

    expect(gameState.currentPlayerId).toBe('b');
    expect(turnOrder.current()).toBe('b');
    expect(gameState.players.a.hasPassed).toBe(true);
  });
});

describe('will action', () => {
  it('validates cost and applies rewards', async () => {
    const gameState = createGameState({
      players: {
        a: {
          ...createGameState().players.a,
          creativity: 3,
          unlockedCharacterNodes: ['will-resource'],
        },
      },
    });

    const context = createContext(gameState);
    const action: PlayerAction = {
      playerId: 'a',
      actionType: 'will',
      payload: { nodeId: 'will-resource' },
    };

    expect(await validateWill(action, context)).toHaveLength(0);
    await applyWill(action, context);

    expect(gameState.players.a.creativity).toBe(1);
    expect(gameState.players.a.resources.light).toBe(1);
    expect(gameState.players.a.resources.rainbow).toBe(1);
    expect(gameState.players.a.unlockedCharacterNodes).toContain('nxt');
    expect(gameState.players.a.vp).toBe(5);
  });

  it('fails when creativity is insufficient', async () => {
    const gameState = createGameState({
      players: {
        a: {
          ...createGameState().players.a,
          creativity: 1,
          unlockedCharacterNodes: ['will-resource'],
        },
      },
    });

    const context = createContext(gameState);
    const action: PlayerAction = {
      playerId: 'a',
      actionType: 'will',
      payload: { nodeId: 'will-resource' },
    };

    const errors = await validateWill(action, context);
    expect(errors).toContain('創造力が不足しています');
  });

  it('allows capacity unlock before granting resources', async () => {
    const gameState = createGameState({
      players: {
        a: {
          ...createGameState().players.a,
          creativity: 2,
          resources: {
            light: 0,
            rainbow: 6,
            stagnation: 0,
            maxCapacity: { light: 6, rainbow: 6, stagnation: 6 },
          },
          unlockedCharacterNodes: ['will-capacity'],
        },
      },
    });

    const context = createContext(gameState);
    const action: PlayerAction = {
      playerId: 'a',
      actionType: 'will',
      payload: { nodeId: 'will-capacity' },
    };

    expect(await validateWill(action, context)).toHaveLength(0);
    await applyWill(action, context);

    expect(gameState.players.a.creativity).toBe(1);
    expect(gameState.players.a.resources.rainbow).toBe(9);
    expect(gameState.players.a.resources.unlimited?.rainbow).toBe(true);
  });
});

describe('trigger events', () => {
  it('awards lens owner when another player activates their lens', async () => {
    const gameState = createGameState({
      players: {
        a: {
          ...createGameState().players.a,
          characterId: 'hero',
          unlockedCharacterNodes: ['trigger-lens-owner'],
        },
        b: {
          ...createGameState().players.b,
          characterId: 'hero',
          unlockedCharacterNodes: [],
        },
      },
      currentPlayerId: 'b',
      board: {
        lenses: {
          lens1: {
            lensId: 'lens1',
            ownerId: 'a',
            cost: {},
            rewards: [],
            slots: 1,
            tags: [],
            status: 'available',
          },
        },
        lobbySlots: [
          {
            lensId: 'lens1',
            ownerId: 'a',
            occupantId: 'b',
            isActive: true,
          },
        ],
        publicDevelopmentCards: ['dev-1'],
      },
    });

    const context = createContext(gameState);
    const action: PlayerAction = {
      playerId: 'b',
      actionType: 'lensActivate',
      payload: { lensId: 'lens1' },
    };

    expect(await validateLensActivate(action, context)).toHaveLength(0);
    await applyLensActivate(action, context);

    expect(gameState.players.a.vp).toBe(3);
  });

  it('awards actor when they have lens activation trigger', async () => {
    const base = createGameState({
      players: {
        a: {
          ...createGameState().players.a,
          characterId: 'hero',
          unlockedCharacterNodes: ['trigger-lens-actor'],
        },
      },
      board: {
        lenses: {
          lens1: {
            lensId: 'lens1',
            ownerId: 'a',
            cost: {},
            rewards: [],
            slots: 1,
            tags: [],
            status: 'available',
          },
        },
        lobbySlots: [
          {
            lensId: 'lens1',
            ownerId: 'a',
            occupantId: undefined,
            isActive: true,
          },
        ],
        publicDevelopmentCards: ['dev-1'],
      },
    });

    const action: PlayerAction = {
      playerId: 'a',
      actionType: 'lensActivate',
      payload: { lensId: 'lens1' },
    };

    const context = createContext(base);
    expect(await validateLensActivate(action, context)).toHaveLength(0);
    await applyLensActivate(action, context);

    expect(base.players.a.vp).toBe(2);
  });

  it('applies collect on development row and triggers effects', async () => {
    const gameState = createGameState({
      players: {
        a: {
          ...createGameState().players.a,
          actionPoints: 2,
          characterId: 'hero',
          unlockedCharacterNodes: ['trigger-collect', 'trigger-slot'],
        },
      },
      board: {
        lenses: {},
        lobbySlots: [],
        publicDevelopmentCards: ['dev-1', 'dev-2'],
      },
      developmentDeck: ['dev-3'],
    });

    const context = createContext(gameState);
    const action: PlayerAction = {
      playerId: 'a',
      actionType: 'collect',
      payload: { slotIndex: 0, slotType: 'development' },
    };

    expect(await validateCollect(action, context)).toHaveLength(0);
    await applyCollect(action, context);

    expect(gameState.players.a.vp).toBe(2);
    expect(gameState.players.a.actionPoints).toBe(0);
    expect(gameState.players.a.collectedDevelopmentCards).toEqual(['dev-1']);
    expect(gameState.board.publicDevelopmentCards.length).toBe(2);
    expect(gameState.board.publicDevelopmentCards[0]).toBe('dev-3');
  });

  it('applies collect on VP row', async () => {
    const gameState = createGameState({
      players: {
        a: {
          ...createGameState().players.a,
          actionPoints: 4,
        },
      },
      board: {
        lenses: {},
        lobbySlots: [],
        publicDevelopmentCards: [],
        publicVpCards: ['vp-1', 'vp-2'],
      },
      vpDeck: ['vp-3'],
    });

    const context = createContext(gameState);
    const action: PlayerAction = {
      playerId: 'a',
      actionType: 'collect',
      payload: { slotIndex: 1, slotType: 'vp' },
    };

    expect(await validateCollect(action, context)).toHaveLength(0);
    await applyCollect(action, context);

  expect(gameState.players.a.collectedVpCards).toEqual(['vp-2']);
  expect(gameState.board.publicVpCards.length).toBe(2);
  expect(gameState.board.publicVpCards[1]).toBe('vp-3');
  });

  it('applies collect on foundation supply', async () => {
    const baseState = createGameState();
    const gameState = createGameState({
      players: {
        a: {
          ...baseState.players.a,
          actionPoints: 4,
          collectedFoundationCards: {},
        },
      },
      board: {
        ...baseState.board,
        foundationStock: { 2: 1 },
      },
    });

    const action: PlayerAction = {
      playerId: 'a',
      actionType: 'collect',
      payload: { slotType: 'foundation', foundationCost: 2 },
    };

    expect(await validateCollect(action, createContext(gameState))).toHaveLength(0);
    await applyCollect(action, createContext(gameState));

    expect(gameState.players.a.actionPoints).toBe(2);
    expect(gameState.players.a.collectedFoundationCards?.[2]).toBe(1);
    expect(gameState.board.foundationStock?.[2]).toBeUndefined();
  });

  it('rejects foundation collect when stock depleted', async () => {
    const baseState = createGameState();
    const gameState = createGameState({
      players: {
        a: {
          ...baseState.players.a,
          actionPoints: 4,
        },
      },
      board: {
        ...baseState.board,
        foundationStock: { 3: 0 },
      },
    });

    const action: PlayerAction = {
      playerId: 'a',
      actionType: 'collect',
      payload: { slotType: 'foundation', foundationCost: 3 },
    };

    const errors = await validateCollect(action, createContext(gameState));
    expect(errors).toContain('指定された土台カードは在庫がありません');
  });
});

describe('lab activation capacity check', () => {
  it('prevents activation when resource cap would overflow', async () => {
    const gameState = createGameState({
      players: {
        a: {
          ...createGameState().players.a,
          resources: {
            light: 6,
            rainbow: 0,
            stagnation: 0,
            maxCapacity: { light: 6, rainbow: 6, stagnation: 6 },
          },
        },
      },
    });

    const errors = await validateLabActivate({
      playerId: 'a',
      actionType: 'labActivate',
      payload: { labId: 'lab-1' },
    }, createContext(gameState));

    expect(errors).toContain('light の上限を超えます');
  });
});

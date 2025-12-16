import { describe, it, expect, beforeEach } from 'vitest';
import { GameSessionImpl } from '../src/gameSession';
import {
    GameState,
    Ruleset,
} from '../src/types';
import { characters } from '../src/rules/characters';

// Mock Ruleset
const mockRuleset: Ruleset = {
    characters,
    endgameConversions: { light: 1, rainbow: 3 },
    version: '1.0.0',
    resourceCaps: { light: 10, rainbow: 10, stagnation: 10 },
    labs: {},
    lenses: {},
    tasks: {},
    developmentCards: {},
};

describe('Kazari Hizumi Corrections Verification', () => {
    let session: GameSessionImpl;
    let state: GameState;

    beforeEach(async () => {
        const mockState: GameState = {
            roomId: 'test-room',
            currentRound: 1,
            currentPhase: 'setup',
            lifecycleStage: 'active' as any,
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
            tasks: {},
            logs: [],
            labPlacements: [],
            turnOrder: [],
            currentPlayerId: 'p1',
            developmentDeckInitialized: true,
            vpDeckInitialized: true,
        };

        const mockMutableState = {
            state: mockState,
            save: async () => { },
        };

        const mockPhaseManager = {
            preparePhase: async () => { },
            mainPhase: async () => { },
            endPhase: async () => { },
            finalScoring: async () => { },
        };

        const mockTurnOrder = {
            setInitialOrder: () => { },
            current: () => 'p1',
            nextPlayer: () => null,
            markPass: () => { },
            registerRooting: () => { },
            hasAllPassed: () => false,
            passedCount: () => 0,
            totalCount: () => 2,
            resolveNextRoundStarter: () => null,
        };

        const mockActionResolver = {
            resolve: async () => ({ success: true }),
        };

        session = new GameSessionImpl('test-room', {
            phaseManager: mockPhaseManager,
            turnOrder: mockTurnOrder,
            stateLoader: async () => mockMutableState,
            actionResolver: mockActionResolver,
        });

        await session.start();
        state = mockState;

        // Setup 2 players
        state.players['p1'] = {
            playerId: 'p1',
            displayName: 'Player 1',
            vp: 0,
            actionPoints: 7,
            creativity: 1,
            resources: { light: 0, rainbow: 0, stagnation: 0, maxCapacity: { light: 10, rainbow: 10, stagnation: 10 } },
            lobbyReserve: 4,
            lobbyAvailable: 0,
            unlockedCharacterNodes: [],
            collectedDevelopmentCards: [],
            collectedVpCards: [],
            ownedLenses: [],
            tasksCompleted: [],
            hasPassed: false,
        };
        state.players['p2'] = {
            playerId: 'p2',
            displayName: 'Player 2',
            vp: 0,
            actionPoints: 7,
            creativity: 1,
            resources: { light: 0, rainbow: 0, stagnation: 0, maxCapacity: { light: 10, rainbow: 10, stagnation: 10 } },
            lobbyReserve: 4,
            lobbyAvailable: 0,
            unlockedCharacterNodes: [],
            collectedDevelopmentCards: [],
            collectedVpCards: [],
            ownedLenses: [],
            tasksCompleted: [],
            hasPassed: false,
        };
    });

    describe('Node S: Lobby Created Trigger', () => {
        it('should upgrade Stagnation to Light when lobby created', async () => {
            const p1 = state.players['p1'];
            p1.characterId = 'kazari-hizumi';
            p1.unlockedCharacterNodes = ['kazari-hizumi:s'];
            p1.resources.stagnation = 1;
            p1.resources.light = 0;

            const { triggerEvent } = await import('../src/triggerEngine');

            triggerEvent(state, mockRuleset, 'actionPerformed', {
                actorId: 'p1',
                actionType: 'createLobby' as any
            });

            expect(p1.resources.stagnation).toBe(0);
            expect(p1.resources.light).toBe(1);
        });
    });

    describe('Node 2: Growth Lock', () => {
        it('should prevent unlocking new nodes when Node 2 is unlocked', async () => {
            const p1 = state.players['p1'];
            p1.characterId = 'kazari-hizumi';
            p1.unlockedCharacterNodes = ['kazari-hizumi:s', 'kazari-hizumi:2'];

            const { canUnlockGrowthNode } = await import('../src/characterGrowth');
            const canUnlock = canUnlockGrowthNode('kazari-hizumi', 'kazari-hizumi:3', new Set(p1.unlockedCharacterNodes));
            expect(canUnlock).toBe(false);

            // Simulate consuming Node 2
            p1.unlockedCharacterNodes = ['kazari-hizumi:s'];
            const canUnlockAfterConsumption = canUnlockGrowthNode('kazari-hizumi', 'kazari-hizumi:3', new Set(p1.unlockedCharacterNodes));
            expect(canUnlockAfterConsumption).toBe(true);
        });
    });

    describe('Node 7: Lobby Returned Trigger', () => {
        it('should gain 1 Light when lobby returned', async () => {
            const p1 = state.players['p1'];
            p1.characterId = 'kazari-hizumi';
            p1.unlockedCharacterNodes = ['kazari-hizumi:s', 'kazari-hizumi:4', 'kazari-hizumi:7'];
            p1.resources.light = 0;

            const { triggerEvent } = await import('../src/triggerEngine');
            triggerEvent(state, mockRuleset, 'actionPerformed', {
                actorId: 'p1',
                actionType: 'returnLobby'
            });

            expect(p1.resources.light).toBe(1);
        });
    });

    describe('Node 8: Gain Lobby', () => {
        it('should gain 1 Lobby Available by paying Creativity', async () => {
            const p1 = state.players['p1'];
            p1.characterId = 'kazari-hizumi';
            p1.unlockedCharacterNodes = ['kazari-hizumi:s', 'kazari-hizumi:7', 'kazari-hizumi:8'];
            p1.creativity = 2;
            p1.lobbyReserve = 4;
            p1.lobbyAvailable = 0;

            const { applyWill } = await import('../src/actionHandlers');
            const context = { gameState: state, ruleset: mockRuleset, timestamp: Date.now() };

            await applyWill({
                playerId: 'p1',
                actionType: 'will',
                payload: {
                    nodeId: 'kazari-hizumi:8',
                    customAction: 'gainLobby',
                    cost: { creativity: 2 }
                } as any
            }, context);

            expect(p1.creativity).toBe(0);
            expect(p1.lobbyReserve).toBe(3);
            expect(p1.lobbyAvailable).toBe(1);
        });
    });

    describe('Node 9: Distribute Resources', () => {
        it('should distribute resources and gain VP', async () => {
            const p1 = state.players['p1'];
            const p2 = state.players['p2'];
            p1.characterId = 'kazari-hizumi';
            p1.unlockedCharacterNodes = ['kazari-hizumi:s', 'kazari-hizumi:9'];

            // Setup resources
            p1.resources = { light: 2, rainbow: 2, stagnation: 2, maxCapacity: { light: 10, rainbow: 10, stagnation: 10 } };
            p2.resources = { light: 0, rainbow: 0, stagnation: 0, maxCapacity: { light: 10, rainbow: 10, stagnation: 10 } };
            p1.vp = 0;

            const { triggerEvent } = await import('../src/triggerEngine');
            triggerEvent(state, mockRuleset, 'roundEnd', {
                actorId: 'p1'
            });

            // P1 gives 1 Stagnation (0 VP), 1 Light (3 VP), 1 Rainbow (5 VP)
            // Remaining: 1, 1, 1
            // P2 gains: 1, 1, 1
            // VP: 3 + 5 = 8

            expect(p1.resources.stagnation).toBe(1);
            expect(p1.resources.light).toBe(1);
            expect(p1.resources.rainbow).toBe(1);

            expect(p2.resources.stagnation).toBe(1);
            expect(p2.resources.light).toBe(1);
            expect(p2.resources.rainbow).toBe(1);

            expect(p1.vp).toBe(8);
        });
    });
});

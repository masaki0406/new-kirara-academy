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

describe('Shirogami Yuu Corrections Verification', () => {
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

    describe('Node 1: -5 VP Penalty', () => {
        it('should apply -5 VP at endgame', async () => {
            const p1 = state.players['p1'];
            p1.characterId = 'shirogami-yuu';
            p1.unlockedCharacterNodes = ['shirogami-yuu:s', 'shirogami-yuu:1'];

            // Manually invoke finalScoring logic (via PhaseManagerImpl logic simulation)
            // We need to import PhaseManagerImpl logic or just test collectCharacterEndgameEffects
            // But PhaseManagerImpl is not exported. We can use `import` to get internal functions if exported?
            // No, they are not exported.
            // We can instantiate PhaseManagerImpl and run finalScoring.
            const { PhaseManagerImpl } = await import('../src/phaseManager');
            const mockDeps = {
                turnOrder: {} as any,
                ruleset: mockRuleset,
            };
            const pm = new PhaseManagerImpl(mockDeps);

            const mutableState = { state, save: async () => { } };
            await pm.finalScoring(mutableState);

            // Node S: -10 VP, Node 1: -5 VP. Total -15 VP.
            expect(p1.vp).toBe(-15);
        });
    });

    describe('Node 2: Material Reward Mismatch', () => {
        it('should trigger when cost and reward resources do not overlap', async () => {
            const p1 = state.players['p1'];
            p1.characterId = 'shirogami-yuu';
            p1.unlockedCharacterNodes = ['shirogami-yuu:s', 'shirogami-yuu:2'];

            // Setup Lens: Cost Light, Reward Rainbow (Mismatch)
            state.board.lenses['l_mismatch'] = {
                lensId: 'l_mismatch',
                ownerId: 'p1',
                cost: { light: 1 },
                rewards: [{ type: 'resource', value: { rainbow: 1 } }],
                slots: 1,
                status: 'available',
                leftItems: [],
                rightItems: [],
                tags: [],
            };

            const { triggerEvent } = await import('../src/triggerEngine');
            triggerEvent(state, mockRuleset, 'actionPerformed', {
                actorId: 'p1',
                actionType: 'persuasion',
                lensId: 'l_mismatch'
            });

            expect(p1.vp).toBe(2);
        });

        it('should NOT trigger when cost and reward resources overlap', async () => {
            const p1 = state.players['p1'];
            p1.characterId = 'shirogami-yuu';
            p1.unlockedCharacterNodes = ['shirogami-yuu:s', 'shirogami-yuu:2'];

            // Setup Lens: Cost Light, Reward Light (Match)
            state.board.lenses['l_match'] = {
                lensId: 'l_match',
                ownerId: 'p1',
                cost: { light: 1 },
                rewards: [{ type: 'resource', value: { light: 1 } }],
                slots: 1,
                status: 'available',
                leftItems: [],
                rightItems: [],
                tags: [],
            };

            const { triggerEvent } = await import('../src/triggerEngine');
            triggerEvent(state, mockRuleset, 'actionPerformed', {
                actorId: 'p1',
                actionType: 'persuasion',
                lensId: 'l_match'
            });

            expect(p1.vp).toBe(0);
        });
    });

    describe('Node 5: Immediate Forced Collection', () => {
        it('should steal resources and reduce lobby available from opponents upon unlock', async () => {
            const p1 = state.players['p1'];
            const p2 = state.players['p2'];
            p1.characterId = 'shirogami-yuu';
            // Node 5 requires Node 4. Node 4 requires 1 or 3.
            // We just need to satisfy immediate prerequisite for Node 5 to be unlockable?
            // Actually, canUnlockGrowthNode checks if ANY prerequisite is met.
            // So we need 'shirogami-yuu:4' in unlocked nodes.
            p1.unlockedCharacterNodes = ['shirogami-yuu:s', 'shirogami-yuu:4'];
            p1.lobbyReserve = 1; // Cost for growth

            // Setup P2
            p2.resources.light = 2;
            p2.resources.rainbow = 2;
            p2.lobbyAvailable = 2;
            p2.lobbyReserve = 0;

            const { applyGrowth } = await import('../src/actionHandlers');
            const context = { gameState: state, ruleset: mockRuleset, timestamp: Date.now() };

            // Unlock Node 5
            await applyGrowth({
                playerId: 'p1',
                type: 'growth',
                payload: { selection: ['shirogami-yuu:5'] }
            } as any, context);

            // Verify P1 gained resources
            expect(p1.resources.light).toBe(1);
            expect(p1.resources.rainbow).toBe(1);

            // Verify P2 lost resources
            expect(p2.resources.light).toBe(1);
            expect(p2.resources.rainbow).toBe(1);

            // Verify P2 lobby moved from Available to Reserve
            expect(p2.lobbyAvailable).toBe(1);
            expect(p2.lobbyReserve).toBe(1);
        });
    });

    describe('Node 7: VP per Lobby Slot', () => {
        it('should grant 3 VP per owned lobby slot', async () => {
            const p1 = state.players['p1'];
            p1.characterId = 'shirogami-yuu';
            p1.unlockedCharacterNodes = ['shirogami-yuu:s', 'shirogami-yuu:7'];

            // Setup 2 lobby slots
            state.board.lobbySlots.push(
                { lensId: 'l1', ownerId: 'p1', isActive: true },
                { lensId: 'l2', ownerId: 'p1', isActive: true }
            );

            const { PhaseManagerImpl } = await import('../src/phaseManager');
            const mockDeps = { turnOrder: {} as any, ruleset: mockRuleset };
            const pm = new PhaseManagerImpl(mockDeps);
            const mutableState = { state, save: async () => { } };

            await pm.finalScoring(mutableState);

            // Node S: -10 VP. Node 7: 2 slots * 3 VP = 6 VP. Total -4 VP.
            expect(p1.vp).toBe(-4);
        });
    });

    describe('Node 9: Convert Negative VP', () => {
        it('should convert negative VP components to positive', async () => {
            const p1 = state.players['p1'];
            p1.characterId = 'shirogami-yuu';
            // Unlock S (-10), 1 (-5), 9 (Convert)
            p1.unlockedCharacterNodes = ['shirogami-yuu:s', 'shirogami-yuu:1', 'shirogami-yuu:9'];

            // Add Stagnation (2 tokens -> -2 VP penalty)
            p1.resources.stagnation = 2;

            const { PhaseManagerImpl } = await import('../src/phaseManager');
            // Mock ruleset with stagnation penalty = 1
            const rulesetWithPenalty = { ...mockRuleset };
            const mockDeps = {
                turnOrder: {} as any,
                ruleset: rulesetWithPenalty,
                rulesetConfig: { stagnationPenalty: 1 } as any
            };
            const pm = new PhaseManagerImpl(mockDeps);
            const mutableState = { state, save: async () => { } };

            await pm.finalScoring(mutableState);

            // Expected calculation:
            // Negative Flat VP: Node S (-10) + Node 1 (-5) = -15.
            // Stagnation Penalty: 2 * 1 = 2.
            // With Convert:
            // Flat VP becomes +15.
            // Stagnation Penalty becomes +2.
            // Total VP = 15 + 2 = 17.

            expect(p1.vp).toBe(17);
        });
    });
});

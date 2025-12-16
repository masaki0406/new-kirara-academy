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

describe('Akito Daidou Corrections Verification', () => {
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

    describe('Node S: Lens Activated Of Other', () => {
        it('should trigger +2 VP when activating another player\'s lens', async () => {
            const p1 = state.players['p1'];
            p1.characterId = 'akito-daidou';
            p1.unlockedCharacterNodes = ['akito-daidou:s'];

            // Setup P2's Lens
            state.board.lenses['l_p2'] = {
                lensId: 'l_p2',
                ownerId: 'p2',
                cost: { light: 1 },
                rewards: [],
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
                lensId: 'l_p2'
            });

            expect(p1.vp).toBe(2);
        });

        it('should NOT trigger when activating OWN lens', async () => {
            const p1 = state.players['p1'];
            p1.characterId = 'akito-daidou';
            p1.unlockedCharacterNodes = ['akito-daidou:s'];

            // Setup P1's Lens
            state.board.lenses['l_p1'] = {
                lensId: 'l_p1',
                ownerId: 'p1',
                cost: { light: 1 },
                rewards: [],
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
                lensId: 'l_p1'
            });

            expect(p1.vp).toBe(0);
        });
    });

    describe('Node 2: Growth Lock', () => {
        it('should prevent unlocking new nodes when Node 2 is unlocked', async () => {
            const p1 = state.players['p1'];
            p1.characterId = 'akito-daidou';
            // Unlock S and 2
            p1.unlockedCharacterNodes = ['akito-daidou:s', 'akito-daidou:2'];
            p1.lobbyReserve = 1;

            const { canUnlockGrowthNode } = await import('../src/characterGrowth');
            // Try to unlock Node 3 (requires S, which is unlocked)
            // But Node 2 is unlocked, so it should be blocked.
            const canUnlock = canUnlockGrowthNode('akito-daidou', 'akito-daidou:3', new Set(p1.unlockedCharacterNodes));
            expect(canUnlock).toBe(false);
        });
    });

    describe('Node 3: Persuasion Targeted', () => {
        it('should trigger +2 VP and +1 Stagnation when targeted by persuasion', async () => {
            const p1 = state.players['p1'];
            p1.characterId = 'akito-daidou';
            p1.unlockedCharacterNodes = ['akito-daidou:s', 'akito-daidou:3'];

            const { triggerEvent } = await import('../src/triggerEngine');
            // P2 persuades P1
            triggerEvent(state, mockRuleset, 'actionPerformed', {
                actorId: 'p2',
                actionType: 'persuasion',
                targetPlayerId: 'p1'
            });

            expect(p1.vp).toBe(2);
            expect(p1.resources.stagnation).toBe(1);
        });
    });

    describe('Node 7: Resonance Intervention', () => {
        it('should allow reactivating another player\'s lens', async () => {
            const p1 = state.players['p1'];
            p1.characterId = 'akito-daidou';
            p1.unlockedCharacterNodes = ['akito-daidou:s', 'akito-daidou:7'];
            p1.creativity = 1;
            p1.resources.light = 1; // Cost for lens

            // Setup P2's Lens (Inactive)
            state.board.lenses['l_p2'] = {
                lensId: 'l_p2',
                ownerId: 'p2',
                cost: { light: 1 },
                rewards: [],
                slots: 1,
                status: 'available',
                leftItems: [],
                rightItems: [],
                tags: [],
            };
            state.board.lobbySlots.push({ lensId: 'l_p2', isActive: false, ownerId: 'p2' });

            const { applyWill } = await import('../src/actionHandlers');
            const context = { gameState: state, ruleset: mockRuleset, timestamp: Date.now() };

            await applyWill({
                playerId: 'p1',
                actionType: 'will',
                payload: {
                    nodeId: 'akito-daidou:7', // Must specify nodeId to look up effect
                    targetLensId: 'l_p2',
                    interventionType: 'reactivate'
                } as any
            }, context);

            // Verify lens is active
            const slot = state.board.lobbySlots.find(s => s.lensId === 'l_p2');
            expect(slot?.isActive).toBe(true);
            // Verify costs paid
            expect(p1.creativity).toBe(0);
            expect(p1.resources.light).toBe(0);
        });
    });

    describe('Node 9: VP Multiplier', () => {
        it('should multiply VP by 1.5 and round up', async () => {
            const p1 = state.players['p1'];
            p1.characterId = 'akito-daidou';
            p1.unlockedCharacterNodes = ['akito-daidou:s', 'akito-daidou:9'];
            p1.vp = 11;

            const { PhaseManagerImpl } = await import('../src/phaseManager');
            const mockDeps = { turnOrder: {} as any, ruleset: mockRuleset };
            const pm = new PhaseManagerImpl(mockDeps);
            const mutableState = { state, save: async () => { } };

            await pm.finalScoring(mutableState);

            // 11 * 1.5 = 16.5 -> ceil -> 17
            expect(p1.vp).toBe(17);
        });
    });
});

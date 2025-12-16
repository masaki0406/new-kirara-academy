import { describe, it, expect, beforeEach } from 'vitest';
import { GameSessionImpl } from '../src/gameSession';
import {
    GameState,
    PlayerId,
    Ruleset,
    CharacterProfile,
    ActionType,
} from '../src/types';
import { characters } from '../src/rules/characters';

// Mock Ruleset
const mockRuleset: Ruleset = {
    characters,
    endgameConversions: { light: 1, rainbow: 3, stagnation: -1 },
    version: '1.0.0',
    resourceCaps: { light: 10, rainbow: 10, stagnation: 10 },
    labs: {},
    lenses: {},
    tasks: {},
    events: {},
};

describe('Character Abilities Full Verification', () => {
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
        };
    });

    describe('Kazari Hizumi (Round End Triggers)', () => {
        it('should gain VP for Stagnation at round end (Node 1)', async () => {
            const p1 = state.players['p1'];
            p1.characterId = 'kazari-hizumi';
            p1.unlockedCharacterNodes = ['kazari-hizumi:s', 'kazari-hizumi:1'];
            p1.resources.stagnation = 3;

            const { triggerEvent } = await import('../src/triggerEngine');
            triggerEvent(state, mockRuleset, 'roundEnd', { actorId: 'p1' });

            expect(p1.vp).toBe(3); // 1 VP per Stagnation * 3
        });

        it('should gain VP for Light at round end (Node 3)', async () => {
            const p1 = state.players['p1'];
            p1.characterId = 'kazari-hizumi';
            p1.unlockedCharacterNodes = ['kazari-hizumi:s', 'kazari-hizumi:3'];
            p1.resources.light = 2;

            const { triggerEvent } = await import('../src/triggerEngine');
            triggerEvent(state, mockRuleset, 'roundEnd', { actorId: 'p1' });

            expect(p1.vp).toBe(2); // 1 VP per Light * 2
        });
    });

    describe('Aono Haruyo (Growth Triggers & Passive)', () => {
        it('should reduce persuasion cost to 0 (Node 9)', async () => {
            const p1 = state.players['p1'];
            p1.characterId = 'aono-haruyo';
            p1.unlockedCharacterNodes = ['aono-haruyo:s', 'aono-haruyo:9'];

            // Mock lens cost
            state.board.lenses['l1'] = {
                lensId: 'l1',
                ownerId: 'p2',
                cost: { actionPoints: 0 },
                rewards: [],
                slots: 1,
                status: 'available',
                leftItems: [],
                rightItems: [],
                tags: [],
            };
            state.board.lobbySlots.push({ lensId: 'l1', occupantId: 'p2', isActive: true, ownerId: 'p2' });

            // Validate persuasion
            const { validatePersuasion } = await import('../src/actionHandlers');
            const context = { gameState: state, ruleset: mockRuleset, timestamp: Date.now() };

            // Normal cost: 2 AP. With Node 9: 0 AP.
            p1.actionPoints = 0;
            const action: any = { playerId: 'p1', type: 'persuasion', payload: { lensId: 'l1' } };
            const errors = await validatePersuasion(action, context);
            expect(errors).toHaveLength(0); // Should be allowed with 0 AP
        });
    });

    describe('Akito Daidou (Passive Cost Reduction)', () => {
        it('should reduce persuasion cost by 1 (Node 1)', async () => {
            const p1 = state.players['p1'];
            p1.characterId = 'akito-daidou';
            p1.unlockedCharacterNodes = ['akito-daidou:s', 'akito-daidou:1'];

            state.board.lenses['l1'] = {
                lensId: 'l1',
                ownerId: 'p2',
                cost: { actionPoints: 0 },
                rewards: [],
                slots: 1,
                status: 'available',
                leftItems: [],
                rightItems: [],
                tags: [],
            };
            state.board.lobbySlots.push({ lensId: 'l1', occupantId: 'p2', isActive: true, ownerId: 'p2' });

            const { validatePersuasion } = await import('../src/actionHandlers');
            const context = { gameState: state, ruleset: mockRuleset, timestamp: Date.now() };

            // Normal cost: 2 AP. With Node 1: 1 AP.
            p1.actionPoints = 1;
            const action1: any = { playerId: 'p1', type: 'persuasion', payload: { lensId: 'l1' } };
            const errors = await validatePersuasion(action1, context);
            expect(errors).toHaveLength(0);

            p1.actionPoints = 0;
            const action2: any = { playerId: 'p1', type: 'persuasion', payload: { lensId: 'l1' } };
            const errors2 = await validatePersuasion(action2, context);
            expect(errors2).toContain('行動力が不足しています');
        });
    });

    describe('Akane Hiyori (Lens Completion)', () => {
        it('should gain 4 VP when completing a lens (Node 1)', async () => {
            const p1 = state.players['p1'];
            p1.characterId = 'akane-hiyori';
            p1.unlockedCharacterNodes = ['akane-hiyori:s', 'akane-hiyori:1'];

            // Trigger lens completion event
            const { triggerEvent } = await import('../src/triggerEngine');
            triggerEvent(state, mockRuleset, 'lensCompleted', { actorId: 'p1' });

            expect(p1.vp).toBe(4);
        });
    });

    describe('Shirogami Yuu (Forced Collection)', () => {
        it('should steal resources and decrease unused lobby from opponents (Node 5)', async () => {
            const p1 = state.players['p1'];
            const p2 = state.players['p2'];

            p1.characterId = 'shirogami-yuu';
            p1.unlockedCharacterNodes = ['shirogami-yuu:s', 'shirogami-yuu:5'];
            p1.actionPoints = 10; // Ensure enough AP

            // Setup P2 resources and lobby
            p2.resources.light = 2;
            p2.resources.rainbow = 2;
            p2.lobbyAvailable = 2; // Has unused lobby

            // Execute "Will" action for Node 5
            const { applyWill } = await import('../src/actionHandlers');
            const context = { gameState: state, ruleset: mockRuleset, timestamp: Date.now() };

            await applyWill({
                playerId: 'p1',
                type: 'will',
                payload: { nodeId: 'shirogami-yuu:5' }
            } as any, context);

            // Verify resources stolen
            expect(p1.resources.light).toBe(1); // 0 + 1
            expect(p1.resources.rainbow).toBe(1); // 0 + 1
            expect(p2.resources.light).toBe(1); // 2 - 1
            expect(p2.resources.rainbow).toBe(1); // 2 - 1

            // Verify unused lobby decreased
            expect(p2.lobbyAvailable).toBe(1); // 2 - 1
        });
    });

    describe('Midori Rina (Trigger Conditions)', () => {
        it('should gain VP when high cost lens is activated by other (Node 3)', async () => {
            const p1 = state.players['p1'];
            const p2 = state.players['p2'];
            p1.characterId = 'midori-rina';
            p1.unlockedCharacterNodes = ['midori-rina:s', 'midori-rina:3'];

            // Setup high cost lens owned by P1
            state.board.lenses['l_high'] = {
                lensId: 'l_high',
                ownerId: 'p1',
                cost: { actionPoints: 3 },
                rewards: [],
                slots: 1,
                status: 'available',
                leftItems: [],
                rightItems: [],
                tags: [],
            };

            // Trigger lensActivatedByOther
            const { triggerEvent } = await import('../src/triggerEngine');
            triggerEvent(state, mockRuleset, 'lensActivatedByOther', {
                actorId: 'p2',
                ownerId: 'p1',
                lensId: 'l_high'
            });

            expect(p1.vp).toBe(3); // +3 VP
        });

        it('should convert stagnation to VP (Node 4)', async () => {
            const p1 = state.players['p1'];
            p1.characterId = 'midori-rina';
            p1.unlockedCharacterNodes = ['midori-rina:s', 'midori-rina:4'];
            p1.resources.stagnation = 3;
            p1.actionPoints = 10;

            const { applyWill } = await import('../src/actionHandlers');
            const context = { gameState: state, ruleset: mockRuleset, timestamp: Date.now() };

            await applyWill({
                playerId: 'p1',
                type: 'will',
                payload: { nodeId: 'midori-rina:4', amount: 2 }
            } as any, context);

            expect(p1.resources.stagnation).toBe(1); // 3 - 2
            expect(p1.vp).toBe(4); // 2 * 2
        });
    });

    describe('Aono Haruyo (Trigger Conditions)', () => {
        it('should gain VP when activating own lens (Node 1)', async () => {
            const p1 = state.players['p1'];
            p1.characterId = 'aono-haruyo';
            p1.unlockedCharacterNodes = ['aono-haruyo:s', 'aono-haruyo:1'];

            // Setup own lens
            state.board.lenses['l_own'] = {
                lensId: 'l_own',
                ownerId: 'p1',
                cost: { actionPoints: 1 },
                rewards: [],
                slots: 1,
                status: 'available',
                leftItems: [],
                rightItems: [],
                tags: [],
            };

            // Trigger actionPerformed
            const { triggerEvent } = await import('../src/triggerEngine');
            triggerEvent(state, mockRuleset, 'actionPerformed', {
                actorId: 'p1',
                actionType: 'persuasion', // or refresh
                lensId: 'l_own'
            });

            expect(p1.vp).toBe(2); // +2 VP
        });
    });

    describe('Akane Hiyori (Trigger Conditions)', () => {
        it('should gain VP when activating light-consuming lens (Node 5)', async () => {
            const p1 = state.players['p1'];
            p1.characterId = 'akane-hiyori';
            p1.unlockedCharacterNodes = ['akane-hiyori:s', 'akane-hiyori:5'];

            // Setup light consuming lens
            state.board.lenses['l_light'] = {
                lensId: 'l_light',
                ownerId: 'p2',
                cost: { actionPoints: 1, light: 1 },
                rewards: [],
                slots: 1,
                status: 'available',
                leftItems: [],
                rightItems: [],
                tags: [],
            };

            // Trigger actionPerformed
            const { triggerEvent } = await import('../src/triggerEngine');
            triggerEvent(state, mockRuleset, 'actionPerformed', {
                actorId: 'p1',
                actionType: 'persuasion',
                lensId: 'l_light'
            });

            expect(p1.vp).toBe(3); // +3 VP
        });
    });
});

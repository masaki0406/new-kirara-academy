import { describe, it, expect, beforeEach } from 'vitest';
import { GameState, PlayerState, Ruleset, GamePhase, LifecycleStage, LensDefinition } from '../src/types';
import { triggerEvent } from '../src/triggerEngine';

describe('Akane Hiyori Corrections Verification', () => {
    let gameState: GameState;
    let ruleset: Ruleset;

    beforeEach(() => {
        ruleset = {
            characters: {
                'akane-hiyori': {
                    characterId: 'akane-hiyori',
                    name: 'Akane Hiyori',
                    nodes: [
                        { nodeId: 'akane-hiyori:1', position: '1', effects: [{ type: 'trigger', payload: { event: 'lensCompleted', amount: 4 } }] },
                        {
                            nodeId: 'akane-hiyori:2', position: '2', effects: [
                                { type: 'endGame', payload: { kind: 'vpFlat', amount: 10 } },
                                { type: 'passive', payload: { restriction: 'growthLock' } }
                            ]
                        },
                        { nodeId: 'akane-hiyori:3', position: '3', effects: [{ type: 'trigger', payload: { event: 'growth', amount: 1, rewardType: 'rainbow' } }] },
                        { nodeId: 'akane-hiyori:5', position: '5', effects: [{ type: 'trigger', payload: { event: 'actionPerformed', condition: 'consumeLight', amount: 3 } }] },
                        { nodeId: 'akane-hiyori:7', position: '7', effects: [{ type: 'trigger', payload: { event: 'actionPerformed', condition: 'consumeRainbow', amount: 4 } }] },
                        { nodeId: 'akane-hiyori:8', position: '8', effects: [{ type: 'endGame', payload: { kind: 'conditionalVp', condition: 'rainbow7', amount: 30 } }] },
                        { nodeId: 'akane-hiyori:9', position: '9', effects: [{ type: 'active', payload: { cost: { creativity: 1 }, customAction: 'akaneNode9' } }] },
                    ],
                },
            },
            lenses: {},
            endgameConversions: {},
        } as unknown as Ruleset;

        gameState = {
            players: {
                p1: {
                    playerId: 'p1',
                    characterId: 'akane-hiyori',
                    vp: 0,
                    actionPoints: 10,
                    creativity: 5,
                    resources: { stagnation: 0, light: 0, rainbow: 0, maxCapacity: { stagnation: 10, light: 10, rainbow: 10 } },
                    unlockedCharacterNodes: [],
                    lobbyAvailable: 5,
                    lobbyUsed: 0,
                    lobbyReserve: 5,
                    hand: [],
                    board: [],
                    displayName: 'Player 1',
                    collectedDevelopmentCards: [],
                    collectedVpCards: [],
                    craftedLenses: [],
                    ownedLenses: [],
                } as unknown as PlayerState,
                p2: {
                    playerId: 'p2',
                    vp: 0,
                    actionPoints: 10,
                    resources: { stagnation: 0, light: 0, rainbow: 0, maxCapacity: { stagnation: 10, light: 10, rainbow: 10 } },
                    lobbyAvailable: 5,
                    lobbyUsed: 0,
                    lobbyReserve: 5,
                    hand: [],
                    board: [],
                    displayName: 'Player 2',
                    collectedDevelopmentCards: [],
                    collectedVpCards: [],
                    craftedLenses: [],
                    ownedLenses: [],
                } as unknown as PlayerState,
            },
            board: {
                lenses: {
                    'lens_light': { lensId: 'lens_light', ownerId: 'p1', cost: { actionPoints: 1, light: 1 }, rewards: [] },
                    'lens_rainbow': { lensId: 'lens_rainbow', ownerId: 'p1', cost: { actionPoints: 1, rainbow: 1 }, rewards: [] },
                    'lens_p2': { lensId: 'lens_p2', ownerId: 'p2', cost: { actionPoints: 1, light: 1 }, rewards: [] },
                },
                lobbySlots: [
                    { lensId: 'lens_light', ownerId: 'p1', occupantId: undefined, isActive: false },
                    { lensId: 'lens_rainbow', ownerId: 'p1', occupantId: undefined, isActive: false },
                    { lensId: 'lens_p2', ownerId: 'p2', occupantId: 'p2', isActive: false },
                ],
            },
            currentPhase: 'action',
            lifecycleStage: 'inGame',
            logs: [],
            labPlacements: [],
        } as unknown as GameState;
    });

    it('Node 1: should gain VP on Lens Completed', async () => {
        const p1 = gameState.players.p1;
        p1.unlockedCharacterNodes = ['akane-hiyori:1'];

        triggerEvent(gameState, ruleset, 'lensCompleted', {
            actorId: 'p1',
            lensId: 'some_lens',
        });

        // +4 VP from Node 1
        expect(p1.vp).toBe(4);
    });

    it('Node 2: should prevent Growth', async () => {
        const p1 = gameState.players.p1;
        p1.unlockedCharacterNodes = ['akane-hiyori:2'];

        const { canUnlockGrowthNode } = await import('../src/characterGrowth');

        const canUnlock = canUnlockGrowthNode('akane-hiyori', 'akane-hiyori:3', new Set(p1.unlockedCharacterNodes));
        expect(canUnlock).toBe(false);
    });

    it('Node 3: should gain Rainbow on Growth', async () => {
        const p1 = gameState.players.p1;
        p1.unlockedCharacterNodes = ['akane-hiyori:3'];

        triggerEvent(gameState, ruleset, 'growth', {
            actorId: 'p1',
        });

        // +1 Rainbow from Node 3
        expect(p1.resources.rainbow).toBe(1);
        expect(p1.vp).toBe(0);
    });

    it('Node 5: should gain VP on Consume Light (Lens Activate)', async () => {
        const p1 = gameState.players.p1;
        p1.unlockedCharacterNodes = ['akane-hiyori:5'];
        p1.resources.light = 1;

        const { applyLensActivate } = await import('../src/actionHandlers');

        await applyLensActivate({
            playerId: 'p1',
            actionType: 'lensActivate',
            payload: { lensId: 'lens_light' },
        } as any, { gameState, ruleset, timestamp: Date.now() });

        // +3 VP from Node 5
        expect(p1.vp).toBe(3);
        expect(p1.resources.light).toBe(0);
    });

    it('Node 5: should gain VP on Consume Light (Refresh)', async () => {
        const p1 = gameState.players.p1;
        p1.unlockedCharacterNodes = ['akane-hiyori:5'];
        p1.resources.light = 1;
        p1.actionPoints = 10;

        // Setup occupied slot for refresh
        const slot = gameState.board.lobbySlots.find(s => s.lensId === 'lens_light');
        if (slot) {
            slot.occupantId = 'p1';
            slot.isActive = false; // Needs refresh (actually refresh is for inactive slots? No, refresh is to recover used lobby? Wait, refresh is to RECOVER lobby from slot?)
            // applyRefresh logic:
            // const slot = gameState.board.lobbySlots.find((entry) => entry.lensId === lensId && entry.occupantId === action.playerId && !entry.isActive);
            // Wait, !isActive means it IS available? No, isActive=true means active/exhausted?
            // Usually isActive=true means "Active/Occupied".
            // applyRefresh checks !entry.isActive?
            // Let's check applyRefresh logic again.
            // "const slot = ... && !entry.isActive"
            // If !isActive, it means it's NOT active.
            // Why would we refresh an inactive slot?
            // Maybe "isActive" means "Ready to use"?
            // Or maybe "isActive" means "Currently processing"?
            // In Kirara Academy, usually slots are occupied.
            // If I recall, `isActive` might be used for "Is currently active/running"?
            // But `applyLensActivate` sets `isActive = false`?
            // Let's assume standard setup: Occupied slot.
            // If `applyRefresh` requires `!isActive`, then I set it to false.
        }

        const { applyRefresh } = await import('../src/actionHandlers');

        await applyRefresh({
            playerId: 'p1',
            actionType: 'refresh',
            payload: { lensId: 'lens_light' },
        } as any, { gameState, ruleset, timestamp: Date.now() });

        // +3 VP from Node 5
        expect(p1.vp).toBe(3);
        expect(p1.resources.light).toBe(0);
    });

    it('Node 7: should gain VP on Consume Rainbow (Persuasion)', async () => {
        const p1 = gameState.players.p1;
        p1.unlockedCharacterNodes = ['akane-hiyori:7'];
        p1.resources.rainbow = 1;
        p1.actionPoints = 10;

        // Setup slot occupied by P2
        const slot = gameState.board.lobbySlots.find(s => s.lensId === 'lens_p2'); // P2 lens, cost Light?
        // Wait, Node 7 triggers on Consume Rainbow.
        // I need a lens that costs Rainbow.
        // lens_rainbow costs Rainbow. But it's owned by P1.
        // Persuasion is usually on OTHER's lens? Or own lens occupied by other?
        // Persuasion: "Return occupant to owner".
        // Can be own lens occupied by other.
        // Let's use lens_rainbow occupied by P2.
        if (slot) {
            // Modify lens_p2 to cost Rainbow for this test?
            // Or use lens_rainbow and set occupant to P2.
            const rainbowSlot = gameState.board.lobbySlots.find(s => s.lensId === 'lens_rainbow');
            if (rainbowSlot) {
                rainbowSlot.occupantId = 'p2';
            }
        }

        const { applyPersuasion } = await import('../src/actionHandlers');

        await applyPersuasion({
            playerId: 'p1',
            actionType: 'persuasion',
            payload: { lensId: 'lens_rainbow' },
        } as any, { gameState, ruleset, timestamp: Date.now() });

        // +4 VP from Node 7
        expect(p1.vp).toBe(4);
        expect(p1.resources.rainbow).toBe(0);
    });

    it('Node 9: should allow choice between Rainbow and Lobby', async () => {
        const p1 = gameState.players.p1;
        p1.unlockedCharacterNodes = ['akane-hiyori:9'];
        p1.creativity = 1;
        p1.resources.rainbow = 0;
        p1.lobbyReserve = 5;
        p1.lobbyAvailable = 0; // Start with 0 available to verify gain

        const { applyWill } = await import('../src/actionHandlers');

        // Choice: Rainbow
        await applyWill({
            playerId: 'p1',
            actionType: 'will',
            payload: { nodeId: 'akane-hiyori:9', choice: 'rainbow' },
        } as any, { gameState, ruleset, timestamp: Date.now() });

        expect(p1.resources.rainbow).toBe(1);
        expect(p1.creativity).toBe(0);

        // Reset
        p1.creativity = 1;
        p1.resources.rainbow = 0;
        p1.lobbyAvailable = 0;

        // Choice: Lobby
        await applyWill({
            playerId: 'p1',
            actionType: 'will',
            payload: { nodeId: 'akane-hiyori:9', choice: 'lobby' },
        } as any, { gameState, ruleset, timestamp: Date.now() });

        // Gained 1 "Used" Lobby (from Reserve)
        // Reserve should decrease by 1.
        // Used should increase by 1.
        // Available should remain 0.
        expect(p1.lobbyReserve).toBe(4); // Started with 5
        expect(p1.lobbyUsed).toBe(1); // Started with 0
        expect(p1.lobbyAvailable).toBe(0);
        expect(p1.creativity).toBe(0);
    });
});

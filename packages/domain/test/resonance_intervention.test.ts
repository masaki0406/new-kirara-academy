import { describe, it, expect, beforeEach } from 'vitest';
import { GameState, PlayerState, Ruleset } from '../src/types';
import { applyWill, validateWill } from '../src/actionHandlers';
import { characters } from '../src/rules/characters';

describe('Resonance Intervention (Akito Node 7)', () => {
    let gameState: GameState;
    let ruleset: Ruleset;

    beforeEach(() => {
        ruleset = {
            characters: characters,
            lenses: {},
            labs: {},
        } as any;

        gameState = {
            players: {
                p1: {
                    playerId: 'p1',
                    characterId: 'akito-daidou',
                    resources: {
                        light: 5,
                        rainbow: 5,
                        stagnation: 0,
                        maxCapacity: { light: 10, rainbow: 10, stagnation: 10 }
                    },
                    actionPoints: 10,
                    creativity: 5,
                    unlockedCharacterNodes: ['akito-daidou:7'],
                    lobbyAvailable: 2,
                    lobbyReserve: 2,
                    lobbyUsed: 0,
                } as PlayerState,
                p2: {
                    playerId: 'p2',
                    resources: {
                        light: 0,
                        rainbow: 0,
                        stagnation: 0,
                        maxCapacity: { light: 10, rainbow: 10, stagnation: 10 }
                    },
                    lobbyAvailable: 0,
                    lobbyReserve: 0,
                    lobbyUsed: 1, // Occupying lens2
                } as PlayerState,
            },
            board: {
                lenses: {
                    'lens1': {
                        lensId: 'lens1',
                        ownerId: 'p1',
                        cost: { light: 1 },
                        rewards: [{ type: 'resource', value: { rainbow: 2 } }],
                        status: 'available',
                        active: true, // Not used
                    },
                    'lens2': {
                        lensId: 'lens2',
                        ownerId: 'p2',
                        cost: { light: 1 },
                        rewards: [{ type: 'resource', value: { rainbow: 2 } }],
                        status: 'available',
                        active: true, // Occupied by p2
                    },
                },
                lobbySlots: [
                    { lensId: 'lens1', occupantId: 'p1', isActive: false }, // p1 used their own lens (inactive)
                    { lensId: 'lens2', occupantId: 'p2', isActive: true }, // p2 occupying their own lens (active)
                ],
                foundationStock: {},
            },
            logs: [],
            currentPlayerId: 'p1',
        } as any;
    });

    it('should validate persuasion (target occupied by other)', async () => {
        const action = {
            playerId: 'p1',
            type: 'will',
            payload: {
                nodeId: 'akito-daidou:7',
                targetLensId: 'lens2',
                interventionType: 'persuasion',
            }
        } as any;

        const errors = await validateWill(action, { gameState, ruleset, timestamp: Date.now() });
        expect(errors).toEqual([]);
    });

    it('should apply persuasion: return other token, place own, pay cost, get reward', async () => {
        const action = {
            playerId: 'p1',
            type: 'will',
            payload: {
                nodeId: 'akito-daidou:7',
                targetLensId: 'lens2',
                interventionType: 'persuasion',
            }
        } as any;

        await applyWill(action, { gameState, ruleset, timestamp: Date.now() });

        const p1 = gameState.players.p1;
        const p2 = gameState.players.p2;
        const slot = gameState.board.lobbySlots.find(s => s.lensId === 'lens2');

        // P1 pays Will cost (Creativity 1) + Lens Cost (Light 1)
        expect(p1.creativity).toBe(4);
        expect(p1.resources.light).toBe(4);

        // P1 gets Reward (Rainbow 2)
        expect(p1.resources.rainbow).toBe(7);

        // P2 gets token back (to Available? User said "行動済未行動を維持したままで戻します" -> "Return to owner maintaining acted/unacted state")
        // If it was on a lens, it was "placed". Usually placed tokens are "Used".
        // If it returns to "Unacted" (Available), that's a bonus for P2.
        // User said: "置かれているロビーを持ち主に行動済未行動を維持したままで戻します。"
        // "Return the placed lobby to the owner while maintaining acted/unacted state."
        // A placed lobby is... acted? Or is it just "placed"?
        // If "Acted" means "Used", then it returns to "Used" (or Reserve?).
        // If "Unacted" means "Available".
        // Usually, when a lens is used, the token becomes "inactive" (exhausted).
        // But here, the lens `lens2` has `isActive: true`. So the token is "Active" (Unacted?).
        // So it should return to `lobbyAvailable`.
        expect(p2.lobbyAvailable).toBe(1); // Was 0
        expect(p2.lobbyUsed).toBe(0); // Was 1

        // Slot is now occupied by P1
        expect(slot?.occupantId).toBe('p1');
        // And it should be "Active" (ready to use)? Or "Used" (exhausted)?
        // User said: "その後は通常の起動と同じで自分のロビーをレンズにのせてコストを支払報酬を獲得します。"
        // "After that, it's the same as normal activation: place own lobby on lens, pay cost, get reward."
        // Normal activation places a token. The token stays there.
        // If the lens is "Available" (not exhausted), the token is placed and the lens becomes "Used" (exhausted) IF it's a one-time use?
        // No, lenses are reusable unless they are "One-shot".
        // But usually placing a token makes the lens "Occupied".
        // The lens itself doesn't have "Active/Inactive" state in `lens` object usually, but `lobbySlot` has `isActive`.
        // If `isActive` is false, it's exhausted.
        // If I activate it, I place a token. Does it become exhausted?
        // Usually yes.
        // So `slot.isActive` should be `false`?
        // But `applyLensActivate` sets `isActive`? No, `applyLensActivate` just applies effects.
        // `applyMove` places token and sets `isActive = true`.
        // Wait, `applyMove` sets `isActive = true`.
        // Then `applyLensActivate` (if it requires a token) might require `isActive = true`?
        // Actually, `applyLensActivate` checks `canActivateLens`.

        // Let's assume for now it should be `isActive: false` (exhausted) because we just used it to get rewards.
        expect(slot?.isActive).toBe(false);
    });

    it('should validate reactivate (own used lens)', async () => {
        // lens1 is owned by p1, occupied by p1, and isActive: false (used).
        const action = {
            playerId: 'p1',
            type: 'will',
            payload: {
                nodeId: 'akito-daidou:7',
                targetLensId: 'lens1',
                interventionType: 'reactivate',
            }
        } as any;

        const errors = await validateWill(action, { gameState, ruleset, timestamp: Date.now() });
        expect(errors).toEqual([]);
    });

    it('should apply reactivate: return own token, place new, pay cost, get reward', async () => {
        // lens1 is owned by p1, occupied by p1, and isActive: false.
        const action = {
            playerId: 'p1',
            type: 'will',
            payload: {
                nodeId: 'akito-daidou:7',
                targetLensId: 'lens1',
                interventionType: 'reactivate',
            }
        } as any;

        await applyWill(action, { gameState, ruleset, timestamp: Date.now() });

        const p1 = gameState.players.p1;
        const slot = gameState.board.lobbySlots.find(s => s.lensId === 'lens1');

        // P1 pays Will cost (Creativity 1) + Lens Cost (Light 1)
        expect(p1.creativity).toBe(4);
        expect(p1.resources.light).toBe(4);

        // P1 gets Reward (Rainbow 2)
        expect(p1.resources.rainbow).toBe(7);

        // P1 returns "Used" token (Acted -> Used). No change in Available.
        // P1 places "New" token (Available -> Used). -1 Available.
        // Net change: -1 Available.
        expect(p1.lobbyAvailable).toBe(1); // Was 2. Used 1.

        // Slot should be occupied by p1.
        expect(slot?.occupantId).toBe('p1');
        // And exhausted (isActive: false) because we used it.
        expect(slot?.isActive).toBe(false);
    });
});

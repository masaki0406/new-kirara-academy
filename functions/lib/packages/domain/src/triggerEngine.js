"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.triggerEvent = triggerEvent;
function triggerEvent(gameState, ruleset, event, params) {
    const triggers = collectAllTriggers(gameState, ruleset);
    triggers.forEach(({ playerId, payload }) => {
        const player = gameState.players[playerId];
        if (!player) {
            return;
        }
        switch (payload.event) {
            case 'lensActivatedByOther': {
                if (event !== 'lensActivatedByOther') {
                    return;
                }
                if (!params.ownerId || params.ownerId !== playerId) {
                    return;
                }
                if (params.actorId === playerId) {
                    return;
                }
                const amount = Number(payload.amount ?? 0);
                if (amount) {
                    player.vp += amount;
                }
                break;
            }
            case 'developmentSlotFreed': {
                if (event !== 'developmentSlotFreed') {
                    return;
                }
                const amount = Number(payload.amount ?? 0);
                if (amount) {
                    player.vp += amount;
                }
                break;
            }
            case 'actionPerformed': {
                if (event !== 'actionPerformed') {
                    return;
                }
                if (params.actorId !== playerId) {
                    return;
                }
                if (payload.actionType && payload.actionType !== params.actionType) {
                    return;
                }
                const amount = Number(payload.amount ?? 0);
                if (amount) {
                    player.vp += amount;
                }
                break;
            }
            default:
                break;
        }
    });
}
function collectAllTriggers(gameState, ruleset) {
    const result = [];
    Object.values(gameState.players).forEach((player) => {
        const characterId = player.characterId;
        if (!characterId) {
            return;
        }
        const profile = ruleset.characters[characterId];
        if (!profile) {
            return;
        }
        const unlocked = new Set(player.unlockedCharacterNodes ?? []);
        profile.nodes.forEach((node) => {
            if (!unlocked.has(node.nodeId)) {
                return;
            }
            if (node.effect.type !== 'trigger') {
                return;
            }
            const payload = node.effect.payload;
            if (!payload?.event) {
                return;
            }
            result.push({ playerId: player.playerId, payload });
        });
    });
    return result;
}

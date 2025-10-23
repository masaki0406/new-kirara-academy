"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhaseManagerImpl = void 0;
class PhaseManagerImpl {
    constructor(deps) {
        this.deps = deps;
    }
    async preparePhase(state) {
        const gameState = state.state;
        if (this.deps.initializeDevelopmentDeck && !gameState.developmentDeckInitialized) {
            await this.deps.initializeDevelopmentDeck(gameState);
        }
        const order = determineTurnOrder(gameState.currentRound, gameState.players);
        this.deps.turnOrder.setInitialOrder(order);
        gameState.currentPlayerId = order[0];
        gameState.currentPhase = 'setup';
        // リソース・行動力初期化
        Object.values(gameState.players).forEach((player) => {
            const initialAp = this.deps.rulesetConfig?.initialActionPoints ?? 2;
            player.actionPoints = initialAp;
            player.hasPassed = false;
            if (player.isRooting) {
                player.isRooting = false;
            }
        });
        // 公開開発カード補充
        replenishDevelopmentRow(gameState, this.deps.rulesetConfig?.publicDevelopmentSlots ?? 8);
        // 共有ボード初期化（各レンズのロビー状態リセット）
        gameState.board.lobbySlots.forEach((slot) => {
            slot.occupantId = undefined;
            slot.isActive = true;
        });
        await state.save();
    }
    async mainPhase(state) {
        const gameState = state.state;
        gameState.currentPhase = 'main';
        const currentPlayerId = this.deps.turnOrder.current();
        gameState.currentPlayerId = currentPlayerId;
        Object.values(gameState.players).forEach((player) => {
            player.hasPassed = false;
        });
        await state.save();
    }
    async endPhase(state) {
        const gameState = state.state;
        gameState.currentPhase = 'end';
        // 使用済みレンズのロビーを未行動状態へ戻す
        gameState.board.lobbySlots.forEach((slot) => {
            slot.isActive = true;
        });
        // 公開列を補充
        replenishDevelopmentRow(gameState, this.deps.rulesetConfig?.publicDevelopmentSlots ?? 8);
        await state.save();
    }
    async finalScoring(state) {
        const gameState = state.state;
        gameState.currentPhase = 'finalScoring';
        const endgameEffects = collectCharacterEndgameEffects(gameState, this.deps.ruleset);
        applyResourceConversions(gameState, this.deps.ruleset.endgameConversions);
        applyStagnationPenalty(gameState, this.deps.rulesetConfig?.stagnationPenalty ?? 2, endgameEffects);
        applyCharacterBonuses(gameState, endgameEffects);
        await state.save();
    }
}
exports.PhaseManagerImpl = PhaseManagerImpl;
function determineTurnOrder(currentRound, players) {
    const ids = Object.keys(players);
    if (currentRound === 1) {
        return ids;
    }
    const rootingPlayer = ids.find((id) => players[id].isRooting);
    if (rootingPlayer) {
        const idx = ids.indexOf(rootingPlayer);
        return [...ids.slice(idx), ...ids.slice(0, idx)];
    }
    const firstPassed = ids.find((id) => players[id].hasPassed) ?? ids[0];
    const idx = ids.indexOf(firstPassed);
    return [...ids.slice(idx), ...ids.slice(0, idx)];
}
function replenishDevelopmentRow(gameState, requiredSlots) {
    while (gameState.board.publicDevelopmentCards.length < requiredSlots && gameState.developmentDeck.length > 0) {
        const card = gameState.developmentDeck.shift();
        if (!card) {
            break;
        }
        gameState.board.publicDevelopmentCards.push(card);
    }
}
function applyResourceConversions(gameState, conversion) {
    Object.values(gameState.players).forEach((player) => {
        const { resources } = player;
        if (conversion.light) {
            player.vp += resources.light * conversion.light;
        }
        if (conversion.rainbow) {
            player.vp += resources.rainbow * conversion.rainbow;
        }
        if (conversion.stagnation) {
            player.vp += resources.stagnation * conversion.stagnation;
        }
    });
}
function applyStagnationPenalty(gameState, penaltyPerToken, effects) {
    if (penaltyPerToken <= 0) {
        return;
    }
    Object.values(gameState.players).forEach((player) => {
        const penalty = player.resources.stagnation * penaltyPerToken;
        if (penalty > 0) {
            const summary = effects.get(player.playerId);
            if (summary?.convertPenalty) {
                player.vp += penalty;
            }
            else {
                player.vp -= penalty;
            }
        }
    });
}
function collectCharacterEndgameEffects(gameState, ruleset) {
    const result = new Map();
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
        let summary;
        const ensureSummary = () => {
            if (!summary) {
                summary = { bonusVp: 0, multiplier: 1, convertPenalty: false };
                result.set(player.playerId, summary);
            }
            return summary;
        };
        profile.nodes.forEach((node) => {
            if (!unlocked.has(node.nodeId)) {
                return;
            }
            if (node.effect.type !== 'endGame') {
                return;
            }
            const payloadKind = typeof node.effect.payload.kind === 'string' ? node.effect.payload.kind : undefined;
            switch (payloadKind) {
                case 'vpFlat': {
                    const s = ensureSummary();
                    s.bonusVp += Number(node.effect.payload.amount ?? 0);
                    break;
                }
                case 'conditionalVp': {
                    const condition = node.effect.payload.condition;
                    if (condition === 'noLightNoRainbow') {
                        if (player.resources.light === 0 && player.resources.rainbow === 0) {
                            const s = ensureSummary();
                            s.bonusVp += Number(node.effect.payload.amount ?? 0);
                        }
                    }
                    break;
                }
                case 'vpMultiplier': {
                    const factor = Number(node.effect.payload.multiplier ?? 1);
                    if (!Number.isNaN(factor) && factor > 0) {
                        const s = ensureSummary();
                        s.multiplier *= factor;
                    }
                    break;
                }
                case 'convertNegativeVp': {
                    ensureSummary().convertPenalty = true;
                    break;
                }
                case 'vpPerLobby':
                default:
                    // 今後の拡張用
                    break;
            }
        });
    });
    return result;
}
function applyCharacterBonuses(gameState, effects) {
    effects.forEach((summary, playerId) => {
        const player = gameState.players[playerId];
        if (!player) {
            return;
        }
        player.vp += summary.bonusVp;
        if (summary.multiplier !== 1) {
            player.vp = Math.ceil(player.vp * summary.multiplier);
        }
    });
}

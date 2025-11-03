"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyPass = exports.validatePass = exports.applyRooting = exports.validateRooting = exports.applyTask = exports.validateTask = exports.applyWill = exports.validateWill = exports.applyCollect = exports.validateCollect = exports.applyRefresh = exports.validateRefresh = exports.applyMove = exports.validateMove = exports.applyLensActivate = exports.validateLensActivate = exports.applyLabActivate = exports.validateLabActivate = void 0;
exports.createActionHandler = createActionHandler;
exports.hasCapacity = hasCapacity;
const triggerEngine_1 = require("./triggerEngine");
const characterGrowth_1 = require("./characterGrowth");
const DEFAULT_LOBBY_STOCK = 4;
function resolveLabCost(lab) {
    const base = { actionPoints: 1 };
    if (!lab?.cost) {
        return base;
    }
    return {
        actionPoints: lab.cost.actionPoints ?? 1,
        creativity: lab.cost.creativity,
        resources: lab.cost.resources,
        lobby: lab.cost.lobby,
    };
}
function getPlayerLobbyStock(player) {
    if (typeof player.lobbyStock === 'number' && Number.isFinite(player.lobbyStock)) {
        return player.lobbyStock;
    }
    return DEFAULT_LOBBY_STOCK;
}
function createActionHandler({ validate, apply, }) {
    return async (action, context) => {
        const errors = await validate(action, context);
        if (errors.length > 0) {
            return { success: false, errors };
        }
        await apply(action, context);
        return { success: true };
    };
}
const validateLabActivate = async (action, context) => {
    const errors = [];
    const { gameState, ruleset } = context;
    const player = gameState.players[action.playerId];
    if (!player) {
        errors.push('プレイヤーが存在しません');
        return errors;
    }
    if (gameState.currentPlayerId !== action.playerId) {
        errors.push('現在の手番プレイヤーではありません');
    }
    const labId = typeof action.payload.labId === 'string' ? action.payload.labId : undefined;
    if (!labId) {
        errors.push('ラボIDが指定されていません');
        return errors;
    }
    const lab = ruleset.labs?.[labId];
    if (!lab) {
        errors.push('指定されたラボが存在しません');
        return errors;
    }
    const cost = resolveLabCost(lab);
    const actionPointCost = cost.actionPoints ?? 0;
    if (player.actionPoints < actionPointCost) {
        errors.push('行動力が不足しています');
    }
    if (cost.creativity && player.creativity < cost.creativity) {
        errors.push('創造力が不足しています');
    }
    if (cost.resources && !canPayResourceCost(player.resources, cost.resources)) {
        errors.push('必要な資源が不足しています');
    }
    if (cost.lobby) {
        const stock = getPlayerLobbyStock(player);
        if (stock < cost.lobby) {
            errors.push('ロビー在庫が不足しています');
        }
    }
    lab.rewards
        .filter((reward) => reward.type === 'resource')
        .forEach((reward) => {
        const value = reward.value;
        for (const [resource, amount] of resourceRewardEntries(value)) {
            if (!hasCapacity(player.resources, resource, amount)) {
                errors.push(`${resource} の上限を超えます`);
            }
        }
    });
    return errors;
};
exports.validateLabActivate = validateLabActivate;
const applyLabActivate = async (action, context) => {
    const { gameState, ruleset } = context;
    const player = gameState.players[action.playerId];
    if (!player) {
        throw new Error('プレイヤーが存在しません');
    }
    const labId = action.payload.labId;
    const lab = ruleset.labs?.[labId];
    if (!lab) {
        throw new Error('指定されたラボが存在しません');
    }
    const cost = resolveLabCost(lab);
    const actionPointCost = cost.actionPoints ?? 0;
    if (actionPointCost > 0) {
        player.actionPoints = Math.max(0, player.actionPoints - actionPointCost);
    }
    if (cost.creativity) {
        player.creativity = Math.max(0, player.creativity - cost.creativity);
    }
    if (cost.resources) {
        payResourceCost(player.resources, cost.resources);
    }
    if (cost.lobby) {
        const currentStock = getPlayerLobbyStock(player);
        const nextStock = Math.max(0, currentStock - cost.lobby);
        player.lobbyStock = nextStock;
        const placements = gameState.labPlacements;
        const existingPlacement = placements.find((placement) => placement.labId === labId && placement.playerId === action.playerId);
        if (existingPlacement) {
            existingPlacement.count += cost.lobby;
        }
        else {
            placements.push({ labId, playerId: action.playerId, count: cost.lobby });
        }
    }
    for (const reward of lab.rewards) {
        applyReward(player, reward);
    }
};
exports.applyLabActivate = applyLabActivate;
const validateLensActivate = async (action, context) => {
    const errors = [];
    const { gameState } = context;
    const player = gameState.players[action.playerId];
    if (!player) {
        errors.push('プレイヤーが存在しません');
        return errors;
    }
    if (gameState.currentPlayerId !== action.playerId) {
        errors.push('現在の手番プレイヤーではありません');
    }
    const lensId = typeof action.payload.lensId === 'string' ? action.payload.lensId : undefined;
    if (!lensId) {
        errors.push('レンズIDが指定されていません');
        return errors;
    }
    const lens = gameState.board.lenses[lensId];
    if (!lens) {
        errors.push('指定されたレンズが存在しません');
        return errors;
    }
    if (lens.status !== 'available') {
        errors.push('レンズは使用済みです');
    }
    if (!canActivateLens(lensId, lens.ownerId, action.playerId, gameState)) {
        errors.push('このレンズを起動する条件を満たしていません');
    }
    const totalActionCost = 1 + (lens.cost.actionPoints ?? 0);
    if (player.actionPoints < totalActionCost) {
        errors.push('行動力が不足しています');
    }
    if (!canPayResourceCost(player.resources, lens.cost)) {
        errors.push('必要な資源が不足しています');
    }
    if ((lens.cost.creativity ?? 0) > player.creativity) {
        errors.push('創造力が不足しています');
    }
    return errors;
};
exports.validateLensActivate = validateLensActivate;
const applyLensActivate = async (action, context) => {
    const { gameState } = context;
    const player = gameState.players[action.playerId];
    if (!player) {
        throw new Error('プレイヤーが存在しません');
    }
    const lensId = action.payload.lensId;
    const lens = gameState.board.lenses[lensId];
    if (!lens) {
        throw new Error('指定されたレンズが存在しません');
    }
    const totalActionCost = 1 + (lens.cost.actionPoints ?? 0);
    player.actionPoints = Math.max(0, player.actionPoints - totalActionCost);
    payResourceCost(player.resources, lens.cost);
    if (lens.cost.creativity) {
        player.creativity = Math.max(0, player.creativity - lens.cost.creativity);
    }
    for (const reward of lens.rewards) {
        applyReward(player, reward);
    }
    lens.status = 'exhausted';
    gameState.board.lobbySlots
        .filter((slot) => slot.lensId === lensId && slot.occupantId === action.playerId)
        .forEach((slot) => {
        slot.isActive = false;
    });
    if (lens.ownerId !== action.playerId) {
        (0, triggerEngine_1.triggerEvent)(gameState, context.ruleset, 'lensActivatedByOther', {
            actorId: action.playerId,
            ownerId: lens.ownerId,
            actionType: 'lensActivate',
        });
    }
    (0, triggerEngine_1.triggerEvent)(gameState, context.ruleset, 'actionPerformed', {
        actorId: action.playerId,
        actionType: 'lensActivate',
    });
};
exports.applyLensActivate = applyLensActivate;
const validateMove = async (action, context) => {
    const errors = [];
    const { gameState } = context;
    const player = gameState.players[action.playerId];
    if (!player) {
        errors.push('プレイヤーが存在しません');
        return errors;
    }
    if (gameState.currentPlayerId !== action.playerId) {
        errors.push('現在の手番プレイヤーではありません');
    }
    if (player.actionPoints < 2) {
        errors.push('行動力が不足しています');
    }
    const lensId = typeof action.payload.lensId === 'string' ? action.payload.lensId : undefined;
    if (!lensId) {
        errors.push('移動先のレンズIDが指定されていません');
        return errors;
    }
    const lens = gameState.board.lenses[lensId];
    if (!lens) {
        errors.push('指定されたレンズが存在しません');
        return errors;
    }
    if (lens.ownerId === action.playerId) {
        errors.push('自分のレンズには移動できません');
    }
    const availableSlot = gameState.board.lobbySlots.find((slot) => slot.lensId === lensId && !slot.occupantId);
    if (!availableSlot) {
        errors.push('空きロビーがありません');
    }
    return errors;
};
exports.validateMove = validateMove;
const applyMove = async (action, context) => {
    const { gameState } = context;
    const player = gameState.players[action.playerId];
    if (!player) {
        throw new Error('プレイヤーが存在しません');
    }
    const lensId = action.payload.lensId;
    const slot = gameState.board.lobbySlots.find((item) => item.lensId === lensId && !item.occupantId);
    if (!slot) {
        throw new Error('空きロビーがありません');
    }
    player.actionPoints = Math.max(0, player.actionPoints - 2);
    slot.occupantId = action.playerId;
    slot.isActive = true;
};
exports.applyMove = applyMove;
const validateRefresh = async (action, context) => {
    const errors = [];
    const { gameState } = context;
    const player = gameState.players[action.playerId];
    if (!player) {
        errors.push('プレイヤーが存在しません');
        return errors;
    }
    if (gameState.currentPlayerId !== action.playerId) {
        errors.push('現在の手番プレイヤーではありません');
    }
    if (player.actionPoints < 3) {
        errors.push('行動力が不足しています');
    }
    const lensId = typeof action.payload.lensId === 'string' ? action.payload.lensId : undefined;
    if (!lensId) {
        errors.push('再起動するレンズIDが指定されていません');
        return errors;
    }
    const lens = gameState.board.lenses[lensId];
    if (!lens) {
        errors.push('指定されたレンズが存在しません');
        return errors;
    }
    if (lens.ownerId !== action.playerId) {
        errors.push('自分のレンズのみ再起動できます');
    }
    if (lens.status !== 'exhausted') {
        errors.push('レンズは再起動の必要がありません');
    }
    return errors;
};
exports.validateRefresh = validateRefresh;
const applyRefresh = async (action, context) => {
    const { gameState } = context;
    const player = gameState.players[action.playerId];
    if (!player) {
        throw new Error('プレイヤーが存在しません');
    }
    const lensId = action.payload.lensId;
    const lens = gameState.board.lenses[lensId];
    if (!lens) {
        throw new Error('指定されたレンズが存在しません');
    }
    player.actionPoints = Math.max(0, player.actionPoints - 3);
    lens.status = 'available';
    gameState.board.lobbySlots
        .filter((slot) => slot.lensId === lensId)
        .forEach((slot) => {
        slot.isActive = true;
    });
};
exports.applyRefresh = applyRefresh;
const validateCollect = async (action, context) => {
    const errors = [];
    const { gameState } = context;
    const player = gameState.players[action.playerId];
    if (!player) {
        errors.push('プレイヤーが存在しません');
        return errors;
    }
    if (gameState.currentPlayerId !== action.playerId) {
        errors.push('現在の手番プレイヤーではありません');
    }
    if (player.actionPoints < 2) {
        errors.push('行動力が不足しています');
    }
    const slotIndex = typeof action.payload.slotIndex === 'number' ? action.payload.slotIndex : NaN;
    if (Number.isNaN(slotIndex) || slotIndex < 0 || slotIndex >= gameState.board.publicDevelopmentCards.length) {
        errors.push('公開開発カードのスロット番号が不正です');
    }
    return errors;
};
exports.validateCollect = validateCollect;
const applyCollect = async (action, context) => {
    const { gameState } = context;
    const player = gameState.players[action.playerId];
    if (!player) {
        throw new Error('プレイヤーが存在しません');
    }
    const slotIndex = action.payload.slotIndex;
    const cardId = gameState.board.publicDevelopmentCards[slotIndex];
    if (!cardId) {
        throw new Error('指定された開発カードが存在しません');
    }
    player.actionPoints = Math.max(0, player.actionPoints - 2);
    player.hand.push(cardId);
    gameState.board.publicDevelopmentCards.splice(slotIndex, 1);
    const newCard = gameState.developmentDeck.shift();
    if (newCard) {
        gameState.board.publicDevelopmentCards.splice(slotIndex, 0, newCard);
    }
    (0, triggerEngine_1.triggerEvent)(gameState, context.ruleset, 'actionPerformed', {
        actorId: action.playerId,
        actionType: 'collect',
    });
    (0, triggerEngine_1.triggerEvent)(gameState, context.ruleset, 'developmentSlotFreed', {
        actorId: action.playerId,
    });
};
exports.applyCollect = applyCollect;
const validateWill = async (action, context) => {
    const errors = [];
    const { gameState, ruleset } = context;
    const player = gameState.players[action.playerId];
    if (!player) {
        errors.push('プレイヤーが存在しません');
        return errors;
    }
    if (!player.characterId) {
        errors.push('キャラクターが選択されていません');
        return errors;
    }
    if (gameState.currentPlayerId !== action.playerId) {
        errors.push('現在の手番プレイヤーではありません');
    }
    const nodeId = typeof action.payload.nodeId === 'string' ? action.payload.nodeId : undefined;
    if (!nodeId) {
        errors.push('意思効果のノードIDが指定されていません');
        return errors;
    }
    const profile = ruleset.characters[player.characterId];
    if (!profile) {
        errors.push('キャラクターデータが見つかりません');
        return errors;
    }
    const node = profile.nodes.find((n) => n.nodeId === nodeId);
    if (!node) {
        errors.push('指定された意思効果が存在しません');
        return errors;
    }
    if (node.effect.type !== 'active') {
        errors.push('指定されたノードは意思能力ではありません');
        return errors;
    }
    const unlocked = new Set(player.unlockedCharacterNodes ?? []);
    if (!unlocked.has(nodeId)) {
        errors.push('未解放の意思効果は使用できません');
    }
    const payload = node.effect.payload;
    const cost = payload?.cost;
    if (cost) {
        validateWillCost(cost, player, errors);
    }
    validateWillRewards(payload, player, errors);
    return errors;
};
exports.validateWill = validateWill;
const applyWill = async (action, context) => {
    const { gameState, ruleset } = context;
    const player = gameState.players[action.playerId];
    if (!player) {
        throw new Error('プレイヤーが存在しません');
    }
    const nodeId = action.payload.nodeId;
    const profile = player.characterId ? ruleset.characters[player.characterId] : undefined;
    if (!profile) {
        throw new Error('キャラクターデータが見つかりません');
    }
    const node = profile.nodes.find((n) => n.nodeId === nodeId);
    if (!node || node.effect.type !== 'active') {
        throw new Error('指定された意思効果が存在しません');
    }
    const payload = node.effect.payload;
    const cost = payload?.cost;
    if (cost) {
        applyWillCost(cost, player);
    }
    if (payload?.setCapacityUnlimited) {
        ensureUnlimitedMap(player.resources);
        payload.setCapacityUnlimited.forEach((resource) => {
            player.resources.unlimited[resource] = true;
        });
    }
    payload?.rewards?.forEach((reward) => {
        applyReward(player, reward);
    });
    (0, triggerEngine_1.triggerEvent)(gameState, ruleset, 'actionPerformed', {
        actorId: action.playerId,
        actionType: 'will',
    });
};
exports.applyWill = applyWill;
const validateTask = async (action, context) => {
    const errors = [];
    const { gameState } = context;
    const player = gameState.players[action.playerId];
    if (!player) {
        errors.push('プレイヤーが存在しません');
        return errors;
    }
    const taskId = typeof action.payload.taskId === 'string' ? action.payload.taskId : undefined;
    if (!taskId) {
        errors.push('課題IDが指定されていません');
        return errors;
    }
    const task = gameState.tasks[taskId];
    if (!task) {
        errors.push('指定された課題が存在しません');
        return errors;
    }
    if (player.tasksCompleted.includes(taskId)) {
        errors.push('既に達成済みの課題です');
    }
    const requirementError = getTaskRequirementError(taskId, player, gameState);
    if (requirementError) {
        errors.push(requirementError);
    }
    const rewardChoice = action.payload.rewardChoice;
    if (!rewardChoice || typeof rewardChoice !== 'object') {
        errors.push('課題報酬を選択してください');
        return errors;
    }
    if (rewardChoice.type === 'growth') {
        if (!player.characterId) {
            errors.push('キャラクターが設定されていません');
        }
        if (typeof rewardChoice.nodeId !== 'string' || rewardChoice.nodeId.trim().length === 0) {
            errors.push('成長させるノードを選択してください');
        }
        else if ((player.unlockedCharacterNodes ?? []).includes(rewardChoice.nodeId)) {
            errors.push('指定されたノードは既に解放済みです');
        }
        else if (player.characterId) {
            const nodeDefinition = (0, characterGrowth_1.getGrowthNode)(player.characterId, rewardChoice.nodeId);
            if (!nodeDefinition) {
                errors.push('指定されたノードは存在しません');
            }
            else {
                if ((0, characterGrowth_1.isGrowthNodeAutoUnlocked)(player.characterId, rewardChoice.nodeId)) {
                    errors.push('指定されたノードは自動解放ノードです');
                }
                else {
                    const unlockedSet = (0, characterGrowth_1.buildUnlockedSetWithAuto)(player.characterId, player.unlockedCharacterNodes ?? []);
                    if (!(0, characterGrowth_1.canUnlockGrowthNode)(player.characterId, rewardChoice.nodeId, unlockedSet)) {
                        errors.push('成長条件を満たしていません');
                    }
                }
            }
        }
    }
    else if (rewardChoice.type === 'lobby') {
        // no additional validation needed
    }
    else {
        errors.push('無効な課題報酬が指定されました');
    }
    // 条件判定は EffectEngine or Task definition に依存
    return errors;
};
exports.validateTask = validateTask;
const applyTask = async (action, context) => {
    const { gameState } = context;
    const player = gameState.players[action.playerId];
    if (!player) {
        throw new Error('プレイヤーが存在しません');
    }
    const taskId = action.payload.taskId;
    const task = gameState.tasks[taskId];
    if (!task) {
        throw new Error('指定された課題が存在しません');
    }
    player.tasksCompleted.push(taskId);
    for (const reward of task.reward) {
        applyReward(player, reward);
    }
    const rewardChoice = action.payload.rewardChoice;
    if (!rewardChoice || typeof rewardChoice.type !== 'string') {
        throw new Error('課題報酬が指定されていません');
    }
    switch (rewardChoice.type) {
        case 'growth': {
            if (!player.characterId) {
                throw new Error('キャラクターが設定されていません');
            }
            const nodeId = rewardChoice.nodeId;
            if (!nodeId || typeof nodeId !== 'string') {
                throw new Error('成長させるノードが指定されていません');
            }
            if (!player.unlockedCharacterNodes) {
                player.unlockedCharacterNodes = [];
            }
            if (player.unlockedCharacterNodes.includes(nodeId)) {
                throw new Error('指定されたノードは既に解放済みです');
            }
            const unlockedSet = (0, characterGrowth_1.buildUnlockedSetWithAuto)(player.characterId, player.unlockedCharacterNodes);
            if (!(0, characterGrowth_1.canUnlockGrowthNode)(player.characterId, nodeId, unlockedSet)) {
                throw new Error('成長条件を満たしていません');
            }
            player.unlockedCharacterNodes.push(nodeId);
            break;
        }
        case 'lobby': {
            const currentStock = typeof player.lobbyStock === 'number' ? player.lobbyStock : DEFAULT_LOBBY_STOCK;
            player.lobbyStock = currentStock + 1;
            break;
        }
        default:
            throw new Error('無効な課題報酬が指定されました');
    }
};
exports.applyTask = applyTask;
const validateRooting = async (action, context) => {
    const errors = [];
    const { gameState } = context;
    const player = gameState.players[action.playerId];
    if (!player) {
        errors.push('プレイヤーが存在しません');
        return errors;
    }
    if (gameState.currentPhase !== 'main') {
        errors.push('根回しはメインフェーズのみ実行できます');
    }
    if (gameState.currentPlayerId !== action.playerId) {
        errors.push('現在の手番プレイヤーではありません');
    }
    const alreadyRooting = Object.values(gameState.players).some((p) => p.isRooting);
    if (alreadyRooting) {
        errors.push('根回しはこのラウンドで既に行われています');
    }
    if (!hasCapacity(player.resources, 'light', 1)) {
        errors.push('光トークンの上限を超えます');
    }
    return errors;
};
exports.validateRooting = validateRooting;
const applyRooting = async (action, context) => {
    const { gameState } = context;
    const player = gameState.players[action.playerId];
    if (!player) {
        throw new Error('プレイヤーが存在しません');
    }
    player.isRooting = true;
    player.resources.light += 1;
};
exports.applyRooting = applyRooting;
const validatePass = async (action, context) => {
    const errors = [];
    const { gameState } = context;
    const player = gameState.players[action.playerId];
    if (!player) {
        errors.push('プレイヤーが存在しません');
        return errors;
    }
    if (gameState.currentPlayerId !== action.playerId) {
        errors.push('現在の手番プレイヤーではありません');
    }
    if (player.hasPassed) {
        errors.push('既にパスしています');
    }
    if (!context.turnOrder) {
        errors.push('ターン順情報が利用できません');
    }
    return errors;
};
exports.validatePass = validatePass;
const applyPass = async (action, context) => {
    const { gameState, turnOrder } = context;
    const player = gameState.players[action.playerId];
    if (!player) {
        throw new Error('プレイヤーが存在しません');
    }
    player.hasPassed = true;
    turnOrder?.markPass(action.playerId);
    const nextPlayer = turnOrder?.nextPlayer();
    if (nextPlayer) {
        gameState.currentPlayerId = nextPlayer;
    }
};
exports.applyPass = applyPass;
function hasCapacity(wallet, resource, amount) {
    if (wallet.unlimited?.[resource]) {
        return true;
    }
    const cap = wallet.maxCapacity[resource];
    const current = wallet[resource];
    return current + amount <= cap;
}
function getTaskRequirementError(taskId, player, gameState) {
    switch (taskId) {
        case 'rainbow': {
            const required = 5;
            return player.resources.rainbow >= required ? null : `虹トークンが${required}個必要です`;
        }
        case 'light': {
            const required = 7;
            return player.resources.light >= required ? null : `光トークンが${required}個必要です`;
        }
        case 'lens': {
            const required = 3;
            const owned = countPlayerLenses(gameState, player);
            return owned >= required ? null : `完成済みレンズが${required}枚必要です`;
        }
        default:
            return null;
    }
}
function countPlayerLenses(gameState, player) {
    const boardLenses = Object.values(gameState.board?.lenses ?? {});
    const ownedOnBoard = boardLenses.filter((lens) => lens.ownerId === player.playerId).length;
    const ownedFromState = Array.isArray(player.ownedLenses) ? player.ownedLenses.length : 0;
    return Math.max(ownedOnBoard, ownedFromState);
}
function resourceRewardEntries(reward) {
    const entries = [];
    ['light', 'rainbow', 'stagnation'].forEach((resource) => {
        const amount = reward[resource];
        if (typeof amount === 'number' && amount > 0) {
            entries.push([resource, amount]);
        }
    });
    return entries;
}
function applyReward(player, reward) {
    switch (reward.type) {
        case 'vp': {
            const vp = typeof reward.value === 'number' ? reward.value : 0;
            player.vp += vp;
            break;
        }
        case 'resource': {
            const value = reward.value;
            for (const [resource, amount] of resourceRewardEntries(value)) {
                player.resources[resource] += amount;
            }
            if (typeof value.actionPoints === 'number') {
                player.actionPoints += value.actionPoints;
            }
            if (typeof value.creativity === 'number') {
                player.creativity += value.creativity;
            }
            break;
        }
        case 'growth':
            applyGrowthReward(player, reward.value);
            break;
        case 'trigger':
            // トリガーはイベント処理でハンドリングするためここでは何もしない
            break;
        default:
            break;
    }
}
function validateWillCost(cost, player, errors) {
    if (cost.creativity && player.creativity < cost.creativity) {
        errors.push('創造力が不足しています');
    }
    if (cost.actionPoints && player.actionPoints < cost.actionPoints) {
        errors.push('行動力が不足しています');
    }
    if (cost.resources && !canPayResourceCost(player.resources, cost.resources)) {
        errors.push('必要な資源が不足しています');
    }
}
function validateWillRewards(payload, player, errors) {
    if (!payload?.rewards) {
        return;
    }
    const unlimitedTarget = new Set(payload.setCapacityUnlimited ?? []);
    payload.rewards
        .filter((reward) => reward.type === 'resource')
        .forEach((reward) => {
        const value = reward.value;
        ['light', 'rainbow', 'stagnation'].forEach((resource) => {
            if (unlimitedTarget.has(resource)) {
                return;
            }
            const amount = value[resource];
            if (typeof amount === 'number' && amount > 0) {
                if (!hasCapacity(player.resources, resource, amount)) {
                    errors.push(`${resource} の上限を超えます`);
                }
            }
        });
    });
}
function applyWillCost(cost, player) {
    if (cost.creativity) {
        player.creativity = Math.max(0, player.creativity - cost.creativity);
    }
    if (cost.actionPoints) {
        player.actionPoints = Math.max(0, player.actionPoints - cost.actionPoints);
    }
    if (cost.resources) {
        payResourceCost(player.resources, cost.resources);
    }
}
function ensureUnlimitedMap(wallet) {
    if (!wallet.unlimited) {
        wallet.unlimited = {};
    }
}
function canActivateLens(lensId, ownerId, playerId, gameState) {
    if (ownerId === playerId) {
        return true;
    }
    return gameState.board.lobbySlots.some((slot) => slot.lensId === lensId && slot.occupantId === playerId && slot.isActive);
}
function canPayResourceCost(wallet, cost) {
    return ['light', 'rainbow', 'stagnation'].every((resource) => {
        const required = cost[resource];
        if (!required) {
            return true;
        }
        return wallet[resource] >= required;
    });
}
function payResourceCost(wallet, cost) {
    ['light', 'rainbow', 'stagnation'].forEach((resource) => {
        const required = cost[resource];
        if (required) {
            wallet[resource] = Math.max(0, wallet[resource] - required);
        }
    });
}
function applyGrowthReward(player, reward) {
    if (!reward) {
        return;
    }
    if (typeof reward.vp === 'number') {
        player.vp += reward.vp;
    }
    if (reward.unlockNodeId) {
        if (!player.unlockedCharacterNodes) {
            player.unlockedCharacterNodes = [];
        }
        if (!player.unlockedCharacterNodes.includes(reward.unlockNodeId)) {
            player.unlockedCharacterNodes.push(reward.unlockNodeId);
        }
    }
}

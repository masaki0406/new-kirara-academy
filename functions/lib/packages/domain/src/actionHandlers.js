"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyPass = exports.validatePass = exports.applyPersuasion = exports.validatePersuasion = exports.applyRooting = exports.validateRooting = exports.applyTask = exports.validateTask = exports.applyWill = exports.validateWill = exports.applyCollect = exports.validateCollect = exports.applyRefresh = exports.validateRefresh = exports.applyMove = exports.validateMove = exports.applyLensActivate = exports.validateLensActivate = exports.applyLabActivate = exports.validateLabActivate = void 0;
exports.createActionHandler = createActionHandler;
exports.hasCapacity = hasCapacity;
const types_1 = require("./types");
const triggerEngine_1 = require("./triggerEngine");
const characterGrowth_1 = require("./characterGrowth");
const DEFAULT_LOBBY_STOCK = 4;
const MAX_ACTION_POINTS = 10;
const MAX_CREATIVITY = 5;
const TOTAL_RESOURCE_LIMIT = 12;
const RESOURCE_ORDER = ['light', 'rainbow', 'stagnation'];
function getTotalResources(wallet) {
    return RESOURCE_ORDER.reduce((sum, resource) => sum + wallet[resource], 0);
}
function isFoundationCost(value) {
    return types_1.FOUNDATION_COSTS.includes(value);
}
function parseFoundationCost(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return null;
    }
    const numeric = Math.floor(value);
    return isFoundationCost(numeric) ? numeric : null;
}
function toFiniteNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const parsed = Number(value);
        if (!Number.isNaN(parsed)) {
            return parsed;
        }
    }
    return null;
}
function normalizePolishCardType(value) {
    if (value === 'development' || value === 'vp') {
        return value;
    }
    return null;
}
function normalizeCraftedLensSideItems(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    const items = [];
    value.forEach((entry) => {
        if (!entry || typeof entry !== 'object') {
            return;
        }
        const record = entry;
        const cardId = typeof record.cardId === 'string' ? record.cardId : null;
        const cardType = normalizePolishCardType(record.cardType);
        if (!cardId || !cardType) {
            return;
        }
        const positionNumber = toFiniteNumber(record.position);
        const position = positionNumber !== null ? Math.floor(positionNumber) : null;
        let item = null;
        if (typeof record.item === 'string') {
            item = record.item;
        }
        else if (record.item !== undefined && record.item !== null) {
            item = String(record.item);
        }
        const normalized = {
            cardId,
            cardType,
            position,
            item,
        };
        if (typeof record.quantity === 'number' && Number.isFinite(record.quantity)) {
            normalized.quantity = record.quantity;
        }
        else if (record.quantity === null) {
            normalized.quantity = null;
        }
        items.push(normalized);
    });
    return items;
}
function normalizeCraftedLensSourceCards(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    const sources = [];
    value.forEach((entry) => {
        if (!entry || typeof entry !== 'object') {
            return;
        }
        const record = entry;
        const cardId = typeof record.cardId === 'string' ? record.cardId : null;
        const cardType = normalizePolishCardType(record.cardType);
        const flipped = typeof record.flipped === 'boolean' ? record.flipped : false;
        if (!cardId || !cardType) {
            return;
        }
        sources.push({
            cardId,
            cardType,
            flipped,
        });
    });
    return sources;
}
function normalizeCraftedLens(value) {
    if (!value || typeof value !== 'object') {
        return null;
    }
    const record = value;
    const foundationCost = parseFoundationCost(record.foundationCost);
    const leftTotalNumber = toFiniteNumber(record.leftTotal);
    const rightTotalNumber = toFiniteNumber(record.rightTotal);
    if (foundationCost === null || leftTotalNumber === null || rightTotalNumber === null) {
        return null;
    }
    const vpTotalNumber = toFiniteNumber(record.vpTotal) ?? 0;
    const createdAtNumber = toFiniteNumber(record.createdAt);
    const lensId = typeof record.lensId === 'string' && record.lensId.trim().length > 0 ? record.lensId : '';
    const leftItems = normalizeCraftedLensSideItems(record.leftItems);
    const rightItems = normalizeCraftedLensSideItems(record.rightItems);
    const sourceCards = normalizeCraftedLensSourceCards(record.sourceCards);
    return {
        lensId,
        createdAt: createdAtNumber !== null && Number.isFinite(createdAtNumber)
            ? Math.max(0, Math.floor(createdAtNumber))
            : Date.now(),
        foundationCost,
        leftTotal: leftTotalNumber,
        rightTotal: rightTotalNumber,
        vpTotal: vpTotalNumber,
        leftItems,
        rightItems,
        sourceCards,
    };
}
function normalizePolishPayload(raw) {
    if (!raw || typeof raw !== 'object') {
        return null;
    }
    const record = raw;
    const selection = normalizeCraftedLensSourceCards(record.selection);
    const foundationCost = parseFoundationCost(record.foundationCost);
    const result = normalizeCraftedLens(record.result);
    if (!selection.length || foundationCost === null || !result) {
        return null;
    }
    if (!result.sourceCards.length) {
        result.sourceCards = selection.map((entry) => ({ ...entry }));
    }
    result.foundationCost = foundationCost;
    return {
        selection,
        foundationCost,
        result,
    };
}
function findDuplicatePositions(items) {
    const seen = new Set();
    for (const item of items) {
        if (item.position === null || item.position === undefined) {
            continue;
        }
        const position = Math.floor(item.position);
        if (seen.has(position)) {
            return position;
        }
        seen.add(position);
    }
    return null;
}
function buildSelectionKey(cardId, cardType, flipped) {
    return `${cardType}:${cardId}:${flipped ? '1' : '0'}`;
}
function removeCardFromList(cards, cardId) {
    const index = cards.indexOf(cardId);
    if (index === -1) {
        throw new Error('指定されたカードが見つかりません');
    }
    cards.splice(index, 1);
}
function consumeFoundationCard(player, foundationCost) {
    if (!player.collectedFoundationCards) {
        throw new Error('土台カードの在庫が不足しています');
    }
    const current = player.collectedFoundationCards[foundationCost] ?? 0;
    if (!Number.isFinite(current) || current <= 0) {
        throw new Error('土台カードの在庫が不足しています');
    }
    const remaining = current - 1;
    if (remaining > 0) {
        player.collectedFoundationCards[foundationCost] = remaining;
    }
    else {
        delete player.collectedFoundationCards[foundationCost];
    }
}
function generateCraftedLensId(playerId, timestamp) {
    const timeSeed = typeof timestamp === 'number' && Number.isFinite(timestamp) ? timestamp : Date.now();
    const randomSeed = Math.random().toString(36).slice(2, 8);
    return `crafted-lens-${playerId}-${timeSeed}-${randomSeed}`;
}
function cloneSideItems(items) {
    return items.map((item) => {
        const cloned = {
            cardId: item.cardId,
            cardType: item.cardType,
            position: item.position === null || item.position === undefined ? null : Math.floor(item.position),
            item: item.item ?? null,
        };
        if (typeof item.quantity === 'number' && Number.isFinite(item.quantity)) {
            cloned.quantity = item.quantity;
        }
        else if (item.quantity === null) {
            cloned.quantity = null;
        }
        return cloned;
    });
}
function cloneSourceCards(cards) {
    return cards.map((card) => ({
        cardId: card.cardId,
        cardType: card.cardType,
        flipped: card.flipped,
    }));
}
function applyPolishResult(action, context, player, payload) {
    const board = context.gameState.board;
    consumeFoundationCard(player, payload.foundationCost);
    player.collectedDevelopmentCards = player.collectedDevelopmentCards ?? [];
    player.collectedVpCards = player.collectedVpCards ?? [];
    const developmentCards = player.collectedDevelopmentCards;
    const vpCards = player.collectedVpCards;
    payload.selection.forEach((selection) => {
        if (selection.cardType === 'development') {
            removeCardFromList(developmentCards, selection.cardId);
        }
        else {
            removeCardFromList(vpCards, selection.cardId);
        }
    });
    if (!player.craftedLenses) {
        player.craftedLenses = [];
    }
    const createdAt = typeof payload.result.createdAt === 'number' && Number.isFinite(payload.result.createdAt)
        ? Math.max(0, Math.floor(payload.result.createdAt))
        : context.timestamp ?? Date.now();
    const lensId = payload.result.lensId && payload.result.lensId.trim().length > 0
        ? payload.result.lensId
        : generateCraftedLensId(action.playerId, context.timestamp);
    const lens = {
        lensId,
        createdAt,
        foundationCost: payload.foundationCost,
        leftTotal: payload.result.leftTotal,
        rightTotal: payload.result.rightTotal,
        vpTotal: typeof payload.result.vpTotal === 'number' && Number.isFinite(payload.result.vpTotal)
            ? payload.result.vpTotal
            : payload.result.vpTotal ?? 0,
        leftItems: cloneSideItems(payload.result.leftItems),
        rightItems: cloneSideItems(payload.result.rightItems),
        sourceCards: cloneSourceCards(payload.result.sourceCards.length ? payload.result.sourceCards : payload.selection),
    };
    player.craftedLenses.push(lens);
    if (!player.ownedLenses) {
        player.ownedLenses = [];
    }
    if (!player.ownedLenses.includes(lensId)) {
        player.ownedLenses.push(lensId);
    }
    // ボード上に完成レンズを配置し、ロビーを確保する
    if (!board.lenses[lensId]) {
        const craftedLensState = {
            lensId,
            ownerId: action.playerId,
            cost: { actionPoints: payload.foundationCost },
            rewards: [],
            slots: 1,
            tags: ['crafted'],
            status: 'available',
            leftItems: lens.leftItems,
            rightItems: lens.rightItems,
        };
        board.lenses[lensId] = craftedLensState;
    }
    if (!Array.isArray(board.lobbySlots)) {
        board.lobbySlots = [];
    }
    const existingSlots = board.lobbySlots.filter((slot) => slot.lensId === lensId);
    if (existingSlots.length === 0) {
        board.lobbySlots.push({
            lensId,
            ownerId: action.playerId,
            isActive: true,
        });
    }
}
function cloneDefaultFoundationStock() {
    const stock = {};
    types_1.FOUNDATION_COSTS.forEach((cost) => {
        const base = types_1.DEFAULT_FOUNDATION_STOCK[cost];
        if (typeof base === 'number') {
            stock[cost] = base;
        }
    });
    return stock;
}
function ensureFoundationStockInitialized(board) {
    if (!board.foundationStock || typeof board.foundationStock !== 'object') {
        board.foundationStock = cloneDefaultFoundationStock();
    }
}
function getAvailableFoundationStock(state, cost) {
    const stock = state.board.foundationStock;
    if (stock && typeof stock[cost] === 'number' && Number.isFinite(stock[cost])) {
        return stock[cost];
    }
    if (!stock) {
        const fallback = types_1.DEFAULT_FOUNDATION_STOCK[cost];
        return typeof fallback === 'number' ? fallback : 0;
    }
    return 0;
}
function clampActionPoints(value) {
    return Math.max(0, Math.min(MAX_ACTION_POINTS, value));
}
function clampCreativity(value) {
    return Math.max(0, Math.min(MAX_CREATIVITY, value));
}
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
function getLobbyReserve(player) {
    if (typeof player.lobbyReserve === 'number' && Number.isFinite(player.lobbyReserve)) {
        return Math.max(0, player.lobbyReserve);
    }
    return DEFAULT_LOBBY_STOCK;
}
function getLobbyAvailable(player) {
    if (typeof player.lobbyAvailable === 'number' && Number.isFinite(player.lobbyAvailable)) {
        return Math.max(0, player.lobbyAvailable);
    }
    return DEFAULT_LOBBY_STOCK;
}
function getPlayerLobbyUsed(player) {
    if (typeof player.lobbyUsed === 'number' && Number.isFinite(player.lobbyUsed)) {
        return Math.max(0, player.lobbyUsed);
    }
    return 0;
}
function incrementPlayerLobbyUsed(player, amount) {
    const current = getPlayerLobbyUsed(player);
    const next = Math.max(0, current + amount);
    player.lobbyUsed = next;
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
    if (labId === 'negotiation') {
        const existingPlacement = gameState.labPlacements.some((placement) => placement.labId === labId && placement.count > 0);
        if (existingPlacement) {
            errors.push('根回しは既に利用されています');
        }
        const alreadyRooting = Object.values(gameState.players).some((p) => p.isRooting);
        if (alreadyRooting) {
            errors.push('根回しはこのラウンドで既に行われています');
        }
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
        const stock = getLobbyAvailable(player);
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
    if (labId === 'polish') {
        const rawPayload = action.payload && typeof action.payload === 'object'
            ? action.payload.polish
            : undefined;
        const normalized = normalizePolishPayload(rawPayload);
        if (!normalized) {
            errors.push('研磨の設定が不正です');
            return errors;
        }
        if (!normalized.selection.length) {
            errors.push('研磨で使用するカードを選択してください');
        }
        const foundationAvailable = player.collectedFoundationCards?.[normalized.foundationCost] ?? 0;
        if (foundationAvailable <= 0) {
            errors.push('指定された土台カードを所持していません');
        }
        const developmentCounts = new Map();
        (player.collectedDevelopmentCards ?? []).forEach((cardId) => {
            developmentCounts.set(cardId, (developmentCounts.get(cardId) ?? 0) + 1);
        });
        const vpCounts = new Map();
        (player.collectedVpCards ?? []).forEach((cardId) => {
            vpCounts.set(cardId, (vpCounts.get(cardId) ?? 0) + 1);
        });
        normalized.selection.forEach((selection) => {
            if (selection.cardType === 'development') {
                const remaining = developmentCounts.get(selection.cardId) ?? 0;
                if (remaining <= 0) {
                    errors.push(`開発カード ${selection.cardId} を所持していません`);
                }
                else {
                    developmentCounts.set(selection.cardId, remaining - 1);
                }
            }
            else {
                const remaining = vpCounts.get(selection.cardId) ?? 0;
                if (remaining <= 0) {
                    errors.push(`VPカード ${selection.cardId} を所持していません`);
                }
                else {
                    vpCounts.set(selection.cardId, remaining - 1);
                }
            }
        });
        const diff = Math.max(0, normalized.result.rightTotal - normalized.result.leftTotal);
        if (diff > normalized.foundationCost) {
            errors.push('土台カードのコストが不足しています');
        }
        const leftDuplicate = findDuplicatePositions(normalized.result.leftItems);
        if (leftDuplicate !== null) {
            errors.push('左側のPOSが重複しています');
        }
        const rightDuplicate = findDuplicatePositions(normalized.result.rightItems);
        if (rightDuplicate !== null) {
            errors.push('右側のPOSが重複しています');
        }
        const selectionCountMap = new Map();
        normalized.selection.forEach((selection) => {
            const key = buildSelectionKey(selection.cardId, selection.cardType, selection.flipped);
            selectionCountMap.set(key, (selectionCountMap.get(key) ?? 0) + 1);
        });
        const resultCountMap = new Map();
        normalized.result.sourceCards.forEach((source) => {
            const key = buildSelectionKey(source.cardId, source.cardType, source.flipped);
            resultCountMap.set(key, (resultCountMap.get(key) ?? 0) + 1);
        });
        if (selectionCountMap.size !== resultCountMap.size) {
            errors.push('研磨結果の参照カードが一致しません');
        }
        else {
            selectionCountMap.forEach((count, key) => {
                if (resultCountMap.get(key) !== count) {
                    errors.push('研磨結果の参照カードが一致しません');
                }
            });
        }
        normalized.result.leftItems.forEach((item) => {
            const key = buildSelectionKey(item.cardId, item.cardType, false);
            if (!selectionCountMap.has(key)) {
                errors.push('左側のアイテム割り当てが不正です');
            }
        });
        normalized.result.rightItems.forEach((item) => {
            const key = buildSelectionKey(item.cardId, item.cardType, true);
            if (!selectionCountMap.has(key)) {
                errors.push('右側のアイテム割り当てが不正です');
            }
        });
    }
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
        const currentStock = getLobbyAvailable(player);
        const nextStock = Math.max(0, currentStock - cost.lobby);
        player.lobbyAvailable = nextStock;
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
    if (labId === 'polish') {
        const rawPayload = action.payload && typeof action.payload === 'object'
            ? action.payload.polish
            : undefined;
        const normalized = normalizePolishPayload(rawPayload);
        if (!normalized) {
            throw new Error('研磨の設定が不正です');
        }
        applyPolishResult(action, context, player, normalized);
    }
    if (labId === 'negotiation') {
        player.isRooting = true;
        context.turnOrder?.registerRooting(action.playerId);
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
    const itemCost = accumulateItemEffects(lens.leftItems, 'cost');
    const mergedCost = {
        light: (lens.cost.light ?? 0) + (itemCost.resources.light ?? 0),
        rainbow: (lens.cost.rainbow ?? 0) + (itemCost.resources.rainbow ?? 0),
        stagnation: (lens.cost.stagnation ?? 0) + (itemCost.resources.stagnation ?? 0),
        creativity: (lens.cost.creativity ?? 0) + (itemCost.resources.creativity ?? 0),
        actionPoints: lens.cost.actionPoints,
    };
    if (!canPayResourceCost(player.resources, mergedCost)) {
        errors.push('必要な資源が不足しています');
    }
    if (mergedCost.creativity && mergedCost.creativity > player.creativity) {
        errors.push('創造力が不足しています');
    }
    if (itemCost.lobbyReturn > getPlayerLobbyUsed(player)) {
        errors.push('戻せるロビーが不足しています');
    }
    if (itemCost.growthLoss > 0) {
        const current = new Set(player.unlockedCharacterNodes ?? []);
        const removable = [...current].filter((nodeId) => !nodeId.endsWith(':s'));
        if (removable.length < itemCost.growthLoss) {
            errors.push('戻せる成長が不足しています');
        }
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
    const itemCost = accumulateItemEffects(lens.leftItems, 'cost');
    payResourceCost(player.resources, lens.cost);
    payResourceCost(player.resources, itemCost.resources);
    if (lens.cost.creativity) {
        player.creativity = Math.max(0, player.creativity - lens.cost.creativity);
    }
    if (itemCost.resources.creativity) {
        player.creativity = Math.max(0, player.creativity - itemCost.resources.creativity);
    }
    if (itemCost.lobbyReturn > 0) {
        returnLobbyToStock(player, gameState, lensId, itemCost.lobbyReturn);
    }
    if (itemCost.growthLoss > 0) {
        for (let i = 0; i < itemCost.growthLoss; i += 1) {
            applyGrowthDelta(player, -1);
        }
    }
    for (const reward of lens.rewards) {
        applyReward(player, reward);
    }
    const itemReward = accumulateItemEffects(lens.rightItems, 'reward');
    if (itemReward.resources.light ||
        itemReward.resources.rainbow ||
        itemReward.resources.stagnation ||
        itemReward.resources.actionPoints ||
        itemReward.resources.creativity) {
        applyReward(player, { type: 'resource', value: itemReward.resources });
    }
    if (itemReward.lobbyGain > 0) {
        gainLobbyFromStock(player, itemReward.lobbyGain);
    }
    if (itemReward.growthGain > 0) {
        const growthSelections = Array.isArray(action.payload.growthSelections)
            ? action.payload.growthSelections
            : undefined;
        applyGrowthSelection(player, growthSelections, itemReward.growthGain);
    }
    lens.status = 'exhausted';
    const targetSlots = gameState.board.lobbySlots.filter((slot) => slot.lensId === lensId);
    let occupiedSlot = targetSlots.find((slot) => slot.occupantId === action.playerId);
    if (!occupiedSlot) {
        occupiedSlot = targetSlots.find((slot) => !slot.occupantId);
        if (!occupiedSlot) {
            throw new Error('ロビー枠がありません');
        }
        const available = getLobbyAvailable(player);
        if (available <= 0) {
            throw new Error('ロビーが不足しています');
        }
        player.lobbyAvailable = available - 1;
        occupiedSlot.occupantId = action.playerId;
    }
    occupiedSlot.isActive = false;
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
    if (lens.status !== 'exhausted') {
        errors.push('レンズは再起動の必要がありません');
    }
    const slot = gameState.board.lobbySlots.find((entry) => entry.lensId === lensId && entry.occupantId === action.playerId && !entry.isActive);
    if (!slot) {
        errors.push('使用済みの自分のロビーが配置されていません');
    }
    if (getLobbyAvailable(player) <= 0) {
        errors.push('未使用のロビーが不足しています');
    }
    const totalActionCost = 3 + (lens.cost.actionPoints ?? 0);
    if (player.actionPoints < totalActionCost) {
        errors.push('行動力が不足しています');
    }
    if (lens.cost.creativity && player.creativity < lens.cost.creativity) {
        errors.push('創造力が不足しています');
    }
    const itemCost = accumulateItemEffects(lens.leftItems, 'cost');
    const mergedCost = {
        light: (lens.cost.light ?? 0) + (itemCost.resources.light ?? 0),
        rainbow: (lens.cost.rainbow ?? 0) + (itemCost.resources.rainbow ?? 0),
        stagnation: (lens.cost.stagnation ?? 0) + (itemCost.resources.stagnation ?? 0),
        creativity: (lens.cost.creativity ?? 0) + (itemCost.resources.creativity ?? 0),
        actionPoints: lens.cost.actionPoints,
    };
    if (!canPayResourceCost(player.resources, mergedCost)) {
        errors.push('必要な資源が不足しています');
    }
    if (mergedCost.creativity && mergedCost.creativity > player.creativity) {
        errors.push('創造力が不足しています');
    }
    if (itemCost.lobbyReturn > getPlayerLobbyUsed(player)) {
        errors.push('戻せるロビーが不足しています');
    }
    if (itemCost.growthLoss > 0) {
        const current = new Set(player.unlockedCharacterNodes ?? []);
        const removable = [...current].filter((nodeId) => !nodeId.endsWith(':s'));
        if (removable.length < itemCost.growthLoss) {
            errors.push('戻せる成長が不足しています');
        }
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
    const slot = gameState.board.lobbySlots.find((entry) => entry.lensId === lensId && entry.occupantId === action.playerId && !entry.isActive);
    if (!slot) {
        throw new Error('使用済みの自分のロビーが配置されていません');
    }
    player.actionPoints = Math.max(0, player.actionPoints - 3);
    const cost = lens.cost;
    if (cost.actionPoints) {
        player.actionPoints = Math.max(0, player.actionPoints - cost.actionPoints);
    }
    const itemCost = accumulateItemEffects(lens.leftItems, 'cost');
    payResourceCost(player.resources, cost);
    payResourceCost(player.resources, itemCost.resources);
    if (cost.creativity) {
        player.creativity = Math.max(0, player.creativity - cost.creativity);
    }
    if (itemCost.resources.creativity) {
        player.creativity = Math.max(0, player.creativity - itemCost.resources.creativity);
    }
    if (itemCost.lobbyReturn > 0) {
        returnLobbyToStock(player, gameState, lensId, itemCost.lobbyReturn);
    }
    if (itemCost.growthLoss > 0) {
        for (let i = 0; i < itemCost.growthLoss; i += 1) {
            applyGrowthDelta(player, -1);
        }
    }
    // 手元の未使用ロビーを消費して、使用済みロビーを補充
    const available = getLobbyAvailable(player);
    if (available > 0) {
        player.lobbyAvailable = available - 1;
    }
    incrementPlayerLobbyUsed(player, 1);
    // スロット上のロビーを使用状態にする
    slot.isActive = false;
    for (const reward of lens.rewards) {
        applyReward(player, reward);
    }
    const itemReward = accumulateItemEffects(lens.rightItems, 'reward');
    if (itemReward.resources.light ||
        itemReward.resources.rainbow ||
        itemReward.resources.stagnation ||
        itemReward.resources.actionPoints ||
        itemReward.resources.creativity) {
        applyReward(player, { type: 'resource', value: itemReward.resources });
    }
    if (itemReward.lobbyGain > 0) {
        gainLobbyFromStock(player, itemReward.lobbyGain);
    }
    if (itemReward.growthGain > 0) {
        const growthSelections = Array.isArray(action.payload.growthSelections)
            ? action.payload.growthSelections
            : undefined;
        applyGrowthSelection(player, growthSelections, itemReward.growthGain);
    }
    lens.status = 'exhausted';
    if (lens.ownerId !== action.playerId) {
        const owner = gameState.players[lens.ownerId];
        if (owner) {
            owner.vp += 2;
        }
        (0, triggerEngine_1.triggerEvent)(gameState, context.ruleset, 'lensActivatedByOther', {
            actorId: action.playerId,
            ownerId: lens.ownerId,
            actionType: 'refresh',
        });
    }
    (0, triggerEngine_1.triggerEvent)(gameState, context.ruleset, 'actionPerformed', {
        actorId: action.playerId,
        actionType: 'refresh',
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
    const slotTypeRaw = typeof action.payload.slotType === 'string' ? action.payload.slotType : 'development';
    if (slotTypeRaw !== 'development' && slotTypeRaw !== 'vp' && slotTypeRaw !== 'foundation') {
        errors.push('カードの取得先が不正です');
        return errors;
    }
    if (slotTypeRaw === 'foundation') {
        const rawCost = action.payload.foundationCost;
        const parsedCost = typeof rawCost === 'number' && Number.isFinite(rawCost) ? Math.floor(rawCost) : NaN;
        if (Number.isNaN(parsedCost) || !isFoundationCost(parsedCost)) {
            errors.push('土台カードのコスト指定が不正です');
            return errors;
        }
        const cost = parsedCost;
        const available = getAvailableFoundationStock(gameState, cost);
        if (available <= 0) {
            errors.push('指定された土台カードは在庫がありません');
        }
        return errors;
    }
    const slotIndex = typeof action.payload.slotIndex === 'number' ? action.payload.slotIndex : NaN;
    if (Number.isNaN(slotIndex) || slotIndex < 0) {
        errors.push('カードのスロット番号が不正です');
        return errors;
    }
    if (slotTypeRaw === 'development') {
        const cards = gameState.board.publicDevelopmentCards ?? [];
        if (slotIndex >= cards.length || !cards[slotIndex]) {
            errors.push('公開開発カードのスロット番号が不正です');
        }
    }
    else {
        const cards = gameState.board.publicVpCards ?? [];
        if (slotIndex >= cards.length || !cards[slotIndex]) {
            errors.push('公開VPカードのスロット番号が不正です');
        }
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
    player.actionPoints = Math.max(0, player.actionPoints - 2);
    const slotTypeRaw = typeof action.payload.slotType === 'string' ? action.payload.slotType : 'development';
    if (slotTypeRaw === 'foundation') {
        const rawCost = action.payload.foundationCost;
        const parsedCost = typeof rawCost === 'number' && Number.isFinite(rawCost) ? Math.floor(rawCost) : NaN;
        if (Number.isNaN(parsedCost) || !isFoundationCost(parsedCost)) {
            throw new Error('指定された土台カードが存在しません');
        }
        const cost = parsedCost;
        ensureFoundationStockInitialized(gameState.board);
        const stock = gameState.board.foundationStock;
        const available = typeof stock[cost] === 'number' && Number.isFinite(stock[cost]) ? stock[cost] : 0;
        if (available <= 0) {
            throw new Error('指定された土台カードは在庫がありません');
        }
        const remaining = available - 1;
        if (remaining > 0) {
            stock[cost] = remaining;
        }
        else {
            delete stock[cost];
        }
        if (!player.collectedFoundationCards || typeof player.collectedFoundationCards !== 'object') {
            player.collectedFoundationCards = {};
        }
        const currentCount = typeof player.collectedFoundationCards[cost] === 'number'
            ? player.collectedFoundationCards[cost]
            : 0;
        player.collectedFoundationCards[cost] = currentCount + 1;
    }
    else if (slotTypeRaw === 'vp') {
        const slotIndex = typeof action.payload.slotIndex === 'number' && Number.isFinite(action.payload.slotIndex)
            ? action.payload.slotIndex
            : -1;
        const cards = gameState.board.publicVpCards ?? [];
        const cardId = cards[slotIndex];
        if (!cardId) {
            throw new Error('指定されたVPカードが存在しません');
        }
        player.collectedVpCards = player.collectedVpCards ?? [];
        player.collectedVpCards.push(cardId);
        cards.splice(slotIndex, 1);
        const newCard = gameState.vpDeck.shift();
        if (newCard) {
            cards.splice(slotIndex, 0, newCard);
        }
    }
    else {
        const slotIndex = typeof action.payload.slotIndex === 'number' && Number.isFinite(action.payload.slotIndex)
            ? action.payload.slotIndex
            : -1;
        const cards = gameState.board.publicDevelopmentCards ?? [];
        const cardId = cards[slotIndex];
        if (!cardId) {
            throw new Error('指定された開発カードが存在しません');
        }
        player.collectedDevelopmentCards = player.collectedDevelopmentCards ?? [];
        player.collectedDevelopmentCards.push(cardId);
        cards.splice(slotIndex, 1);
        const newCard = gameState.developmentDeck.shift();
        if (newCard) {
            cards.splice(slotIndex, 0, newCard);
        }
        (0, triggerEngine_1.triggerEvent)(gameState, context.ruleset, 'developmentSlotFreed', {
            actorId: action.playerId,
        });
    }
    (0, triggerEngine_1.triggerEvent)(gameState, context.ruleset, 'actionPerformed', {
        actorId: action.playerId,
        actionType: 'collect',
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
            const reserve = getLobbyReserve(player);
            player.lobbyReserve = reserve + 1;
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
const validatePersuasion = async (action, context) => {
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
    const slot = gameState.board.lobbySlots.find((item) => item.lensId === lensId && item.occupantId && item.occupantId !== action.playerId);
    if (!slot) {
        errors.push('相手のロビーが配置されていません');
    }
    else if (slot.occupantId === action.playerId) {
        errors.push('自分のロビーには説得できません');
    }
    const requiredActionPoints = 2 + (lens.cost.actionPoints ?? 0);
    if (player.actionPoints < requiredActionPoints) {
        errors.push('行動力が不足しています');
    }
    const itemCost = accumulateItemEffects(lens.leftItems, 'cost');
    const mergedCost = {
        light: (lens.cost.light ?? 0) + (itemCost.resources.light ?? 0),
        rainbow: (lens.cost.rainbow ?? 0) + (itemCost.resources.rainbow ?? 0),
        stagnation: (lens.cost.stagnation ?? 0) + (itemCost.resources.stagnation ?? 0),
        creativity: (lens.cost.creativity ?? 0) + (itemCost.resources.creativity ?? 0),
        actionPoints: lens.cost.actionPoints,
    };
    if (!canPayResourceCost(player.resources, mergedCost)) {
        errors.push('必要な資源が不足しています');
    }
    if (mergedCost.creativity && mergedCost.creativity > player.creativity) {
        errors.push('創造力が不足しています');
    }
    if (itemCost.lobbyReturn > getPlayerLobbyUsed(player)) {
        errors.push('戻せるロビーが不足しています');
    }
    if (itemCost.growthLoss > 0) {
        const current = new Set(player.unlockedCharacterNodes ?? []);
        const removable = [...current].filter((nodeId) => !nodeId.endsWith(':s'));
        if (removable.length < itemCost.growthLoss) {
            errors.push('戻せる成長が不足しています');
        }
    }
    lens.rewards
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
exports.validatePersuasion = validatePersuasion;
const applyPersuasion = async (action, context) => {
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
    const slot = gameState.board.lobbySlots.find((item) => item.lensId === lensId && item.occupantId && item.occupantId !== action.playerId);
    if (!slot || !slot.occupantId) {
        throw new Error('相手のロビーが配置されていません');
    }
    const occupantId = slot.occupantId;
    const occupantPlayer = gameState.players[occupantId];
    player.actionPoints = Math.max(0, player.actionPoints - 2);
    const extraAction = lens.cost.actionPoints ?? 0;
    if (extraAction > 0) {
        player.actionPoints = Math.max(0, player.actionPoints - extraAction);
    }
    const itemCost = accumulateItemEffects(lens.leftItems, 'cost');
    payResourceCost(player.resources, lens.cost);
    payResourceCost(player.resources, itemCost.resources);
    if (lens.cost.creativity) {
        player.creativity = Math.max(0, player.creativity - lens.cost.creativity);
    }
    if (itemCost.resources.creativity) {
        player.creativity = Math.max(0, player.creativity - itemCost.resources.creativity);
    }
    if (itemCost.lobbyReturn > 0) {
        returnLobbyToStock(player, gameState, lensId, itemCost.lobbyReturn);
    }
    if (itemCost.growthLoss > 0) {
        for (let i = 0; i < itemCost.growthLoss; i += 1) {
            applyGrowthDelta(player, -1);
        }
    }
    for (const reward of lens.rewards) {
        applyReward(player, reward);
    }
    const itemReward = accumulateItemEffects(lens.rightItems, 'reward');
    if (itemReward.resources.light ||
        itemReward.resources.rainbow ||
        itemReward.resources.stagnation ||
        itemReward.resources.actionPoints ||
        itemReward.resources.creativity) {
        applyReward(player, { type: 'resource', value: itemReward.resources });
    }
    if (itemReward.lobbyGain > 0) {
        gainLobbyFromStock(player, itemReward.lobbyGain);
    }
    if (itemReward.growthGain > 0) {
        const growthSelections = Array.isArray(action.payload.growthSelections)
            ? action.payload.growthSelections
            : undefined;
        applyGrowthSelection(player, growthSelections, itemReward.growthGain);
    }
    // 既存ロビーを返却し、自分のロビーを配置（配置したロビーはこの手番で使用済み）
    slot.occupantId = action.playerId;
    slot.isActive = false;
    if (occupantPlayer) {
        incrementPlayerLobbyUsed(occupantPlayer, 1);
    }
    lens.status = 'exhausted';
    if (lens.ownerId !== action.playerId) {
        const owner = gameState.players[lens.ownerId];
        if (owner) {
            owner.vp += 2;
        }
        (0, triggerEngine_1.triggerEvent)(gameState, context.ruleset, 'lensActivatedByOther', {
            actorId: action.playerId,
            ownerId: lens.ownerId,
            actionType: 'persuasion',
        });
    }
    (0, triggerEngine_1.triggerEvent)(gameState, context.ruleset, 'actionPerformed', {
        actorId: action.playerId,
        actionType: 'persuasion',
    });
};
exports.applyPersuasion = applyPersuasion;
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
    RESOURCE_ORDER.forEach((resource) => {
        const amount = reward[resource];
        if (typeof amount === 'number' && amount > 0) {
            entries.push([resource, amount]);
        }
    });
    return entries;
}
function addResourcesWithLimits(wallet, reward) {
    let totalResources = getTotalResources(wallet);
    RESOURCE_ORDER.forEach((resource) => {
        const increment = reward[resource];
        if (typeof increment !== 'number' || increment <= 0) {
            return;
        }
        if (wallet.unlimited?.[resource]) {
            wallet[resource] += increment;
            totalResources += increment;
            return;
        }
        const capacityRemaining = wallet.maxCapacity[resource] - wallet[resource];
        if (capacityRemaining <= 0) {
            return;
        }
        const totalRemaining = TOTAL_RESOURCE_LIMIT - totalResources;
        if (totalRemaining <= 0) {
            return;
        }
        const allowed = Math.min(increment, capacityRemaining, totalRemaining);
        if (allowed > 0) {
            wallet[resource] += allowed;
            totalResources += allowed;
        }
    });
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
            addResourcesWithLimits(player.resources, value);
            if (typeof value.actionPoints === 'number') {
                player.actionPoints = clampActionPoints(player.actionPoints + value.actionPoints);
            }
            if (typeof value.creativity === 'number') {
                player.creativity = clampCreativity(player.creativity + value.creativity);
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
function toResourceKey(label) {
    if (!label) {
        return null;
    }
    const normalized = label.toLowerCase();
    if (normalized.includes('光') || normalized.includes('light')) {
        return 'light';
    }
    if (normalized.includes('虹') || normalized.includes('rainbow')) {
        return 'rainbow';
    }
    if (normalized.includes('淀') || normalized.includes('stagnation') || normalized.includes('yodomi')) {
        return 'stagnation';
    }
    return null;
}
function normalizeItemLabel(value) {
    return (value ?? '').toString().toLowerCase();
}
function accumulateItemEffects(items, direction) {
    const summary = {
        resources: {},
        lobbyGain: 0,
        lobbyReturn: 0,
        growthGain: 0,
        growthLoss: 0,
        creativityCost: 0,
    };
    if (!Array.isArray(items)) {
        return summary;
    }
    items.forEach((item) => {
        const label = normalizeItemLabel(item.item ?? item.cardId);
        const amount = typeof item.quantity === 'number' && Number.isFinite(item.quantity) ? item.quantity : 1;
        const resourceKey = toResourceKey(label);
        if (resourceKey) {
            summary.resources[resourceKey] = (summary.resources[resourceKey] ?? 0) + amount;
            return;
        }
        if (label.includes('img') || label.includes('creativity') || label.includes('想') || label.includes('創')) {
            summary.resources.creativity = (summary.resources.creativity ?? 0) + amount;
            return;
        }
        if (label.includes('grow')) {
            if (direction === 'reward') {
                summary.growthGain += amount;
            }
            else {
                summary.growthLoss += amount;
            }
            return;
        }
        if (label.includes('loby') || label.includes('lobby') || label.includes('ロビー')) {
            if (direction === 'reward') {
                summary.lobbyGain += amount;
            }
            else {
                summary.lobbyReturn += amount;
            }
            return;
        }
    });
    return summary;
}
function canActivateLens(lensId, ownerId, playerId, gameState) {
    const slots = gameState.board.lobbySlots.filter((slot) => slot.lensId === lensId);
    const hasOccupant = slots.some((slot) => Boolean(slot.occupantId));
    if (hasOccupant) {
        return false;
    }
    const hasEmptySlot = slots.some((slot) => !slot.occupantId);
    const player = gameState.players[playerId];
    const hasLobbyToken = player ? getLobbyAvailable(player) > 0 : false;
    return hasEmptySlot && hasLobbyToken;
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
function applyGrowthDelta(player, delta) {
    if (!player.characterId || delta === 0) {
        return;
    }
    if (!player.unlockedCharacterNodes) {
        player.unlockedCharacterNodes = [];
    }
    if (delta > 0) {
        const unlockedSet = (0, characterGrowth_1.buildUnlockedSetWithAuto)(player.characterId, player.unlockedCharacterNodes);
        const candidates = characterGrowth_1.CHARACTER_GROWTH_DEFINITIONS[player.characterId]
            ? Object.keys(characterGrowth_1.CHARACTER_GROWTH_DEFINITIONS[player.characterId])
            : [];
        const unlockable = candidates.find((nodeId) => !unlockedSet.has(nodeId) &&
            !(0, characterGrowth_1.isGrowthNodeAutoUnlocked)(player.characterId, nodeId) &&
            (0, characterGrowth_1.canUnlockGrowthNode)(player.characterId, nodeId, unlockedSet));
        if (unlockable) {
            player.unlockedCharacterNodes.push(unlockable);
        }
    }
    else {
        const current = new Set(player.unlockedCharacterNodes);
        const removable = [...current].filter((nodeId) => !nodeId.endsWith(':s'));
        const target = removable[0];
        if (target) {
            player.unlockedCharacterNodes = player.unlockedCharacterNodes.filter((id) => id !== target);
        }
    }
}
function applyGrowthSelection(player, selections, amount) {
    if (!player.characterId || amount <= 0) {
        return;
    }
    if (!player.unlockedCharacterNodes) {
        player.unlockedCharacterNodes = [];
    }
    const unlocked = new Set((0, characterGrowth_1.buildUnlockedSetWithAuto)(player.characterId, player.unlockedCharacterNodes));
    const requested = selections && selections.length ? [...selections] : [];
    for (let i = 0; i < amount; i += 1) {
        const nextId = requested.length > 0
            ? requested.shift()
            : Object.keys(characterGrowth_1.CHARACTER_GROWTH_DEFINITIONS[player.characterId] ?? {}).find((nodeId) => {
                return (!unlocked.has(nodeId) &&
                    !(0, characterGrowth_1.isGrowthNodeAutoUnlocked)(player.characterId, nodeId) &&
                    (0, characterGrowth_1.canUnlockGrowthNode)(player.characterId, nodeId, unlocked));
            });
        if (!nextId) {
            break;
        }
        if (!(0, characterGrowth_1.canUnlockGrowthNode)(player.characterId, nextId, unlocked)) {
            continue;
        }
        player.unlockedCharacterNodes.push(nextId);
        unlocked.add(nextId);
    }
}
function gainLobbyFromStock(player, amount) {
    if (amount <= 0) {
        return;
    }
    const stock = getLobbyReserve(player);
    const transferable = Math.min(stock, amount);
    if (transferable > 0) {
        player.lobbyReserve = stock - transferable;
        incrementPlayerLobbyUsed(player, transferable);
    }
}
function returnLobbyToStock(player, gameState, lensId, amount) {
    if (amount <= 0) {
        return;
    }
    let remaining = amount;
    gameState.board.lobbySlots.forEach((slot) => {
        if (remaining <= 0) {
            return;
        }
        if (slot.occupantId === player.playerId && slot.lensId !== lensId) {
            delete slot.occupantId;
            slot.isActive = true;
            remaining -= 1;
            player.lobbyReserve = getLobbyReserve(player) + 1;
        }
    });
    if (remaining > 0) {
        const available = getLobbyAvailable(player);
        const takeAvail = Math.min(available, remaining);
        if (takeAvail > 0) {
            player.lobbyAvailable = available - takeAvail;
            player.lobbyReserve = getLobbyReserve(player) + takeAvail;
            remaining -= takeAvail;
        }
    }
    if (remaining > 0) {
        const currentUsed = getPlayerLobbyUsed(player);
        const takeUsed = Math.min(currentUsed, remaining);
        if (takeUsed > 0) {
            player.lobbyUsed = Math.max(0, currentUsed - takeUsed);
            player.lobbyReserve = getLobbyReserve(player) + takeUsed;
            remaining -= takeUsed;
        }
    }
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

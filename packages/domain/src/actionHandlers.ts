import {
  ActionContext,
  ActionResult,
  ActiveEffectPayload,
  CharacterCost,
  CraftedLens,
  CraftedLensSideItem,
  CraftedLensSourceCard,
  DEFAULT_FOUNDATION_STOCK,
  FOUNDATION_COSTS,
  FoundationCost,
  GameState,
  GrowthReward,
  PlayerAction,
  PlayerState,
  PolishActionPayload,
  PolishCardType,
  ResourceCost,
  ResourceReward,
  ResourceType,
  ResourceWallet,
  LabDefinition,
  LabCostDefinition,
} from './types';
import { triggerEvent } from './triggerEngine';
import {
  buildUnlockedSetWithAuto,
  canUnlockGrowthNode,
  getGrowthNode,
  isGrowthNodeAutoUnlocked,
} from './characterGrowth';

const DEFAULT_LOBBY_STOCK = 4;
const MAX_ACTION_POINTS = 10;
const MAX_CREATIVITY = 5;
const TOTAL_RESOURCE_LIMIT = 12;
const RESOURCE_ORDER: ResourceType[] = ['light', 'rainbow', 'stagnation'];

function getTotalResources(wallet: ResourceWallet): number {
  return RESOURCE_ORDER.reduce((sum, resource) => sum + wallet[resource], 0);
}

function isFoundationCost(value: number): value is FoundationCost {
  return FOUNDATION_COSTS.includes(value as FoundationCost);
}

function parseFoundationCost(value: unknown): FoundationCost | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  const numeric = Math.floor(value);
  return isFoundationCost(numeric) ? numeric : null;
}

function toFiniteNumber(value: unknown): number | null {
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

function normalizePolishCardType(value: unknown): PolishCardType | null {
  if (value === 'development' || value === 'vp') {
    return value;
  }
  return null;
}

function normalizeCraftedLensSideItems(value: unknown): CraftedLensSideItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const items: CraftedLensSideItem[] = [];
  value.forEach((entry) => {
    if (!entry || typeof entry !== 'object') {
      return;
    }
    const record = entry as Record<string, unknown>;
    const cardId = typeof record.cardId === 'string' ? record.cardId : null;
    const cardType = normalizePolishCardType(record.cardType);
    if (!cardId || !cardType) {
      return;
    }
    const positionNumber = toFiniteNumber(record.position);
    const position = positionNumber !== null ? Math.floor(positionNumber) : null;
    let item: string | null = null;
    if (typeof record.item === 'string') {
      item = record.item;
    } else if (record.item !== undefined && record.item !== null) {
      item = String(record.item);
    }
    const normalized: CraftedLensSideItem = {
      cardId,
      cardType,
      position,
      item,
    };
    if (typeof record.quantity === 'number' && Number.isFinite(record.quantity)) {
      normalized.quantity = record.quantity;
    } else if (record.quantity === null) {
      normalized.quantity = null;
    }
    items.push(normalized);
  });
  return items;
}

function normalizeCraftedLensSourceCards(value: unknown): CraftedLensSourceCard[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const sources: CraftedLensSourceCard[] = [];
  value.forEach((entry) => {
    if (!entry || typeof entry !== 'object') {
      return;
    }
    const record = entry as Record<string, unknown>;
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

function normalizeCraftedLens(value: unknown): CraftedLens | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  const foundationCost = parseFoundationCost(record.foundationCost);
  const leftTotalNumber = toFiniteNumber(record.leftTotal);
  const rightTotalNumber = toFiniteNumber(record.rightTotal);
  if (foundationCost === null || leftTotalNumber === null || rightTotalNumber === null) {
    return null;
  }
  const vpTotalNumber = toFiniteNumber(record.vpTotal) ?? 0;
  const createdAtNumber = toFiniteNumber(record.createdAt);
  const lensId =
    typeof record.lensId === 'string' && record.lensId.trim().length > 0 ? record.lensId : '';
  const leftItems = normalizeCraftedLensSideItems(record.leftItems);
  const rightItems = normalizeCraftedLensSideItems(record.rightItems);
  const sourceCards = normalizeCraftedLensSourceCards(record.sourceCards);
  return {
    lensId,
    createdAt:
      createdAtNumber !== null && Number.isFinite(createdAtNumber)
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

interface NormalizedPolishPayload extends PolishActionPayload {
  foundationCost: FoundationCost;
  selection: CraftedLensSourceCard[];
  result: CraftedLens;
}

function normalizePolishPayload(raw: unknown): NormalizedPolishPayload | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const record = raw as Record<string, unknown>;
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

function findDuplicatePositions(items: CraftedLensSideItem[]): number | null {
  const seen = new Set<number>();
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

function buildSelectionKey(cardId: string, cardType: PolishCardType, flipped: boolean): string {
  return `${cardType}:${cardId}:${flipped ? '1' : '0'}`;
}

function removeCardFromList(cards: string[], cardId: string): void {
  const index = cards.indexOf(cardId);
  if (index === -1) {
    throw new Error('指定されたカードが見つかりません');
  }
  cards.splice(index, 1);
}

function consumeFoundationCard(
  player: PlayerState,
  foundationCost: FoundationCost,
): void {
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
  } else {
    delete player.collectedFoundationCards[foundationCost];
  }
}

function generateCraftedLensId(playerId: string, timestamp: number | undefined): string {
  const timeSeed = typeof timestamp === 'number' && Number.isFinite(timestamp) ? timestamp : Date.now();
  const randomSeed = Math.random().toString(36).slice(2, 8);
  return `crafted-lens-${playerId}-${timeSeed}-${randomSeed}`;
}

function cloneSideItems(items: CraftedLensSideItem[]): CraftedLensSideItem[] {
  return items.map((item) => {
    const cloned: CraftedLensSideItem = {
      cardId: item.cardId,
      cardType: item.cardType,
      position:
        item.position === null || item.position === undefined ? null : Math.floor(item.position),
      item: item.item ?? null,
    };
    if (typeof item.quantity === 'number' && Number.isFinite(item.quantity)) {
      cloned.quantity = item.quantity;
    } else if (item.quantity === null) {
      cloned.quantity = null;
    }
    return cloned;
  });
}

function cloneSourceCards(cards: CraftedLensSourceCard[]): CraftedLensSourceCard[] {
  return cards.map((card) => ({
    cardId: card.cardId,
    cardType: card.cardType,
    flipped: card.flipped,
  }));
}

function applyPolishResult(
  action: PlayerAction,
  context: ActionContext,
  player: PlayerState,
  payload: NormalizedPolishPayload,
): void {
  consumeFoundationCard(player, payload.foundationCost);
  player.collectedDevelopmentCards = player.collectedDevelopmentCards ?? [];
  player.collectedVpCards = player.collectedVpCards ?? [];
  const developmentCards = player.collectedDevelopmentCards;
  const vpCards = player.collectedVpCards;
  payload.selection.forEach((selection) => {
    if (selection.cardType === 'development') {
      removeCardFromList(developmentCards, selection.cardId);
    } else {
      removeCardFromList(vpCards, selection.cardId);
    }
  });
  if (!player.craftedLenses) {
    player.craftedLenses = [];
  }
  const createdAt =
    typeof payload.result.createdAt === 'number' && Number.isFinite(payload.result.createdAt)
      ? Math.max(0, Math.floor(payload.result.createdAt))
      : context.timestamp ?? Date.now();
  const lensId =
    payload.result.lensId && payload.result.lensId.trim().length > 0
      ? payload.result.lensId
      : generateCraftedLensId(action.playerId, context.timestamp);
  const lens: CraftedLens = {
    lensId,
    createdAt,
    foundationCost: payload.foundationCost,
    leftTotal: payload.result.leftTotal,
    rightTotal: payload.result.rightTotal,
    vpTotal:
      typeof payload.result.vpTotal === 'number' && Number.isFinite(payload.result.vpTotal)
        ? payload.result.vpTotal
        : payload.result.vpTotal ?? 0,
    leftItems: cloneSideItems(payload.result.leftItems),
    rightItems: cloneSideItems(payload.result.rightItems),
    sourceCards: cloneSourceCards(
      payload.result.sourceCards.length ? payload.result.sourceCards : payload.selection,
    ),
  };
  player.craftedLenses.push(lens);
}

function cloneDefaultFoundationStock(): Partial<Record<FoundationCost, number>> {
  const stock: Partial<Record<FoundationCost, number>> = {};
  FOUNDATION_COSTS.forEach((cost) => {
    const base = DEFAULT_FOUNDATION_STOCK[cost];
    if (typeof base === 'number') {
      stock[cost] = base;
    }
  });
  return stock;
}

function ensureFoundationStockInitialized(board: GameState['board']): void {
  if (!board.foundationStock || typeof board.foundationStock !== 'object') {
    board.foundationStock = cloneDefaultFoundationStock();
  }
}

function getAvailableFoundationStock(state: GameState, cost: FoundationCost): number {
  const stock = state.board.foundationStock;
  if (stock && typeof stock[cost] === 'number' && Number.isFinite(stock[cost]!)) {
    return stock[cost]!;
  }
  if (!stock) {
    const fallback = DEFAULT_FOUNDATION_STOCK[cost];
    return typeof fallback === 'number' ? fallback : 0;
  }
  return 0;
}

function clampActionPoints(value: number): number {
  return Math.max(0, Math.min(MAX_ACTION_POINTS, value));
}

function clampCreativity(value: number): number {
  return Math.max(0, Math.min(MAX_CREATIVITY, value));
}

type ResourceKey = 'light' | 'rainbow' | 'stagnation';

function resolveLabCost(lab: LabDefinition | undefined): LabCostDefinition {
  const base: LabCostDefinition = { actionPoints: 1 };
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

function getPlayerLobbyStock(player: PlayerState): number {
  if (typeof player.lobbyStock === 'number' && Number.isFinite(player.lobbyStock)) {
    return Math.max(0, player.lobbyStock);
  }
  const used = getPlayerLobbyUsed(player);
  return Math.max(0, DEFAULT_LOBBY_STOCK - used);
}

function getPlayerLobbyUsed(player: PlayerState): number {
  if (typeof player.lobbyUsed === 'number' && Number.isFinite(player.lobbyUsed)) {
    return Math.max(0, player.lobbyUsed);
  }
  return 0;
}

function incrementPlayerLobbyUsed(player: PlayerState, amount: number): void {
  const current = getPlayerLobbyUsed(player);
  const next = Math.max(0, current + amount);
  player.lobbyUsed = Math.min(DEFAULT_LOBBY_STOCK, next);
}

export type Validator = (
  action: PlayerAction,
  context: ActionContext,
) => Promise<string[]>;

export type EffectApplier = (
  action: PlayerAction,
  context: ActionContext,
) => Promise<void>;

interface ActionHandlerConfig {
  validate: Validator;
  apply: EffectApplier;
}

export function createActionHandler({
  validate,
  apply,
}: ActionHandlerConfig) {
  return async (
    action: PlayerAction,
    context: ActionContext,
  ): Promise<ActionResult> => {
    const errors = await validate(action, context);
    if (errors.length > 0) {
      return { success: false, errors };
    }

    await apply(action, context);

    return { success: true };
  };
}

export const validateLabActivate: Validator = async (action, context) => {
  const errors: string[] = [];
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
    const existingPlacement = gameState.labPlacements.some(
      (placement) => placement.labId === labId && placement.count > 0,
    );
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
    const stock = getPlayerLobbyStock(player);
    if (stock < cost.lobby) {
      errors.push('ロビー在庫が不足しています');
    }
  }

  lab.rewards
    .filter((reward) => reward.type === 'resource')
    .forEach((reward) => {
      const value = reward.value as ResourceReward;
      for (const [resource, amount] of resourceRewardEntries(value)) {
        if (!hasCapacity(player.resources, resource, amount)) {
          errors.push(`${resource} の上限を超えます`);
        }
      }
    });

  if (labId === 'polish') {
    const rawPayload =
      action.payload && typeof action.payload === 'object'
        ? (action.payload as Record<string, unknown>).polish
        : undefined;
    const normalized = normalizePolishPayload(rawPayload);
    if (!normalized) {
      errors.push('研磨の設定が不正です');
      return errors;
    }
    if (!normalized.selection.length) {
      errors.push('研磨で使用するカードを選択してください');
    }
    const foundationAvailable =
      player.collectedFoundationCards?.[normalized.foundationCost] ?? 0;
    if (foundationAvailable <= 0) {
      errors.push('指定された土台カードを所持していません');
    }
    const developmentCounts = new Map<string, number>();
    (player.collectedDevelopmentCards ?? []).forEach((cardId) => {
      developmentCounts.set(cardId, (developmentCounts.get(cardId) ?? 0) + 1);
    });
    const vpCounts = new Map<string, number>();
    (player.collectedVpCards ?? []).forEach((cardId) => {
      vpCounts.set(cardId, (vpCounts.get(cardId) ?? 0) + 1);
    });
    normalized.selection.forEach((selection) => {
      if (selection.cardType === 'development') {
        const remaining = developmentCounts.get(selection.cardId) ?? 0;
        if (remaining <= 0) {
          errors.push(`開発カード ${selection.cardId} を所持していません`);
        } else {
          developmentCounts.set(selection.cardId, remaining - 1);
        }
      } else {
        const remaining = vpCounts.get(selection.cardId) ?? 0;
        if (remaining <= 0) {
          errors.push(`VPカード ${selection.cardId} を所持していません`);
        } else {
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
    const selectionCountMap = new Map<string, number>();
    normalized.selection.forEach((selection) => {
      const key = buildSelectionKey(selection.cardId, selection.cardType, selection.flipped);
      selectionCountMap.set(key, (selectionCountMap.get(key) ?? 0) + 1);
    });
    const resultCountMap = new Map<string, number>();
    normalized.result.sourceCards.forEach((source) => {
      const key = buildSelectionKey(source.cardId, source.cardType, source.flipped);
      resultCountMap.set(key, (resultCountMap.get(key) ?? 0) + 1);
    });
    if (selectionCountMap.size !== resultCountMap.size) {
      errors.push('研磨結果の参照カードが一致しません');
    } else {
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

export const applyLabActivate: EffectApplier = async (action, context) => {
  const { gameState, ruleset } = context;
  const player = gameState.players[action.playerId];
  if (!player) {
    throw new Error('プレイヤーが存在しません');
  }

  const labId = action.payload.labId as string;
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
    const existingPlacement = placements.find(
      (placement) => placement.labId === labId && placement.playerId === action.playerId,
    );
    if (existingPlacement) {
      existingPlacement.count += cost.lobby;
    } else {
      placements.push({ labId, playerId: action.playerId, count: cost.lobby });
    }
  }

  for (const reward of lab.rewards) {
    applyReward(player, reward);
  }

  if (labId === 'polish') {
    const rawPayload =
      action.payload && typeof action.payload === 'object'
        ? (action.payload as Record<string, unknown>).polish
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

export const validateLensActivate: Validator = async (action, context) => {
  const errors: string[] = [];
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

  const itemCost = accumulateResourceFromItems(
    (lens as unknown as { leftItems?: CraftedLensSideItem[] }).leftItems,
  );
  const mergedCost: ResourceCost = {
    light: (lens.cost.light ?? 0) + (itemCost.light ?? 0),
    rainbow: (lens.cost.rainbow ?? 0) + (itemCost.rainbow ?? 0),
    stagnation: (lens.cost.stagnation ?? 0) + (itemCost.stagnation ?? 0),
    creativity: lens.cost.creativity,
    actionPoints: lens.cost.actionPoints,
  };
  if (!canPayResourceCost(player.resources, mergedCost)) {
    errors.push('必要な資源が不足しています');
  }

  if ((lens.cost.creativity ?? 0) > player.creativity) {
    errors.push('創造力が不足しています');
  }

  return errors;
};

export const applyLensActivate: EffectApplier = async (action, context) => {
  const { gameState } = context;
  const player = gameState.players[action.playerId];
  if (!player) {
    throw new Error('プレイヤーが存在しません');
  }

  const lensId = action.payload.lensId as string;
  const lens = gameState.board.lenses[lensId];
  if (!lens) {
    throw new Error('指定されたレンズが存在しません');
  }

  const totalActionCost = 1 + (lens.cost.actionPoints ?? 0);
  player.actionPoints = Math.max(0, player.actionPoints - totalActionCost);

  payResourceCost(player.resources, lens.cost);
  const itemCost = accumulateResourceFromItems(
    (lens as unknown as { leftItems?: CraftedLensSideItem[] }).leftItems,
  );
  payResourceCost(player.resources, itemCost);
  if (lens.cost.creativity) {
    player.creativity = Math.max(0, player.creativity - lens.cost.creativity);
  }

  for (const reward of lens.rewards) {
    applyReward(player, reward);
  }
  const itemReward = accumulateResourceFromItems(
    (lens as unknown as { rightItems?: CraftedLensSideItem[] }).rightItems,
  );
  if (
    itemReward.light ||
    itemReward.rainbow ||
    itemReward.stagnation ||
    itemReward.actionPoints ||
    itemReward.creativity
  ) {
    applyReward(player, { type: 'resource', value: itemReward });
  }

  lens.status = 'exhausted';
  gameState.board.lobbySlots
    .filter((slot) => slot.lensId === lensId && slot.occupantId === action.playerId)
    .forEach((slot) => {
      slot.isActive = false;
    });

  if (lens.ownerId !== action.playerId) {
    triggerEvent(gameState, context.ruleset, 'lensActivatedByOther', {
      actorId: action.playerId,
      ownerId: lens.ownerId,
      actionType: 'lensActivate',
    });
  }

  triggerEvent(gameState, context.ruleset, 'actionPerformed', {
    actorId: action.playerId,
    actionType: 'lensActivate',
  });
};

export const validateMove: Validator = async (action, context) => {
  const errors: string[] = [];
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

  const availableSlot = gameState.board.lobbySlots.find(
    (slot) => slot.lensId === lensId && !slot.occupantId,
  );
  if (!availableSlot) {
    errors.push('空きロビーがありません');
  }

  return errors;
};

export const applyMove: EffectApplier = async (action, context) => {
  const { gameState } = context;
  const player = gameState.players[action.playerId];
  if (!player) {
    throw new Error('プレイヤーが存在しません');
  }

  const lensId = action.payload.lensId as string;
  const slot = gameState.board.lobbySlots.find(
    (item) => item.lensId === lensId && !item.occupantId,
  );
  if (!slot) {
    throw new Error('空きロビーがありません');
  }

  player.actionPoints = Math.max(0, player.actionPoints - 2);
  slot.occupantId = action.playerId;
  slot.isActive = true;
};

export const validateRefresh: Validator = async (action, context) => {
  const errors: string[] = [];
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

  const slot = gameState.board.lobbySlots.find(
    (entry) => entry.lensId === lensId && entry.occupantId === action.playerId && !entry.isActive,
  );
  if (!slot) {
    errors.push('使用済みの自分のロビーが配置されていません');
  }

  const totalActionCost = 3 + (lens.cost.actionPoints ?? 0);
  if (player.actionPoints < totalActionCost) {
    errors.push('行動力が不足しています');
  }
  if (lens.cost.creativity && player.creativity < lens.cost.creativity) {
    errors.push('創造力が不足しています');
  }
  if (!canPayResourceCost(player.resources, lens.cost)) {
    errors.push('必要な資源が不足しています');
  }

  return errors;
};

export const applyRefresh: EffectApplier = async (action, context) => {
  const { gameState } = context;
  const player = gameState.players[action.playerId];
  if (!player) {
    throw new Error('プレイヤーが存在しません');
  }

  const lensId = action.payload.lensId as string;
  const lens = gameState.board.lenses[lensId];
  if (!lens) {
    throw new Error('指定されたレンズが存在しません');
  }

  const slot = gameState.board.lobbySlots.find(
    (entry) => entry.lensId === lensId && entry.occupantId === action.playerId && !entry.isActive,
  );
  if (!slot) {
    throw new Error('使用済みの自分のロビーが配置されていません');
  }

  player.actionPoints = Math.max(0, player.actionPoints - 3);

  const cost = lens.cost;
  if (cost.actionPoints) {
    player.actionPoints = Math.max(0, player.actionPoints - cost.actionPoints);
  }
  payResourceCost(player.resources, cost);
  if (cost.creativity) {
    player.creativity = Math.max(0, player.creativity - cost.creativity);
  }

  // 入れ替えたロビーを使用状態にする
  slot.isActive = false;

  for (const reward of lens.rewards) {
    applyReward(player, reward);
  }

  lens.status = 'exhausted';

  if (lens.ownerId !== action.playerId) {
    const owner = gameState.players[lens.ownerId];
    if (owner) {
      owner.vp += 2;
    }
    triggerEvent(gameState, context.ruleset, 'lensActivatedByOther', {
      actorId: action.playerId,
      ownerId: lens.ownerId,
      actionType: 'refresh',
    });
  }

  triggerEvent(gameState, context.ruleset, 'actionPerformed', {
    actorId: action.playerId,
    actionType: 'refresh',
  });
};

export const validateCollect: Validator = async (action, context) => {
  const errors: string[] = [];
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

  const slotTypeRaw =
    typeof action.payload.slotType === 'string' ? action.payload.slotType : 'development';
  if (slotTypeRaw !== 'development' && slotTypeRaw !== 'vp' && slotTypeRaw !== 'foundation') {
    errors.push('カードの取得先が不正です');
    return errors;
  }

  if (slotTypeRaw === 'foundation') {
    const rawCost = action.payload.foundationCost;
    const parsedCost =
      typeof rawCost === 'number' && Number.isFinite(rawCost) ? Math.floor(rawCost) : NaN;
    if (Number.isNaN(parsedCost) || !isFoundationCost(parsedCost)) {
      errors.push('土台カードのコスト指定が不正です');
      return errors;
    }
    const cost = parsedCost as FoundationCost;
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
  } else {
    const cards = gameState.board.publicVpCards ?? [];
    if (slotIndex >= cards.length || !cards[slotIndex]) {
      errors.push('公開VPカードのスロット番号が不正です');
    }
  }

  return errors;
};

export const applyCollect: EffectApplier = async (action, context) => {
  const { gameState } = context;
  const player = gameState.players[action.playerId];
  if (!player) {
    throw new Error('プレイヤーが存在しません');
  }

  player.actionPoints = Math.max(0, player.actionPoints - 2);

  const slotTypeRaw =
    typeof action.payload.slotType === 'string' ? action.payload.slotType : 'development';

  if (slotTypeRaw === 'foundation') {
    const rawCost = action.payload.foundationCost;
    const parsedCost =
      typeof rawCost === 'number' && Number.isFinite(rawCost) ? Math.floor(rawCost) : NaN;
    if (Number.isNaN(parsedCost) || !isFoundationCost(parsedCost)) {
      throw new Error('指定された土台カードが存在しません');
    }
    const cost = parsedCost as FoundationCost;
    ensureFoundationStockInitialized(gameState.board);
    const stock = gameState.board.foundationStock!;
    const available =
      typeof stock[cost] === 'number' && Number.isFinite(stock[cost]!) ? stock[cost]! : 0;
    if (available <= 0) {
      throw new Error('指定された土台カードは在庫がありません');
    }
    const remaining = available - 1;
    if (remaining > 0) {
      stock[cost] = remaining;
    } else {
      delete stock[cost];
    }
    if (!player.collectedFoundationCards || typeof player.collectedFoundationCards !== 'object') {
      player.collectedFoundationCards = {};
    }
    const currentCount =
      typeof player.collectedFoundationCards[cost] === 'number'
        ? player.collectedFoundationCards[cost]!
        : 0;
    player.collectedFoundationCards[cost] = currentCount + 1;
  } else if (slotTypeRaw === 'vp') {
    const slotIndex =
      typeof action.payload.slotIndex === 'number' && Number.isFinite(action.payload.slotIndex)
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
  } else {
    const slotIndex =
      typeof action.payload.slotIndex === 'number' && Number.isFinite(action.payload.slotIndex)
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
    triggerEvent(gameState, context.ruleset, 'developmentSlotFreed', {
      actorId: action.playerId,
    });
  }

  triggerEvent(gameState, context.ruleset, 'actionPerformed', {
    actorId: action.playerId,
    actionType: 'collect',
  });
};

export const validateWill: Validator = async (action, context) => {
  const errors: string[] = [];
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

  const payload = node.effect.payload as ActiveEffectPayload;
  const cost = payload?.cost;
  if (cost) {
    validateWillCost(cost, player, errors);
  }

  validateWillRewards(payload, player, errors);

  return errors;
};

export const applyWill: EffectApplier = async (action, context) => {
  const { gameState, ruleset } = context;
  const player = gameState.players[action.playerId];
  if (!player) {
    throw new Error('プレイヤーが存在しません');
  }

  const nodeId = action.payload.nodeId as string;
  const profile = player.characterId ? ruleset.characters[player.characterId] : undefined;
  if (!profile) {
    throw new Error('キャラクターデータが見つかりません');
  }

  const node = profile.nodes.find((n) => n.nodeId === nodeId);
  if (!node || node.effect.type !== 'active') {
    throw new Error('指定された意思効果が存在しません');
  }

  const payload = node.effect.payload as ActiveEffectPayload;
  const cost = payload?.cost;
  if (cost) {
    applyWillCost(cost, player);
  }

  if (payload?.setCapacityUnlimited) {
    ensureUnlimitedMap(player.resources);
    payload.setCapacityUnlimited.forEach((resource) => {
      player.resources.unlimited![resource] = true;
    });
  }

  payload?.rewards?.forEach((reward) => {
    applyReward(player, reward);
  });

  triggerEvent(gameState, ruleset, 'actionPerformed', {
    actorId: action.playerId,
    actionType: 'will',
  });
};

export const validateTask: Validator = async (action, context) => {
  const errors: string[] = [];
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

  const rewardChoice = action.payload.rewardChoice as { type?: unknown; nodeId?: unknown } | undefined;
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
    } else if ((player.unlockedCharacterNodes ?? []).includes(rewardChoice.nodeId)) {
      errors.push('指定されたノードは既に解放済みです');
    } else if (player.characterId) {
      const nodeDefinition = getGrowthNode(player.characterId, rewardChoice.nodeId);
      if (!nodeDefinition) {
        errors.push('指定されたノードは存在しません');
      } else {
        if (isGrowthNodeAutoUnlocked(player.characterId, rewardChoice.nodeId)) {
          errors.push('指定されたノードは自動解放ノードです');
        } else {
          const unlockedSet = buildUnlockedSetWithAuto(
            player.characterId,
            player.unlockedCharacterNodes ?? [],
          );
          if (!canUnlockGrowthNode(player.characterId, rewardChoice.nodeId, unlockedSet)) {
            errors.push('成長条件を満たしていません');
          }
        }
      }
    }
  } else if (rewardChoice.type === 'lobby') {
    // no additional validation needed
  } else {
    errors.push('無効な課題報酬が指定されました');
  }

  // 条件判定は EffectEngine or Task definition に依存
  return errors;
};

export const applyTask: EffectApplier = async (action, context) => {
  const { gameState } = context;
  const player = gameState.players[action.playerId];
  if (!player) {
    throw new Error('プレイヤーが存在しません');
  }

  const taskId = action.payload.taskId as string;
  const task = gameState.tasks[taskId];
  if (!task) {
    throw new Error('指定された課題が存在しません');
  }

  player.tasksCompleted.push(taskId);
  for (const reward of task.reward) {
    applyReward(player, reward);
  }

  const rewardChoice = action.payload.rewardChoice as { type?: string; nodeId?: string } | undefined;
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
      const unlockedSet = buildUnlockedSetWithAuto(
        player.characterId,
        player.unlockedCharacterNodes,
      );
      if (!canUnlockGrowthNode(player.characterId, nodeId, unlockedSet)) {
        throw new Error('成長条件を満たしていません');
      }
      player.unlockedCharacterNodes.push(nodeId);
      break;
    }
    case 'lobby': {
      const currentStock =
        typeof player.lobbyStock === 'number' ? player.lobbyStock : DEFAULT_LOBBY_STOCK;
      player.lobbyStock = currentStock + 1;
      break;
    }
    default:
      throw new Error('無効な課題報酬が指定されました');
  }
};

export const validateRooting: Validator = async (action, context) => {
  const errors: string[] = [];
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

export const applyRooting: EffectApplier = async (action, context) => {
  const { gameState } = context;
  const player = gameState.players[action.playerId];
  if (!player) {
    throw new Error('プレイヤーが存在しません');
  }

  player.isRooting = true;
  player.resources.light += 1;
};

export const validatePersuasion: Validator = async (action, context) => {
  const errors: string[] = [];
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

  const slot = gameState.board.lobbySlots.find(
    (item) => item.lensId === lensId && item.occupantId && item.occupantId !== action.playerId,
  );
  if (!slot) {
    errors.push('相手のロビーが配置されていません');
  } else if (slot.occupantId === action.playerId) {
    errors.push('自分のロビーには説得できません');
  }

  const requiredActionPoints = 2 + (lens.cost.actionPoints ?? 0);
  if (player.actionPoints < requiredActionPoints) {
    errors.push('行動力が不足しています');
  }

  if (!canPayResourceCost(player.resources, lens.cost)) {
    errors.push('必要な資源が不足しています');
  }

  if ((lens.cost.creativity ?? 0) > player.creativity) {
    errors.push('創造力が不足しています');
  }

  lens.rewards
    .filter((reward) => reward.type === 'resource')
    .forEach((reward) => {
      const value = reward.value as ResourceReward;
      for (const [resource, amount] of resourceRewardEntries(value)) {
        if (!hasCapacity(player.resources, resource, amount)) {
          errors.push(`${resource} の上限を超えます`);
        }
      }
    });

  return errors;
};

export const applyPersuasion: EffectApplier = async (action, context) => {
  const { gameState } = context;
  const player = gameState.players[action.playerId];
  if (!player) {
    throw new Error('プレイヤーが存在しません');
  }

  const lensId = action.payload.lensId as string;
  const lens = gameState.board.lenses[lensId];
  if (!lens) {
    throw new Error('指定されたレンズが存在しません');
  }

  const slot = gameState.board.lobbySlots.find(
    (item) => item.lensId === lensId && item.occupantId && item.occupantId !== action.playerId,
  );
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

  payResourceCost(player.resources, lens.cost);
  if (lens.cost.creativity) {
    player.creativity = Math.max(0, player.creativity - lens.cost.creativity);
  }

  for (const reward of lens.rewards) {
    applyReward(player, reward);
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
    triggerEvent(gameState, context.ruleset, 'lensActivatedByOther', {
      actorId: action.playerId,
      ownerId: lens.ownerId,
      actionType: 'persuasion',
    });
  }
  triggerEvent(gameState, context.ruleset, 'actionPerformed', {
    actorId: action.playerId,
    actionType: 'persuasion',
  });
};

export const validatePass: Validator = async (action, context) => {
  const errors: string[] = [];
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

export const applyPass: EffectApplier = async (action, context) => {
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

export function hasCapacity(
  wallet: ResourceWallet,
  resource: 'light' | 'rainbow' | 'stagnation',
  amount: number,
): boolean {
  if (wallet.unlimited?.[resource]) {
    return true;
  }
  const cap = wallet.maxCapacity[resource];
  const current = wallet[resource];
  return current + amount <= cap;
}

function getTaskRequirementError(taskId: string, player: PlayerState, gameState: GameState): string | null {
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

function countPlayerLenses(gameState: GameState, player: PlayerState): number {
  const boardLenses = Object.values(gameState.board?.lenses ?? {});
  const ownedOnBoard = boardLenses.filter((lens) => lens.ownerId === player.playerId).length;
  const ownedFromState = Array.isArray(player.ownedLenses) ? player.ownedLenses.length : 0;
  return Math.max(ownedOnBoard, ownedFromState);
}

function resourceRewardEntries(reward: ResourceReward): Array<[ResourceType, number]> {
  const entries: Array<[ResourceType, number]> = [];
  RESOURCE_ORDER.forEach((resource) => {
    const amount = reward[resource];
    if (typeof amount === 'number' && amount > 0) {
      entries.push([resource, amount]);
    }
  });
  return entries;
}

function addResourcesWithLimits(wallet: ResourceWallet, reward: ResourceReward): void {
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

function applyReward(player: { resources: ResourceWallet; vp: number; actionPoints: number; creativity: number }, reward: {
  type: 'vp' | 'resource' | 'growth' | 'trigger';
  value: number | ResourceReward | unknown;
}): void {
  switch (reward.type) {
    case 'vp': {
      const vp = typeof reward.value === 'number' ? reward.value : 0;
      player.vp += vp;
      break;
    }
    case 'resource': {
      const value = reward.value as ResourceReward;
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
      applyGrowthReward(player, reward.value as GrowthReward);
      break;
    case 'trigger':
      // トリガーはイベント処理でハンドリングするためここでは何もしない
      break;
    default:
      break;
  }
}

function validateWillCost(cost: CharacterCost, player: { creativity: number; actionPoints: number; resources: ResourceWallet }, errors: string[]): void {
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

function validateWillRewards(payload: ActiveEffectPayload | undefined, player: { resources: ResourceWallet }, errors: string[]): void {
  if (!payload?.rewards) {
    return;
  }
  const unlimitedTarget = new Set(payload.setCapacityUnlimited ?? []);
  payload.rewards
    .filter((reward) => reward.type === 'resource')
    .forEach((reward) => {
      const value = reward.value as ResourceReward;
      (['light', 'rainbow', 'stagnation'] as ResourceType[]).forEach((resource) => {
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

function applyWillCost(cost: CharacterCost, player: { creativity: number; actionPoints: number; resources: ResourceWallet }): void {
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

function ensureUnlimitedMap(wallet: ResourceWallet): void {
  if (!wallet.unlimited) {
    wallet.unlimited = {} as Partial<Record<ResourceType, boolean>>;
  }
}

function toResourceKey(label: string | null | undefined): ResourceKey | null {
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

function accumulateResourceFromItems(
  items: CraftedLensSideItem[] | undefined,
): ResourceReward {
  const reward: ResourceReward = {};
  if (!Array.isArray(items)) {
    return reward;
  }
  items.forEach((item) => {
    const key = toResourceKey(item.item);
    if (!key) {
      return;
    }
    const amount =
      typeof item.quantity === 'number' && Number.isFinite(item.quantity) ? item.quantity : 1;
    reward[key] = (reward[key] ?? 0) + amount;
  });
  return reward;
}

function canActivateLens(
  lensId: string,
  ownerId: string,
  playerId: string,
  gameState: GameState,
): boolean {
  if (ownerId === playerId) {
    return true;
  }
  return gameState.board.lobbySlots.some(
    (slot) => slot.lensId === lensId && slot.occupantId === playerId && slot.isActive,
  );
}

function canPayResourceCost(wallet: ResourceWallet, cost: ResourceCost): boolean {
  return (['light', 'rainbow', 'stagnation'] as ResourceType[]).every((resource) => {
    const required = cost[resource];
    if (!required) {
      return true;
    }
    return wallet[resource] >= required;
  });
}

function payResourceCost(wallet: ResourceWallet, cost: ResourceCost): void {
  (['light', 'rainbow', 'stagnation'] as ResourceType[]).forEach((resource) => {
    const required = cost[resource];
    if (required) {
      wallet[resource] = Math.max(0, wallet[resource] - required);
    }
  });
}
function applyGrowthReward(
  player: {
    resources: ResourceWallet;
    vp: number;
    actionPoints: number;
    creativity: number;
    unlockedCharacterNodes?: string[];
  },
  reward: GrowthReward,
): void {
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

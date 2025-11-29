"use client";

import type { JSX, SetStateAction } from "react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";
import {
  DEFAULT_FUNCTIONS_BASE_URL,
  useSession,
} from "../../context/SessionContext";
import { CHARACTER_CATALOG, getCharacterColor, type CharacterGrowthNode } from "../../data/characters";
import { DevelopmentCardPreview } from "../../components/DevelopmentCardPreview";
import {
  buildUnlockedSetWithAuto,
  canUnlockGrowthNode,
  getGrowthNode,
  type GrowthNodeDefinition,
} from "@domain/characterGrowth";
import { FunctionsGateway } from "@domain/client/functionsGateway";
import type {
  CatalogDevelopmentCard,
  PlayerState,
  ResourceWallet,
  ResourceCost,
  RewardDefinition,
  ResourceReward,
  CraftedLens,
  CraftedLensSideItem,
  PolishActionPayload,
} from "@domain/types";
import { CraftedLensPreview } from "../../components/CraftedLensPreview";

type LabActionSide = "left" | "right";

interface LabActionDefinition {
  id: string;
  name: string;
  nameEn: string;
  side: LabActionSide;
  material: string;
  cost: string[];
  result: string[];
}

const LAB_ACTIONS: LabActionDefinition[] = [
  {
    id: "polish",
    name: "研磨",
    nameEn: "POLISH",
    side: "left",
    material: "共有設備が揃う研究棟で、レンズ改良を進めるための研磨機を利用できます。",
    cost: ["行動力 1", "ロビー ×1 (研磨スペースへ配置)"],
    result: ["未完成のレンズを研究進捗 +1", "共有レンズのロビーを整理"],
  },
  {
    id: "focus-light",
    name: "集光",
    nameEn: "FOCUS LIGHT",
    side: "left",
    material: "集光ボードで創造力とロビーを使い、光資源を生成します。",
    cost: ["創造力 ×1", "ロビー ×1 (集光ボードに配置)"],
    result: ["光トークン ×1 を獲得"],
  },
  {
    id: "negotiation",
    name: "根回し",
    nameEn: "NEGOTIATION",
    side: "right",
    material: "講義棟で教員と調整し、次の研究予定に優先枠を確保します。",
    cost: ["ロビー ×1 (交渉スペースへ配置)"],
    result: ["光トークン ×1 を得る", "次ラウンドの先手番を予約"],
  },
  {
    id: "spirit",
    name: "気合",
    nameEn: "SPIRIT",
    side: "right",
    material: "学生ラウンジで気持ちを整え、集中力と士気を高めます。",
    cost: ["ロビー ×1 (ラウンジへ配置)"],
    result: ["行動力 +1 を得る", "淀みトークン ×1 を得る"],
  },
];

interface TaskDefinition {
  id: string;
  label: string;
  target: number;
  color: "rainbow" | "light" | "lens";
  description: string;
}

const LAB_TASKS: TaskDefinition[] = [
  {
    id: "rainbow",
    label: "虹トークン",
    target: 5,
    color: "rainbow",
    description: "希少な虹トークンを 5 個集めると特別課題を完了できます。",
  },
  {
    id: "light",
    label: "光トークン",
    target: 7,
    color: "light",
    description: "安定した光資源を 7 個確保すると共有研究が進展します。",
  },
  {
    id: "lens",
    label: "完成レンズ",
    target: 3,
    color: "lens",
    description: "完成したレンズを 3 枚揃えると卒業課題に挑戦可能です。",
  },
];

const COST_LEFT_UP_EXTRA_KEYS = ["cost_left_up", "costLeftUp", "costTopLeft", "cost_topleft"];
const COST_LEFT_DOWN_EXTRA_KEYS = ["cost_left_down", "costLeftDown", "costBottomLeft", "cost_bottomleft"];
const COST_RIGHT_UP_EXTRA_KEYS = [
  "cost_right_up",
  "costRightUp",
  "costTopRight",
  "cost_rightup",
  "COST",
  "cost",
];
const COST_RIGHT_DOWN_EXTRA_KEYS = [
  "cost_right_down",
  "costRightDown",
  "costBottomRight",
  "cost_rightdown",
];
const COST_SLOT_KEYS = ["costa", "costb", "costc"] as const;
type CostSlotIndex = 0 | 1 | 2;
type CostSlotArray = [number, number, number];

function toSlotFromPosition(value: number | null | undefined): "top" | "middle" | "bottom" {
  if (value === 1) {
    return "top";
  }
  if (value === 3) {
    return "bottom";
  }
  return "middle";
}

function addSlotValue(slots: CostSlotArray, index: CostSlotIndex, value: number | null): void {
  if (value === null) {
    return;
  }
  slots[index] += value;
}

function extractCostSlots(
  record: Record<string, unknown> | undefined,
  extras: Record<string, unknown> | undefined,
  extraKeys: readonly string[],
): CostSlotArray {
  const slots: CostSlotArray = [0, 0, 0];

  if (record && typeof record === "object") {
    COST_SLOT_KEYS.forEach((key, index) => {
      addSlotValue(slots, index as CostSlotIndex, toNumeric(record[key]));
    });
  } else {
    addSlotValue(slots, 1, toNumeric(record));
  }

  extraKeys.forEach((extraKey) => {
    const extraValue = extras?.[extraKey];
    if (!extraValue) {
      return;
    }
    if (typeof extraValue === "object" && !Array.isArray(extraValue)) {
      COST_SLOT_KEYS.forEach((key, index) => {
        const nested = (extraValue as Record<string, unknown>)[key];
        addSlotValue(slots, index as CostSlotIndex, toNumeric(nested));
      });
    } else {
      addSlotValue(slots, 1, toNumeric(extraValue));
    }
  });

  return slots;
}

function sumSlots(slots: CostSlotArray): number {
  return slots[0] + slots[1] + slots[2];
}

function flipPosition(position: number | null | undefined): number | null {
  if (position === null || position === undefined || Number.isNaN(position)) {
    return position ?? null;
  }
  const slot = toSlotFromPosition(position);
  if (slot === "top") {
    return 3;
  }
  if (slot === "bottom") {
    return 1;
  }
  return 2;
}

type PlayerActionCategory = "lab" | "student" | "general";

interface PlayerActionDefinition {
  id: string;
  label: string;
  category: PlayerActionCategory;
  summary: string;
  description: string;
  requirement?: PlayerActionRequirement;
  highlight?: "primary" | "warning";
  implemented?: boolean;
}

interface PlayerActionContext {
  player: PlayerState;
  resources: ResourceWallet;
  lobby: LobbySummary;
  willAbilityCount: number;
  negotiationAvailable: boolean;
  persuasionTargetCount: number;
  collectableCardCount: number;
  lensActivateCount: number;
  exhaustedLensCount: number;
}

interface PlayerActionAvailability {
  available: boolean;
  reason?: string;
}

type PlayerActionRequirement = (context: PlayerActionContext) => PlayerActionAvailability;

interface PlayerActionGroupViewModel {
  category: PlayerActionCategory;
  label: string;
  actions: PlayerActionViewModel[];
}

interface PlayerActionViewModel extends PlayerActionDefinition {
  available: boolean;
  reason?: string;
}

type PolishSelectionMap = Record<
  string,
  {
    type: "development" | "vp";
    flipped: boolean;
  }
>;

interface PolishSelectionDetail {
  cardId: string;
  type: "development" | "vp";
  card: CatalogDevelopmentCard | null;
  flipped: boolean;
  values: {
    left: { top: CostSlotArray; bottom: CostSlotArray };
    right: { top: CostSlotArray; bottom: CostSlotArray };
  };
  costItem: string | null;
  costNumber: number | null;
  costPosition: number | null;
}

interface LabPlacementView {
  playerId: string;
  name: string;
  count: number;
  color?: string;
}


const PLAYER_COLOR_PALETTE = [
  "#ef4444",
  "#22c55e",
  "#3b82f6",
  "#f59e0b",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#10b981",
];

const PLAYER_ACTION_CATEGORY_ORDER: PlayerActionCategory[] = ["lab", "student", "general"];

const PLAYER_ACTION_CATEGORY_LABELS: Record<PlayerActionCategory, string> = {
  lab: "研究棟アクション",
  student: "学生アクション",
  general: "共通操作",
};

interface CraftedLensWithOwner {
  lens: CraftedLens;
  ownerId: string;
  ownerName: string;
}

const LAB_ACTION_LOOKUP = new Map<string, LabActionDefinition>(
  LAB_ACTIONS.map((action) => [action.id, action]),
);

type ResourceKey = "light" | "rainbow" | "stagnation";

const RESOURCE_LABELS: Record<ResourceKey, string> = {
  light: "光トークン",
  rainbow: "虹トークン",
  stagnation: "淀みトークン",
};

function getLabActionText(id: string): { summary: string; description: string } {
  const entry = LAB_ACTION_LOOKUP.get(id);
  if (!entry) {
    return {
      summary: "",
      description: "",
    };
  }
  const summary = entry.cost.join(" / ");
  const description = `${entry.material} 【効果】${entry.result.join(" / ")}`;
  return { summary, description };
}

function scrollIntoViewIfPossible(target: HTMLElement | null | undefined): void {
  if (!target) {
    return;
  }
  try {
    target.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
  } catch {
    // no-op
  }
}

function describeResourceCost(cost: ResourceCost): string[] {
  const parts: string[] = [];
  if (cost.actionPoints) {
    parts.push(`行動力 ${cost.actionPoints}`);
  }
  if (cost.creativity) {
    parts.push(`創造力 ${cost.creativity}`);
  }
  (["light", "rainbow", "stagnation"] as ResourceKey[]).forEach((resource) => {
    const amount = cost[resource];
    if (amount) {
      parts.push(`${RESOURCE_LABELS[resource]} ×${amount}`);
    }
  });
  return parts;
}

function describeResourceReward(reward: ResourceReward): string[] {
  const parts: string[] = [];
  if (reward.actionPoints) {
    parts.push(`行動力 +${reward.actionPoints}`);
  }
  if (reward.creativity) {
    parts.push(`創造力 +${reward.creativity}`);
  }
  (["light", "rainbow", "stagnation"] as ResourceKey[]).forEach((resource) => {
    const amount = reward[resource];
    if (amount) {
      parts.push(`${RESOURCE_LABELS[resource]} +${amount}`);
    }
  });
  return parts;
}

function describeRewardDefinition(reward: RewardDefinition): string {
  switch (reward.type) {
    case "resource": {
      const rows = describeResourceReward(reward.value as ResourceReward);
      return rows.join(" / ") || "資源を獲得";
    }
    case "vp":
      return `VP +${reward.value as number}`;
    case "growth":
      return "成長効果を解決";
    case "trigger":
      return `トリガー効果: ${(reward.value as { triggerType?: string })?.triggerType ?? "発動"}`;
    default:
      return "効果を解決";
  }
}

function countGrow(items: CraftedLensSideItem[] | undefined): number {
  if (!Array.isArray(items)) {
    return 0;
  }
  return items.reduce((total, item) => {
    const label = (item.item ?? item.cardId ?? "").toLowerCase();
    const amount =
      typeof item.quantity === "number" && Number.isFinite(item.quantity) ? item.quantity : 1;
    return label.includes("grow") ? total + amount : total;
  }, 0);
}

function accumulateItemCostEffects(
  items: CraftedLensSideItem[] | undefined,
): {
  resources: Partial<Record<ResourceKey | "creativity", number>>;
  lobbyReturn: number;
  growthLoss: number;
} {
  const summary = {
    resources: {} as Partial<Record<ResourceKey | "creativity", number>>,
    lobbyReturn: 0,
    growthLoss: 0,
  };
  if (!Array.isArray(items)) {
    return summary;
  }
  items.forEach((item) => {
    const label = (item.item ?? item.cardId ?? "").toLowerCase();
    const amount =
      typeof item.quantity === "number" && Number.isFinite(item.quantity) ? item.quantity : 1;
    if (label.includes("光") || label.includes("light")) {
      summary.resources.light = (summary.resources.light ?? 0) + amount;
      return;
    }
    if (label.includes("虹") || label.includes("rainbow")) {
      summary.resources.rainbow = (summary.resources.rainbow ?? 0) + amount;
      return;
    }
    if (label.includes("淀") || label.includes("stagnation") || label.includes("yodomi")) {
      summary.resources.stagnation = (summary.resources.stagnation ?? 0) + amount;
      return;
    }
    if (label.includes("img") || label.includes("creativity") || label.includes("想") || label.includes("創")) {
      summary.resources.creativity = (summary.resources.creativity ?? 0) + amount;
      return;
    }
    if (label.includes("grow")) {
      summary.growthLoss += amount;
      return;
    }
    if (label.includes("loby") || label.includes("lobby") || label.includes("ロビー")) {
      summary.lobbyReturn += amount;
    }
  });
  return summary;
}

function combineRequirements(
  ...requirements: PlayerActionRequirement[]
): PlayerActionRequirement {
  return (context) => {
    for (const requirement of requirements) {
      const result = requirement(context);
      if (!result.available) {
        return result;
      }
    }
    return { available: true };
  };
}

function requireActionPoints(amount: number): PlayerActionRequirement {
  return ({ player }) =>
    player.actionPoints >= amount
      ? { available: true }
      : { available: false, reason: `行動力が ${amount} 必要です` };
}

function requireCreativity(amount: number): PlayerActionRequirement {
  return ({ player }) =>
    player.creativity >= amount
      ? { available: true }
      : { available: false, reason: `創造力が ${amount} 必要です` };
}

function requireLensActivateTarget(): PlayerActionRequirement {
  return ({ lensActivateCount }) =>
    lensActivateCount > 0
      ? { available: true }
      : { available: false, reason: "起動できるレンズがありません" };
}

function requireLobbyStock(): PlayerActionRequirement {
  return ({ lobby }) =>
    lobby.handUnused > 0
      ? { available: true }
      : { available: false, reason: "ロビー在庫が不足しています" };
}

function requireWillAbility(): PlayerActionRequirement {
  return ({ willAbilityCount }) =>
    willAbilityCount > 0
      ? { available: true }
      : { available: false, reason: "使用可能な意思能力がありません" };
}

function requireResourceCapacity(resource: ResourceKey, amount: number): PlayerActionRequirement {
  return ({ resources }) => {
    if (resources.unlimited?.[resource]) {
      return { available: true };
    }
    const capacity = resources.maxCapacity[resource];
    const current = resources[resource];
    return current + amount <= capacity
      ? { available: true }
      : { available: false, reason: `${RESOURCE_LABELS[resource]}の上限を超えます` };
  };
}

function requireNegotiationAvailable(): PlayerActionRequirement {
  return ({ negotiationAvailable }) =>
    negotiationAvailable
      ? { available: true }
      : { available: false, reason: "このラボは既に利用されています" };
}

function requirePersuasionTarget(): PlayerActionRequirement {
  return ({ persuasionTargetCount }) =>
    persuasionTargetCount > 0
      ? { available: true }
      : { available: false, reason: "説得できるロビーがありません" };
}

function requireCollectTarget(): PlayerActionRequirement {
  return ({ collectableCardCount }) =>
    collectableCardCount > 0
      ? { available: true }
      : { available: false, reason: "獲得可能なカードがありません" };
}

function requireNotPassed(): PlayerActionRequirement {
  return ({ player }) =>
    !player.hasPassed
      ? { available: true }
      : { available: false, reason: "すでにパス済みです" };
}

function requireActionPointsExhausted(): PlayerActionRequirement {
  return ({ player }) =>
    player.actionPoints === 0
      ? { available: true }
      : { available: false, reason: "行動力を使い切ったあとに実行します" };
}

function requireExhaustedLens(): PlayerActionRequirement {
  return ({ exhaustedLensCount }) =>
    exhaustedLensCount > 0
      ? { available: true }
      : { available: false, reason: "再起動できるレンズがありません" };
}

const PLAYER_ACTIONS: PlayerActionDefinition[] = [
  (() => {
    const { summary, description } = getLabActionText("polish");
    return {
      id: "polish",
      label: "研磨",
      category: "lab",
      summary: summary || "行動力 1 / ロビー ×1",
      description:
        description ||
        "共有設備を使いレンズの研磨とロビー整理を進めます。研究の基礎アクションです。",
      requirement: combineRequirements(requireActionPoints(1), requireLobbyStock()),
      highlight: "primary",
      implemented: true,
    };
  })(),
  (() => {
    const { summary, description } = getLabActionText("focus-light");
    return {
      id: "focus-light",
      label: "集光",
      category: "lab",
      summary: summary || "創造力 1 / ロビー 1 を消費",
      description:
        description ||
        "集光ボードにロビーを配置し、創造力を消費して光トークンを 1 つ得ます。",
      requirement: combineRequirements(
        requireActionPoints(1),
        requireCreativity(1),
        requireLobbyStock(),
        requireResourceCapacity("light", 1),
      ),
      implemented: true,
    };
  })(),
  (() => {
    const { summary, description } = getLabActionText("negotiation");
    return {
      id: "negotiation",
      label: "根回し",
      category: "student",
      summary: summary || "ロビー ×1 / 光 +1 / 次ラウンド先手",
      description:
        description ||
        "講義棟で教員と調整し、光を得ながら次ラウンドの先手番を確保します。",
      requirement: combineRequirements(
        requireLobbyStock(),
        requireNegotiationAvailable(),
        requireResourceCapacity("light", 1),
      ),
      highlight: "primary",
    };
  })(),
  (() => {
    const { summary, description } = getLabActionText("spirit");
    return {
      id: "spirit",
      label: "気合",
      category: "student",
      summary: summary || "ロビー ×1 / 行動力 +1 / 淀み +1",
      description:
        description ||
        "学生ラウンジで士気を高め、行動力を回復しながら淀みを蓄えます。",
      requirement: requireLobbyStock(),
    };
  })(),
  {
    id: "lens-activate",
    label: "レンズ起動",
    category: "general",
    summary: "行動力 1 / 所有レンズを起動",
    description: "所有するレンズを起動し、対応する効果を発動します。",
    requirement: combineRequirements(requireActionPoints(1), requireLensActivateTarget()),
    highlight: "primary",
  },
  {
    id: "restart",
    label: "再起動",
    category: "general",
    summary: "行動力 3 / 自分の使用済みレンズを再起動",
    description: "使用済みレンズを再び使用可能状態に戻します。行動力を3消費します。",
    requirement: combineRequirements(requireActionPoints(3), requireExhaustedLens()),
  },
  {
    id: "collect",
    label: "収集",
    category: "general",
    summary: "行動力 2 / 公開カード・土台から 1 枚獲得",
    description:
      "公開中の開発カード、VPカード、または土台カードを 1 枚選択し、獲得済みの領域に移します。",
    requirement: combineRequirements(requireActionPoints(2), requireCollectTarget()),
  },
  {
    id: "will",
    label: "意思",
    category: "student",
    summary: "創造力 1 / 意思を固める",
    description: "意思力を整え、キャラクター固有の効果を発動するための準備を行います。",
    requirement: combineRequirements(requireCreativity(1), requireWillAbility()),
    implemented: true,
  },
  {
    id: "persuasion",
    label: "説得",
    category: "student",
    summary: "行動力 2 / 対象レンズの起動コストを支払う",
    description:
      "相手のロビーを使ってレンズを起動し、効果を得たあとロビーを使用済みとして戻します。",
    requirement: combineRequirements(requireActionPoints(2), requirePersuasionTarget()),
    implemented: true,
  },
  {
    id: "pass",
    label: "パス",
    category: "general",
    summary: "いつでも使用可",
    description: "これ以上行動しない場合はパスを宣言し、次のプレイヤーへ手番を渡します。",
    requirement: requireNotPassed(),
    highlight: "warning",
  },
];

function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

function toNumeric(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function sumCostRecord(record: Record<string, unknown> | undefined): number {
  if (!record) {
    return 0;
  }
  return Object.values(record).reduce<number>(
    (total, entry) => total + toNumeric(entry),
    0,
  );
}

function sumExtras(
  extras: Record<string, unknown> | undefined,
  keys: string[],
): number {
  if (!extras) {
    return 0;
  }
  return keys.reduce((total, key) => {
    if (!(key in extras)) {
      return total;
    }
    const value = extras[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return total + sumCostRecord(value as Record<string, unknown>);
    }
    return total + toNumeric(value);
  }, 0);
}

function isWillAbilityNode(node: CharacterGrowthNode): boolean {
  return node.name.startsWith("意思");
}

function getPolishCardValues(
  card: CatalogDevelopmentCard | null | undefined,
  cardType: "development" | "vp" = "development",
): {
  left: { top: CostSlotArray; bottom: CostSlotArray };
  right: { top: CostSlotArray; bottom: CostSlotArray };
} {
  if (!card) {
    return {
      left: { top: [0, 0, 0], bottom: [0, 0, 0] },
      right: { top: [0, 0, 0], bottom: [0, 0, 0] },
    };
  }
  const extras = card.extras ?? {};
  const leftTop = extractCostSlots(
    card.costLeftUp as Record<string, unknown> | undefined,
    extras,
    COST_LEFT_UP_EXTRA_KEYS,
  );
  const leftBottom = extractCostSlots(
    card.costLeftDown as Record<string, unknown> | undefined,
    extras,
    COST_LEFT_DOWN_EXTRA_KEYS,
  );
  const rightTop = extractCostSlots(undefined, extras, COST_RIGHT_UP_EXTRA_KEYS);
  const rightBottom = extractCostSlots(undefined, extras, COST_RIGHT_DOWN_EXTRA_KEYS);

  if (cardType === "vp") {
    const effectiveRightTop = sumSlots(rightTop) > 0 ? rightTop : leftTop;
    const effectiveRightBottom = sumSlots(rightBottom) > 0 ? rightBottom : leftBottom;
    return {
      left: { top: [0, 0, 0], bottom: [0, 0, 0] },
      right: { top: effectiveRightTop, bottom: effectiveRightBottom },
    };
  }

  return {
    left: { top: leftTop, bottom: leftBottom },
    right: { top: rightTop, bottom: rightBottom },
  };
}

function toOptionalNumeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return null;
}

function getCardCostNumber(card: CatalogDevelopmentCard | null): number | null {
  if (!card) {
    return null;
  }
  return toOptionalNumeric(card.costNumber);
}

function getCardCostPosition(card: CatalogDevelopmentCard | null): number | null {
  if (!card) {
    return null;
  }
  const value = card.costPosition;
  const parsed = toOptionalNumeric(value);
  return parsed !== null ? Math.trunc(parsed) : null;
}

function normalizeItemLabel(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined) {
    return null;
  }
  return String(value);
}

function extractCardVp(card: CatalogDevelopmentCard | null): number {
  if (!card || !card.extras) {
    return 0;
  }
  return Object.entries(card.extras).reduce<number>((total, [key, value]) => {
    const normalizedKey = key.toLowerCase();
    if (!normalizedKey.includes("vp")) {
      return total;
    }
    const parsed = toOptionalNumeric(value);
    return parsed !== null ? total + parsed : total;
  }, 0);
}

function extractCardVpReward(card: CatalogDevelopmentCard | null): {
  amount: number | null;
  position: number | null;
} {
  if (!card?.extras) {
    return { amount: null, position: null };
  }
  const amountKeys = ["getvp", "get_vp"];
  const positionKeys = ["vppos", "vp_pos"];
  let amount: number | null = null;
  for (const key of amountKeys) {
    if (amount !== null) {
      break;
    }
    amount = toOptionalNumeric(card.extras[key]);
  }
  let position: number | null = null;
  for (const key of positionKeys) {
    if (position !== null) {
      break;
    }
    position = toOptionalNumeric(card.extras[key]);
  }
  return { amount, position };
}

function formatCostRowText(slots: CostSlotArray): string {
  return slots
    .map((value) => {
      if (Number.isInteger(value)) {
        return value.toString();
      }
      return value.toFixed(2).replace(/\.?0+$/, "");
    })
    .join(" / ");
}

function formatDisplayNumber(value: number): string {
  if (Number.isInteger(value)) {
    return value.toString();
  }
  return value.toFixed(2).replace(/\.?0+$/, "");
}

function removeUsedCards(
  cards: string[],
  removalMap: Map<string, number> | null | undefined,
): string[] {
  if (!removalMap || removalMap.size === 0) {
    return cards;
  }
  const counts = new Map(removalMap);
  const result: string[] = [];
  cards.forEach((cardId) => {
    const remaining = counts.get(cardId) ?? 0;
    if (remaining > 0) {
      counts.set(cardId, remaining - 1);
    } else {
      result.push(cardId);
    }
  });
  return result;
}

function buildDraftCraftedLens(
  details: PolishSelectionDetail[],
  foundationCost: FoundationCost | null,
): CraftedLens | null {
  if (foundationCost === null || details.length === 0) {
    return null;
  }
  let leftTopTotal = 0;
  let rightTopTotal = 0;
  let vpTotal = 0;
  const leftItems: CraftedLensSideItem[] = [];
  const rightItems: CraftedLensSideItem[] = [];
  const sourceCards = details.map((detail) => ({
    cardId: detail.cardId,
    cardType: detail.type,
    flipped: detail.type === "vp" ? false : detail.flipped,
  }));
  details.forEach((detail) => {
    const sumLeftTop = sumSlots(detail.values.left.top);
    const sumLeftBottom = sumSlots(detail.values.left.bottom);
    const sumRightTop = sumSlots(detail.values.right.top);
    const sumRightBottom = sumSlots(detail.values.right.bottom);

    const detailVpValue = extractCardVp(detail.card);
    const vpReward = detail.type === "vp" ? extractCardVpReward(detail.card) : { amount: null, position: null };
    if (detail.type === "vp") {
      rightTopTotal += sumRightTop;
    } else if (!detail.flipped) {
      leftTopTotal += sumLeftTop;
      rightTopTotal += sumRightTop;
    } else {
      leftTopTotal += sumRightBottom;
      rightTopTotal += sumLeftBottom;
    }
    vpTotal += detail.type === "vp" ? vpReward.amount ?? detailVpValue : detailVpValue;
    const basePosition = detail.costPosition ?? null;
    const finalPosition =
      detail.type === "vp"
        ? vpReward.position ?? basePosition
        : detail.flipped
          ? flipPosition(basePosition)
          : basePosition;
    const displayLabel =
      detail.type === "vp"
        ? vpReward.amount !== null
          ? `VP × ${formatDisplayNumber(vpReward.amount)}`
          : `${detail.card?.cardId ?? detail.cardId} ｜ 上(${formatCostRowText(detail.values.right.top)}) 下(${formatCostRowText(detail.values.right.bottom)}) ｜ ${
              detailVpValue ? `VP × ${detailVpValue}` : "-"
            }`
        : detail.costItem ?? detail.cardId;
    const item: CraftedLensSideItem = {
      cardId: detail.cardId,
      cardType: detail.type,
      position: finalPosition,
      item: displayLabel,
    };
    const quantity =
      detail.type === "vp"
        ? null
        : detail.costNumber;
    if (quantity !== null && quantity !== undefined && !Number.isNaN(quantity)) {
      item.quantity = quantity;
    }
    if (detail.type === "vp" || detail.flipped) {
      rightItems.push(item);
    } else {
      leftItems.push(item);
    }
  });
  return {
    lensId: "draft",
    createdAt: Date.now(),
    foundationCost,
    leftTotal: leftTopTotal,
    rightTotal: rightTopTotal,
    vpTotal,
    leftItems,
    rightItems,
    sourceCards,
  };
}

type JournalSlotRole = "development" | "developmentDeck" | "vp" | "vpDeck";

interface JournalSlotDefinition {
  position: number;
  role: JournalSlotRole;
  label: string;
}

interface JournalSlotData extends JournalSlotDefinition {
  cardId: string | null;
  card?: CatalogDevelopmentCard | null;
  count?: number;
  slotIndex?: number | null;
}

interface LobbySummary {
  reserve: number;
  handUnused: number;
  handUsed: number;
  boardActive: number;
  boardFatigued: number;
  labCommitted: number;
}

interface LensTargetOption {
  lensId: string;
  ownerId: string;
  ownerName: string;
  occupantId: string;
  occupantName: string;
  slotActive: boolean;
  cost: ResourceCost;
  rewards: RewardDefinition[];
  leftItems?: CraftedLensSideItem[];
  rightItems?: CraftedLensSideItem[];
}

interface LensActivateOption {
  lensId: string;
  cost: ResourceCost;
  rewards: RewardDefinition[];
  status: string;
  ownerName?: string;
  leftItems?: CraftedLensSideItem[];
  rightItems?: CraftedLensSideItem[];
}

interface ExhaustedLensOption {
  lensId: string;
  ownerName?: string;
  status: string;
  slotActive: boolean;
  leftItems?: CraftedLensSideItem[];
  rightItems?: CraftedLensSideItem[];
}

const JOURNAL_SLOT_LAYOUT: JournalSlotDefinition[] = [
  { position: 1, role: "development", label: "開発カード置き場" },
  { position: 2, role: "development", label: "開発カード置き場" },
  { position: 3, role: "development", label: "開発カード置き場" },
  { position: 4, role: "vp", label: "VPカード置き場" },
  { position: 5, role: "development", label: "開発カード置き場" },
  { position: 6, role: "developmentDeck", label: "開発カード山札置き場" },
  { position: 7, role: "development", label: "開発カード置き場" },
  { position: 8, role: "vpDeck", label: "VPカード山札置き場" },
  { position: 9, role: "development", label: "開発カード置き場" },
  { position: 10, role: "development", label: "開発カード置き場" },
  { position: 11, role: "development", label: "開発カード置き場" },
  { position: 12, role: "vp", label: "VPカード置き場" },
];

const JOURNAL_DEVELOPMENT_SLOT_COUNT = JOURNAL_SLOT_LAYOUT.filter(
  (slot) => slot.role === "development",
).length;

const FOUNDATION_CARD_COSTS = [0, 1, 2, 3, 4] as const;
// デザイン資料の初期セットアップに基づき、ロビーマーカーの基本ストック数を 4 と想定
const DEFAULT_LOBBY_STOCK = 4;
type FoundationCost = (typeof FOUNDATION_CARD_COSTS)[number];

interface FoundationSupplySlot {
  cost: FoundationCost;
  remaining: number;
}

interface FoundationInventoryEntry {
  cost: FoundationCost;
  count: number;
}

type CollectRequestPayload =
  | { slotType: "development"; slotIndex: number }
  | { slotType: "vp"; slotIndex: number }
  | { slotType: "foundation"; foundationCost: FoundationCost };

interface CharacterGrowthNodeWithStatus extends CharacterGrowthNode {
  isUnlocked: boolean;
  definition?: GrowthNodeDefinition;
  unlockable: boolean;
}

interface PendingPolishResult {
  lens: CraftedLens;
  selection: Array<{ cardId: string; cardType: "development" | "vp" }>;
  foundationCost: FoundationCost;
}

export default function PlayPage(): JSX.Element {
  const {
    baseUrl,
    setBaseUrl,
    roomId: sessionRoomId,
    setRoomId: setSessionRoomId,
    localPlayer,
    status,
    gameState,
    isConnected,
    connect,
    disconnect,
    refresh,
    performAction,
    adjustPlayerForTest,
  } = useSession();

  const [baseUrlInput, setBaseUrlInput] = useState(
    baseUrl || DEFAULT_FUNCTIONS_BASE_URL,
  );
  const [roomIdInput, setRoomIdInput] = useState(sessionRoomId ?? "");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [taskRewardDialog, setTaskRewardDialog] = useState<{
    taskId: string;
    choice: "growth" | "lobby";
    nodeId?: string;
  } | null>(null);
  const [developmentCardCatalog, setDevelopmentCardCatalog] = useState<
    Map<string, CatalogDevelopmentCard>
  >(new Map());
  const [isLoadingDevelopmentCards, setIsLoadingDevelopmentCards] = useState(false);
  const [developmentCardError, setDevelopmentCardError] = useState<string | null>(null);
  const [vpCardCatalog, setVpCardCatalog] = useState<Map<string, CatalogDevelopmentCard>>(
    new Map(),
  );

  const getCardDefinition = useCallback(
    (cardId: string, cardType: "development" | "vp") => {
      const trimmed = cardId.trim();
      if (cardType === "vp") {
        return vpCardCatalog.get(trimmed) ?? developmentCardCatalog.get(trimmed) ?? null;
      }
      return developmentCardCatalog.get(trimmed) ?? vpCardCatalog.get(trimmed) ?? null;
    },
    [developmentCardCatalog, vpCardCatalog],
  );
  const [isLoadingVpCards, setIsLoadingVpCards] = useState(false);
  const [vpCardError, setVpCardError] = useState<string | null>(null);
  const [isPolishDialogOpen, setIsPolishDialogOpen] = useState(false);
  const [polishSelectionMap, setPolishSelectionMap] = useState<PolishSelectionMap>({});
  const [polishFoundationChoice, setPolishFoundationChoice] = useState<FoundationCost | null>(null);
  const [isPolishSubmitting, setIsPolishSubmitting] = useState(false);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [labConfirmDialog, setLabConfirmDialog] = useState<LabActionDefinition | null>(null);
  const [isWillDialogOpen, setIsWillDialogOpen] = useState(false);
  const [selectedWillNodeId, setSelectedWillNodeId] = useState<string | null>(null);
  const [isWillSubmitting, setIsWillSubmitting] = useState(false);
  const [isLensActivateDialogOpen, setIsLensActivateDialogOpen] = useState(false);
  const [selectedLensActivateId, setSelectedLensActivateId] = useState<string | null>(null);
  const [isLensActivateSubmitting, setIsLensActivateSubmitting] = useState(false);
  const [lensActivateGrowthSelections, setLensActivateGrowthSelections] = useState<string[]>([]);
  const [isRefreshDialogOpen, setIsRefreshDialogOpen] = useState(false);
  const [selectedRefreshLensId, setSelectedRefreshLensId] = useState<string | null>(null);
  const [isRefreshSubmitting, setIsRefreshSubmitting] = useState(false);
  const [refreshGrowthSelections, setRefreshGrowthSelections] = useState<string[]>([]);
  const [isPersuasionDialogOpen, setIsPersuasionDialogOpen] = useState(false);
  const [selectedPersuasionLensId, setSelectedPersuasionLensId] = useState<string | null>(null);
  const [isPersuasionSubmitting, setIsPersuasionSubmitting] = useState(false);
  const [persuasionGrowthSelections, setPersuasionGrowthSelections] = useState<string[]>([]);
  const [pendingCollectKey, setPendingCollectKey] = useState<string | null>(null);
  const [pendingPolishResult, setPendingPolishResult] = useState<PendingPolishResult | null>(null);
  const collectSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setBaseUrlInput(baseUrl || DEFAULT_FUNCTIONS_BASE_URL);
  }, [baseUrl]);

  useEffect(() => {
    if (sessionRoomId) {
      setRoomIdInput(sessionRoomId);
    }
  }, [sessionRoomId]);

  useEffect(() => {
    const trimmedBaseUrl = baseUrl?.trim();
    if (!trimmedBaseUrl) {
      setDevelopmentCardCatalog(new Map());
      setDevelopmentCardError(null);
      setVpCardCatalog(new Map());
      setVpCardError(null);
      return;
    }

    let cancelled = false;
    const gateway = new FunctionsGateway({ baseUrl: trimmedBaseUrl, fetchImpl: fetch });
    setIsLoadingDevelopmentCards(true);
    setDevelopmentCardError(null);

    gateway
      .listDevelopmentCards()
      .then((cards) => {
        if (cancelled) {
          return;
        }
        const map = new Map<string, CatalogDevelopmentCard>();
        cards.forEach((card) => {
          const resolvedId = (card.cardId || card.id).trim();
          map.set(resolvedId, card);
          if (card.id && card.id !== resolvedId) {
            map.set(card.id, card);
          }
        });
        setDevelopmentCardCatalog(map);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        console.error("Failed to load development cards", error);
        setDevelopmentCardCatalog(new Map());
        setDevelopmentCardError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingDevelopmentCards(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [baseUrl]);

  useEffect(() => {
    const trimmedBaseUrl = baseUrl?.trim();
    if (!trimmedBaseUrl) {
      setVpCardCatalog(new Map());
      setVpCardError(null);
      return;
    }

    let cancelled = false;
    const gateway = new FunctionsGateway({ baseUrl: trimmedBaseUrl, fetchImpl: fetch });
    setIsLoadingVpCards(true);
    setVpCardError(null);

    gateway
      .listVpCards()
      .then((cards) => {
        if (cancelled) {
          return;
        }
        const map = new Map<string, CatalogDevelopmentCard>();
        cards.forEach((card) => {
          const resolvedId = (card.cardId || card.id).trim();
          if (resolvedId) {
            map.set(resolvedId, card);
          }
          if (card.id && card.id !== resolvedId) {
            map.set(card.id, card);
          }
        });
        setVpCardCatalog(map);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        console.error("Failed to load VP cards", error);
        setVpCardCatalog(new Map());
        setVpCardError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingVpCards(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [baseUrl]);

  const handleConnect = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmedBaseUrl = baseUrlInput.trim();
      const trimmedRoomId = roomIdInput.trim();
      if (!trimmedBaseUrl || !trimmedRoomId) {
        setFeedback("Base URL と Room ID を入力してください。");
        return;
      }
      try {
        setFeedback(null);
        setBaseUrl(trimmedBaseUrl);
        setSessionRoomId(trimmedRoomId);
        await connect({ baseUrl: trimmedBaseUrl, roomId: trimmedRoomId });
      } catch (error) {
        console.error(error);
        setFeedback(
          error instanceof Error ? error.message : "接続に失敗しました。",
        );
      }
    },
    [baseUrlInput, roomIdInput, connect, setBaseUrl, setSessionRoomId],
  );

  const handlePass = useCallback(async () => {
    if (!localPlayer?.id) {
      setFeedback("先にロビーでプレイヤーとして参加してください。");
      return;
    }
    setIsSubmitting(true);
    setFeedback(null);
    try {
      await performAction({
        action: {
          playerId: localPlayer.id,
          actionType: "pass",
          payload: {},
        },
      });
      setFeedback("パスを宣言しました。");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "アクション送信に失敗しました";
      setFeedback(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [localPlayer?.id, performAction]);

  const players = useMemo(() => {
    if (!gameState) {
      return [];
    }
    return Object.values(gameState.players);
  }, [gameState]);

  const localGamePlayer = useMemo(() => {
    if (!localPlayer?.id || !gameState) {
      return undefined;
    }
    return gameState.players[localPlayer.id];
  }, [localPlayer?.id, gameState]);

  useEffect(() => {
    if (!pendingPolishResult) {
      return;
    }
    const hasApplied =
      localGamePlayer?.craftedLenses?.some((lens) => lens.lensId === pendingPolishResult.lens.lensId) ??
      false;
    if (hasApplied || !localGamePlayer) {
      setPendingPolishResult(null);
    }
  }, [localGamePlayer, pendingPolishResult]);

  const playerLensCount = useMemo(() => {
    if (!localPlayer?.id || !gameState) {
      return 0;
    }
    const boardLenses = Object.values(gameState.board?.lenses ?? {});
    const ownedOnBoard = boardLenses.filter(
      (lens) => lens.ownerId === localPlayer.id,
    ).length;
    const ownedFromState = localGamePlayer?.ownedLenses?.length ?? 0;
    return Math.max(ownedOnBoard, ownedFromState);
  }, [gameState, localPlayer?.id, localGamePlayer?.ownedLenses?.length]);

  const debugEnabled = process.env.NODE_ENV !== "production";

  const effectiveResources = localGamePlayer?.resources ?? null;

  const effectiveLensCount = playerLensCount;

  const handleAdjustDebug = useCallback(
    async (target: "light" | "rainbow" | "lens", delta: number) => {
      if (!localPlayer?.id) {
        setFeedback("先にロビーでプレイヤーとして参加してください。");
        return;
      }
      try {
        if (target === "lens") {
          const next = Math.max(0, playerLensCount + delta);
          await adjustPlayerForTest({
            playerId: localPlayer.id,
            lensCount: next,
          });
        } else {
          if (!localGamePlayer?.resources) {
            return;
          }
          const next = Math.max(0, localGamePlayer.resources[target] + delta);
          await adjustPlayerForTest({
            playerId: localPlayer.id,
            resources: { [target]: next },
          });
        }
        setFeedback(null);
      } catch (error) {
        console.error(error);
        setFeedback(
          error instanceof Error
            ? error.message
            : "デバッグ調整に失敗しました。",
        );
      }
    },
    [adjustPlayerForTest, localPlayer?.id, localGamePlayer?.resources, playerLensCount],
  );

  const localCharacterProfile = useMemo(() => {
    if (!localGamePlayer?.characterId) {
      return undefined;
    }
    return CHARACTER_CATALOG.find(
      (profile) => profile.id === localGamePlayer.characterId,
    );
  }, [localGamePlayer?.characterId]);

  const currentPlayer = gameState?.currentPlayerId
    ? gameState.players[gameState.currentPlayerId]
    : null;

  const isLocalTurn = Boolean(
    currentPlayer && localPlayer?.id === currentPlayer.playerId,
  );

  const developmentCardCount = gameState?.board?.publicDevelopmentCards.length ?? 0;
  const visibleDevelopmentCount = Math.min(
    developmentCardCount,
    JOURNAL_DEVELOPMENT_SLOT_COUNT,
  );

  const lobbySummary = useMemo<LobbySummary>(() => {
    if (!gameState || !localGamePlayer) {
      return {
        reserve: 0,
        handUnused: 0,
        handUsed: 0,
        boardActive: 0,
        boardFatigued: 0,
        labCommitted: 0,
      };
    }

    const lobbySlots = gameState.board?.lobbySlots ?? [];
    const playerSlots = lobbySlots.filter(
      (slot) => slot.occupantId === localGamePlayer.playerId,
    );
    const boardActive = playerSlots.filter((slot) => slot.isActive).length;
    const boardFatigued = playerSlots.length - boardActive;

    const labCommitted = (gameState.labPlacements ?? []).reduce((sum, placement) => {
      if (placement.playerId === localGamePlayer.playerId) {
        return sum + (placement.count ?? 0);
      }
      return sum;
    }, 0);

    const handUsed =
      typeof localGamePlayer.lobbyUsed === "number" && Number.isFinite(localGamePlayer.lobbyUsed)
        ? Math.max(0, localGamePlayer.lobbyUsed)
        : 0;

    const reserve =
      typeof localGamePlayer.lobbyReserve === "number" && Number.isFinite(localGamePlayer.lobbyReserve)
        ? Math.max(0, localGamePlayer.lobbyReserve)
        : DEFAULT_LOBBY_STOCK;

    const handUnused =
      typeof localGamePlayer.lobbyAvailable === "number" &&
      Number.isFinite(localGamePlayer.lobbyAvailable)
        ? Math.max(0, localGamePlayer.lobbyAvailable)
        : DEFAULT_LOBBY_STOCK;

    return {
      reserve,
      handUnused,
      handUsed,
      boardActive,
      boardFatigued,
      labCommitted,
    };
  }, [gameState, localGamePlayer]);

  const foundationSupply = useMemo<FoundationSupplySlot[]>(() => {
    const foundationStock =
      (gameState?.board?.foundationStock as Partial<Record<FoundationCost, number>> | undefined) ??
      {};
    return FOUNDATION_CARD_COSTS.map((cost) => {
      const raw = foundationStock[cost];
      const remaining =
        typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
      return { cost, remaining };
    });
  }, [gameState?.board?.foundationStock]);

  const collectedFoundationEntries = useMemo<FoundationInventoryEntry[]>(() => {
    const collection =
      (localGamePlayer?.collectedFoundationCards as Partial<Record<FoundationCost, number>> | undefined) ??
      {};
    return FOUNDATION_CARD_COSTS.map((cost) => {
      const raw = collection[cost];
      const count =
        typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
      const pendingAdjustment =
        pendingPolishResult?.foundationCost === cost ? 1 : 0;
      const adjustedCount = Math.max(0, count - pendingAdjustment);
      return { cost, count: adjustedCount };
    });
  }, [localGamePlayer?.collectedFoundationCards, pendingPolishResult?.foundationCost]);

  const pendingPolishRemoval = useMemo(() => {
    if (!pendingPolishResult) {
      return null;
    }
    const development = new Map<string, number>();
    const vp = new Map<string, number>();
    pendingPolishResult.selection.forEach(({ cardId, cardType }) => {
      const map = cardType === "development" ? development : vp;
      map.set(cardId, (map.get(cardId) ?? 0) + 1);
    });
    return { development, vp };
  }, [pendingPolishResult]);

  const effectiveCollectedDevelopmentCards = useMemo(() => {
    const cards = [...(localGamePlayer?.collectedDevelopmentCards ?? [])];
    return removeUsedCards(cards, pendingPolishRemoval?.development);
  }, [localGamePlayer?.collectedDevelopmentCards, pendingPolishRemoval?.development]);

  const effectiveCollectedVpCards = useMemo(() => {
    const cards = [...(localGamePlayer?.collectedVpCards ?? [])];
    return removeUsedCards(cards, pendingPolishRemoval?.vp);
  }, [localGamePlayer?.collectedVpCards, pendingPolishRemoval?.vp]);

  const totalCollectedFoundation = useMemo(
    () => collectedFoundationEntries.reduce((sum, entry) => sum + entry.count, 0),
    [collectedFoundationEntries],
  );

  const effectiveCraftedLenses = useMemo(() => {
    const lenses = localGamePlayer?.craftedLenses ?? [];
    if (!pendingPolishResult) {
      return lenses;
    }
    const alreadyExists = lenses.some((lens) => lens.lensId === pendingPolishResult.lens.lensId);
    return alreadyExists ? lenses : [...lenses, pendingPolishResult.lens];
  }, [localGamePlayer?.craftedLenses, pendingPolishResult]);

  const allCraftedLenses = useMemo<CraftedLensWithOwner[]>(() => {
    if (!gameState?.players) {
      return [];
    }
    return Object.values(gameState.players).flatMap((player) =>
      (player.craftedLenses ?? []).map((lens) => ({
        lens,
        ownerId: player.playerId,
        ownerName: player.displayName ?? player.playerId,
      })),
    );
  }, [gameState?.players]);

  const openPolishDialog = useCallback(() => {
    setPolishSelectionMap({});
    setPolishFoundationChoice(null);
    setIsPolishDialogOpen(true);
  }, []);

  const closePolishDialog = useCallback(() => {
    setIsPolishDialogOpen(false);
    setPolishSelectionMap({});
    setPolishFoundationChoice(null);
    setIsPolishSubmitting(false);
  }, []);

  const openLabConfirmDialog = useCallback((labId: string) => {
    const definition = LAB_ACTION_LOOKUP.get(labId);
    if (!definition) {
      return;
    }
    setLabConfirmDialog(definition);
  }, []);

  const closeLabConfirmDialog = useCallback(() => {
    setLabConfirmDialog(null);
  }, []);

  const handleTogglePolishCard = useCallback((cardId: string, type: "development" | "vp") => {
    setPolishSelectionMap((prev) => {
      const next = { ...prev };
      if (next[cardId]) {
        delete next[cardId];
      } else {
        next[cardId] = { type, flipped: type === "vp" };
      }
      return next;
    });
  }, []);

  const handleTogglePolishFlip = useCallback((cardId: string) => {
    setPolishSelectionMap((prev) => {
      const next = { ...prev };
      const entry = next[cardId];
      if (entry && entry.type === "development") {
        next[cardId] = { ...entry, flipped: !entry.flipped };
      }
      return next;
    });
  }, []);

  const handleSelectPolishFoundation = useCallback((cost: FoundationCost | null) => {
    setPolishFoundationChoice(cost);
  }, []);

  const polishSelectionDetails = useMemo<PolishSelectionDetail[]>(() => {
    return Object.entries(polishSelectionMap).map(([cardId, entry]) => {
      const card =
        entry.type === "development"
          ? developmentCardCatalog.get(cardId) ?? null
          : vpCardCatalog.get(cardId) ?? developmentCardCatalog.get(cardId) ?? null;
      const values = getPolishCardValues(card, entry.type);
      return {
        cardId,
        type: entry.type,
        card,
        flipped: entry.flipped,
        values,
        costItem: normalizeItemLabel(card?.costItem ?? null),
        costNumber: getCardCostNumber(card),
        costPosition: getCardCostPosition(card),
      };
    });
  }, [polishSelectionMap, developmentCardCatalog, vpCardCatalog]);

  const polishSummary = useMemo(() => {
    let leftTopTotal = 0;
    let rightTopTotal = 0;
    polishSelectionDetails.forEach((detail) => {
      const useRight = detail.type === "vp" || detail.flipped;
      if (detail.type === "vp") {
        rightTopTotal += sumSlots(detail.values.right.top);
      } else if (!detail.flipped) {
        leftTopTotal += sumSlots(detail.values.left.top);
        rightTopTotal += sumSlots(detail.values.right.top);
      } else {
        leftTopTotal += sumSlots(detail.values.right.bottom);
        rightTopTotal += sumSlots(detail.values.left.bottom);
      }
    });
    const foundationRequirement = Math.max(0, Math.ceil(rightTopTotal - leftTopTotal));
    const selectedFoundation =
      polishFoundationChoice !== null
        ? collectedFoundationEntries.find(
            (entry) => entry.cost === polishFoundationChoice && entry.count > 0,
          ) ?? null
        : null;
    const foundationMet =
      foundationRequirement <= 0
        ? Boolean(selectedFoundation && selectedFoundation.count > 0)
        : Boolean(
            selectedFoundation &&
            selectedFoundation.count > 0 &&
            selectedFoundation.cost >= foundationRequirement,
          );
    const leftPositions = new Set<number>();
    const rightPositions = new Set<number>();
    let leftConflict = false;
    let rightConflict = false;
    polishSelectionDetails.forEach((detail) => {
      const position = detail.costPosition;
      const useRight = detail.type === "vp" || detail.flipped;
      if (position === null || position === undefined || Number.isNaN(position)) {
        return;
      }
      if (useRight) {
        if (rightPositions.has(position)) {
          rightConflict = true;
        } else {
          rightPositions.add(position);
        }
      } else {
        if (leftPositions.has(position)) {
          leftConflict = true;
        } else {
          leftPositions.add(position);
        }
      }
    });
    const positionConflict = leftConflict || rightConflict;
    const lensResult = buildDraftCraftedLens(polishSelectionDetails, polishFoundationChoice);
    const canSubmit =
      polishSelectionDetails.length > 0 &&
      foundationMet &&
      !positionConflict &&
      !isPolishSubmitting &&
      lensResult !== null;

    return {
      foundationRequirement,
      foundationMet,
      selectedFoundation,
      positionConflict,
      lensResult,
      canSubmit,
    };
  }, [
    polishSelectionDetails,
    polishFoundationChoice,
    collectedFoundationEntries,
    isPolishSubmitting,
  ]);

  const handleSubmitPolish = useCallback(async () => {
    if (!localPlayer?.id) {
      setFeedback("先にロビーでプレイヤーとして参加してください。");
      return;
    }
    if (!polishSummary.canSubmit || !polishSummary.lensResult || polishFoundationChoice === null) {
      return;
    }
    const selection = polishSelectionDetails.map((detail) => ({
      cardId: detail.cardId,
      cardType: detail.type,
      flipped: detail.flipped,
    }));
    const lensId = `lens-${Date.now()}`;
    const baseLens = polishSummary.lensResult;
    const resultLens: CraftedLens = {
      ...baseLens,
      lensId,
      createdAt: Date.now(),
      foundationCost: polishFoundationChoice,
      leftItems: baseLens.leftItems.map((item) => ({ ...item })),
      rightItems: baseLens.rightItems.map((item) => ({ ...item })),
      sourceCards: baseLens.sourceCards.map((card) => ({ ...card })),
    };
    const polishPayload: PolishActionPayload = {
      selection,
      foundationCost: polishFoundationChoice,
      result: resultLens,
    };
    setIsPolishSubmitting(true);
    try {
      await performAction({
        action: {
          playerId: localPlayer.id,
          actionType: "labActivate",
          payload: {
            labId: "polish",
            polish: polishPayload,
          },
        },
      });
      setPendingPolishResult({
        lens: resultLens,
        selection: selection.map((entry) => ({ cardId: entry.cardId, cardType: entry.cardType })),
        foundationCost: polishFoundationChoice,
      });
      setFeedback("研磨を実行しました。");
      closePolishDialog();
      await refresh();
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error ? error.message : "研磨アクションの実行に失敗しました。";
      setFeedback(message);
    } finally {
      setIsPolishSubmitting(false);
    }
  }, [
    localPlayer?.id,
    polishSummary.canSubmit,
    polishSummary.lensResult,
    polishSelectionDetails,
    polishFoundationChoice,
    performAction,
    closePolishDialog,
    refresh,
    setFeedback,
  ]);

  const handleExecuteLab = useCallback(
    async (labId: string, extraPayload?: Record<string, unknown>) => {
      if (!localPlayer?.id) {
        setFeedback("先にロビーでプレイヤーとして参加してください。");
        return;
      }
      setPendingActionId(labId);
      try {
        const payload: Record<string, unknown> = { labId, ...(extraPayload ?? {}) };
        await performAction({
          action: {
            playerId: localPlayer.id,
            actionType: "labActivate",
            payload,
          },
        });
        setFeedback(
          labId === "focus-light"
            ? "集光を実行しました。"
            : "ラボアクションを実行しました。",
        );
        await refresh();
        closeLabConfirmDialog();
      } catch (error) {
        console.error(error);
        setFeedback(
          error instanceof Error ? error.message : "ラボアクションの実行に失敗しました。",
        );
      } finally {
        setPendingActionId(null);
      }
    },
    [localPlayer?.id, performAction, refresh, closeLabConfirmDialog],
  );

  const growthNodes = localCharacterProfile?.growthNodes ?? [];

  const growthNodesWithStatus = useMemo<CharacterGrowthNodeWithStatus[]>(() => {
    if (!growthNodes.length || !localGamePlayer?.characterId) {
      return growthNodes.map((node) => ({
        ...node,
        isUnlocked: false,
        unlockable: false,
      }));
    }

    const unlockedSet = buildUnlockedSetWithAuto(
      localGamePlayer.characterId,
      localGamePlayer.unlockedCharacterNodes ?? [],
    );

    return growthNodes.map((node) => {
      const definition = getGrowthNode(localGamePlayer.characterId!, node.id);
      const isUnlocked = unlockedSet.has(node.id);
      const unlockable =
        !!definition &&
        !definition.autoUnlock &&
        !isUnlocked &&
        canUnlockGrowthNode(localGamePlayer.characterId!, node.id, unlockedSet);
      return {
        ...node,
        isUnlocked,
        definition,
        unlockable,
      };
    });
  }, [growthNodes, localGamePlayer?.characterId, localGamePlayer?.unlockedCharacterNodes]);
  const availableGrowthNodes = useMemo(
    () => growthNodesWithStatus.filter((node) => node.unlockable),
    [growthNodesWithStatus],
  );
  const growthNodeMap = useMemo(() => {
    const map = new Map<string, CharacterGrowthNodeWithStatus>();
    growthNodesWithStatus.forEach((node) => {
      map.set(node.id, node);
    });
    return map;
  }, [growthNodesWithStatus]);

  const availableWillNodes = useMemo(
    () =>
      growthNodesWithStatus.filter(
        (node) => node.isUnlocked && isWillAbilityNode(node),
      ),
    [growthNodesWithStatus],
  );
  const willAbilityCount = availableWillNodes.length;

  const lensActivateTargets = useMemo<LensActivateOption[]>(() => {
    if (!gameState || !localPlayer?.id || !localGamePlayer) {
      return [];
    }
    const lenses = gameState.board?.lenses ?? {};
    const slots = gameState.board?.lobbySlots ?? [];
    const players = gameState.players ?? {};
    const availableLobbyTokens = lobbySummary.handUnused;
    const resources = effectiveResources ?? localGamePlayer.resources;
    const removableGrowth = (localGamePlayer.unlockedCharacterNodes ?? []).filter(
      (id) => !id.endsWith(":s"),
    ).length;
    return Object.values(lenses)
      .filter((lens) => lens.status === "available")
      .filter((lens) => {
        const lensSlots = slots.filter((slot) => slot.lensId === lens.lensId);
        const hasAnyLobby = lensSlots.some((slot) => Boolean(slot.occupantId));
        if (hasAnyLobby) {
          return false;
        }
        const hasEmptySlot = lensSlots.some((slot) => !slot.occupantId);
        const canUseOwnLobby = hasEmptySlot && availableLobbyTokens > 0;
        if (!canUseOwnLobby) {
          return false;
        }
        const itemCost = accumulateItemCostEffects(
          (lens as unknown as { leftItems?: CraftedLensSideItem[] }).leftItems,
        );
        const mergedLight = (lens.cost.light ?? 0) + (itemCost.resources.light ?? 0);
        const mergedRainbow = (lens.cost.rainbow ?? 0) + (itemCost.resources.rainbow ?? 0);
        const mergedStagnation = (lens.cost.stagnation ?? 0) + (itemCost.resources.stagnation ?? 0);
        const mergedCreativity = (lens.cost.creativity ?? 0) + (itemCost.resources.creativity ?? 0);
        const totalAction = 1 + (lens.cost.actionPoints ?? 0);
        if (localGamePlayer.actionPoints < totalAction) {
          return false;
        }
        if (
          resources.light < mergedLight ||
          resources.rainbow < mergedRainbow ||
          resources.stagnation < mergedStagnation
        ) {
          return false;
        }
        if (mergedCreativity > (localGamePlayer.creativity ?? 0)) {
          return false;
        }
        if (itemCost.lobbyReturn > lobbySummary.handUsed) {
          return false;
        }
        if (itemCost.growthLoss > removableGrowth) {
          return false;
        }
        return true;
      })
      .map((lens) => ({
        lensId: lens.lensId,
        cost: lens.cost,
        rewards: lens.rewards,
        status: lens.status,
        ownerName: players[lens.ownerId]?.displayName ?? lens.ownerId,
        leftItems: (lens as unknown as { leftItems?: CraftedLensSideItem[] }).leftItems,
        rightItems: (lens as unknown as { rightItems?: CraftedLensSideItem[] }).rightItems,
      }));
  }, [
    gameState,
    localPlayer?.id,
    localGamePlayer,
    effectiveResources,
    lobbySummary.handUnused,
    lobbySummary.handUsed,
  ]);

  const exhaustedLensTargets = useMemo<ExhaustedLensOption[]>(() => {
    if (!gameState || !localPlayer?.id) {
      return [];
    }
    const lenses = gameState.board?.lenses ?? {};
    const slots = gameState.board?.lobbySlots ?? [];
    const players = gameState.players ?? {};
    return slots
      .filter(
        (slot) =>
          slot.occupantId === localPlayer.id &&
          Boolean(lenses[slot.lensId]) &&
          lenses[slot.lensId].status === "exhausted" &&
          slot.isActive === false,
      )
      .map((slot) => {
        const lens = lenses[slot.lensId];
        return {
          lensId: lens.lensId,
          ownerName: players[lens.ownerId]?.displayName ?? lens.ownerId,
          status: lens.status,
          slotActive: slot.isActive,
          leftItems: (lens as unknown as { leftItems?: CraftedLensSideItem[] }).leftItems,
          rightItems: (lens as unknown as { rightItems?: CraftedLensSideItem[] }).rightItems,
        };
      });
  }, [gameState, localPlayer?.id]);

  const openWillDialog = useCallback(() => {
    if (availableWillNodes.length === 0) {
      setFeedback("使用可能な意思能力がありません。");
      return;
    }
    setSelectedWillNodeId((prev) => {
      if (prev && availableWillNodes.some((node) => node.id === prev)) {
        return prev;
      }
      return availableWillNodes[0]?.id ?? null;
    });
    setIsWillDialogOpen(true);
  }, [availableWillNodes, setFeedback]);

  const closeWillDialog = useCallback(() => {
    setIsWillDialogOpen(false);
    setSelectedWillNodeId(null);
    setIsWillSubmitting(false);
  }, []);

  const openLensActivateDialog = useCallback(() => {
    if (lensActivateTargets.length === 0) {
      setFeedback("起動できるレンズがありません。");
      return;
    }
    setSelectedLensActivateId((prev) => {
      if (prev && lensActivateTargets.some((lens) => lens.lensId === prev)) {
        return prev;
      }
      return lensActivateTargets[0]?.lensId ?? null;
    });
    setIsLensActivateDialogOpen(true);
  }, [lensActivateTargets, setFeedback]);

  const closeLensActivateDialog = useCallback(() => {
    setIsLensActivateDialogOpen(false);
    setSelectedLensActivateId(null);
    setIsLensActivateSubmitting(false);
    setLensActivateGrowthSelections([]);
  }, []);

  const openRefreshDialog = useCallback(() => {
    if (exhaustedLensTargets.length === 0) {
      setFeedback("再起動できるレンズがありません。");
      return;
    }
    setSelectedRefreshLensId((prev) => {
      if (prev && exhaustedLensTargets.some((lens) => lens.lensId === prev)) {
        return prev;
      }
      return exhaustedLensTargets[0]?.lensId ?? null;
    });
    setIsRefreshDialogOpen(true);
  }, [exhaustedLensTargets, setFeedback]);

  const closeRefreshDialog = useCallback(() => {
    setIsRefreshDialogOpen(false);
    setSelectedRefreshLensId(null);
    setIsRefreshSubmitting(false);
    setRefreshGrowthSelections([]);
  }, []);

  const selectedLensActivateTarget = useMemo(
    () =>
      lensActivateTargets.find((lens) => lens.lensId === selectedLensActivateId) ??
      lensActivateTargets[0] ??
      null,
    [lensActivateTargets, selectedLensActivateId],
  );

  const lensActivateCostDescriptions = useMemo(
    () => (selectedLensActivateTarget ? describeResourceCost(selectedLensActivateTarget.cost) : []),
    [selectedLensActivateTarget],
  );

  const lensActivateRewardDescriptions = useMemo(
    () =>
      selectedLensActivateTarget
        ? selectedLensActivateTarget.rewards.map((reward) => describeRewardDefinition(reward))
        : [],
    [selectedLensActivateTarget],
  );
  const lensActivateGrowthNeeded = useMemo(
    () => countGrow((selectedLensActivateTarget as { rightItems?: CraftedLensSideItem[] } | null)?.rightItems),
    [selectedLensActivateTarget],
  );
  useEffect(() => {
    if (lensActivateGrowthNeeded <= 0) {
      setLensActivateGrowthSelections([]);
      return;
    }
    setLensActivateGrowthSelections(Array.from({ length: lensActivateGrowthNeeded }, () => ""));
  }, [lensActivateGrowthNeeded, selectedLensActivateTarget?.lensId]);

  const selectedRefreshTarget = useMemo(
    () =>
      exhaustedLensTargets.find((lens) => lens.lensId === selectedRefreshLensId) ??
      exhaustedLensTargets[0] ??
      null,
    [exhaustedLensTargets, selectedRefreshLensId],
  );
  const refreshGrowthNeeded = useMemo(
    () => countGrow((selectedRefreshTarget as { rightItems?: CraftedLensSideItem[] } | null)?.rightItems),
    [selectedRefreshTarget],
  );
  useEffect(() => {
    if (refreshGrowthNeeded <= 0) {
      setRefreshGrowthSelections([]);
      return;
    }
    setRefreshGrowthSelections(Array.from({ length: refreshGrowthNeeded }, () => ""));
  }, [refreshGrowthNeeded, selectedRefreshTarget?.lensId]);

  const handleSubmitWill = useCallback(async () => {
    if (!localPlayer?.id) {
      setFeedback("先にロビーでプレイヤーとして参加してください。");
      return;
    }
    const nodeId =
      selectedWillNodeId && availableWillNodes.some((node) => node.id === selectedWillNodeId)
        ? selectedWillNodeId
        : availableWillNodes[0]?.id ?? null;
    if (!nodeId) {
      setFeedback("意思能力を選択してください。");
      return;
    }

    setIsWillSubmitting(true);
    setPendingActionId("will");
    try {
      await performAction({
        action: {
          playerId: localPlayer.id,
          actionType: "will",
          payload: { nodeId },
        },
      });
      const executedNode = availableWillNodes.find((node) => node.id === nodeId);
      setFeedback(
        executedNode
          ? `意思能力「${executedNode.name}」を実行しました。`
          : "意思能力を実行しました。",
      );
      await refresh();
      closeWillDialog();
    } catch (error) {
      console.error(error);
      setFeedback(error instanceof Error ? error.message : "意思アクションの実行に失敗しました。");
    } finally {
    setIsWillSubmitting(false);
    setPendingActionId(null);
  }
}, [
    localPlayer?.id,
    selectedWillNodeId,
    availableWillNodes,
    performAction,
    refresh,
    closeWillDialog,
    setFeedback,
  ]);

  const handleSubmitLensActivate = useCallback(async () => {
    if (!localPlayer?.id) {
      setFeedback("先にロビーでプレイヤーとして参加してください。");
      return;
    }
    const lensId =
      selectedLensActivateId &&
      lensActivateTargets.some((lens) => lens.lensId === selectedLensActivateId)
        ? selectedLensActivateId
        : lensActivateTargets[0]?.lensId ?? null;
    if (!lensId) {
      setFeedback("起動するレンズを選択してください。");
      return;
    }
    setIsLensActivateSubmitting(true);
    setPendingActionId("lens-activate");
    try {
      await performAction({
        action: {
          playerId: localPlayer.id,
          actionType: "lensActivate",
          payload: {
            lensId,
            growthSelections:
              lensActivateGrowthNeeded > 0 ? lensActivateGrowthSelections.filter(Boolean) : undefined,
          },
        },
      });
      setFeedback(`レンズ ${lensId} を起動しました。`);
      await refresh();
      closeLensActivateDialog();
    } catch (error) {
      console.error(error);
    setFeedback(
      error instanceof Error
        ? error.message
        : "レンズ起動アクションの実行に失敗しました。",
    );
  } finally {
    setIsLensActivateSubmitting(false);
    setPendingActionId(null);
  }
}, [
  localPlayer?.id,
  selectedLensActivateId,
  lensActivateTargets,
  performAction,
  refresh,
  closeLensActivateDialog,
  setFeedback,
]);

  const handleSubmitRefresh = useCallback(async () => {
    if (!localPlayer?.id) {
      setFeedback("先にロビーでプレイヤーとして参加してください。");
      return;
    }
    const lensId =
      selectedRefreshLensId &&
      exhaustedLensTargets.some((lens) => lens.lensId === selectedRefreshLensId)
        ? selectedRefreshLensId
        : exhaustedLensTargets[0]?.lensId ?? null;
    if (!lensId) {
      setFeedback("再起動するレンズを選択してください。");
      return;
    }
    setIsRefreshSubmitting(true);
    setPendingActionId("restart");
    try {
      await performAction({
        action: {
          playerId: localPlayer.id,
          actionType: "refresh",
          payload: {
            lensId,
            growthSelections:
              refreshGrowthNeeded > 0 ? refreshGrowthSelections.filter(Boolean) : undefined,
          },
        },
      });
      setFeedback(`レンズ ${lensId} を再起動しました。`);
      await refresh();
      closeRefreshDialog();
    } catch (error) {
      console.error(error);
      setFeedback(
        error instanceof Error ? error.message : "再起動アクションの実行に失敗しました。",
      );
    } finally {
    setIsRefreshSubmitting(false);
    setPendingActionId(null);
  }
}, [
  localPlayer?.id,
  selectedRefreshLensId,
  exhaustedLensTargets,
  performAction,
  refresh,
  closeRefreshDialog,
  setFeedback,
]);

  const handleSubmitPass = useCallback(async () => {
    if (!localPlayer?.id) {
      setFeedback("先にロビーでプレイヤーとして参加してください。");
      return;
    }
    setPendingActionId("pass");
    try {
      await performAction({
        action: {
          playerId: localPlayer.id,
          actionType: "pass",
          payload: {},
        },
      });
      setFeedback("パスしました。");
      await refresh();
    } catch (error) {
      console.error(error);
      setFeedback(error instanceof Error ? error.message : "パスの実行に失敗しました。");
    } finally {
      setPendingActionId(null);
    }
  }, [localPlayer?.id, performAction, refresh, setFeedback]);


  const lensOpponentTargets = useMemo<LensTargetOption[]>(() => {
    if (!gameState || !localGamePlayer) {
      return [];
    }
    const lenses = gameState.board?.lenses ?? {};
    const slots = gameState.board?.lobbySlots ?? [];
    const map = new Map<string, LensTargetOption>();

    slots.forEach((slot) => {
      if (!slot.occupantId || slot.occupantId === localGamePlayer.playerId) {
        return;
      }
      const lens = lenses[slot.lensId];
      if (!lens || lens.status !== "available") {
        return;
      }
      const occupant = gameState.players[slot.occupantId];
      const owner = gameState.players[lens.ownerId];
      const existing = map.get(lens.lensId);
      if (!existing || (!existing.slotActive && slot.isActive)) {
        map.set(lens.lensId, {
          lensId: lens.lensId,
          ownerId: lens.ownerId,
          ownerName: owner?.displayName ?? lens.ownerId,
          occupantId: slot.occupantId,
          occupantName: occupant?.displayName ?? slot.occupantId,
          slotActive: slot.isActive,
          cost: lens.cost,
          rewards: lens.rewards,
          leftItems: (lens as unknown as { leftItems?: CraftedLensSideItem[] }).leftItems,
          rightItems: (lens as unknown as { rightItems?: CraftedLensSideItem[] }).rightItems,
        });
      }
    });

    return Array.from(map.values());
  }, [gameState, localGamePlayer]);

  const persuasionTargetCount = lensOpponentTargets.length;
  const selectedPersuasionTarget = useMemo(
    () =>
      lensOpponentTargets.find((target) => target.lensId === selectedPersuasionLensId) ??
      lensOpponentTargets[0] ??
      null,
    [lensOpponentTargets, selectedPersuasionLensId],
  );
  const persuasionGrowthNeeded = useMemo(
    () => countGrow((selectedPersuasionTarget as { rightItems?: CraftedLensSideItem[] } | null)?.rightItems),
    [selectedPersuasionTarget],
  );
  useEffect(() => {
    if (persuasionGrowthNeeded <= 0) {
      setPersuasionGrowthSelections([]);
      return;
    }
    setPersuasionGrowthSelections(Array.from({ length: persuasionGrowthNeeded }, () => ""));
  }, [persuasionGrowthNeeded, selectedPersuasionTarget?.lensId]);

  const renderGrowthSelector = (
    need: number,
    selections: string[],
    setSelections: (value: SetStateAction<string[]>) => void,
    keyPrefix: string,
  ): JSX.Element | null => {
    if (need <= 0) {
      return null;
    }
    const handleChange = (index: number, value: string) => {
      setSelections((prev) => {
        const next = [...prev];
        next[index] = value;
        return next;
      });
    };
    return (
      <div className={styles.actionConfirmSection}>
        <h5 className={styles.actionConfirmHeading}>成長選択</h5>
        {Array.from({ length: need }).map((_, index) => (
          <div key={`${keyPrefix}-${index}`} className={styles.formRow}>
            <select
              value={selections[index] ?? ""}
              onChange={(event) => handleChange(index, event.target.value)}
            >
              <option value="">自動選択</option>
              {availableGrowthNodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.name}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    );
  };
  const persuasionLensCostDescriptions = useMemo(
    () =>
      selectedPersuasionTarget ? describeResourceCost(selectedPersuasionTarget.cost) : [],
    [selectedPersuasionTarget],
  );
  const persuasionLensRewardDescriptions = useMemo(
    () =>
      selectedPersuasionTarget
        ? selectedPersuasionTarget.rewards.map((reward) => describeRewardDefinition(reward))
        : [],
    [selectedPersuasionTarget],
  );

  const negotiationAvailable = useMemo(() => {
    if (!gameState) {
      return true;
    }
    const placements = Array.isArray(gameState.labPlacements) ? gameState.labPlacements : [];
    const placementUsed = placements.some(
      (placement) => placement.labId === "negotiation" && placement.count > 0,
    );
    const players = Object.values(gameState.players ?? {});
    const alreadyRooting = players.some((player) => player.isRooting);
    return !placementUsed && !alreadyRooting;
  }, [gameState]);

  const collectableCardCount = useMemo(() => {
    const developmentCards = gameState?.board?.publicDevelopmentCards ?? [];
    const vpCards = gameState?.board?.publicVpCards ?? [];
    const foundationCount = foundationSupply.reduce((sum, slot) => sum + slot.remaining, 0);
    return (
      developmentCards.filter((cardId) => Boolean(cardId)).length +
      vpCards.filter((cardId) => Boolean(cardId)).length +
      foundationCount
    );
  }, [
    gameState?.board?.publicDevelopmentCards,
    gameState?.board?.publicVpCards,
    foundationSupply,
  ]);

  const playerActionsByCategory = useMemo<PlayerActionGroupViewModel[]>(() => {
    if (!localGamePlayer) {
      return [];
    }
    const resources = effectiveResources ?? localGamePlayer.resources;
    const context: PlayerActionContext = {
      player: localGamePlayer,
      resources,
      lobby: lobbySummary,
      willAbilityCount,
      negotiationAvailable,
      persuasionTargetCount,
      collectableCardCount,
      lensActivateCount: lensActivateTargets.length,
      exhaustedLensCount: exhaustedLensTargets.length,
    };
    const groups = new Map<PlayerActionCategory, PlayerActionGroupViewModel>();

    PLAYER_ACTIONS.forEach((action) => {
      const availability = (action.requirement ?? (() => ({ available: true })))(context);
      const view: PlayerActionViewModel = {
        ...action,
        available: availability.available,
        reason: availability.available ? undefined : availability.reason,
      };
      const existing = groups.get(action.category);
      if (existing) {
        existing.actions.push(view);
      } else {
        groups.set(action.category, {
          category: action.category,
          label: PLAYER_ACTION_CATEGORY_LABELS[action.category],
          actions: [view],
        });
      }
    });

    const ordered = Array.from(groups.values()).sort(
      (a, b) =>
        PLAYER_ACTION_CATEGORY_ORDER.indexOf(a.category) -
        PLAYER_ACTION_CATEGORY_ORDER.indexOf(b.category),
    );

    ordered.forEach((group) => {
      group.actions.sort((a, b) => a.label.localeCompare(b.label, "ja"));
    });

    return ordered;
  }, [
    localGamePlayer,
    effectiveResources,
    lobbySummary,
    willAbilityCount,
    negotiationAvailable,
    persuasionTargetCount,
    collectableCardCount,
    lensActivateTargets.length,
    exhaustedLensTargets.length,
  ]);

  const openPersuasionDialog = useCallback(() => {
    if (lensOpponentTargets.length === 0) {
      setFeedback("説得できるレンズがありません。");
      return;
    }
    setSelectedPersuasionLensId((prev) => {
      if (prev && lensOpponentTargets.some((target) => target.lensId === prev)) {
        return prev;
      }
      return lensOpponentTargets[0]?.lensId ?? null;
    });
    setIsPersuasionDialogOpen(true);
  }, [lensOpponentTargets, setFeedback]);

  const closePersuasionDialog = useCallback(() => {
    setIsPersuasionDialogOpen(false);
    setSelectedPersuasionLensId(null);
    setIsPersuasionSubmitting(false);
    setPersuasionGrowthSelections([]);
  }, []);

  const handleSubmitPersuasion = useCallback(async () => {
    if (!localPlayer?.id) {
      setFeedback("先にロビーでプレイヤーとして参加してください。");
      return;
    }
    const lensId =
      selectedPersuasionLensId &&
      lensOpponentTargets.some((target) => target.lensId === selectedPersuasionLensId)
        ? selectedPersuasionLensId
        : lensOpponentTargets[0]?.lensId ?? null;
    if (!lensId) {
      setFeedback("説得対象のレンズを選択してください。");
      return;
    }
    setIsPersuasionSubmitting(true);
    setPendingActionId("persuasion");
    try {
      await performAction({
        action: {
          playerId: localPlayer.id,
          actionType: "persuasion",
          payload: {
            lensId,
            growthSelections:
              persuasionGrowthNeeded > 0 ? persuasionGrowthSelections.filter(Boolean) : undefined,
          },
        },
      });
      setFeedback(`説得でレンズ ${lensId} を起動しました。`);
      await refresh();
      closePersuasionDialog();
    } catch (error) {
      console.error(error);
      setFeedback(
        error instanceof Error ? error.message : "説得アクションの実行に失敗しました。",
      );
    } finally {
      setIsPersuasionSubmitting(false);
      setPendingActionId(null);
    }
  }, [
    localPlayer?.id,
    selectedPersuasionLensId,
    lensOpponentTargets,
    performAction,
    refresh,
    closePersuasionDialog,
    setFeedback,
  ]);

  const handleCollect = useCallback(
    async (payload: CollectRequestPayload) => {
      if (!localPlayer?.id) {
        setFeedback("先にロビーでプレイヤーとして参加してください。");
        return;
      }
      const key =
        payload.slotType === "foundation"
          ? `foundation-${payload.foundationCost}`
          : `${payload.slotType}-${payload.slotIndex}`;
      setPendingCollectKey(key);
      try {
        await performAction({
          action: {
            playerId: localPlayer.id,
            actionType: "collect",
            payload,
          },
        });
        let message: string;
        if (payload.slotType === "foundation") {
          message = `土台カード（コスト ${payload.foundationCost}）を獲得しました。`;
        } else {
          message = payload.slotType === "vp" ? "VPカードを獲得しました。" : "開発カードを獲得しました。";
        }
        setFeedback(message);
        await refresh();
      } catch (error) {
        console.error(error);
        setFeedback(
          error instanceof Error ? error.message : "収集アクションの実行に失敗しました。",
      );
      } finally {
        setPendingCollectKey(null);
      }
    },
    [localPlayer?.id, performAction, refresh, setFeedback],
  );

  const formatPrerequisites = useCallback(
    (definition?: GrowthNodeDefinition) => {
      if (!definition) {
        return null;
      }
      const parts: string[] = [];
      if (definition.prerequisitesAny && definition.prerequisitesAny.length > 0) {
        const labels = definition.prerequisitesAny.map((id) =>
          growthNodeMap.get(id)?.position ?? id,
        );
        parts.push(`条件: ${labels.join(', ')}`);
      }
      return parts.length > 0 ? parts.join(' / ') : null;
    },
    [growthNodeMap],
  );
  const completedTasks = useMemo(() => {
    return new Set(localGamePlayer?.tasksCompleted ?? []);
  }, [localGamePlayer?.tasksCompleted]);

  const getTaskRequirementStatus = useCallback(
    (taskId: string) => {
      if (!localGamePlayer) {
        return { met: false, hint: null };
      }
      const effective = effectiveResources ?? localGamePlayer.resources;

      if (!effective) {
        return { met: false, hint: null };
      }
      switch (taskId) {
        case "rainbow": {
          const current = effective.rainbow;
          const required = 5;
          return {
            met: current >= required,
            hint: current >= required
              ? null
              : `虹トークンが ${required} 個必要です（現在 ${current} 個）。`,
          };
        }
        case "light": {
          const current = effective.light;
          const required = 7;
          return {
            met: current >= required,
            hint: current >= required
              ? null
              : `光トークンが ${required} 個必要です（現在 ${current} 個）。`,
          };
        }
        case "lens": {
          const current = effectiveLensCount;
          const required = 3;
          return {
            met: current >= required,
            hint: current >= required
              ? null
              : `完成済みレンズが ${required} 枚必要です（現在 ${current} 枚）。`,
          };
        }
        default:
          return { met: true, hint: null };
      }
    },
    [localGamePlayer, effectiveResources, effectiveLensCount],
  );

  const openTaskRewardDialog = useCallback(
    (taskId: string) => {
      if (!localPlayer?.id) {
        setFeedback("先にロビーでプレイヤーとして参加してください。");
        return;
      }
      if (!gameState?.tasks || !gameState.tasks[taskId]) {
        setFeedback("この課題は現在達成できません。");
        return;
      }
      if (pendingTaskId) {
        return;
      }
      const hasGrowthOption = availableGrowthNodes.length > 0;
      setTaskRewardDialog({
        taskId,
        choice: hasGrowthOption ? "growth" : "lobby",
        nodeId: hasGrowthOption ? availableGrowthNodes[0]?.id : undefined,
      });
      setFeedback(null);
    },
    [localPlayer?.id, gameState?.tasks, pendingTaskId, availableGrowthNodes],
  );

  const confirmTaskReward = useCallback(async () => {
    if (!taskRewardDialog) {
      return;
    }
    if (!localPlayer?.id) {
      setFeedback("先にロビーでプレイヤーとして参加してください。");
      return;
    }
    if (pendingTaskId) {
      return;
    }
    const { taskId, choice, nodeId } = taskRewardDialog;
    if (choice === "growth" && (!nodeId || nodeId.trim().length === 0)) {
      setFeedback("成長させるノードを選択してください。");
      return;
    }
    if (choice === "growth") {
      if (!localGamePlayer?.characterId) {
        setFeedback("キャラクターが未設定です。");
        return;
      }
      const unlockedSet = buildUnlockedSetWithAuto(
        localGamePlayer.characterId,
        localGamePlayer.unlockedCharacterNodes ?? [],
      );
      if (!nodeId || !canUnlockGrowthNode(localGamePlayer.characterId, nodeId, unlockedSet)) {
        setFeedback("成長条件を満たしていません。");
        return;
      }
    }
    setPendingTaskId(taskId);
    setFeedback(null);
    try {
      await performAction({
        action: {
          playerId: localPlayer.id,
          actionType: "task",
          payload: {
            taskId,
            rewardChoice:
              choice === "growth"
                ? { type: "growth", nodeId }
                : { type: "lobby" },
          },
        },
      });
      setFeedback("課題を達成しました。");
      setTaskRewardDialog(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "課題の達成送信に失敗しました";
      setFeedback(message);
    } finally {
      setPendingTaskId(null);
    }
  }, [taskRewardDialog, localPlayer?.id, pendingTaskId, performAction]);

  const cancelTaskReward = useCallback(() => {
    if (pendingTaskId) {
      return;
    }
    setTaskRewardDialog(null);
  }, [pendingTaskId]);

  const taskRewardDialogTask = taskRewardDialog
    ? gameState?.tasks?.[taskRewardDialog.taskId]
    : undefined;
  const growthOptionDisabled = availableGrowthNodes.length === 0;

  const journalSlots = useMemo<JournalSlotData[]>(() => {
    const developmentCards = gameState?.board?.publicDevelopmentCards ?? [];
    const vpCards = gameState?.board?.publicVpCards ?? [];
    const developmentDeckCount = gameState?.developmentDeck.length ?? 0;
    const vpDeckCount = gameState?.vpDeck?.length ?? 0;
    let developmentIndex = 0;
    let vpIndex = 0;

    const resolveCard = (
      rawId: string | null,
      catalogs: Map<string, CatalogDevelopmentCard>[],
    ): CatalogDevelopmentCard | null => {
      if (!rawId) {
        return null;
      }
      const trimmed = rawId.trim();
      for (const catalog of catalogs) {
        if (catalog.size === 0) {
          continue;
        }
        const match = catalog.get(rawId) ?? (trimmed !== rawId ? catalog.get(trimmed) : undefined);
        if (match) {
          return match;
        }
      }
      return null;
    };

    return JOURNAL_SLOT_LAYOUT.map((slot) => {
      if (slot.role === "development") {
        const slotIndex = developmentIndex;
        const cardId = developmentCards[slotIndex] ?? null;
        developmentIndex += 1;
        const card = resolveCard(cardId, [developmentCardCatalog]);
        return { ...slot, cardId, card, slotIndex };
      }

      if (slot.role === "developmentDeck") {
        return { ...slot, cardId: null, count: developmentDeckCount };
      }

      if (slot.role === "vp") {
        const slotIndex = vpIndex;
        const cardId = vpCards[slotIndex] ?? null;
        vpIndex += 1;
        const card = resolveCard(cardId, [vpCardCatalog, developmentCardCatalog]);
        return { ...slot, cardId, card, slotIndex };
      }

      if (slot.role === "vpDeck") {
        return { ...slot, cardId: null, count: vpDeckCount };
      }

      return { ...slot, cardId: null };
    });
  }, [gameState, developmentCardCatalog, vpCardCatalog]);

  const playerColorMap = useMemo(() => {
    const map = new Map<string, string>();
    if (gameState?.players) {
      const playerIds = Object.keys(gameState.players);
      playerIds.forEach((playerId, index) => {
        const player = gameState.players[playerId];
        const characterColor =
          player?.characterId ? getCharacterColor(player.characterId) : undefined;
        const fallbackColor = PLAYER_COLOR_PALETTE[index % PLAYER_COLOR_PALETTE.length];
        map.set(playerId, characterColor ?? fallbackColor);
      });
    }
    return map;
  }, [gameState?.players]);

  const polishDevelopmentOptions = useMemo(
    () =>
      effectiveCollectedDevelopmentCards.map((cardId) => ({
        cardId,
        card: developmentCardCatalog.get(cardId) ?? null,
      })),
    [effectiveCollectedDevelopmentCards, developmentCardCatalog],
  );

  const polishVpOptions = useMemo(
    () =>
      effectiveCollectedVpCards.map((cardId) => ({
        cardId,
        card: vpCardCatalog.get(cardId) ?? developmentCardCatalog.get(cardId) ?? null,
      })),
    [effectiveCollectedVpCards, vpCardCatalog, developmentCardCatalog],
  );

  const labPlacementSummary = useMemo(() => {
    const summary = new Map<string, LabPlacementView[]>();
    if (!gameState?.labPlacements) {
      return summary;
    }
    gameState.labPlacements.forEach(({ labId, playerId, count }) => {
      if (!count || count <= 0) {
        return;
      }
      const player = gameState.players[playerId];
      const name = player?.displayName ?? playerId;
      const list = summary.get(labId) ?? [];
      const existing = list.find((entry) => entry.playerId === playerId);
      const color = playerColorMap.get(playerId);
      if (existing) {
        existing.count += count;
      } else {
        list.push({ playerId, name, count, color });
      }
      summary.set(labId, list);
    });
    return summary;
  }, [gameState?.labPlacements, gameState?.players, playerColorMap]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Kirara Academy メインボード</h1>
          <p className={styles.subtitle}>
            ゲーム進行中の状態を確認し、アクションを送信できます。これはデバッグ用の簡易 UI
            です。
          </p>
        </div>
        <nav className={styles.navLinks}>
          <Link href="/" className={styles.navLink}>
            ロビー
          </Link>
          <Link href="/turn-order" className={styles.navLink}>
            手番順
          </Link>
          <Link href="/character-select" className={styles.navLink}>
            キャラクター
          </Link>
        </nav>
      </header>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>接続情報</h2>
        <form className={styles.form} onSubmit={handleConnect}>
          <label className={styles.label}>
            <span>Functions Base URL</span>
            <input
              className={styles.input}
              value={baseUrlInput}
              onChange={(event) => setBaseUrlInput(event.target.value)}
              placeholder="http://127.0.0.1:5002/PROJECT_ID/us-central1"
            />
          </label>
          <label className={styles.label}>
            <span>Room ID</span>
            <input
              className={styles.input}
              value={roomIdInput}
              onChange={(event) => setRoomIdInput(event.target.value)}
              placeholder="room-xxxx"
            />
          </label>
          <div className={styles.buttonRow}>
            <button
              type="submit"
              className={`${styles.button} ${styles.primary}`}
              disabled={isSubmitting}
            >
              接続
            </button>
            <button
              type="button"
              className={styles.button}
              onClick={() => {
                void refresh();
              }}
              disabled={!isConnected || isSubmitting}
            >
              最新状態を取得
            </button>
            <button
              type="button"
              className={styles.button}
              onClick={() => {
                void disconnect();
              }}
              disabled={!isConnected || isSubmitting}
            >
              切断
            </button>
          </div>
        </form>
        <div className={`${styles.status} ${styles[`status-${status.type}`] ?? ""}`}>
          {status.message}
        </div>
        <div className={styles.sessionMeta}>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>ルーム</span>
            <span className={styles.metaValue}>
              {gameState?.roomId ?? sessionRoomId ?? "未接続"}
            </span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>フェーズ</span>
            <span className={styles.metaValue}>{gameState?.currentPhase ?? "-"}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>ラウンド</span>
            <span className={styles.metaValue}>{gameState?.currentRound ?? "-"}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>現在の手番</span>
            <span className={styles.metaValue}>
              {currentPlayer ? currentPlayer.displayName : "-"}
            </span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>ローカルプレイヤー</span>
            <span className={styles.metaValue}>
              {localPlayer
                ? `${localPlayer.name} (${localPlayer.role === "host" ? "ホスト" : "参加者"})`
                : "未登録"}
            </span>
          </div>
        </div>
        {feedback && <p className={styles.feedback}>{feedback}</p>}
      </section>

      <section className={styles.grid}>
        <div className={`${styles.column} ${styles.playersColumn}`}>
          <h3 className={styles.sectionTitle}>プレイヤー一覧</h3>
          {players.length === 0 ? (
            <p className={styles.muted}>プレイヤーが参加していません。</p>
          ) : (
            <ul className={styles.playerList}>
              {players.map((player) => {
                const isCurrent =
                  currentPlayer?.playerId === player.playerId;
                const isLocal = localPlayer?.id === player.playerId;
                return (
                  <li
                    key={player.playerId}
                    className={`${styles.playerItem} ${
                      isCurrent ? styles.playerItemActive : ""
                    }`}
                  >
                    <div className={styles.playerRow}>
                      <span className={styles.playerName}>
                        {player.displayName}
                      </span>
                      <div className={styles.badgeRow}>
                        {player.isHost && (
                          <span className={`${styles.badge} ${styles.badgeHost}`}>
                            ホスト
                          </span>
                        )}
                        {isLocal && (
                          <span className={`${styles.badge} ${styles.badgeLocal}`}>
                            あなた
                          </span>
                        )}
                        {player.characterId && (
                          <span className={`${styles.badge} ${styles.badgeCharacter}`}>
                            {player.characterId}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={styles.playerStats}>
                      <span>VP: {player.vp}</span>
                      <span>行動力: {player.actionPoints}</span>
                      <span>
                        資源: 光 {player.resources.light} / 虹 {player.resources.rainbow} / 淀み {player.resources.stagnation}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className={`${styles.column} ${styles.sharedColumn}`}>
          <h3 className={styles.sectionTitle}>共有ボード</h3>
          {gameState ? (
            <>
              <div className={styles.boardSection}>
                <div>
                  <h4 className={styles.boardTitle}>公開開発カード</h4>
                  {isLoadingDevelopmentCards && (
                    <p className={styles.muted}>カード情報を取得中です...</p>
                  )}
                  {developmentCardError && (
                    <p className={`${styles.status} ${styles["status-error"]}`}>
                      カード情報の取得に失敗しました: {developmentCardError}
                    </p>
                  )}
                  {gameState.board.publicDevelopmentCards.length === 0 ? (
                    <p className={styles.muted}>カードは公開されていません。</p>
                  ) : (
                    <p className={styles.muted}>
                      公開中の開発カードは研究日誌のカード置き場で確認できます。
                    </p>
                  )}
                </div>
                <div>
                  <h4 className={styles.boardTitle}>公開 VP カード</h4>
                  {isLoadingVpCards && (
                    <p className={styles.muted}>VPカード情報を取得中です...</p>
                  )}
                  {vpCardError && (
                    <p className={`${styles.status} ${styles["status-error"]}`}>
                      VPカード情報の取得に失敗しました: {vpCardError}
                    </p>
                  )}
                  {(gameState.board.publicVpCards ?? []).length === 0 ? (
                    <p className={styles.muted}>VPカードは公開されていません。</p>
                  ) : (
                    <p className={styles.muted}>
                      公開中の VP カードは研究日誌の VP カード置き場で確認できます。
                    </p>
                  )}
                </div>
                <div>
                  <h4 className={styles.boardTitle}>ロビー配置</h4>
                  {gameState.board.lobbySlots.length === 0 ? (
                    <p className={styles.muted}>ロビーは空です。</p>
                  ) : (
                    <ul className={styles.simpleList}>
                      {gameState.board.lobbySlots.map((slot, index) => (
                        <li key={slot.lensId ?? index}>
                          {slot.lensId ?? "-"} : {slot.occupantId ?? "空席"} ({
                            slot.isActive ? "未使用" : "使用済"
                          })
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <article className={`${styles.card} ${styles.labBoard}`}>
                <div className={styles.labHeader}>
                  <div>
                    <h4 className={styles.boardTitle}>ラボ案内図</h4>
                    <p className={styles.boardCaption}>
                      行動力を消費して各設備を利用し、資源獲得や手番調整を行うエリアです。
                    </p>
                  </div>
                </div>
                <div className={styles.labMap}>
                  <div className={styles.labColumn}>
                    {LAB_ACTIONS.filter((action) => action.side === "left").map((action) => (
                      <section key={action.id} className={styles.labCard}>
                        <header className={styles.labCardHeader}>
                          <span className={styles.labName}>{action.name}</span>
                          <span className={styles.labNameEn}>{action.nameEn}</span>
                        </header>
                        <div className={styles.labCardBody}>
                          <p className={styles.labMaterial}>{action.material}</p>
                          <div className={styles.labDetail}>
                            <span className={styles.labDetailLabel}>Cost</span>
                            <ul className={styles.labList}>
                              {action.cost.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          </div>
                          <div className={styles.labDetail}>
                            <span className={styles.labDetailLabel}>Result</span>
                            <ul className={styles.labList}>
                              {action.result.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          </div>
                          <div className={styles.labPlacementSection}>
                            <span className={styles.labDetailLabel}>ロビー配置</span>
                            {(() => {
                              const placements = labPlacementSummary.get(action.id) ?? [];
                              if (placements.length === 0) {
                                return <p className={styles.labPlacementEmpty}>ロビー未配置</p>;
                              }
                              return (
                                <ul className={styles.labPlacementList}>
                                  {placements.map((placement) => (
                                    <li key={placement.playerId} className={styles.labPlacementItem}>
                                      <span className={styles.labPlacementIdentity}>
                                        <span
                                          className={styles.labPlacementDot}
                                          style={{ backgroundColor: placement.color ?? "#94a3b8" }}
                                          aria-hidden="true"
                                        />
                                        <span className={styles.labPlacementName}>{placement.name}</span>
                                      </span>
                                      <span className={styles.labPlacementCount}>×{placement.count}</span>
                                    </li>
                                  ))}
                                </ul>
                              );
                            })()}
                          </div>
                        </div>
                      </section>
                    ))}
                  </div>
                  <div className={styles.labColumn}>
                    {LAB_ACTIONS.filter((action) => action.side === "right").map((action) => (
                      <section key={action.id} className={styles.labCard}>
                        <header className={styles.labCardHeader}>
                          <span className={styles.labName}>{action.name}</span>
                          <span className={styles.labNameEn}>{action.nameEn}</span>
                        </header>
                        <div className={styles.labCardBody}>
                          <p className={styles.labMaterial}>{action.material}</p>
                          <div className={styles.labDetail}>
                            <span className={styles.labDetailLabel}>Cost</span>
                            <ul className={styles.labList}>
                              {action.cost.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          </div>
                          <div className={styles.labDetail}>
                            <span className={styles.labDetailLabel}>Result</span>
                            <ul className={styles.labList}>
                              {action.result.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          </div>
                          <div className={styles.labPlacementSection}>
                            <span className={styles.labDetailLabel}>ロビー配置</span>
                            {(() => {
                              const placements = labPlacementSummary.get(action.id) ?? [];
                              if (placements.length === 0) {
                                return <p className={styles.labPlacementEmpty}>ロビー未配置</p>;
                              }
                              return (
                                <ul className={styles.labPlacementList}>
                                  {placements.map((placement) => (
                                    <li key={placement.playerId} className={styles.labPlacementItem}>
                                      <span className={styles.labPlacementIdentity}>
                                        <span
                                          className={styles.labPlacementDot}
                                          style={{ backgroundColor: placement.color ?? "#94a3b8" }}
                                          aria-hidden="true"
                                        />
                                        <span className={styles.labPlacementName}>{placement.name}</span>
                                      </span>
                                      <span className={styles.labPlacementCount}>×{placement.count}</span>
                                    </li>
                                  ))}
                                </ul>
                              );
                            })()}
                          </div>
                        </div>
                      </section>
                    ))}
                  </div>
                </div>
                <div className={styles.labTasks}>
                  <h5 className={styles.labTasksTitle}>課題ボード</h5>
                  <div className={styles.labTaskRows}>
                    {LAB_TASKS.map((task) => (
                      <div key={task.id} className={styles.labTaskRow}>
                        <div className={`${styles.taskMarker} ${styles[`taskMarker-${task.color}`]}`}>
                          {task.target}
                        </div>
                        <div className={styles.taskInfo}>
                          <span className={styles.taskLabel}>{task.label}</span>
                          <span className={styles.taskDescription}>{task.description}</span>
                          <div className={styles.taskActions}>
                            {(() => {
                              const { met, hint } = getTaskRequirementStatus(task.id);
                              const definitionMissing = !gameState?.tasks?.[task.id];
                              const disabled =
                                isSubmitting ||
                                pendingTaskId === task.id ||
                                completedTasks.has(task.id) ||
                                !localPlayer ||
                                !isConnected ||
                                definitionMissing ||
                                !met ||
                                taskRewardDialog !== null;
                              return (
                                <>
                                  <button
                                    type="button"
                                    className={styles.taskButton}
                                    onClick={() => openTaskRewardDialog(task.id)}
                                    disabled={disabled}
                                  >
                                    {completedTasks.has(task.id)
                                      ? "達成済み"
                                      : pendingTaskId === task.id
                                        ? "送信中..."
                                        : "課題達成"}
                                  </button>
                                  {definitionMissing ? (
                                    <span className={styles.taskHint}>未設定の課題です</span>
                                  ) : !met && hint ? (
                                    <span className={styles.taskHint}>{hint}</span>
                                  ) : null}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </article>

              <article className={`${styles.card} ${styles.journalBoard}`} ref={collectSectionRef}>
                <div className={styles.journalHeader}>
                  <div>
                    <h4 className={styles.boardTitle}>研究日誌</h4>
                    <p className={styles.boardCaption}>
                      公開中の開発カードをノート形式で整理し、進捗を確認できます。
                    </p>
                  </div>
                  <div className={styles.journalMeta}>
                    <span>
                      開発カードスロット {visibleDevelopmentCount} / {JOURNAL_DEVELOPMENT_SLOT_COUNT}
                    </span>
                  </div>
                </div>
                <div className={styles.journalBody}>
                  <div className={styles.journalGrid}>
                    {journalSlots.map((slot) => {
                      const slotRoleClass =
                        (styles as Record<string, string>)[`journalSlot-${slot.role}`] ?? "";
                      const className = [styles.journalSlot, slotRoleClass]
                        .filter((name) => Boolean(name))
                        .join(" ");

                      let bodyContent: JSX.Element = (
                        <span className={styles.journalSlotValue}>未設定</span>
                      );
                      let hint: string | null = null;

                      switch (slot.role) {
                        case "development": {
                          if (slot.cardId && slot.card) {
                            bodyContent = (
                              <DevelopmentCardPreview card={slot.card} />
                            );
                            hint = "公開中の開発カード";
                          } else if (slot.cardId) {
                            const fallbackId = slot.cardId.trim() || slot.cardId;
                            bodyContent = (
                              <span className={styles.journalSlotValue}>{fallbackId}</span>
                            );
                            hint = "カード情報が未登録です";
                          } else {
                            bodyContent = (
                              <span className={styles.journalSlotValue}>空スロット</span>
                            );
                            hint = "補充待ち";
                          }
                          break;
                        }
                        case "developmentDeck": {
                          const remaining = slot.count ?? 0;
                          bodyContent = (
                            <span className={styles.journalSlotValue}>{`残り ${remaining} 枚`}</span>
                          );
                          hint = "公開スロットへ補充する山札";
                          break;
                        }
                        case "vp": {
                          if (slot.card) {
                            bodyContent = (
                              <DevelopmentCardPreview
                                card={slot.card}
                                orientation="right"
                                cardType="vp"
                              />
                            );
                            hint = "公開中の VP カード";
                          } else if (slot.cardId) {
                            const fallbackId = slot.cardId.trim() || slot.cardId;
                            bodyContent = (
                              <span className={styles.journalSlotValue}>{fallbackId}</span>
                            );
                            hint = "VPカード情報が未登録です";
                          } else {
                            bodyContent = (
                              <span className={styles.journalSlotValue}>空スロット</span>
                            );
                            hint = "VPカードを配置してください";
                          }
                          break;
                        }
                        case "vpDeck": {
                          const remaining =
                            typeof slot.count === "number" ? `（残り ${slot.count} 枚）` : "";
                          const value = `VPカード山札${remaining}`;
                          bodyContent = <span className={styles.journalSlotValue}>{value}</span>;
                          hint = "VPカードを引く際に使用します";
                          break;
                        }
                        default: {
                          bodyContent = (
                            <span className={styles.journalSlotValue}>未設定</span>
                          );
                          break;
                        }
                      }

                      const collectDisabled =
                        !localGamePlayer ||
                        !isLocalTurn ||
                        (localGamePlayer.actionPoints ?? 0) < 2 ||
                        pendingCollectKey !== null;

                      return (
                        <div key={slot.position} className={className}>
                          <div className={styles.journalSlotHeader}>
                            <span className={styles.journalSlotIndex}>
                              No.{slot.position.toString().padStart(2, "0")}
                            </span>
                            <span className={styles.journalSlotType}>{slot.label}</span>
                          </div>
                          <div className={styles.journalSlotBody}>
                            {bodyContent}
                            {hint ? (
                              <span className={styles.journalSlotHint}>{hint}</span>
                            ) : null}
                            {slot.role === "development" && slot.cardId && slot.slotIndex != null ? (
                              <button
                                type="button"
                                className={styles.collectButton}
                                disabled={collectDisabled}
                                onClick={() =>
                                  void handleCollect({
                                    slotType: "development",
                                    slotIndex: slot.slotIndex as number,
                                  })
                                }
                              >
                                カードを収集
                              </button>
                            ) : null}
                            {slot.role === "vp" && slot.cardId && slot.slotIndex != null ? (
                              <button
                                type="button"
                                className={styles.collectButton}
                                disabled={collectDisabled}
                                onClick={() =>
                                  void handleCollect({
                                    slotType: "vp",
                                    slotIndex: slot.slotIndex as number,
                                  })
                                }
                              >
                                カードを収集
                              </button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <aside className={styles.journalSidebar}>
                    <h5 className={styles.journalSidebarTitle}>土台カード置き場</h5>
                    <p className={styles.journalSidebarNote}>
                      コスト 0 〜 4 の土台カードを管理します。
                    </p>
                    <ul className={styles.foundationList}>
                      {foundationSupply.map(({ cost, remaining }) => {
                        const key = `foundation-${cost}`;
                        const disabled =
                          !localGamePlayer ||
                          !isLocalTurn ||
                          (localGamePlayer.actionPoints ?? 0) < 2 ||
                          pendingCollectKey !== null ||
                          remaining <= 0;
                        return (
                          <li key={cost} className={styles.foundationItem}>
                            <div className={styles.foundationRow}>
                              <span className={styles.foundationCost}>コスト {cost}</span>
                              <span className={styles.foundationRemaining}>残り {remaining} 枚</span>
                            </div>
                            <button
                              type="button"
                              className={styles.collectButton}
                              disabled={disabled}
                              onClick={() =>
                                void handleCollect({ slotType: "foundation", foundationCost: cost })
                              }
                            >
                              {pendingCollectKey === key ? "処理中..." : "土台を収集"}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </aside>
                </div>
              </article>

              <article className={`${styles.card} ${styles.characterCard}`}>
                <div className={styles.boardPreviewHeader}>
                  <h4 className={styles.boardTitle}>自分のキャラクターボード</h4>
                  <p className={styles.boardCaption}>
                    ラウンド中に参照しやすいよう、現在の成長状況とステータスをまとめました。
                  </p>
                </div>
                {localGamePlayer ? (
                  <div className={styles.characterContent}>
                    <div className={styles.characterHeader}>
                      <span className={styles.characterPlayer}>
                        {localGamePlayer.displayName}
                      </span>
                      <span className={styles.characterRole}>
                        {localPlayer?.role === "host" ? "ホスト" : "参加者"}
                      </span>
                    </div>
                    <div className={styles.characterMeta}>
                      <span className={styles.characterLabel}>キャラクター</span>
                      <span className={styles.characterValue}>
                        {localCharacterProfile
                          ? `${localCharacterProfile.name}（${localCharacterProfile.title}）`
                          : localGamePlayer.characterId ?? "未選択"}
                      </span>
                    </div>
                    <div className={styles.characterMeta}>
                      <span className={styles.characterLabel}>VP</span>
                      <span className={styles.characterValue}>
                        {localGamePlayer.vp}
                      </span>
                    </div>
                    <div className={styles.characterMeta}>
                      <span className={styles.characterLabel}>創造力 / 行動力</span>
                      <span className={styles.characterValue}>
                        {localGamePlayer.creativity} / {localGamePlayer.actionPoints}
                      </span>
                    </div>
                    <div className={styles.characterMeta}>
                      <span className={styles.characterLabel}>資源</span>
                      <span className={styles.characterValue}>
                        光 {effectiveResources?.light ?? localGamePlayer.resources.light}
                        {" / "}
                        虹 {effectiveResources?.rainbow ?? localGamePlayer.resources.rainbow}
                        {" / 淀み "}
                        {localGamePlayer.resources.stagnation}
                      </span>
                    </div>
                    <div className={styles.characterMeta}>
                      <span className={styles.characterLabel}>ロビー管理</span>
                      <span className={styles.characterValue}>
                        ストック {lobbySummary.reserve} ｜ ロビー 未使用 {lobbySummary.handUnused} / 使用済み{" "}
                        {lobbySummary.handUsed} ｜ レンズ 使用 {lobbySummary.boardActive + lobbySummary.boardFatigued}（未使用 {lobbySummary.boardActive} / 使用済み {lobbySummary.boardFatigued}） ｜ ラボ配置{" "}
                        {lobbySummary.labCommitted}
                      </span>
                    </div>
                    <div className={styles.characterMeta}>
                      <span className={styles.characterLabel}>開放ノード</span>
                      <span className={styles.characterValue}>
                        {(localGamePlayer.unlockedCharacterNodes?.length ?? 0).toString()}
                      </span>
                    </div>
                    <div className={styles.collectedSection}>
                      <h5 className={styles.collectedHeading}>獲得済みカード</h5>
                      <div className={styles.collectedColumns}>
                        <section className={styles.collectedColumn}>
                          <header className={styles.collectedSummary}>
                            開発カード {polishDevelopmentOptions.length} 枚
                          </header>
                          {polishDevelopmentOptions.length === 0 ? (
                            <p className={styles.collectedEmpty}>まだ獲得していません。</p>
                          ) : (
                            <div className={styles.collectedCardGrid}>
                              {polishDevelopmentOptions.map(({ cardId, card }) => (
                                <div
                                  key={`collected-dev-${cardId}`}
                                  className={`${styles.journalSlot} ${styles.collectedCardFrame}`}
                                >
                                  <div className={styles.journalSlotHeader}>
                                    <span className={styles.journalSlotIndex}>DEV</span>
                                    <span className={styles.journalSlotType}>獲得カード</span>
                                  </div>
                                  <div className={styles.journalSlotBody}>
                                    {card ? (
                                      <DevelopmentCardPreview card={card} />
                                    ) : (
                                      <span className={styles.collectedFallback}>{cardId}</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </section>
                        <section className={styles.collectedColumn}>
                          <header className={styles.collectedSummary}>
                            土台カード {totalCollectedFoundation} 枚
                          </header>
                          {totalCollectedFoundation === 0 ? (
                            <p className={styles.collectedEmpty}>まだ獲得していません。</p>
                          ) : (
                            <ul className={styles.foundationInventoryList}>
                              {collectedFoundationEntries.map((entry) =>
                                entry.count > 0 ? (
                                  <li
                                    key={`collected-foundation-${entry.cost}`}
                                    className={styles.foundationInventoryItem}
                                  >
                                    <span className={styles.foundationInventoryCost}>
                                      コスト {entry.cost}
                                    </span>
                                    <span className={styles.foundationInventoryCount}>
                                      {entry.count} 枚
                                    </span>
                                  </li>
                                ) : null,
                              )}
                            </ul>
                        )}
                      </section>
                      <section className={styles.collectedColumn}>
                        <header className={styles.collectedSummary}>
                          VPカード {polishVpOptions.length} 枚
                          </header>
                          {polishVpOptions.length === 0 ? (
                            <p className={styles.collectedEmpty}>まだ獲得していません。</p>
                          ) : (
                            <div className={styles.collectedCardGrid}>
                              {polishVpOptions.map(({ cardId, card }) => (
                                <div
                                  key={`collected-vp-${cardId}`}
                                  className={`${styles.journalSlot} ${styles.collectedCardFrame}`}
                                >
                                  <div className={styles.journalSlotHeader}>
                                    <span className={styles.journalSlotIndex}>VP</span>
                                    <span className={styles.journalSlotType}>獲得カード</span>
                                  </div>
                                  <div className={styles.journalSlotBody}>
                                    {card ? (
                                      <DevelopmentCardPreview
                                        card={card}
                                        orientation="right"
                                        cardType="vp"
                                      />
                                    ) : (
                                      <span className={styles.collectedFallback}>{cardId}</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </section>
                        <section className={styles.collectedColumn}>
                          <header className={styles.collectedSummary}>
                            完成レンズ {effectiveCraftedLenses.length} 枚
                          </header>
                          {effectiveCraftedLenses.length > 0 ? (
                            <div className={styles.craftedLensGrid}>
                              {effectiveCraftedLenses.map((lens) => (
                                <CraftedLensPreview
                                  key={lens.lensId}
                                  lens={lens}
                                  className={styles.craftedLensCard}
                                  ownerName={localGamePlayer?.displayName ?? localGamePlayer?.playerId}
                                  getCard={getCardDefinition}
                                />
                              ))}
                            </div>
                          ) : (
                            <p className={styles.collectedEmpty}>まだ作成していません。</p>
                          )}
                        </section>
                        <section className={styles.collectedColumn}>
                          <header className={styles.collectedSummary}>
                            全プレイヤーの完成レンズ {allCraftedLenses.length} 枚
                          </header>
                          {allCraftedLenses.length > 0 ? (
                            <div className={styles.craftedLensGrid}>
                              {allCraftedLenses.map(({ lens, ownerId, ownerName }) => (
                                <div key={`all-lens-${lens.lensId}`} className={styles.craftedLensCard}>
                                  <div className={styles.journalSlotHeader}>
                                    <span className={styles.journalSlotIndex}>LP</span>
                                    <span className={styles.journalSlotType}>
                                      所有者: {ownerName ?? ownerId}
                                    </span>
                                  </div>
                                  <CraftedLensPreview
                                    lens={lens}
                                    getCard={getCardDefinition}
                                    ownerName={ownerName ?? ownerId}
                                  />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className={styles.collectedEmpty}>公開済みの完成レンズがありません。</p>
                          )}
                        </section>
                      </div>
                    </div>
                    {localCharacterProfile ? (
                      <>
                        <p className={styles.characterOverview}>
                          {localCharacterProfile.overview}
                        </p>
                        {growthNodesWithStatus.length > 0 ? (
                          <div className={styles.growthSection}>
                            <h5 className={styles.growthTitle}>成長能力一覧</h5>
                            <ul className={styles.growthList}>
                              {growthNodesWithStatus.map((node) => (
                                <li
                                  key={node.id}
                                  className={`${styles.growthItem} ${
                                    node.isUnlocked
                                      ? styles.growthItemUnlocked
                                      : styles.growthItemLocked
                                  }`}
                                >
                                  <div className={styles.growthHeader}>
                                    <span className={styles.growthPosition}>{node.position}</span>
                                    <span className={styles.growthName}>{node.name}</span>
                                    <span
                                      className={`${styles.growthStatus} ${
                                        node.isUnlocked
                                          ? styles.growthStatusUnlocked
                                          : styles.growthStatusLocked
                                      }`}
                                    >
                                      {node.isUnlocked ? "解放済み" : "未解放"}
                                    </span>
                                  </div>
                                  <p className={styles.growthDescription}>{node.description}</p>
                                  {!node.isUnlocked ? (
                                    <p className={styles.growthPrereq}>
                                      {formatPrerequisites(node.definition) ?? "条件なし"}
                                    </p>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                    ) : (
                          <p className={styles.muted}>
                            このキャラクターの成長能力データはまだ登録されていません。
                          </p>
                        )}
                      </>
                    ) : null}
                    {playerActionsByCategory.length > 0 ? (
                      <div className={styles.playerActionsSection}>
                        <div className={styles.playerActionsHeader}>
                          <h5 className={styles.playerActionsTitle}>行動メニュー</h5>
                          <p className={styles.playerActionsCaption}>
                            行動可能な選択肢と条件を一覧で確認できます。条件を満たすと実行ボタンが有効になります。
                          </p>
                        </div>
                        <div className={styles.playerActionGroups}>
                          {playerActionsByCategory.map((group) => {
                            const availableCount = group.actions.filter(
                              (action) => action.available,
                            ).length;
                            return (
                              <section key={group.category} className={styles.playerActionGroup}>
                                <div className={styles.playerActionGroupHeader}>
                                  <h6 className={styles.playerActionGroupLabel}>{group.label}</h6>
                                  <span className={styles.playerActionGroupCount}>
                                    {availableCount} / {group.actions.length} 実行可能
                                  </span>
                                </div>
                                <div className={styles.playerActionGrid}>
                                  {group.actions.map((action) => {
                                    const cardClass = classNames(
                                      styles.playerActionCard,
                                      action.available
                                        ? styles.playerActionCardAvailable
                                        : styles.playerActionCardDisabled,
                                      action.available && action.highlight === "primary"
                                        ? styles.playerActionCardHighlightPrimary
                                        : undefined,
                                      action.available && action.highlight === "warning"
                                        ? styles.playerActionCardHighlightWarning
                                        : undefined,
                                    );
                                    const badgeClass = classNames(
                                      styles.playerActionStatus,
                                      action.available
                                        ? styles.playerActionStatusAvailable
                                        : styles.playerActionStatusBlocked,
                                    );
                                    const implemented = action.implemented !== false;
                                    const hasPolishSources =
                                      action.id !== "polish" ||
                                      polishDevelopmentOptions.length > 0 ||
                                      polishVpOptions.length > 0;
                                    const hasLensActivateSources =
                                      action.id !== "lens-activate" || lensActivateTargets.length > 0;
                                    const hasRefreshSources =
                                      action.id !== "restart" || exhaustedLensTargets.length > 0;
                                    const buttonDisabled =
                                      !action.available ||
                                      action.implemented === false ||
                                      !hasPolishSources ||
                                      !hasLensActivateSources ||
                                      !hasRefreshSources ||
                                      pendingActionId === action.id;
                                    const handleActionClick = () => {
                                      if (action.implemented === false) {
                                        setFeedback("この行動は現在準備中です。");
                                        return;
                                      }
                                      if (action.id === "collect") {
                                        scrollIntoViewIfPossible(collectSectionRef.current);
                                      }
                                      if (action.id === "polish") {
                                        openPolishDialog();
                                      } else if (action.id === "will") {
                                        openWillDialog();
                                      } else if (action.id === "lens-activate") {
                                        openLensActivateDialog();
                                      } else if (action.id === "restart") {
                                        openRefreshDialog();
                                      } else if (action.id === "persuasion") {
                                        openPersuasionDialog();
                                      } else if (action.id === "pass") {
                                        void handleSubmitPass();
                                      } else if (LAB_ACTION_LOOKUP.has(action.id)) {
                                        openLabConfirmDialog(action.id);
                                      }
                                    };
                                    return (
                                      <div key={action.id} className={cardClass}>
                                        <div className={styles.playerActionHeader}>
                                          <span className={styles.playerActionName}>
                                            {action.label}
                                          </span>
                                          <span className={badgeClass}>
                                            {action.available
                                              ? "実行可能"
                                              : action.reason ?? "条件不足"}
                                          </span>
                                        </div>
                                        <p className={styles.playerActionSummary}>
                                          {action.summary}
                                        </p>
                                        <p className={styles.playerActionDescription}>
                                          {action.description}
                                        </p>
                                        {!action.available && action.reason ? (
                                          <p className={styles.playerActionHint}>
                                            不足: {action.reason}
                                          </p>
                                        ) : null}
                                        {action.id === "polish" && implemented && !hasPolishSources ? (
                                          <p className={styles.playerActionHint}>
                                            獲得済みのカードがありません。
                                          </p>
                                        ) : null}
                                        {action.id === "lens-activate" &&
                                        implemented &&
                                        !hasLensActivateSources ? (
                                          <p className={styles.playerActionHint}>
                                            起動できるレンズがありません。
                                          </p>
                                        ) : null}
                                        {action.id === "restart" && implemented && !hasRefreshSources ? (
                                          <p className={styles.playerActionHint}>
                                            再起動できるレンズがありません。
                                          </p>
                                        ) : null}
                                        {action.implemented === false ? (
                                          <p className={styles.playerActionHint}>この行動は現在準備中です。</p>
                                        ) : null}
                                        <div className={styles.playerActionFooter}>
                                          <button
                                            type="button"
                                            className={styles.playerActionButton}
                                            disabled={buttonDisabled}
                                            onClick={handleActionClick}
                                          >
                                            行動を選択
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </section>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                    {debugEnabled && localGamePlayer ? (
                      <details className={styles.debugPanel}>
                        <summary>デバッグ調整</summary>
                        <div className={styles.debugControls}>
                          <div className={styles.debugRow}>
                            <span>虹トークン</span>
                            <div className={styles.debugButtonRow}>
                              <button
                                type="button"
                                className={styles.debugButton}
                                onClick={() => void handleAdjustDebug("rainbow", -1)}
                              >
                                -1
                              </button>
                              <button
                                type="button"
                                className={styles.debugButton}
                                onClick={() => void handleAdjustDebug("rainbow", 1)}
                              >
                                +1
                              </button>
                              <button
                                type="button"
                                className={styles.debugButton}
                                onClick={() => void handleAdjustDebug("rainbow", 5)}
                              >
                                +5
                              </button>
                              <span className={styles.debugValue}>
                                現在 {effectiveResources?.rainbow ?? localGamePlayer.resources.rainbow}
                              </span>
                            </div>
                          </div>
                          <div className={styles.debugRow}>
                            <span>光トークン</span>
                            <div className={styles.debugButtonRow}>
                              <button
                                type="button"
                                className={styles.debugButton}
                                onClick={() => void handleAdjustDebug("light", -1)}
                              >
                                -1
                              </button>
                              <button
                                type="button"
                                className={styles.debugButton}
                                onClick={() => void handleAdjustDebug("light", 1)}
                              >
                                +1
                              </button>
                              <button
                                type="button"
                                className={styles.debugButton}
                                onClick={() => void handleAdjustDebug("light", 5)}
                              >
                                +5
                              </button>
                              <span className={styles.debugValue}>
                                現在 {effectiveResources?.light ?? localGamePlayer.resources.light}
                              </span>
                            </div>
                          </div>
                          <div className={styles.debugRow}>
                            <span>完成レンズ</span>
                            <div className={styles.debugButtonRow}>
                              <button
                                type="button"
                                className={styles.debugButton}
                                onClick={() => void handleAdjustDebug("lens", -1)}
                              >
                                -1
                              </button>
                              <button
                                type="button"
                                className={styles.debugButton}
                                onClick={() => void handleAdjustDebug("lens", 1)}
                              >
                                +1
                              </button>
                              <span className={styles.debugValue}>現在 {effectiveLensCount}</span>
                            </div>
                          </div>
                        </div>
                      </details>
                    ) : null}
                  </div>
                ) : (
                  <p className={styles.muted}>
                    自分のキャラクターはまだ選択されていません。キャラクター選択後にステータスが表示されます。
                  </p>
                )}
              </article>
            </>
          ) : (
            <p className={styles.muted}>未接続のためデータがありません。</p>
          )}
        </div>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>アクション</h2>
        <p className={styles.description}>
          行動メニューから実行条件を確認できます。研磨は詳細設定ダイアログを利用して準備できます。
        </p>
        <div className={styles.buttonRow}>
          <button
            type="button"
            className={`${styles.button} ${styles.primary}`}
            onClick={() => {
              void handlePass();
            }}
            disabled={!isConnected || isSubmitting || !isLocalTurn}
          >
            パスする
          </button>
          {!isLocalTurn && (
            <span className={styles.inlineHint}>
              現在の手番ではありません。手番が来ると有効になります。
            </span>
          )}
        </div>
        <details className={styles.stateDetails}>
          <summary>GameState の詳細を表示</summary>
          <pre className={styles.stateViewer}>
            {JSON.stringify(gameState, null, 2)}
          </pre>
        </details>
      </section>

      {labConfirmDialog ? (
        <div
          className={styles.actionConfirmOverlay}
          role="dialog"
          aria-modal="true"
          aria-label={`${labConfirmDialog.name}の実行確認`}
          onClick={
            pendingActionId === labConfirmDialog.id ? undefined : () => closeLabConfirmDialog()
          }
        >
          <div
            className={styles.actionConfirmModal}
            role="document"
            onClick={(event) => event.stopPropagation()}
          >
            <h4 className={styles.actionConfirmTitle}>
              {labConfirmDialog.name}を実行しますか？
            </h4>
            <p className={styles.actionConfirmDescription}>{labConfirmDialog.material}</p>
            <div className={styles.actionConfirmSection}>
              <h5 className={styles.actionConfirmHeading}>コスト</h5>
              <ul className={styles.actionConfirmList}>
                {labConfirmDialog.cost.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className={styles.actionConfirmSection}>
              <h5 className={styles.actionConfirmHeading}>効果</h5>
              <ul className={styles.actionConfirmList}>
                {labConfirmDialog.result.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className={styles.actionConfirmActions}>
              <button
                type="button"
                className={styles.actionConfirmButtonSecondary}
                onClick={closeLabConfirmDialog}
                disabled={pendingActionId === labConfirmDialog.id}
              >
                キャンセル
              </button>
              <button
                type="button"
                className={styles.actionConfirmButtonPrimary}
                onClick={() => void handleExecuteLab(labConfirmDialog.id)}
                disabled={pendingActionId === labConfirmDialog.id}
              >
                {pendingActionId === labConfirmDialog.id ? "実行中..." : "実行する"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isWillDialogOpen ? (
        <div
          className={styles.willOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="意思能力の選択"
          onClick={isWillSubmitting ? undefined : closeWillDialog}
        >
          <div
            className={styles.willModal}
            role="document"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.willHeader}>
              <h4>意思能力を選択</h4>
              <button
                type="button"
                className={styles.willCloseButton}
                onClick={closeWillDialog}
                aria-label="閉じる"
                disabled={isWillSubmitting}
              >
                ×
              </button>
            </div>
            <p className={styles.willHelp}>起動する意思能力を選択してください。</p>
            <div
              className={styles.willList}
              role="radiogroup"
              aria-label="意思能力の選択肢"
            >
              {availableWillNodes.length > 0 ? (
                availableWillNodes.map((node) => {
                  const checked = selectedWillNodeId === node.id;
                  return (
                    <label
                      key={node.id}
                      className={classNames(
                        styles.willOption,
                        checked ? styles.willOptionActive : undefined,
                      )}
                    >
                      <input
                        type="radio"
                        name="willAbility"
                        value={node.id}
                        checked={checked}
                        onChange={() => setSelectedWillNodeId(node.id)}
                        disabled={isWillSubmitting}
                      />
                      <div>
                        <span className={styles.willAbilityTitle}>
                          {node.position} {node.name}
                        </span>
                        <p className={styles.willAbilityDescription}>{node.description}</p>
                      </div>
                    </label>
                  );
                })
              ) : (
                <p className={styles.willEmpty}>使用可能な意思能力がありません。</p>
              )}
            </div>
            <div className={styles.willFooter}>
              <button
                type="button"
                className={styles.willSecondaryButton}
                onClick={closeWillDialog}
                disabled={isWillSubmitting}
              >
                キャンセル
              </button>
              <button
                type="button"
                className={styles.willPrimaryButton}
                onClick={() => void handleSubmitWill()}
                disabled={
                  isWillSubmitting || !selectedWillNodeId || availableWillNodes.length === 0
                }
              >
                {isWillSubmitting ? "送信中..." : "意思を実行"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isLensActivateDialogOpen ? (
        <div
          className={styles.willOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="レンズ起動"
          onClick={isLensActivateSubmitting ? undefined : closeLensActivateDialog}
        >
          <div
            className={styles.willModal}
            role="document"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.willHeader}>
              <h4>レンズを起動</h4>
              <button
                type="button"
                className={styles.willCloseButton}
                onClick={closeLensActivateDialog}
                aria-label="閉じる"
                disabled={isLensActivateSubmitting}
              >
                ×
              </button>
            </div>
            <p className={styles.willHelp}>自分のレンズから起動するものを選択してください。</p>
            <div
              className={styles.willList}
              role="radiogroup"
              aria-label="起動するレンズ"
            >
              {lensActivateTargets.length > 0 ? (
                lensActivateTargets.map((lens) => {
                  const checked = selectedLensActivateId === lens.lensId;
                  return (
                    <label
                      key={lens.lensId}
                      className={classNames(
                        styles.willOption,
                        checked ? styles.willOptionActive : undefined,
                      )}
                    >
                      <input
                        type="radio"
                        name="lensActivate"
                        value={lens.lensId}
                        checked={checked}
                        onChange={() => setSelectedLensActivateId(lens.lensId)}
                        disabled={isLensActivateSubmitting}
                      />
                      <div>
                        <span className={styles.willAbilityTitle}>
                          レンズ {lens.lensId}
                        </span>
                        <p className={styles.willAbilityDescription}>
                          状態: {lens.status === "available" ? "使用可能" : lens.status}
                        </p>
                      </div>
                    </label>
                  );
                })
              ) : (
                <p className={styles.willAbilityDescription}>起動できるレンズがありません。</p>
              )}
            </div>
            <div className={styles.actionConfirmSection}>
              <h5 className={styles.actionConfirmHeading}>起動コスト</h5>
              <ul className={styles.actionConfirmList}>
                {lensActivateCostDescriptions.length > 0 ? (
                  lensActivateCostDescriptions.map((item) => <li key={item}>{item}</li>)
                ) : (
                  <li>追加コストなし</li>
                )}
              </ul>
            </div>
            <div className={styles.actionConfirmSection}>
              <h5 className={styles.actionConfirmHeading}>獲得効果</h5>
              <ul className={styles.actionConfirmList}>
                {lensActivateRewardDescriptions.length > 0 ? (
                  lensActivateRewardDescriptions.map((item) => <li key={item}>{item}</li>)
                ) : (
                  <li>即時効果なし</li>
                )}
              </ul>
            </div>
            {renderGrowthSelector(
              lensActivateGrowthNeeded,
              lensActivateGrowthSelections,
              setLensActivateGrowthSelections,
              "lens-activate",
            )}
            <div className={styles.willFooter}>
              <button
                type="button"
                className={styles.willSecondaryButton}
                onClick={closeLensActivateDialog}
                disabled={isLensActivateSubmitting}
              >
                キャンセル
              </button>
              <button
                type="button"
                className={styles.willPrimaryButton}
                onClick={() => void handleSubmitLensActivate()}
                disabled={
                isLensActivateSubmitting || lensActivateTargets.length === 0 || !selectedLensActivateTarget
                }
              >
                {isLensActivateSubmitting ? "送信中..." : "起動する"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isRefreshDialogOpen ? (
        <div
          className={styles.willOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="レンズ再起動"
          onClick={isRefreshSubmitting ? undefined : closeRefreshDialog}
        >
          <div
            className={styles.willModal}
            role="document"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.willHeader}>
              <h4>レンズを再起動</h4>
              <button
                type="button"
                className={styles.willCloseButton}
                onClick={closeRefreshDialog}
                aria-label="閉じる"
                disabled={isRefreshSubmitting}
              >
                ×
              </button>
            </div>
            <p className={styles.willHelp}>使用済みの自分のレンズを選んで再起動します。</p>
            <div
              className={styles.willList}
              role="radiogroup"
              aria-label="再起動するレンズ"
            >
              {exhaustedLensTargets.length > 0 ? (
                exhaustedLensTargets.map((lens) => {
                  const checked = selectedRefreshLensId === lens.lensId;
                  return (
                    <label
                      key={lens.lensId}
                      className={classNames(
                        styles.willOption,
                        checked ? styles.willOptionActive : undefined,
                      )}
                    >
                      <input
                        type="radio"
                        name="lensRefresh"
                        value={lens.lensId}
                        checked={checked}
                        onChange={() => setSelectedRefreshLensId(lens.lensId)}
                        disabled={isRefreshSubmitting}
                      />
                      <div>
                        <span className={styles.willAbilityTitle}>レンズ {lens.lensId}</span>
                        <p className={styles.willAbilityDescription}>
                          所有者: {lens.ownerName ?? "あなた"} / ロビー:{" "}
                          {lens.slotActive ? "未使用" : "使用済み"}
                        </p>
                      </div>
                    </label>
                  );
                })
              ) : (
                <p className={styles.willAbilityDescription}>再起動できるレンズがありません。</p>
              )}
            </div>
            <div className={styles.actionConfirmSection}>
              <h5 className={styles.actionConfirmHeading}>必要コスト</h5>
              <ul className={styles.actionConfirmList}>
                <li>行動力 3</li>
              </ul>
            </div>
            <div className={styles.actionConfirmSection}>
              <h5 className={styles.actionConfirmHeading}>効果</h5>
              <ul className={styles.actionConfirmList}>
                <li>選択したレンズを再び使用可能にします。</li>
              </ul>
            </div>
            {renderGrowthSelector(
              refreshGrowthNeeded,
              refreshGrowthSelections,
              setRefreshGrowthSelections,
              "refresh",
            )}
            <div className={styles.willFooter}>
              <button
                type="button"
                className={styles.willSecondaryButton}
                onClick={closeRefreshDialog}
                disabled={isRefreshSubmitting}
              >
                キャンセル
              </button>
              <button
                type="button"
                className={styles.willPrimaryButton}
                onClick={() => void handleSubmitRefresh()}
                disabled={
                  isRefreshSubmitting ||
                  exhaustedLensTargets.length === 0 ||
                  !selectedRefreshTarget
                }
              >
                {isRefreshSubmitting ? "送信中..." : "再起動する"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isPersuasionDialogOpen ? (
        <div
          className={styles.willOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="説得の対象を選択"
          onClick={isPersuasionSubmitting ? undefined : closePersuasionDialog}
        >
          <div
            className={styles.willModal}
            role="document"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.willHeader}>
              <h4>説得の対象レンズを選択</h4>
              <button
                type="button"
                className={styles.willCloseButton}
                onClick={closePersuasionDialog}
                aria-label="閉じる"
                disabled={isPersuasionSubmitting}
              >
                ×
              </button>
            </div>
            <p className={styles.willHelp}>
              相手のロビーが配置されたレンズを選び、起動コストを支払って効果を得ます。
            </p>
            <div
              className={styles.willList}
              role="radiogroup"
              aria-label="説得対象レンズ"
            >
              {lensOpponentTargets.length > 0 ? (
                lensOpponentTargets.map((target) => {
                  const checked = selectedPersuasionLensId === target.lensId;
                  return (
                    <label
                      key={target.lensId}
                      className={classNames(
                        styles.willOption,
                        checked ? styles.willOptionActive : undefined,
                      )}
                    >
                      <input
                        type="radio"
                        name="persuasionLens"
                        value={target.lensId}
                        checked={checked}
                        onChange={() => setSelectedPersuasionLensId(target.lensId)}
                        disabled={isPersuasionSubmitting}
                      />
                      <div>
                        <span className={styles.willAbilityTitle}>
                          レンズ {target.lensId}（所有者: {target.ownerName}）
                        </span>
                        <p className={styles.willAbilityDescription}>
                          ロビー配置: {target.occupantName} / 状態:{" "}
                          {target.slotActive ? "未使用" : "使用済み"}
                        </p>
                      </div>
                    </label>
                  );
                })
              ) : (
                <p className={styles.willAbilityDescription}>説得できるレンズがありません。</p>
              )}
            </div>
            <div className={styles.actionConfirmSection}>
              <h5 className={styles.actionConfirmHeading}>起動コスト</h5>
              <ul className={styles.actionConfirmList}>
                {persuasionLensCostDescriptions.length > 0 ? (
                  persuasionLensCostDescriptions.map((item) => <li key={item}>{item}</li>)
                ) : (
                  <li>追加コストなし</li>
                )}
              </ul>
            </div>
            <div className={styles.actionConfirmSection}>
              <h5 className={styles.actionConfirmHeading}>獲得効果</h5>
              <ul className={styles.actionConfirmList}>
                {persuasionLensRewardDescriptions.length > 0 ? (
                  persuasionLensRewardDescriptions.map((item) => <li key={item}>{item}</li>)
                ) : (
                  <li>即時効果なし</li>
                )}
              </ul>
            </div>
            {renderGrowthSelector(
              persuasionGrowthNeeded,
              persuasionGrowthSelections,
              setPersuasionGrowthSelections,
              "persuasion",
            )}
            <div className={styles.willFooter}>
              <button
                type="button"
                className={styles.willSecondaryButton}
                onClick={closePersuasionDialog}
                disabled={isPersuasionSubmitting}
              >
                キャンセル
              </button>
              <button
                type="button"
                className={styles.willPrimaryButton}
                onClick={() => void handleSubmitPersuasion()}
                disabled={
                  isPersuasionSubmitting ||
                  lensOpponentTargets.length === 0 ||
                  !selectedPersuasionTarget
                }
              >
                {isPersuasionSubmitting ? "送信中..." : "説得を実行"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isPolishDialogOpen && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="研磨アクション">
          <div className={styles.polishModal}>
            <div className={styles.polishModalHeader}>
              <h4>研磨アクション</h4>
              <button
                type="button"
                className={styles.polishCloseButton}
                onClick={closePolishDialog}
                aria-label="閉じる"
              >
                ×
              </button>
            </div>
            <div className={styles.polishModalBody}>
              <p className={styles.polishSummaryHint}>
                必要土台コスト: {polishSummary.foundationRequirement}
              </p>
              {polishSummary.positionConflict ? (
                <p className={styles.polishWarning}>
                  左右それぞれで同じPOSを使用しないようにしてください。
                </p>
              ) : null}
              {polishSelectionDetails.length > 0 && !polishSummary.foundationMet ? (
                <p className={styles.polishWarning}>
                  土台カードのコストが不足しています（必要 {polishSummary.foundationRequirement}）。
                </p>
              ) : null}
              <div className={styles.polishColumns}>
                <section className={styles.polishSection}>
                  <h6>手札の開発カード</h6>
                  {polishDevelopmentOptions.length === 0 ? (
                    <p className={styles.polishEmpty}>獲得済みの開発カードがありません。</p>
                  ) : (
                    <ul className={styles.polishOptionList}>
                      {polishDevelopmentOptions.map(({ cardId, card }) => {
                        const entry = polishSelectionMap[cardId];
                        const selected = Boolean(entry);
                        const orientationRight = Boolean(entry?.flipped);
                        const orientationLabel = orientationRight ? "左側で使用" : "右側で使用";
                        return (
                          <li key={`dev-${cardId}`} className={styles.polishOptionItem}>
                            <div className={styles.polishOptionHeader}>
                              <label className={styles.polishOptionLabel}>
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => handleTogglePolishCard(cardId, "development")}
                                />
                                <span>{card?.cardId ?? cardId}</span>
                              </label>
                              {selected ? (
                                <button
                                  type="button"
                                  className={styles.polishToggleButton}
                                  onClick={() => handleTogglePolishFlip(cardId)}
                                >
                                  {orientationLabel}
                                </button>
                              ) : null}
                            </div>
                            {card ? (
                              <div className={styles.polishOptionPreview}>
                                <DevelopmentCardPreview
                                  card={card}
                                  orientation={orientationRight ? "right" : "left"}
                                />
                              </div>
                            ) : (
                              <p className={styles.polishWarning}>カード情報が未登録です。</p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
                <section className={styles.polishSection}>
                  <h6>利用可能な VP カード</h6>
                  {polishVpOptions.length === 0 ? (
                    <p className={styles.polishEmpty}>獲得済みの VP カードがありません。</p>
                  ) : (
                    <ul className={styles.polishOptionList}>
                      {polishVpOptions.map(({ cardId, card }) => {
                        const entry = polishSelectionMap[cardId];
                        const selected = Boolean(entry);
                        return (
                          <li key={`vp-${cardId}`} className={styles.polishOptionItem}>
                            <div className={styles.polishOptionHeader}>
                              <label className={styles.polishOptionLabel}>
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => handleTogglePolishCard(cardId, "vp")}
                                />
                                <span>{card?.cardId ?? cardId}</span>
                              </label>
                            </div>
                            {card ? (
                              <div className={styles.polishOptionPreview}>
                                <DevelopmentCardPreview card={card} orientation="right" cardType="vp" />
                              </div>
                            ) : (
                              <p className={styles.polishWarning}>カード情報が未登録です。</p>
                            )}
                            {selected ? (
                              <p className={styles.polishHint}>VPカードは右側で使用します。</p>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              </div>
              <section className={styles.polishSection}>
                <h6>選択したカード</h6>
                {polishSelectionDetails.length === 0 ? (
                  <p className={styles.polishEmpty}>カードを選択してください。</p>
                ) : (
                  <ul className={styles.polishSelectionList}>
                    {polishSelectionDetails.map((detail) => {
                      const useRight = detail.type === "vp" || detail.flipped;
                      return (
                        <li key={`sel-${detail.cardId}`} className={styles.polishSelectionItem}>
                          <div className={styles.polishSelectionHeader}>
                            <div>
                              <strong>{detail.card?.cardId ?? detail.cardId}</strong>
                              <span className={styles.polishSelectionMeta}>
                                {detail.type === "vp" ? "VPカード" : "開発カード"}
                                {useRight ? "（右側配置）" : "（左側配置）"}
                              </span>
                            </div>
                          </div>
                          {detail.card ? (
                            <div className={styles.polishSelectionPreview}>
                              <DevelopmentCardPreview
                                card={detail.card}
                                orientation={useRight ? "right" : "left"}
                                cardType={detail.type}
                              />
                            </div>
                          ) : (
                            <p className={styles.polishWarning}>カード情報が未登録です。</p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
              {polishSummary.lensResult ? (
                <section className={styles.polishSection}>
                  <h6>完成レンズプレビュー</h6>
                  <CraftedLensPreview
                    lens={polishSummary.lensResult}
                    getCard={getCardDefinition}
                    ownerName={localGamePlayer?.displayName ?? localGamePlayer?.playerId}
                  />
                </section>
              ) : null}
              <section className={styles.polishSection}>
                <h6>土台カードの選択</h6>
                {collectedFoundationEntries.some((entry) => entry.count > 0) ? (
                  <div className={styles.polishFoundationList} role="radiogroup" aria-label="土台カード">
                    {collectedFoundationEntries.map((entry) => {
                      const disabled = entry.count <= 0;
                      const checked = polishFoundationChoice === entry.cost;
                      return (
                        <label
                          key={entry.cost}
                          className={classNames(
                            styles.polishFoundationOption,
                            checked ? styles.polishFoundationOptionActive : undefined,
                            disabled ? styles.polishFoundationOptionDisabled : undefined,
                          )}
                        >
                          <input
                            type="radio"
                            name="polishFoundation"
                            value={entry.cost}
                            disabled={disabled}
                            checked={checked}
                            onChange={() => handleSelectPolishFoundation(entry.cost)}
                          />
                          <div>
                            <span className={styles.polishFoundationLabel}>コスト {entry.cost}</span>
                            <span className={styles.polishFoundationCard}>
                              {entry.count > 0 ? `所持 ${entry.count} 枚` : "未所持"}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className={styles.polishEmpty}>利用可能な土台カードがありません。</p>
                )}
              </section>
            </div>
            <div className={styles.polishModalFooter}>
              <button type="button" className={styles.polishSecondaryButton} onClick={closePolishDialog}>
                キャンセル
              </button>
              <button
                type="button"
                className={styles.polishPrimaryButton}
                onClick={() => void handleSubmitPolish()}
                disabled={!polishSummary.canSubmit}
              >
                {isPolishSubmitting ? "送信中..." : "研磨を実行"}
              </button>
            </div>
          </div>
        </div>
      )}

      {taskRewardDialog && (
        <div className={styles.taskRewardOverlay}>
          <div className={styles.taskRewardModal}>
            <h4 className={styles.taskRewardTitle}>課題報酬を選択</h4>
            <p className={styles.taskRewardDescription}>
              {taskRewardDialogTask?.description ?? `課題ID: ${taskRewardDialog.taskId}`}
            </p>
            <div className={styles.rewardOptionList}>
              <label
                className={`${styles.rewardOption} ${
                  taskRewardDialog.choice === "growth" ? styles.rewardOptionActive : ""
                } ${growthOptionDisabled ? styles.rewardOptionDisabled : ""}`}
              >
                <input
                  type="radio"
                  name="taskRewardChoice"
                  value="growth"
                  checked={taskRewardDialog.choice === "growth"}
                  disabled={growthOptionDisabled}
                  onChange={() =>
                    setTaskRewardDialog((prev) =>
                      prev
                        ? {
                            ...prev,
                            choice: "growth",
                            nodeId:
                              prev.nodeId &&
                              availableGrowthNodes.some((node) => node.id === prev.nodeId)
                                ? prev.nodeId
                                : availableGrowthNodes[0]?.id,
                          }
                        : prev,
                    )
                  }
                />
                <span>成長ツリーに配置</span>
              </label>
              {taskRewardDialog.choice === "growth" ? (
                growthOptionDisabled ? (
                  <p className={styles.rewardHelp}>成長可能なノードがありません。</p>
                ) : (
                  <div className={styles.rewardSelect}>
                    <label htmlFor="growthNodeSelect">ノード選択</label>
                    <select
                      id="growthNodeSelect"
                      value={taskRewardDialog.nodeId ?? ""}
                      onChange={(event) =>
                        setTaskRewardDialog((prev) =>
                          prev ? { ...prev, nodeId: event.target.value } : prev,
                        )
                      }
                    >
                      {availableGrowthNodes.map((node) => (
                        <option key={node.id} value={node.id}>
                          {node.position} {node.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              ) : null}
              <label
                className={`${styles.rewardOption} ${
                  taskRewardDialog.choice === "lobby" ? styles.rewardOptionActive : ""
                }`}
              >
                <input
                  type="radio"
                  name="taskRewardChoice"
                  value="lobby"
                  checked={taskRewardDialog.choice === "lobby"}
                  onChange={() =>
                    setTaskRewardDialog((prev) =>
                      prev ? { ...prev, choice: "lobby", nodeId: undefined } : prev,
                    )
                  }
                />
                <span>ロビーを獲得</span>
              </label>
            </div>
            <div className={styles.rewardActions}>
              <button
                type="button"
                className={`${styles.rewardButton} ${styles.rewardButtonPrimary}`}
                onClick={() => {
                  void confirmTaskReward();
                }}
                disabled={pendingTaskId === taskRewardDialog.taskId}
              >
                決定
              </button>
              <button
                type="button"
                className={`${styles.rewardButton} ${styles.rewardButtonSecondary}`}
                onClick={cancelTaskReward}
                disabled={pendingTaskId === taskRewardDialog.taskId}
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

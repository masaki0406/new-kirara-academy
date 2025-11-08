import type { JSX } from "react";
import type { CatalogDevelopmentCard } from "@domain/types";
import styles from "./DevelopmentCardPreview.module.css";

type CardSymbolKind =
  | "light"
  | "rainbow"
  | "stagnation"
  | "vp"
  | "action"
  | "creativity"
  | "lobby"
  | "growth"
  | "neutral";

interface SymbolDefinition {
  kind: CardSymbolKind;
  label: string;
  keywords: string[];
  icon: JSX.Element;
}

interface CostPositionEntry {
  key: string;
  value: unknown;
}

interface CostSource {
  data: unknown;
  preferredKeys?: string[];
  extraKey?: string;
}

const COST_POSITION_KEYS = ["costa", "costb", "costc"];
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
const COST_RIGHT_DOWN_EXTRA_KEYS = ["cost_right_down", "costRightDown", "costBottomRight", "cost_rightdown"];

const SYMBOL_DEFINITIONS: SymbolDefinition[] = [
  {
    kind: "light",
    label: "光",
    keywords: ["light", "光", "hikari"],
    icon: (
      <svg
        className={styles.symbolSvg}
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="12" cy="12" r="5.5" fill="currentColor" opacity="0.88" />
        <path
          d="M12 2.5v2.5M12 19v2.5M4.5 12H2M22 12h-2.5M6 6l-1.8-1.8M19.8 19.8 18 18M6 18l-1.8 1.8M19.8 4.2 18 6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.7"
        />
      </svg>
    ),
  },
  {
    kind: "rainbow",
    label: "虹",
    keywords: ["rainbow", "虹", "niji", "虹彩"],
    icon: (
      <svg
        className={styles.symbolSvg}
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M4 17a8 8 0 0 1 16 0"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M7 17a5 5 0 0 1 10 0"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.75"
        />
        <path
          d="M10 17a2 2 0 0 1 4 0"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.5"
        />
      </svg>
    ),
  },
  {
    kind: "stagnation",
    label: "淀み",
    keywords: ["stagnation", "淀み", "yodomi"],
    icon: (
      <svg
        className={styles.symbolSvg}
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M12 2c-2.1 3.2-6.25 6.9-6.25 11.16A6.25 6.25 0 0 0 12 19.5a6.25 6.25 0 0 0 6.25-6.34C18.25 8.9 14.1 5.2 12 2Z"
          fill="currentColor"
        />
        <path
          d="M8.75 15.5c.75.58 1.92 1.17 3.25 1.17s2.5-.6 3.25-1.17"
          stroke="#ffffff"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.85"
          fill="none"
        />
      </svg>
    ),
  },
  {
    kind: "vp",
    label: "VP",
    keywords: ["vp", "victory", "point", "points", "vp点"],
    icon: (
      <svg
        className={styles.symbolSvg}
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="m12 3.2 2.3 5.16 5.6.5-4.25 3.74 1.3 5.43L12 15.7l-4.95 2.33 1.3-5.43L4.1 8.86l5.6-.5Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    kind: "action",
    label: "行動",
    keywords: ["action", "ap", "行動", "行動力"],
    icon: (
      <svg
        className={styles.symbolSvg}
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M13.5 2 4 13.2h6.1L9.8 22 20 10.4h-6.2L13.5 2Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    kind: "creativity",
    label: "創造",
    keywords: ["creativity", "cp", "創造", "創造力"],
    icon: (
      <svg
        className={styles.symbolSvg}
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M12 3a6.5 6.5 0 0 0-3 12.3V19a1.5 1.5 0 0 0 1.5 1.5h3A1.5 1.5 0 0 0 15 19v-3.7A6.5 6.5 0 0 0 12 3Z"
          fill="currentColor"
        />
        <path
          d="M10 20.5h4"
          stroke="#ffffff"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    kind: "lobby",
    label: "ロビー",
    keywords: ["lobby", "ロビー"],
    icon: (
      <svg
        className={styles.symbolSvg}
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M4.5 10.5 12 4l7.5 6.5V20a.5.5 0 0 1-.5.5H5a.5.5 0 0 1-.5-.5v-9.5Z"
          fill="currentColor"
        />
        <path
          d="M10 20v-4.5h4V20"
          stroke="#ffffff"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    kind: "growth",
    label: "成長",
    keywords: ["growth", "成長"],
    icon: (
      <svg
        className={styles.symbolSvg}
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M12 21c0-4-1.5-7-5-9.5 3.5-.5 5-2.5 5-5.5 0 3 1.5 5 5 5.5C13.5 13.5 12 17 12 21Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
];

const NORMALIZED_SYMBOLS = SYMBOL_DEFINITIONS.map((definition) => ({
  ...definition,
  normalizedKeywords: definition.keywords.map(normalizeKeyword),
}));

function normalizeKeyword(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/[\s_\-・:：]/g, "")
    .toLowerCase();
}

function isCostPositionKey(raw: string): boolean {
  const normalized = normalizeKeyword(raw);
  return COST_POSITION_KEYS.includes(normalized);
}

function resolveSymbolKind(raw?: string | null): SymbolDefinition | null {
  if (!raw) {
    return null;
  }
  const normalized = normalizeKeyword(raw);
  const directMatch = NORMALIZED_SYMBOLS.find((entry) =>
    entry.normalizedKeywords.some((keyword) => normalized.includes(keyword)),
  );
  return directMatch ?? null;
}

function buildTokens(
  map: Record<string, number> | undefined,
  variant: TokenVariant,
  filter?: (key: string, value: number) => boolean,
): TokenDefinition[] {
  if (!map) {
    return [];
  }
  return Object.entries(map)
    .filter(([rawKey, value]) => (filter ? filter(rawKey, value) : true))
    .map(([rawKey, value], index) => {
      const resolved = resolveSymbolKind(rawKey);
      const kind = resolved?.kind ?? "neutral";
      const label = resolved?.label ?? rawKey;
      return {
        id: `${variant}-${rawKey}-${index}`,
        kind,
        label,
        value,
        variant,
      };
    });
}

function buildTokensFromEntries(
  entries: CostPositionEntry[],
  variant: TokenVariant,
): TokenDefinition[] {
  if (!entries || entries.length === 0) {
    return [];
  }
  const map: Record<string, number> = {};
  entries.forEach(({ key, value }) => {
    const numeric = toOptionalNumber(value);
    if (typeof numeric === "number") {
      map[key] = numeric;
      return;
    }
    if (value && typeof value === "object") {
      Object.entries(value as Record<string, unknown>).forEach(([innerKey, innerValue]) => {
        const innerNumeric = toOptionalNumber(innerValue);
        if (typeof innerNumeric === "number") {
          map[innerKey] = innerNumeric;
        }
      });
    }
  });
  return buildTokens(map, variant);
}

function resolveCostEntries(
  sources: CostSource[],
  usedExtraKeys?: Set<string>,
): CostPositionEntry[] {
  for (const source of sources) {
    const entries = toCostEntries(source.data, source.preferredKeys);
    if (entries.length > 0) {
      if (source.extraKey) {
        usedExtraKeys?.add(source.extraKey);
      }
      return entries;
    }
  }
  return [];
}

function toCostEntries(
  data: unknown,
  preferredKeys?: string[],
): CostPositionEntry[] {
  if (data === null || data === undefined) {
    return [];
  }
  if (typeof data === "number" || typeof data === "string" || typeof data === "boolean") {
    return [{ key: "value", value: data }];
  }
  if (Array.isArray(data)) {
    return data.map((value, index) => ({ key: `index-${index}`, value }));
  }
  if (typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (preferredKeys && preferredKeys.length > 0) {
      const result: CostPositionEntry[] = [];
      const used = new Set<string>();
      preferredKeys.forEach((target) => {
        const normalizedTarget = normalizeKeyword(target);
        const matchKey = Object.keys(record).find(
          (key) => normalizeKeyword(key) === normalizedTarget,
        );
        if (matchKey && !used.has(matchKey)) {
          result.push({ key: matchKey, value: record[matchKey] });
          used.add(matchKey);
        }
      });
      Object.entries(record).forEach(([key, value]) => {
        if (!used.has(key)) {
          result.push({ key, value });
        }
      });
      return result;
    }
    return Object.entries(record).map(([key, value]) => ({ key, value }));
  }
  return [];
}

function formatExtraValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "-";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getThemeClassName(symbol: SymbolDefinition | null): string {
  if (!symbol) {
    return "";
  }
  switch (symbol.kind) {
    case "light":
    case "rainbow":
    case "stagnation":
    case "vp":
    case "action":
    case "creativity":
    case "lobby":
    case "growth":
      return styles[`theme-${symbol.kind}`] ?? "";
    default:
      return "";
  }
}

function classNames(...values: Array<string | undefined | null>): string {
  return values.filter(Boolean).join(" ");
}

function renderCostBoxes(
  entries: CostPositionEntry[],
  alignment: "left" | "right",
  keyPrefix: string,
  reverseOrder = false,
): JSX.Element {
  const rowClass = classNames(
    styles.costRow,
    alignment === "right" ? styles.costRowRight : styles.costRowLeft,
  );

  if (entries.length === 0) {
    const placeholderKeys = reverseOrder
      ? [...COST_POSITION_KEYS].reverse()
      : COST_POSITION_KEYS;
    return (
      <div className={rowClass}>
        {placeholderKeys.map((key) => (
          <div
            key={`${key}-${keyPrefix}`}
            className={classNames(styles.costPositionBox, styles.costPositionBoxEmpty)}
          />
        ))}
      </div>
    );
  }

  const orderedEntries = reverseOrder ? [...entries].reverse() : entries;

  return (
    <div className={rowClass}>
      {orderedEntries.map((entry, index) => (
        <div
          key={`${keyPrefix}-${entry.key}-${index}`}
          className={styles.costPositionBox}
        >
          <span className={styles.costPositionValue}>{formatExtraValue(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

function renderCostSlot(
  entries: CostPositionEntry[],
  alignment: "left" | "right",
  slotKey: "top" | "middle" | "bottom",
  keyPrefix: string,
  forceBox = false,
  reverseOrder = false,
): JSX.Element {
  const slotClass = classNames(
    styles.costSlot,
    slotKey === "top"
      ? styles.costSlotTop
      : slotKey === "bottom"
        ? styles.costSlotBottom
        : styles.costSlotMiddle,
    alignment === "right" ? styles.costSlotRight : styles.costSlotLeft,
  );

  if (!forceBox && entries.length === 0) {
    return <div className={slotClass} />;
  }

  return (
    <div className={slotClass}>
      {renderCostBoxes(entries, alignment, `${keyPrefix}-${slotKey}`, reverseOrder)}
    </div>
  );
}

function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function toOptionalIntegerLike(value: unknown): number | undefined {
  const numeric = toOptionalNumber(value);
  if (typeof numeric === "number") {
    return Math.trunc(numeric);
  }
  if (typeof value === "string") {
    const match = value.match(/(\d+)/);
    if (match) {
      const parsed = Number(match[1]);
      if (!Number.isNaN(parsed)) {
        return Math.trunc(parsed);
      }
    }
  }
  return undefined;
}

function toSlotFromPosition(position: number | undefined | null): "top" | "middle" | "bottom" {
  if (position === 1) {
    return "top";
  }
  if (position === 3) {
    return "bottom";
  }
  return "middle";
}

function flipSlotPosition(slot: "top" | "middle" | "bottom"): "top" | "middle" | "bottom" {
  if (slot === "top") {
    return "bottom";
  }
  if (slot === "bottom") {
    return "top";
  }
  return "middle";
}

function formatTokenValue(token: TokenDefinition): string | undefined {
  if (token.value === undefined || Number.isNaN(token.value)) {
    return undefined;
  }
  if (token.variant === "reward" && token.value > 0) {
    return `+${token.value}`;
  }
  return String(token.value);
}

function renderTokenRowContent(tokens: TokenDefinition[]): JSX.Element | null {
  if (tokens.length === 0) {
    return null;
  }

  return (
    <>
      {tokens.map((token) => {
        const symbolDefinition = SYMBOL_DEFINITIONS.find(
          (definition) => definition.kind === token.kind,
        );
        const iconClass = classNames(
          styles.centerTokenIcon,
          styles[
            `symbol${token.kind.charAt(0).toUpperCase()}${token.kind.slice(1)}`
          ] ?? undefined,
        );
        return (
          <span key={token.id} className={styles.centerToken}>
            <span className={iconClass}>
              {symbolDefinition?.icon ?? (
                <svg
                  className={styles.centerTokenSvg}
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  focusable="false"
                >
                  <circle cx="12" cy="12" r="8" fill="currentColor" />
                </svg>
              )}
            </span>
            {token.value !== undefined ? (
              <>
                <span className={styles.centerTokenMultiplier}>×</span>
                <span className={styles.centerTokenValue}>{formatTokenValue(token)}</span>
              </>
            ) : null}
            <span className={styles.srOnly}>
              {token.label} {formatTokenValue(token) ?? ""}
            </span>
          </span>
        );
      })}
    </>
  );
}

interface Props {
  card: CatalogDevelopmentCard;
  className?: string;
  orientation?: "left" | "right";
  cardType?: "development" | "vp";
}

export function DevelopmentCardPreview({
  card,
  className,
  orientation = "left",
  cardType = "development",
}: Props): JSX.Element {
  const displayName = (card.cardId ?? card.id ?? "").trim() || card.id || "未登録カード";
  const mainSymbol = resolveSymbolKind(card.costItem);
  const themeClass = getThemeClassName(mainSymbol);
  const usedExtraKeys = new Set<string>();
  const extrasRecord = card.extras ?? {};
  const claimExtraValue = (targets: string | string[]) => {
    const normalizedTargets = (Array.isArray(targets) ? targets : [targets]).map((target) =>
      target.toLowerCase(),
    );
    const entry = Object.entries(extrasRecord).find(([key]) =>
      normalizedTargets.includes(key.toLowerCase()),
    );
    if (!entry) {
      return null;
    }
    usedExtraKeys.add(entry[0]);
    return { key: entry[0], value: entry[1] };
  };
  const costTopLeft = resolveCostEntries(
    [
      { data: card.costLeftUp, preferredKeys: COST_POSITION_KEYS },
      ...COST_LEFT_UP_EXTRA_KEYS.map((key) => ({
        data: extrasRecord[key],
        preferredKeys: COST_POSITION_KEYS,
        extraKey: key,
      })),
    ],
    usedExtraKeys,
  );
  const costBottomLeft = resolveCostEntries(
    [
      { data: card.costLeftDown, preferredKeys: COST_POSITION_KEYS },
      ...COST_LEFT_DOWN_EXTRA_KEYS.map((key) => ({
        data: extrasRecord[key],
        preferredKeys: COST_POSITION_KEYS,
        extraKey: key,
      })),
    ],
    usedExtraKeys,
  );
  const costTopRight = resolveCostEntries(
    COST_RIGHT_UP_EXTRA_KEYS.map((key) => ({
      data: extrasRecord[key],
      preferredKeys: COST_POSITION_KEYS,
      extraKey: key,
    })),
    usedExtraKeys,
  );
  const costBottomRight = resolveCostEntries(
    COST_RIGHT_DOWN_EXTRA_KEYS.map((key) => ({
      data: extrasRecord[key],
      preferredKeys: COST_POSITION_KEYS,
      extraKey: key,
    })),
    usedExtraKeys,
  );
  const primarySide = orientation;
  const isRightOrientation = orientation === "right";
  const isVpCard = cardType === "vp";
  const shouldRotateCard = !isVpCard && isRightOrientation;
  let vpRewardSlot: "top" | "middle" | "bottom" | null = null;
  let vpRewardText: string | null = null;
  if (isVpCard) {
    const vpRewardEntry = claimExtraValue(["getvp", "get_vp"]);
    const vpRewardAmount = vpRewardEntry ? toOptionalNumber(vpRewardEntry.value) : undefined;
    const vpPosEntry = claimExtraValue(["vppos", "vp_pos"]);
    const vpPosValue = vpPosEntry ? toOptionalIntegerLike(vpPosEntry.value) : undefined;
    const hasVpReward = typeof vpRewardAmount === "number" && Number.isFinite(vpRewardAmount);
    vpRewardSlot = hasVpReward ? toSlotFromPosition(vpPosValue) : null;
    vpRewardText = hasVpReward ? `VP × ${vpRewardAmount}` : null;
  }
  let tokensLeftCost: TokenDefinition[] = [];
  let tokensLeftReward: TokenDefinition[] = [];
  let tokensRightCost: TokenDefinition[] = [];
  let tokensRightReward: TokenDefinition[] = [];
  let effectiveLeftTopEntries = costTopLeft;
  let effectiveLeftBottomEntries = costBottomLeft;
  let effectiveRightTopEntries = costTopRight;
  let effectiveRightBottomEntries = costBottomRight;
  const badgeSlot: "top" | "middle" | "bottom" = toSlotFromPosition(card.costPosition);
  if (!isVpCard) {
    tokensLeftCost = buildTokens(card.costLeftUp, "cost", (key) => !isCostPositionKey(key));
    tokensLeftReward = buildTokens(
      card.costLeftDown,
      "reward",
      (key) => !isCostPositionKey(key),
    );
    tokensRightCost = buildTokensFromEntries(costTopRight, "cost");
    tokensRightReward = buildTokensFromEntries(costBottomRight, "reward");
    if (shouldRotateCard) {
      const originalLeftTop = effectiveLeftTopEntries;
      const originalLeftBottom = effectiveLeftBottomEntries;
      const originalRightTop = effectiveRightTopEntries;
      const originalRightBottom = effectiveRightBottomEntries;
      const originalLeftCostTokens = tokensLeftCost;
      const originalLeftRewardTokens = tokensLeftReward;
      const originalRightCostTokens = tokensRightCost;
      const originalRightRewardTokens = tokensRightReward;

      effectiveLeftTopEntries = originalRightTop;
      effectiveLeftBottomEntries = originalRightBottom;
      effectiveRightTopEntries = originalLeftTop;
      effectiveRightBottomEntries = originalLeftBottom;

      tokensLeftCost = originalRightCostTokens;
      tokensLeftReward = originalRightRewardTokens;
      tokensRightCost = originalLeftCostTokens;
      tokensRightReward = originalLeftRewardTokens;

      [effectiveLeftTopEntries, effectiveLeftBottomEntries] = [
        effectiveLeftBottomEntries,
        effectiveLeftTopEntries,
      ];
      [effectiveRightTopEntries, effectiveRightBottomEntries] = [
        effectiveRightBottomEntries,
        effectiveRightTopEntries,
      ];
    }
  }
  const activeBadgeSlot = shouldRotateCard ? flipSlotPosition(badgeSlot) : badgeSlot;
  const costTokenSlot: "top" | "middle" | "bottom" = shouldRotateCard ? "bottom" : "top";
  const rewardTokenSlot: "top" | "middle" | "bottom" = shouldRotateCard ? "top" : "bottom";
  const reverseCostOrder = shouldRotateCard;
  const extrasEntries = Object.entries(extrasRecord);
  const extras = extrasEntries.filter(
    ([key]) => !isCostPositionKey(key) && !usedExtraKeys.has(key),
  );

  const renderItemSlot = (
    slot: "top" | "middle" | "bottom",
    side: "left" | "right",
  ): JSX.Element => {
    if (isVpCard) {
      const isPrimary = side === primarySide;
      const isActive = isPrimary && vpRewardText && vpRewardSlot === slot;
      const vpClass = classNames(
        styles.centerItemBox,
        slot === "top"
          ? styles.centerItemBoxTop
          : slot === "bottom"
            ? styles.centerItemBoxBottom
            : styles.centerItemBoxMiddle,
        side === "left" ? styles.centerItemBoxLeft : styles.centerItemBoxRight,
        isActive ? styles.centerItemBoxActive : undefined,
      );
      return (
        <div className={vpClass}>
          {isActive ? (
            <span className={styles.centerVpText}>{vpRewardText}</span>
          ) : (
            <span className={styles.centerPlaceholder}>-</span>
          )}
        </div>
      );
    }

    const isPrimary = side === primarySide;
    const boxClass = classNames(
      styles.centerItemBox,
      slot === "top"
        ? styles.centerItemBoxTop
        : slot === "bottom"
          ? styles.centerItemBoxBottom
          : styles.centerItemBoxMiddle,
      side === "left" ? styles.centerItemBoxLeft : styles.centerItemBoxRight,
      isPrimary && activeBadgeSlot === slot ? styles.centerItemBoxActive : undefined,
    );

    const content: JSX.Element[] = [];

    if (isPrimary && slot === costTokenSlot) {
      const tokens = renderTokenRowContent(side === "left" ? tokensLeftCost : tokensRightCost);
      if (tokens) {
        content.push(
          <div key="tokens" className={styles.centerTokenRow}>
            {tokens}
          </div>,
        );
      }
    }

    if (isPrimary && activeBadgeSlot === slot) {
      const alignment: "left" | "center" | "right" =
        primarySide === "right"
          ? slot === "middle"
            ? "center"
            : "right"
          : slot === "middle"
            ? "center"
            : "left";
      content.push(
        <div key="badge" className={styles.centerBadgeHolder}>
          {renderCostBadge(mainSymbol, card.costNumber, card.costItem, alignment)}
        </div>,
      );
    }

    if (isPrimary && slot === rewardTokenSlot) {
      const tokens = renderTokenRowContent(
        side === "left" ? tokensLeftReward : tokensRightReward,
      );
      if (tokens) {
        content.push(
          <div key="tokens" className={styles.centerTokenRow}>
            {tokens}
          </div>,
        );
      }
    }

    if (content.length === 0) {
      content.push(
        <span key="placeholder" className={styles.centerPlaceholder}>
          -
        </span>,
      );
    }

    return <div className={boxClass}>{content}</div>;
  };

  const renderCostColumn = (side: "left" | "right"): JSX.Element => {
    const isLeft = side === "left";
    const topEntries = isLeft
      ? (isVpCard ? costTopLeft : effectiveLeftTopEntries)
      : (isVpCard ? costTopRight : effectiveRightTopEntries);
    const bottomEntries = isLeft
      ? (isVpCard ? costBottomLeft : effectiveLeftBottomEntries)
      : (isVpCard ? costBottomRight : effectiveRightBottomEntries);
    return (
      <div className={classNames(styles.costColumn, isLeft ? styles.costColumnLeft : styles.costColumnRight)}>
        {renderCostSlot(topEntries, isLeft ? "left" : "right", "top", side, true, reverseCostOrder)}
        {renderItemSlot("top", side)}
        {renderItemSlot("middle", side)}
        {renderItemSlot("bottom", side)}
        {renderCostSlot(bottomEntries, isLeft ? "left" : "right", "bottom", side, true, reverseCostOrder)}
      </div>
    );
  };

  return (
    <article className={classNames(styles.card, themeClass, className)}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <span className={styles.name}>{displayName}</span>
          {typeof card.costPosition === "number" ? (
            <span className={styles.position}>POS {card.costPosition}</span>
          ) : null}
        </header>

        <div className={styles.main}>
          <div className={styles.costLayout}>
            {renderCostColumn("left")}
            {renderCostColumn("right")}
          </div>
        </div>

        {extras.length > 0 ? (
          <footer className={styles.extras}>
            {extras.map(([key, value]) => (
              <div key={key} className={styles.extraItem}>
                <span className={styles.extraKey}>{key}</span>
                <span className={styles.extraValue}>{formatExtraValue(value)}</span>
              </div>
            ))}
          </footer>
        ) : null}
      </div>
    </article>
  );
}

export default DevelopmentCardPreview;
type TokenVariant = "cost" | "reward" | "meta";

interface TokenDefinition {
  id: string;
  kind: CardSymbolKind;
  label: string;
  value?: number;
  variant: TokenVariant;
}
function renderCostBadge(
  symbol: SymbolDefinition | null,
  costNumber: number | undefined,
  costItem: string | undefined,
  alignment: "left" | "center" | "right",
): JSX.Element {
  const badgeClass = classNames(
    styles.costBadge,
    alignment === "left"
      ? styles.costBadgeLeft
      : alignment === "right"
        ? styles.costBadgeRight
        : undefined,
  );
  const contentClass = classNames(
    styles.costBadgeContent,
    alignment === "left"
      ? styles.costBadgeContentLeft
      : alignment === "right"
        ? styles.costBadgeContentRight
        : styles.costBadgeContentCenter,
  );
  const iconClass = classNames(
    styles.centerTokenIcon,
    symbol ? styles[`symbol${symbol.kind.charAt(0).toUpperCase()}${symbol.kind.slice(1)}`] : undefined,
  );
  const valueText =
    typeof costNumber === "number" && Number.isFinite(costNumber) ? String(costNumber) : "-";

  return (
    <div className={badgeClass}>
      <div className={contentClass}>
        <span className={iconClass}>
          {symbol?.icon ?? (
            <svg
              className={styles.centerTokenSvg}
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <circle cx="12" cy="12" r="8" fill="currentColor" />
            </svg>
          )}
        </span>
        <span className={styles.centerTokenMultiplier}>×</span>
        <span className={styles.centerTokenValue}>{valueText}</span>
      </div>
      <span className={styles.centerLabel}>{symbol?.label ?? costItem ?? "未分類"}</span>
    </div>
  );
}

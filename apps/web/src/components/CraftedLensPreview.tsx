import type { JSX } from "react";
import type {
  CatalogDevelopmentCard,
  CraftedLens,
  CraftedLensSideItem,
  PolishCardType,
} from "@domain/types";
import styles from "./CraftedLensPreview.module.css";

interface Props {
  lens: CraftedLens;
  className?: string;
  getCard?: (cardId: string, cardType: PolishCardType) => CatalogDevelopmentCard | null;
}

const COST_POSITION_KEYS = ["costa", "costb", "costc"] as const;
type StandardCostKey = (typeof COST_POSITION_KEYS)[number];
type CostPositionKey = StandardCostKey | "total";
type ItemSlotKey = "top" | "middle" | "bottom";

interface CostEntry {
  key: CostPositionKey;
  label: string;
  value: number;
}

interface AggregatedCostData {
  leftTop: CostEntry[];
  leftBottom: CostEntry[];
  rightTop: CostEntry[];
  rightBottom: CostEntry[];
}

interface AggregatedItemData {
  left: Record<ItemSlotKey, string[]>;
  right: Record<ItemSlotKey, string[]>;
}

function normalizeKeyword(value: string): string {
  return value.replace(/[\s_-]/g, "").toLowerCase();
}

function isStandardCostKey(value: string): value is StandardCostKey {
  return (COST_POSITION_KEYS as readonly string[]).includes(value);
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return null;
}

function toSlotFromPosition(position: number | undefined | null): ItemSlotKey {
  if (position === 1) {
    return "top";
  }
  if (position === 3) {
    return "bottom";
  }
  return "middle";
}

function formatCostLabel(key: CostPositionKey): string {
  if (key === "costa") {
    return "A";
  }
  if (key === "costb") {
    return "B";
  }
  if (key === "costc") {
    return "C";
  }
  if (key === "total") {
    return "合計";
  }
  return key.toUpperCase();
}

function addCostValue(store: Map<CostPositionKey, number>, key: string, raw: unknown): void {
  const numeric = toFiniteNumber(raw);
  if (numeric === null) {
    return;
  }
  const normalized = normalizeKeyword(key);
  const costKey: CostPositionKey = isStandardCostKey(normalized) ? normalized : "total";
  store.set(costKey, (store.get(costKey) ?? 0) + numeric);
}

function collectCostEntries(store: Map<CostPositionKey, number>, data: unknown): void {
  if (data === null || data === undefined) {
    return;
  }
  if (typeof data === "number" || typeof data === "string") {
    addCostValue(store, "total", data);
    return;
  }
  if (Array.isArray(data)) {
    data.forEach((value, index) => {
      addCostValue(store, `costa-${index}`, value);
    });
    return;
  }
  if (typeof data === "object") {
    Object.entries(data as Record<string, unknown>).forEach(([key, value]) => {
      collectCostEntriesForKey(store, key, value);
    });
  }
}

function collectCostEntriesForKey(
  store: Map<CostPositionKey, number>,
  key: string,
  value: unknown,
): void {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    collectCostEntries(store, value);
    return;
  }
  addCostValue(store, key, value);
}

function collectFromExtras(
  store: Map<CostPositionKey, number>,
  extras: Record<string, unknown> | undefined,
  keys: readonly string[],
): void {
  if (!extras) {
    return;
  }
  const normalizedTargets = keys.map((key) => key.toLowerCase());
  Object.entries(extras).forEach(([key, value]) => {
    if (normalizedTargets.includes(key.toLowerCase())) {
      collectCostEntries(store, value);
    }
  });
}

function mapToCostEntries(
  store: Map<CostPositionKey, number>,
  fallbackTotal: number | null,
): CostEntry[] {
  const entries: CostEntry[] = [];
  COST_POSITION_KEYS.forEach((key) => {
    if (store.has(key)) {
      const value = store.get(key)!;
      if (value !== 0) {
        entries.push({ key, label: formatCostLabel(key), value });
      }
    }
  });
  const others: CostEntry[] = [];
  store.forEach((value, key) => {
    if (!isStandardCostKey(key) && key !== "total") {
      others.push({ key, label: formatCostLabel(key), value });
    }
  });
  others.sort((a, b) => a.label.localeCompare(b.label, "ja"));
  entries.push(...others);
  if (!entries.length && fallbackTotal !== null && fallbackTotal !== 0) {
    entries.push({ key: "total", label: formatCostLabel("total"), value: fallbackTotal });
  }
  return entries;
}

function aggregateCosts(
  lens: CraftedLens,
  getCard?: (cardId: string, cardType: PolishCardType) => CatalogDevelopmentCard | null,
): AggregatedCostData {
  const leftTop = new Map<CostPositionKey, number>();
  const leftBottom = new Map<CostPositionKey, number>();
  const rightTop = new Map<CostPositionKey, number>();
  const rightBottom = new Map<CostPositionKey, number>();

  if (getCard) {
    lens.sourceCards.forEach((source) => {
      const card = getCard(source.cardId, source.cardType);
      if (!card) {
        return;
      }
      const useRight = source.cardType === "vp" || source.flipped;
      if (useRight) {
        collectFromExtras(rightTop, card.extras, ["cost_right_up", "costRightUp", "costTopRight", "cost_rightup"]);
        collectFromExtras(
          rightBottom,
          card.extras,
          ["cost_right_down", "costRightDown", "costBottomRight", "cost_rightdown"],
        );
      } else {
        const hasLeftUp = card.costLeftUp !== undefined && card.costLeftUp !== null;
        const hasLeftDown = card.costLeftDown !== undefined && card.costLeftDown !== null;
        collectCostEntries(leftTop, card.costLeftUp);
        collectCostEntries(leftBottom, card.costLeftDown);
        if (!hasLeftUp) {
          collectFromExtras(leftTop, card.extras, ["cost_left_up", "costLeftUp", "costTopLeft", "cost_topleft"]);
        }
        if (!hasLeftDown) {
          collectFromExtras(leftBottom, card.extras, ["cost_left_down", "costLeftDown", "costBottomLeft", "cost_bottomleft"]);
        }
      }
    });
  }

  return {
    leftTop: mapToCostEntries(leftTop, lens.leftTotal || null),
    leftBottom: mapToCostEntries(leftBottom, null),
    rightTop: mapToCostEntries(rightTop, lens.rightTotal || null),
    rightBottom: mapToCostEntries(rightBottom, null),
  };
}

function aggregateItems(lens: CraftedLens): AggregatedItemData {
  const buildInitial = (): Record<ItemSlotKey, string[]> => ({
    top: [],
    middle: [],
    bottom: [],
  });
  const left = buildInitial();
  const right = buildInitial();

  lens.leftItems.forEach((item) => {
    const slot = toSlotFromPosition(item.position);
    left[slot].push(formatItem(item));
  });
  lens.rightItems.forEach((item) => {
    const slot = toSlotFromPosition(item.position);
    right[slot].push(formatItem(item));
  });

  return { left, right };
}

function formatItem(item: CraftedLensSideItem): string {
  const label = item.item ?? item.cardId;
  if (item.quantity !== undefined && item.quantity !== null && item.quantity !== 0) {
    return `${label} × ${item.quantity}`;
  }
  return label;
}

function formatNumber(value: number): string {
  if (Number.isInteger(value)) {
    return value.toString();
  }
  return value.toFixed(2).replace(/\.?0+$/, "");
}

function renderCostSlot(entries: CostEntry[], alignment: "left" | "right", position: ItemSlotKey): JSX.Element {
  return (
    <div
      className={[
        styles.costSlot,
        alignment === "right" ? styles.costSlotRight : styles.costSlotLeft,
        position === "top"
          ? styles.costSlotTop
          : position === "bottom"
            ? styles.costSlotBottom
            : styles.costSlotMiddle,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {entries.length === 0 ? (
        <span className={styles.costPlaceholder}>-</span>
      ) : (
        entries.map((entry) => (
          <div key={entry.key} className={styles.costEntry}>
            <span className={styles.costKey}>{entry.label}</span>
            <span className={styles.costValue}>{formatNumber(entry.value)}</span>
          </div>
        ))
      )}
    </div>
  );
}

function renderItemSide(label: string, items: string[]): JSX.Element {
  return (
    <div className={styles.itemSide}>
      <span className={styles.itemSideLabel}>{label}</span>
      {items.length === 0 ? (
        <span className={styles.itemSideEmpty}>なし</span>
      ) : (
        <ul className={styles.itemSideList}>
          {items.map((item, index) => (
            <li key={`${label}-${index}`} className={styles.itemSideEntry}>
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CraftedLensPreview({ lens, className, getCard }: Props): JSX.Element {
  const diff = lens.rightTotal - lens.leftTotal;
  const requirement = Math.max(0, Math.ceil(diff));
  const composedClassName = [styles.card, className].filter(Boolean).join(" ");
  const aggregatedCosts = aggregateCosts(lens, getCard);
  const aggregatedItems = aggregateItems(lens);

  return (
    <article className={composedClassName}>
      <header className={styles.header}>
        <span className={styles.lensId}>{lens.lensId}</span>
        <span className={styles.foundation}>土台コスト: {lens.foundationCost}</span>
      </header>
      <div className={styles.summary}>
        <div>
          <span className={styles.summaryLabel}>左合計</span>
          <strong className={styles.summaryValue}>{lens.leftTotal}</strong>
        </div>
        <div>
          <span className={styles.summaryLabel}>右合計</span>
          <strong className={styles.summaryValue}>{lens.rightTotal}</strong>
        </div>
        <div>
          <span className={styles.summaryLabel}>差分</span>
          <strong className={styles.summaryValue}>{diff}</strong>
        </div>
        <div>
          <span className={styles.summaryLabel}>必要土台</span>
          <strong className={styles.summaryValue}>{requirement}</strong>
        </div>
        <div>
          <span className={styles.summaryLabel}>VP</span>
          <strong className={styles.summaryValue}>{lens.vpTotal ?? 0}</strong>
        </div>
      </div>
      <div className={styles.costLayout}>
        <div className={styles.costColumn}>
          {renderCostSlot(aggregatedCosts.leftTop, "left", "top")}
          {renderCostSlot([], "left", "middle")}
          {renderCostSlot(aggregatedCosts.leftBottom, "left", "bottom")}
        </div>
        <div className={styles.centerColumn}>
          <div className={styles.itemRow}>
            <span className={styles.itemRowTitle}>上段</span>
            <div className={styles.itemRowSides}>
              {renderItemSide("左", aggregatedItems.left.top)}
              {renderItemSide("右", aggregatedItems.right.top)}
            </div>
          </div>
          <div className={styles.itemRow}>
            <span className={styles.itemRowTitle}>中央</span>
            <div className={styles.itemRowSides}>
              {renderItemSide("左", aggregatedItems.left.middle)}
              {renderItemSide("右", aggregatedItems.right.middle)}
            </div>
          </div>
          <div className={styles.itemRow}>
            <span className={styles.itemRowTitle}>下段</span>
            <div className={styles.itemRowSides}>
              {renderItemSide("左", aggregatedItems.left.bottom)}
              {renderItemSide("右", aggregatedItems.right.bottom)}
            </div>
          </div>
        </div>
        <div className={styles.costColumn}>
          {renderCostSlot(aggregatedCosts.rightTop, "right", "top")}
          {renderCostSlot([], "right", "middle")}
          {renderCostSlot(aggregatedCosts.rightBottom, "right", "bottom")}
        </div>
      </div>
      <footer className={styles.footer}>
        <h6 className={styles.sourceTitle}>使用カード</h6>
        {lens.sourceCards.length === 0 ? (
          <p className={styles.sourceEmpty}>情報なし</p>
        ) : (
          <ul className={styles.sourceList}>
            {lens.sourceCards.map((source) => (
              <li key={`${source.cardType}-${source.cardId}`} className={styles.sourceItem}>
                <span className={styles.sourceBadge}>{source.cardType === "vp" ? "VP" : "DEV"}</span>
                <span className={styles.sourceLabel}>
                  {source.cardId}
                  {source.flipped ? "（右配置）" : "（左配置）"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </footer>
    </article>
  );
}

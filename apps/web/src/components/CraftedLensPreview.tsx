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

const STANDARD_COST_KEYS = ["costa", "costb", "costc"] as const;
type StandardCostKey = (typeof STANDARD_COST_KEYS)[number];
type CostSlotArray = [number, number, number];
type ItemSlotKey = "top" | "middle" | "bottom";

interface AggregatedCostData {
  leftTop: CostSlotArray;
  leftBottom: CostSlotArray;
  rightTop: CostSlotArray;
  rightBottom: CostSlotArray;
}

interface AggregatedItemData {
  left: Record<ItemSlotKey, string[]>;
  right: Record<ItemSlotKey, string[]>;
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

function toNumeric(value: unknown): number | null {
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

type CostSlotArray = [number, number, number];

function accumulateSlots(
  slots: CostSlotArray,
  record: Record<string, unknown> | undefined,
  extras: Record<string, unknown> | undefined,
  keys: readonly string[],
): void {
  if (record && typeof record === "object") {
    STANDARD_COST_KEYS.forEach((key, index) => {
      const numeric = toNumeric((record as Record<string, unknown>)[key]);
      if (numeric !== null) {
        slots[index] += numeric;
      }
    });
  } else {
    const numeric = toNumeric(record);
    if (numeric !== null) {
      slots[1] += numeric;
    }
  }

  keys.forEach((extraKey) => {
    const value = extras?.[extraKey];
    if (!value) {
      return;
    }
    if (typeof value === "object" && !Array.isArray(value)) {
      STANDARD_COST_KEYS.forEach((key, index) => {
        const numeric = toNumeric((value as Record<string, unknown>)[key]);
        if (numeric !== null) {
          slots[index] += numeric;
        }
      });
    } else {
      const numeric = toNumeric(value);
      if (numeric !== null) {
        slots[1] += numeric;
      }
    }
  });
}

function getCostSnapshot(card: CatalogDevelopmentCard | null): CostSnapshot {
  if (!card) {
    return {
      left: { top: [0, 0, 0], bottom: [0, 0, 0] },
      right: { top: [0, 0, 0], bottom: [0, 0, 0] },
    };
  }
  const extras = card.extras ?? {};
  const leftTop: CostSlotArray = [0, 0, 0];
  const leftBottom: CostSlotArray = [0, 0, 0];
  const rightTop: CostSlotArray = [0, 0, 0];
  const rightBottom: CostSlotArray = [0, 0, 0];

  accumulateSlots(leftTop, card.costLeftUp as Record<string, unknown> | undefined, extras, COST_LEFT_UP_EXTRA_KEYS);
  accumulateSlots(leftBottom, card.costLeftDown as Record<string, unknown> | undefined, extras, COST_LEFT_DOWN_EXTRA_KEYS);
  accumulateSlots(rightTop, undefined, extras, COST_RIGHT_UP_EXTRA_KEYS);
  accumulateSlots(rightBottom, undefined, extras, COST_RIGHT_DOWN_EXTRA_KEYS);

  return {
    left: { top: leftTop, bottom: leftBottom },
    right: { top: rightTop, bottom: rightBottom },
  };
}

function addSlots(target: CostSlotArray, source: CostSlotArray): void {
  target[0] += source[0];
  target[1] += source[1];
  target[2] += source[2];
}

function reverseSlots(slots: CostSlotArray): CostSlotArray {
  return [slots[2], slots[1], slots[0]];
}

function aggregateCosts(
  lens: CraftedLens,
  getCard?: (cardId: string, cardType: PolishCardType) => CatalogDevelopmentCard | null,
): AggregatedCostData {
  const aggregated: AggregatedCostData = {
    leftTop: [0, 0, 0],
    leftBottom: [0, 0, 0],
    rightTop: [0, 0, 0],
    rightBottom: [0, 0, 0],
  };

  if (!getCard) {
    return aggregated;
  }

  lens.sourceCards.forEach((source) => {
    const card = getCard(source.cardId, source.cardType);
    const snapshot = getCostSnapshot(card);

    if (source.cardType === "vp") {
      addSlots(aggregated.rightTop, snapshot.right.top);
      addSlots(aggregated.rightBottom, snapshot.right.bottom);
      return;
    }

    if (!source.flipped) {
      addSlots(aggregated.leftTop, snapshot.left.top);
      addSlots(aggregated.leftBottom, snapshot.left.bottom);
      addSlots(aggregated.rightTop, snapshot.right.top);
      addSlots(aggregated.rightBottom, snapshot.right.bottom);
      return;
    }

    addSlots(aggregated.rightBottom, reverseSlots(snapshot.left.top));
    addSlots(aggregated.rightTop, reverseSlots(snapshot.left.bottom));
    addSlots(aggregated.leftBottom, reverseSlots(snapshot.right.top));
    addSlots(aggregated.leftTop, reverseSlots(snapshot.right.bottom));
  });

  return aggregated;
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

function renderCostSlot(slots: CostSlotArray, alignment: "left" | "right", position: ItemSlotKey): JSX.Element {
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
      {slots.map((value, index) => (
        <div key={`${position}-${alignment}-${index}`} className={styles.costCell}>
          {value === 0 ? "−" : formatNumber(value)}
        </div>
      ))}
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
  const composedClassName = [styles.card, className].filter(Boolean).join(" ");
  const aggregatedCosts = aggregateCosts(lens, getCard);
  const aggregatedItems = aggregateItems(lens);

  return (
    <article className={composedClassName}>
      <header className={styles.header}>
        <span className={styles.lensId}>{lens.lensId}</span>
        <div className={styles.headerMeta}>
          <span className={styles.foundation}>土台 {lens.foundationCost}</span>
          <span className={styles.vpMeta}>VP {lens.vpTotal ?? 0}</span>
        </div>
      </header>
      <div className={styles.costLayout}>
        <div className={styles.costColumn}>
          {renderCostSlot(aggregatedCosts.leftTop, "left", "top")}
          {renderCostSlot([0, 0, 0], "left", "middle")}
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
          {renderCostSlot([0, 0, 0], "right", "middle")}
          {renderCostSlot(aggregatedCosts.rightBottom, "right", "bottom")}
        </div>
      </div>
    </article>
  );
}

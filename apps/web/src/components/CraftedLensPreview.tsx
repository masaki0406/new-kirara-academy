import type { JSX } from "react";
import type {
  CatalogDevelopmentCard,
  CraftedLens,
  CraftedLensSideItem,
  PolishCardType,
} from "@domain/types";
import styles from "./CraftedLensPreview.module.css";
import cardStyles from "./DevelopmentCardPreview.module.css";

interface Props {
  lens: CraftedLens;
  className?: string;
  getCard?: (cardId: string, cardType: PolishCardType) => CatalogDevelopmentCard | null;
}

const STANDARD_COST_KEYS = ["costa", "costb", "costc"] as const;
const COST_LEFT_UP_EXTRA_KEYS = ["cost_left_up", "costLeftUp", "costTopLeft", "cost_topleft"] as const;
const COST_LEFT_DOWN_EXTRA_KEYS = ["cost_left_down", "costLeftDown", "costBottomLeft", "cost_bottomleft"] as const;
const COST_RIGHT_UP_EXTRA_KEYS = ["cost_right_up", "costRightUp", "costTopRight", "cost_rightup"] as const;
const COST_RIGHT_DOWN_EXTRA_KEYS = ["cost_right_down", "costRightDown", "costBottomRight", "cost_rightdown"] as const;
type CostSlotArray = [number, number, number];
type ItemSlotKey = "top" | "middle" | "bottom";

interface AggregatedCostData {
  leftTop: CostSlotArray;
  leftBottom: CostSlotArray;
  rightTop: CostSlotArray;
  rightBottom: CostSlotArray;
}

interface CostSnapshot {
  left: { top: CostSlotArray; bottom: CostSlotArray };
  right: { top: CostSlotArray; bottom: CostSlotArray };
}

interface AggregatedItemData {
  left: Record<ItemSlotKey, string[]>;
  right: Record<ItemSlotKey, string[]>;
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

function classNames(...values: Array<string | undefined | null>): string {
  return values.filter(Boolean).join(" ");
}

function renderCostRow(
  slots: CostSlotArray,
  alignment: "left" | "right",
  keyPrefix: string,
): JSX.Element {
  const rowClass = classNames(
    cardStyles.costRow,
    alignment === "right" ? cardStyles.costRowRight : cardStyles.costRowLeft,
  );
  return (
    <div className={rowClass}>
      {slots.map((value, index) => (
        <div key={`${keyPrefix}-${index}`} className={cardStyles.costPositionBox}>
          <span className={cardStyles.costPositionValue}>{formatNumber(value)}</span>
        </div>
      ))}
    </div>
  );
}

function renderCostSlot(
  slots: CostSlotArray,
  alignment: "left" | "right",
  position: ItemSlotKey,
  keyPrefix: string,
): JSX.Element {
  const slotClass = classNames(
    cardStyles.costSlot,
    position === "top"
      ? cardStyles.costSlotTop
      : position === "bottom"
        ? cardStyles.costSlotBottom
        : cardStyles.costSlotMiddle,
    alignment === "right" ? cardStyles.costSlotRight : cardStyles.costSlotLeft,
  );
  return (
    <div className={slotClass}>
      {renderCostRow(slots, alignment, keyPrefix)}
    </div>
  );
}

function renderItemBox(
  items: string[],
  slot: ItemSlotKey,
  side: "left" | "right",
): JSX.Element {
  const boxClass = classNames(
    cardStyles.centerItemBox,
    slot === "top"
      ? cardStyles.centerItemBoxTop
      : slot === "bottom"
        ? cardStyles.centerItemBoxBottom
        : cardStyles.centerItemBoxMiddle,
    side === "left" ? cardStyles.centerItemBoxLeft : cardStyles.centerItemBoxRight,
  );
  return (
    <div className={boxClass}>
      {items.length > 0 ? (
        <ul className={styles.itemList}>
          {items.map((item, index) => (
            <li key={`${side}-${slot}-${index}`} className={styles.itemEntry}>
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <span className={cardStyles.centerPlaceholder}>-</span>
      )}
    </div>
  );
}

function renderCostColumn(
  side: "left" | "right",
  costs: AggregatedCostData,
  items: Record<ItemSlotKey, string[]>,
): JSX.Element {
  const isLeft = side === "left";
  const alignment: "left" | "right" = isLeft ? "left" : "right";
  const topSlots = isLeft ? costs.leftTop : costs.rightTop;
  const bottomSlots = isLeft ? costs.leftBottom : costs.rightBottom;

  return (
    <div
      className={classNames(
        cardStyles.costColumn,
        isLeft ? cardStyles.costColumnLeft : cardStyles.costColumnRight,
      )}
    >
      {renderCostSlot(topSlots, alignment, "top", `${side}-top`)}
      {renderItemBox(items.top, "top", side)}
      {renderItemBox(items.middle, "middle", side)}
      {renderItemBox(items.bottom, "bottom", side)}
      {renderCostSlot(bottomSlots, alignment, "bottom", `${side}-bottom`)}
    </div>
  );
}

export function CraftedLensPreview({ lens, className, getCard }: Props): JSX.Element {
  const aggregatedCosts = aggregateCosts(lens, getCard);
  const aggregatedItems = aggregateItems(lens);
  const metaEntries = [
    { label: "土台", value: lens.foundationCost },
    { label: "VP", value: lens.vpTotal ?? 0 },
    { label: "左計", value: lens.leftTotal },
    { label: "右計", value: lens.rightTotal },
  ];

  return (
    <article className={classNames(cardStyles.card, styles.lensCard, className)}>
      <div className={cardStyles.inner}>
        <header className={classNames(cardStyles.header, styles.lensHeader)}>
          <span className={cardStyles.name}>{lens.lensId}</span>
          <div className={styles.lensMeta}>
            {metaEntries.map(({ label, value }) => (
              <span key={label} className={styles.lensBadge}>
                <span className={styles.lensBadgeLabel}>{label}</span>
                <span className={styles.lensBadgeValue}>{value ?? "-"}</span>
              </span>
            ))}
          </div>
        </header>
        <div className={cardStyles.main}>
          <div className={cardStyles.costLayout}>
            {renderCostColumn("left", aggregatedCosts, aggregatedItems.left)}
            {renderCostColumn("right", aggregatedCosts, aggregatedItems.right)}
          </div>
        </div>
      </div>
    </article>
  );
}

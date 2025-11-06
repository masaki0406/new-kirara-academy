import type { CraftedLens, CraftedLensSideItem } from "@domain/types";
import styles from "./CraftedLensPreview.module.css";

interface Props {
  lens: CraftedLens;
  className?: string;
}

function formatPosition(position: number | null | undefined): string {
  if (position === null || position === undefined || Number.isNaN(position)) {
    return "-";
  }
  return `POS ${position}`;
}

function formatItem(item: CraftedLensSideItem): string {
  const label = item.item ?? item.cardId;
  if (item.quantity !== undefined && item.quantity !== null && item.quantity !== 0) {
    return `${label} × ${item.quantity}`;
  }
  return label;
}

export function CraftedLensPreview({ lens, className }: Props): JSX.Element {
  const diff = lens.rightTotal - lens.leftTotal;
  const requirement = Math.max(0, Math.ceil(diff));
  const composedClassName = [styles.card, className].filter(Boolean).join(" ");
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
      <div className={styles.body}>
        <div className={styles.sideColumn}>
          <h6 className={styles.sideTitle}>左サイド</h6>
          {lens.leftItems.length === 0 ? (
            <p className={styles.sideEmpty}>割り当てなし</p>
          ) : (
            <ul className={styles.itemList}>
              {lens.leftItems.map((item) => (
                <li key={`${item.cardId}-left`} className={styles.itemRow}>
                  <span className={styles.itemPosition}>{formatPosition(item.position)}</span>
                  <span className={styles.itemLabel}>{formatItem(item)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className={styles.sideColumn}>
          <h6 className={styles.sideTitle}>右サイド</h6>
          {lens.rightItems.length === 0 ? (
            <p className={styles.sideEmpty}>割り当てなし</p>
          ) : (
            <ul className={styles.itemList}>
              {lens.rightItems.map((item) => (
                <li key={`${item.cardId}-right`} className={styles.itemRow}>
                  <span className={styles.itemPosition}>{formatPosition(item.position)}</span>
                  <span className={styles.itemLabel}>{formatItem(item)}</span>
                </li>
              ))}
            </ul>
          )}
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

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

type TokenVariant = "cost" | "reward" | "meta";

interface SymbolDefinition {
  kind: CardSymbolKind;
  label: string;
  keywords: string[];
  icon: JSX.Element;
}

interface TokenDefinition {
  id: string;
  kind: CardSymbolKind;
  label: string;
  value?: number;
  variant: TokenVariant;
}

interface CostNoteEntry {
  key: string;
  displayLabel: string;
  value: unknown;
}

const COST_NOTE_KEYWORDS = ["costa", "costb", "costc"];

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

function isCostNoteKey(raw: string): boolean {
  const normalized = normalizeKeyword(raw);
  return COST_NOTE_KEYWORDS.includes(normalized);
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

function collectCostNotes(
  ...sources: Array<Array<[string, unknown]> | undefined>
): CostNoteEntry[] {
  const cache = new Map<string, CostNoteEntry>();
  sources.forEach((source) => {
    source?.forEach(([key, value]) => {
      if (!isCostNoteKey(key)) {
        return;
      }
      const normalized = normalizeKeyword(key);
      if (cache.has(normalized)) {
        return;
      }
      cache.set(normalized, {
        key,
        displayLabel: formatCostNoteLabel(key),
        value,
      });
    });
  });
  return Array.from(cache.values());
}

function formatCostNoteLabel(rawKey: string): string {
  const match = rawKey.match(/cost\s*([a-z0-9]+)/i);
  if (match && match[1]) {
    return `Cost ${match[1].toUpperCase()}`;
  }
  if (/^cost$/i.test(rawKey.trim())) {
    return "Cost";
  }
  return rawKey;
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

function formatTokenValue(token: TokenDefinition): string | undefined {
  if (token.value === undefined || Number.isNaN(token.value)) {
    return undefined;
  }
  if (token.variant === "reward" && token.value > 0) {
    return `+${token.value}`;
  }
  return String(token.value);
}

interface Props {
  card: CatalogDevelopmentCard;
  className?: string;
}

export function DevelopmentCardPreview({ card, className }: Props): JSX.Element {
  const displayName = (card.cardId ?? card.id ?? "").trim() || card.id || "未登録カード";
  const mainSymbol = resolveSymbolKind(card.costItem);
  const themeClass = getThemeClassName(mainSymbol);
  const tokensCost = buildTokens(card.costLeftUp, "cost", (key) => !isCostNoteKey(key));
  const tokensReward = buildTokens(card.costLeftDown, "reward", (key) => !isCostNoteKey(key));
  const extrasEntries = card.extras ? Object.entries(card.extras) : [];
  const costNotesFromCostMap = card.costLeftUp
    ? Object.entries(card.costLeftUp).filter(([key]) => isCostNoteKey(key))
    : undefined;
  const costNotesFromExtras = extrasEntries.filter(([key]) => isCostNoteKey(key));
  const costNotes = collectCostNotes(costNotesFromCostMap, costNotesFromExtras);
  const extras = extrasEntries.filter(([key]) => !isCostNoteKey(key));

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
          <div className={styles.tokenRow}>
            {tokensCost.length === 0
              ? costNotes.length === 0 && (
                  <span className={styles.tokenRowEmpty}>コスト情報なし</span>
                )
              : tokensCost.map((token) => (
                  <span
                    key={token.id}
                    className={classNames(
                      styles.symbolBox,
                      styles[
                        `symbol${token.kind.charAt(0).toUpperCase()}${token.kind.slice(1)}`
                      ] ?? styles.symbolNeutral,
                    )}
                    data-variant={token.variant}
                    tabIndex={-1}
                  >
                    <span className={styles.symbolIcon}>
                      {SYMBOL_DEFINITIONS.find((definition) => definition.kind === token.kind)
                        ?.icon ?? (
                        <svg
                          className={styles.symbolSvg}
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                          focusable="false"
                        >
                          <circle cx="12" cy="12" r="8" fill="currentColor" />
                        </svg>
                      )}
                    </span>
                    {token.value !== undefined ? (
                      <span className={styles.symbolValue}>{formatTokenValue(token)}</span>
                    ) : null}
                    <span className={styles.symbolLabel}>{token.label}</span>
                    <span className={styles.srOnly}>
                      {token.label} {formatTokenValue(token) ?? ""}
                    </span>
                  </span>
                ))}
          </div>

          <div className={styles.center}>
            <div className={styles.centerBadge}>
              <span className={styles.centerIcon}>
                {mainSymbol?.icon ?? (
                  <svg
                    className={styles.centerSvg}
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <circle cx="12" cy="12" r="8" fill="currentColor" />
                  </svg>
                )}
              </span>
              {typeof card.costNumber === "number" ? (
                <span className={styles.centerValue}>{card.costNumber}</span>
              ) : null}
            </div>
            <span className={styles.centerLabel}>{mainSymbol?.label ?? card.costItem ?? "未分類"}</span>
          </div>

          <div className={styles.tokenRow}>
            {tokensReward.length === 0 ? (
              <span className={styles.tokenRowEmpty}>効果情報なし</span>
            ) : (
              tokensReward.map((token) => (
                <span
                  key={token.id}
                  className={classNames(
                    styles.symbolBox,
                    styles[`symbol${token.kind.charAt(0).toUpperCase()}${token.kind.slice(1)}`] ??
                      styles.symbolNeutral,
                  )}
                  data-variant={token.variant}
                  tabIndex={-1}
                >
                  <span className={styles.symbolIcon}>
                    {SYMBOL_DEFINITIONS.find((definition) => definition.kind === token.kind)
                      ?.icon ?? (
                      <svg
                        className={styles.symbolSvg}
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        focusable="false"
                      >
                        <rect x="5" y="5" width="14" height="14" fill="currentColor" rx="3" />
                      </svg>
                    )}
                  </span>
                  {token.value !== undefined ? (
                    <span className={styles.symbolValue}>{formatTokenValue(token)}</span>
                  ) : null}
                  <span className={styles.symbolLabel}>{token.label}</span>
                  <span className={styles.srOnly}>
                    {token.label} {formatTokenValue(token) ?? ""}
                  </span>
                </span>
              ))
            )}
          </div>
        </div>

        {costNotes.length > 0 || extras.length > 0 ? (
          <footer className={styles.extras}>
            {costNotes.length > 0 ? (
              <div className={styles.costNotesRow}>
                {costNotes.map((note) => (
                  <span key={note.key} className={styles.costNote}>
                    <span className={styles.costNoteLabel}>{note.displayLabel}</span>
                    <span className={styles.costNoteValue}>{formatExtraValue(note.value)}</span>
                  </span>
                ))}
              </div>
            ) : null}
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

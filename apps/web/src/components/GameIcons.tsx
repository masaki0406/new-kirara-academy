import type { JSX } from "react";
import styles from "./GameIcons.module.css";

export type GameIconKind =
    | "light"
    | "rainbow"
    | "stagnation"
    | "vp"
    | "action"
    | "creativity"
    | "lobby"
    | "growth"
    | "neutral";

interface GameIconProps {
    kind: GameIconKind;
    size?: "small" | "medium" | "large";
    className?: string;
}

const ICON_PATHS: Record<GameIconKind, JSX.Element> = {
    light: (
        <>
            <circle cx="12" cy="12" r="5.5" fill="currentColor" opacity="0.88" />
            <path
                d="M12 2.5v2.5M12 19v2.5M4.5 12H2M22 12h-2.5M6 6l-1.8-1.8M19.8 19.8 18 18M6 18l-1.8 1.8M19.8 4.2 18 6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
                opacity="0.7"
            />
        </>
    ),
    rainbow: (
        <>
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
        </>
    ),
    stagnation: (
        <>
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
        </>
    ),
    vp: (
        <path
            d="m12 3.2 2.3 5.16 5.6.5-4.25 3.74 1.3 5.43L12 15.7l-4.95 2.33 1.3-5.43L4.1 8.86l5.6-.5Z"
            fill="currentColor"
        />
    ),
    action: (
        <path
            d="M13.5 2 4 13.2h6.1L9.8 22 20 10.4h-6.2L13.5 2Z"
            fill="currentColor"
        />
    ),
    creativity: (
        <>
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
        </>
    ),
    lobby: (
        <>
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
        </>
    ),
    growth: (
        <path
            d="M12 21c0-4-1.5-7-5-9.5 3.5-.5 5-2.5 5-5.5 0 3 1.5 5 5 5.5C13.5 13.5 12 17 12 21Z"
            fill="currentColor"
        />
    ),
    neutral: (
        <circle cx="12" cy="12" r="8" fill="currentColor" />
    ),
};

export const ICON_LABELS: Record<GameIconKind, string> = {
    light: "光",
    rainbow: "虹",
    stagnation: "淀み",
    vp: "VP",
    action: "行動力",
    creativity: "創造力",
    lobby: "ロビー",
    growth: "成長",
    neutral: "",
};

const ICON_KEYWORDS: Record<GameIconKind, string[]> = {
    light: ["light", "光", "hikari"],
    rainbow: ["rainbow", "虹", "niji", "虹彩"],
    stagnation: ["stagnation", "淀み", "yodomi", "淀"],
    vp: ["vp", "victory", "point", "points", "vp点"],
    action: ["action", "ap", "行動", "行動力"],
    creativity: ["creativity", "cp", "創造", "創造力", "img", "想"],
    lobby: ["lobby", "ロビー", "loby"],
    growth: ["growth", "成長", "grow"],
    neutral: [],
};

function normalizeKeyword(raw: string): string {
    return raw
        .normalize("NFKC")
        .replace(/[\s_\-・:：]/g, "")
        .toLowerCase();
}

export function resolveIconKind(raw?: string | null): GameIconKind | null {
    if (!raw) {
        return null;
    }
    const normalized = normalizeKeyword(raw);
    for (const [kind, keywords] of Object.entries(ICON_KEYWORDS)) {
        for (const keyword of keywords) {
            if (normalized.includes(normalizeKeyword(keyword))) {
                return kind as GameIconKind;
            }
        }
    }
    return null;
}

export function GameIcon({ kind, size = "medium", className }: GameIconProps): JSX.Element {
    const sizeClass = styles[`size${size.charAt(0).toUpperCase()}${size.slice(1)}`];
    const colorClass = styles[`color${kind.charAt(0).toUpperCase()}${kind.slice(1)}`];

    return (
        <span className={`${styles.iconWrapper} ${sizeClass} ${colorClass} ${className ?? ""}`}>
            <svg
                className={styles.iconSvg}
                viewBox="0 0 24 24"
                aria-hidden="true"
                focusable="false"
            >
                {ICON_PATHS[kind]}
            </svg>
        </span>
    );
}

interface ItemWithIconProps {
    label: string;
    quantity?: number | null;
    size?: "small" | "medium" | "large";
    className?: string;
}

export function ItemWithIcon({ label, quantity, size = "small", className }: ItemWithIconProps): JSX.Element {
    const kind = resolveIconKind(label);
    const displayLabel = kind ? ICON_LABELS[kind] : label;
    const hasQuantity = quantity !== undefined && quantity !== null && quantity !== 0;

    return (
        <span className={`${styles.itemWithIcon} ${className ?? ""}`}>
            {kind && <GameIcon kind={kind} size={size} />}
            <span className={styles.itemLabel}>{displayLabel}</span>
            {hasQuantity && (
                <span className={styles.itemQuantity}>×{quantity}</span>
            )}
        </span>
    );
}

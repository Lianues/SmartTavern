/**
 * SmartTavern Theme Types (v1)
 * Type aggregation file - re-exports types from actual TypeScript modules.
 * This provides a unified import point for theme-related types.
 *
 * Source modules:
 *  - pack:    ../features/themes/pack.ts
 *  - store:   ../features/themes/store.ts
 *  - manager: ../features/themes/manager.ts
 */

// Re-export core types from pack.ts
export type {
  ThemeScriptPermissions,
  ThemeScript,
  ThemeTokens,
  ThemePackV1,
  ThemeApplyOptions
} from '../features/themes/pack'

// Re-export store types
export type {
  ThemeStoreState,
  ColorMode
} from '../features/themes/store'

// Additional utility types
export type ThemeTokenName = `--${string}`
export type ThemeEvent = 'change' | 'theme-applied' | 'theme-reset'
export type ThemeListener = (payload?: unknown) => void

/** Snapshot of current Appearance settings (subset; fields may expand in minor versions) */
export interface ThemeAppearanceSnapshot {
  // Threaded/common sizes
  contentFontSize?: number;
  nameFontSize?: number;
  badgeFontSize?: number;
  floorFontSize?: number;
  avatarSize?: number;
  chatWidth?: number;              // percentage
  inputHeight?: number;            // px

  // Opacity percentages (0~100)
  threadedBgOpacityPct?: number;
  threadedMsgBgOpacityPct?: number;
  threadedListBgOpacityPct?: number;
  threadedInputBgOpacityPct?: number;
  sandboxBgOpacityPct?: number;
  sandboxStageBgOpacityPct?: number;

  // Sandbox layout
  sandboxAspectX?: number;
  sandboxAspectY?: number;
  sandboxMaxWidth?: number;
  sandboxMaxWidthLimit?: number;
  sandboxPadding?: number;
  sandboxRadius?: number;

  // Threaded HTML stage
  thAspectX?: number;
  thAspectY?: number;
  thMaxWidthPct?: number;
  thPadding?: number;
  thRadius?: number;

  // Common appearance
  contentLineHeight?: number;
  messageGap?: number;
  cardRadius?: number | null;
  stripeWidth?: number;

  // Index signature for forward compatibility
  [key: string]: number | string | null | undefined;
}

/** Lightweight extension for theming runtime (no untrusted code execution) */
export interface ThemeExtension {
  /** Unique id */
  id: string;
  /** Whether the extension is active (default true) */
  enabled?: boolean;
  /** Optional priority for ordering (higher runs first); not strictly guaranteed */
  priority?: number;
  /** Logical scopes per contract.json (e.g., "chat-threaded", "sandbox") */
  scopes?: string[];
  /** Receive Appearance snapshot to optionally adjust tokens/CSS */
  applyAppearance?(snapshot: ThemeAppearanceSnapshot): void;
}

// Note: Module declarations removed as these files are now in TypeScript.
// Type exports are available directly from the TS modules.
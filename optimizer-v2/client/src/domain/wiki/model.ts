export type WikiInventoryKind =
  | 'equipment'
  | 'mechanics'
  | 'acquisition'
  | 'index';

export interface WikiPageSnapshot {
  pageId: number;
  pageTitle: string;
  sourceUrl: string;
  revisionId: string;
  revisionTimestamp: string;
  contentHash: string;
  redirectTarget?: string;
  content: string;
}

export interface WikiInventoryEntry {
  pageId: number;
  pageTitle: string;
  categories: string[];
  kind: WikiInventoryKind;
}

export interface WikiCoverageManifest {
  discovered: number;
  fetched: number;
  parsed: number;
  normalized: number;
  verified: number;
  partial: number;
  conflicting: number;
  unknown: number;
  legacy: number;
  unresolved: Array<{ pageTitle: string; reason: string }>;
}

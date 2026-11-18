import type {
  Asset,
  Edge,
  Projection,
  RenderSnapshot,
} from "../../../shared/types";

/**
 * The lightweight state that is stored on every history node.
 *
 * ImageData is deliberately absent: the node only keeps an asset id. The
 * canonical image resource lives once in the asset registry and is retained by
 * every node / export that references it.
 */
export interface StudioState {
  assetId: string | null;
  projection: Projection;
  edge: Edge;
}

export type OperationKind =
  | "initial"
  | "asset"
  | "projection"
  | "view"
  | "edge"
  | "branch";

export interface HistoryNode {
  id: string;
  branchId: string;
  parentId: string | null;
  state: StudioState;
  kind: OperationKind;
  label: string;
  createdAt: number;
}

export interface HistoryBranch {
  id: string;
  name: string;
  color: string;
  nodes: HistoryNode[];
  /** Index into `nodes`. Browsing history only moves this cursor. */
  cursor: number;
  forkedFrom: { branchId: string; nodeId: string } | null;
  /** Used to pick the least recently used branch when the branch cap is hit. */
  lastUsedAt: number;
}

export interface HistoryStats {
  nodes: number;
  branches: number;
  maxNodesPerBranch: number;
  maxBranches: number;
  assets: number;
  assetBytes: number;
  pinnedAssets: number;
}

export interface FrozenContent {
  snapshot: RenderSnapshot;
  nodeId: string;
  label: string;
  /** Releases the export's pin; safe to call more than once. */
  release: () => void;
}

export interface HistoryController {
  readonly branches: readonly HistoryBranch[];
  readonly activeBranchId: string;
  readonly activeBranch: HistoryBranch | null;
  readonly activeNode: HistoryNode | null;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly gestureActive: boolean;
  readonly message: string;
  readonly maxNodesPerBranch: number;
  readonly maxBranches: number;
  readonly stats: HistoryStats;
  undo: () => void;
  redo: () => void;
  /**
   * Starts coalescing all mutations until endGesture/cancelGesture.
   * `onCancel` lets the input reset its own transient state (e.g. a drag origin)
   * when the gesture is aborted.
   */
  beginGesture: (
    label: string,
    kind: OperationKind,
    onCancel?: () => void,
  ) => void;
  endGesture: () => void;
  cancelGesture: () => void;
  /** Runs a discrete mutation as exactly one history operation. */
  transact: (label: string, kind: OperationKind, fn: () => void) => void;
  /**
   * Records the current document state if it differs from the selected node.
   * Used as a fallback when a native control's `change` event fires after the
   * gesture handlers have already run; it is a no-op in that case.
   */
  commit: (label: string, kind: OperationKind) => void;
  /** Adds the image to the shared registry and records one operation. */
  replaceAsset: (asset: Asset) => void;
  browse: (nodeId: string) => void;
  forkFrom: (nodeId: string) => boolean;
  switchBranch: (branchId: string, toHead?: boolean) => void;
  closeBranch: (branchId: string) => void;
  resolveAsset: (assetId: string | null) => Asset | null;
  /** Freezes the selected node and pins its image for the duration of an export. */
  freezeContent: () => FrozenContent | null;
  clearMessage: () => void;
}

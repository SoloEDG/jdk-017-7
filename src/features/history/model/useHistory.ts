import { computed, markRaw, reactive, ref } from "vue";
import type { Asset, StudioDocument } from "../../../shared/types";
import { defaultEdge, defaultProjection } from "../../../shared/defaults";
import { AssetRegistry } from "./registry";
import type {
  FrozenContent,
  HistoryBranch,
  HistoryController,
  HistoryNode,
  OperationKind,
  StudioState,
} from "./types";

export const MAX_NODES_PER_BRANCH = 50;
export const MAX_BRANCHES = 4;

const BRANCH_COLORS = ["#337d60", "#b2764b", "#5b6ea8", "#a05a7a", "#8b8a45"];

const cloneState = (s: StudioState): StudioState => ({
  assetId: s.assetId,
  projection: { ...s.projection },
  edge: { ...s.edge },
});

function sameState(a: StudioState, b: StudioState) {
  return (
    a.assetId === b.assetId &&
    a.projection.mode === b.projection.mode &&
    a.projection.zoom === b.projection.zoom &&
    a.projection.yaw === b.projection.yaw &&
    a.projection.pitch === b.projection.pitch &&
    a.projection.roll === b.projection.roll &&
    a.edge.seam === b.edge.seam &&
    a.edge.feather === b.edge.feather &&
    a.edge.background === b.edge.background &&
    a.edge.transparent === b.edge.transparent
  );
}

interface Gesture {
  label: string;
  kind: OperationKind;
  onCancel?: () => void;
  escape: (e: KeyboardEvent) => void;
}

export function createHistory(doc: StudioDocument): HistoryController {
  const registry = new AssetRegistry();
  const resourceVersion = ref(0);
  const touchResources = () => (resourceVersion.value += 1);

  const branches = reactive<HistoryBranch[]>([]);
  const activeBranchId = ref("");
  const message = ref("");
  const gestureActive = ref(false);
  const maxNodesPerBranch = MAX_NODES_PER_BRANCH;
  const maxBranches = MAX_BRANCHES;

  let nodeSeq = 0;
  let branchSeq = 0;
  let gesture: Gesture | null = null;

  const stateOf = (): StudioState => ({
    assetId: doc.asset?.id ?? null,
    projection: { ...doc.projection },
    edge: { ...doc.edge },
  });

  const activeBranch = computed(
    () => branches.find((b) => b.id === activeBranchId.value) ?? null,
  );
  const activeNode = computed(() => {
    const branch = activeBranch.value;
    return branch?.nodes[branch.cursor] ?? null;
  });

  function applyState(state: StudioState) {
    const asset = registry.get(state.assetId);
    doc.asset = asset ? markRaw(asset) : null;
    Object.assign(doc.projection, state.projection);
    Object.assign(doc.edge, state.edge);
  }

  function applyBranchCursor(branch: HistoryBranch) {
    const node = branch.nodes[branch.cursor];
    if (node) applyState(node.state);
  }

  function newNode(
    branchId: string,
    state: StudioState,
    kind: OperationKind,
    label: string,
    parentId: string | null,
  ): HistoryNode {
    const node: HistoryNode = {
      id: `n${++nodeSeq}`,
      branchId,
      parentId,
      state: cloneState(state),
      kind,
      label,
      createdAt: Date.now(),
    };
    if (node.state.assetId) registry.retain(node.state.assetId);
    return node;
  }

  function releaseNodes(nodes: HistoryNode[]) {
    for (const node of nodes)
      if (node.state.assetId) registry.release(node.state.assetId);
  }

  /**
   * Enforces the per-branch node cap. Oldest nodes go first; the cursor always
   * points at a live node because new operations truncate the redo tail first.
   */
  function compactBranch(branch: HistoryBranch) {
    const dropped: HistoryNode[] = [];
    while (branch.nodes.length > maxNodesPerBranch) {
      const [oldest] = branch.nodes.splice(0, 1);
      dropped.push(oldest);
      branch.cursor = Math.max(0, branch.cursor - 1);
    }
    releaseNodes(dropped);
    touchResources();
    return dropped.length;
  }

  /** Appends an operation unless it would duplicate the selected node. */
  function pushNode(
    state: StudioState,
    kind: OperationKind,
    label: string,
  ): HistoryNode | null {
    const branch = activeBranch.value;
    if (!branch) return null;
    if (branch.nodes.length && sameState(branch.nodes[branch.cursor].state, state))
      return null;
    // A new operation from a browsed node discards that branch's redo tail.
    if (branch.cursor < branch.nodes.length - 1)
      releaseNodes(branch.nodes.splice(branch.cursor + 1));
    const parent = branch.nodes[branch.cursor] ?? null;
    const node = newNode(branch.id, state, kind, label, parent?.id ?? null);
    branch.nodes.push(node);
    branch.cursor = branch.nodes.length - 1;
    branch.lastUsedAt = Date.now();
    const evicted = compactBranch(branch);
    if (evicted) {
      sweepIdleAssets();
      message.value = `历史已满 ${maxNodesPerBranch} 步，最早的操作已移出历史。`;
    }
    touchResources();
    return node;
  }

  function removeBranch(branch: HistoryBranch) {
    const index = branches.indexOf(branch);
    if (index < 0) return;
    releaseNodes(branch.nodes);
    branches.splice(index, 1);
    if (activeBranchId.value === branch.id) {
      const fallback = branches[Math.min(index, branches.length - 1)];
      activeBranchId.value = fallback?.id ?? "";
      if (fallback) {
        fallback.lastUsedAt = Date.now();
        applyBranchCursor(fallback);
      }
    }
    sweepIdleAssets();
    touchResources();
  }

  function pruneBranches(): string[] {
    const dropped: string[] = [];
    while (branches.length > maxBranches) {
      const victim = branches
        .filter((b) => b.id !== activeBranchId.value)
        .sort((a, b) => a.lastUsedAt - b.lastUsedAt)[0];
      if (!victim) break;
      const index = branches.indexOf(victim);
      releaseNodes(victim.nodes);
      branches.splice(index, 1);
      dropped.push(victim.name);
    }
    if (dropped.length) sweepIdleAssets();
    return dropped;
  }

  function selectBranch(branch: HistoryBranch, toHead = false) {
    activeBranchId.value = branch.id;
    branch.lastUsedAt = Date.now();
    if (toHead) branch.cursor = branch.nodes.length - 1;
    applyBranchCursor(branch);
  }

  /** Drops images that no history node references and no export is using. */
  function sweepIdleAssets() {
    const live = new Set<string>();
    for (const branch of branches)
      for (const node of branch.nodes)
        if (node.state.assetId) live.add(node.state.assetId);
    registry.sweep(live);
    touchResources();
  }

  function beginGesture(
    label: string,
    kind: OperationKind,
    onCancel?: () => void,
  ) {
    if (gesture) return;
    gesture = {
      label,
      kind,
      onCancel,
      escape: (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          cancelGesture();
        }
      },
    };
    gestureActive.value = true;
    window.addEventListener("keydown", gesture.escape);
  }

  function finishGesture(record: boolean) {
    const current = gesture;
    if (!current) return;
    gesture = null;
    gestureActive.value = false;
    window.removeEventListener("keydown", current.escape);
    if (!record) {
      // Cancelled: snap back to the selected node's committed state and never
      // append the half-finished adjustment.
      current.onCancel?.();
      const branch = activeBranch.value;
      if (branch) applyBranchCursor(branch);
      message.value = "已取消本次调整";
      return;
    }
    if (!activeNode.value) return;
    // If a native `change` fallback already committed this state, pushNode is
    // a no-op, so a whole drag still produces exactly one node.
    pushNode(stateOf(), current.kind, current.label);
  }

  function endGesture() {
    finishGesture(true);
  }

  function cancelGesture() {
    finishGesture(false);
  }

  function transact(label: string, kind: OperationKind, fn: () => void) {
    // A discrete action never folds into an open gesture (e.g. a click during a
    // wheel-zoom burst): close that gesture first so each stays one operation.
    settle();
    const before = stateOf();
    fn();
    if (!sameState(before, stateOf())) pushNode(stateOf(), kind, label);
  }

  /** Commits any in-flight gesture before a discrete action runs. */
  function settle() {
    if (gesture) finishGesture(true);
  }

  function commit(label: string, kind: OperationKind) {
    if (gestureActive.value) return;
    if (!activeNode.value) return;
    pushNode(stateOf(), kind, label);
  }

  function replaceAsset(asset: Asset) {
    // An import that resolves mid-drag must not be folded into that drag.
    settle();
    // Register the image before recording the node so undo/redo can restore the
    // resource itself, not just the file name.
    registry.add(asset);
    doc.asset = markRaw(asset);
    pushNode(stateOf(), "asset", `替换素材：${asset.name}`);
    sweepIdleAssets();
  }

  function undo() {
    const branch = activeBranch.value;
    if (!branch) return;
    // An unfinished drag is not a step yet: cancel it and stop here, so the
    // first Ctrl+Z during a gesture only rolls back that gesture.
    if (gesture) return cancelGesture();
    if (branch.cursor <= 0) return;
    branch.cursor -= 1;
    branch.lastUsedAt = Date.now();
    applyBranchCursor(branch);
    message.value = "";
  }

  function redo() {
    const branch = activeBranch.value;
    if (!branch) return;
    if (gesture) return cancelGesture();
    if (branch.cursor >= branch.nodes.length - 1) return;
    branch.cursor += 1;
    branch.lastUsedAt = Date.now();
    applyBranchCursor(branch);
    message.value = "";
  }

  function browse(nodeId: string) {
    const branch = activeBranch.value;
    if (!branch) return;
    const index = branch.nodes.findIndex((n) => n.id === nodeId);
    if (index < 0) return;
    // Clicking a node while dragging abandons the uncommitted drag.
    settle();
    branch.cursor = index;
    branch.lastUsedAt = Date.now();
    applyBranchCursor(branch);
    message.value = "";
  }

  function forkFrom(nodeId: string): boolean {
    let source: HistoryNode | undefined;
    for (const branch of branches) {
      const found = branch.nodes.find((n) => n.id === nodeId);
      if (found) {
        source = found;
        break;
      }
    }
    if (!source) return false;
    // A deliberate navigation commits any in-flight adjustment as its own step
    // rather than silently discarding it.
    settle();
    const branch: HistoryBranch = {
      id: `b${++branchSeq}`,
      name: `尝试 ${branches.length + 1}`,
      color: BRANCH_COLORS[branchSeq % BRANCH_COLORS.length],
      nodes: [],
      cursor: 0,
      forkedFrom: { branchId: source.branchId, nodeId: source.id },
      lastUsedAt: Date.now(),
    };
    branches.push(branch);
    activeBranchId.value = branch.id;
    const node = newNode(
      branch.id,
      source.state,
      "branch",
      `从「${source.label}」开新分支`,
      source.id,
    );
    branch.nodes.push(node);
    branch.cursor = 0;
    applyState(node.state);
    const dropped = pruneBranches();
    touchResources();
    message.value = dropped.length
      ? `已开新分支；分支上限 ${maxBranches} 个，已释放最久未用的「${dropped.join("」「")}」。`
      : "已从选中节点开新分支，原分支保持不变。";
    return true;
  }

  function switchBranch(branchId: string, toHead = false) {
    const branch = branches.find((b) => b.id === branchId);
    if (!branch) return;
    if (branch.id === activeBranchId.value) {
      if (toHead) {
        settle();
        branch.cursor = branch.nodes.length - 1;
        applyBranchCursor(branch);
      }
      return;
    }
    settle();
    selectBranch(branch, toHead);
    message.value = "";
  }

  function closeBranch(branchId: string) {
    if (branches.length <= 1) {
      message.value = "至少保留一个分支。";
      return;
    }
    const branch = branches.find((b) => b.id === branchId);
    if (!branch) return;
    removeBranch(branch);
    message.value = `已关闭分支「${branch.name}」；无人引用的素材已释放。`;
  }

  function resolveAsset(assetId: string | null): Asset | null {
    return registry.get(assetId);
  }

  function freezeContent(): FrozenContent | null {
    const node = activeNode.value;
    if (!node) return null;
    const asset = registry.get(node.state.assetId);
    if (!asset) return null;
    // Pin the image so compaction, branch switches or history eviction cannot
    // release its pixels while the export is still reading them.
    registry.pin(asset.id);
    touchResources();
    let released = false;
    return {
      nodeId: node.id,
      label: node.label,
      snapshot: {
        asset,
        projection: { ...node.state.projection },
        edge: { ...node.state.edge },
      },
      release: () => {
        if (released) return;
        released = true;
        registry.unpin(asset.id);
        sweepIdleAssets();
        touchResources();
      },
    };
  }

  const stats = computed(() => {
    resourceVersion.value;
    return {
      nodes: branches.reduce((sum, branch) => sum + branch.nodes.length, 0),
      branches: branches.length,
      maxNodesPerBranch,
      maxBranches,
      ...registry.stats(),
    };
  });

  const canUndo = computed(() => (activeBranch.value?.cursor ?? 0) > 0);
  const canRedo = computed(() => {
    const branch = activeBranch.value;
    return !!branch && branch.cursor < branch.nodes.length - 1;
  });

  // Baseline node: the fixed starting point every session can browse back to.
  const initial: HistoryBranch = {
    id: `b${++branchSeq}`,
    name: "主分支",
    color: BRANCH_COLORS[0],
    nodes: [],
    cursor: 0,
    forkedFrom: null,
    lastUsedAt: Date.now(),
  };
  branches.push(initial);
  activeBranchId.value = initial.id;
  const baseline = newNode(
    initial.id,
    {
      assetId: null,
      projection: defaultProjection(),
      edge: defaultEdge(),
    },
    "initial",
    "开始创作",
    null,
  );
  initial.nodes.push(baseline);

  return reactive({
    branches,
    activeBranchId,
    activeBranch,
    activeNode,
    canUndo,
    canRedo,
    gestureActive,
    message,
    maxNodesPerBranch,
    maxBranches,
    stats,
    undo,
    redo,
    beginGesture,
    endGesture,
    cancelGesture,
    transact,
    commit,
    replaceAsset,
    browse,
    forkFrom,
    switchBranch,
    closeBranch,
    resolveAsset,
    freezeContent,
    clearMessage: () => (message.value = ""),
  }) as HistoryController;
}

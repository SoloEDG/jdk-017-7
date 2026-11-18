export { default as HistoryPanel } from "./ui/HistoryPanel.vue";
export { default as HistoryToolbar } from "./ui/HistoryToolbar.vue";
export { bindHistoryShortcuts } from "./lib/shortcuts";
export { createHistory } from "./model/useHistory";
export {
  MAX_BRANCHES,
  MAX_NODES_PER_BRANCH,
} from "./model/useHistory";
export type {
  FrozenContent,
  HistoryBranch,
  HistoryController,
  HistoryNode,
  OperationKind,
  StudioState,
} from "./model/types";

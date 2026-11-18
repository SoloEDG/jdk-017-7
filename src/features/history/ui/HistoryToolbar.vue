<script setup lang="ts">
import { Undo2, Redo2, GitFork, GitBranch } from "lucide-vue-next";
import type { HistoryController } from "../../history";
const props = defineProps<{ history: HistoryController }>();
const { history } = props;

function fork() {
  if (history.activeNode) history.forkFrom(history.activeNode.id);
}
</script>
<template>
  <section class="history-toolbar" aria-label="操作历史工具栏">
    <div class="history-buttons">
      <button
        class="history-button"
        type="button"
        :disabled="!history.canUndo"
        title="撤销（Ctrl / ⌘ + Z）"
        aria-label="撤销"
        @click="history.undo()"
      >
        <Undo2 :size="16" />
      </button>
      <button
        class="history-button"
        type="button"
        :disabled="!history.canRedo"
        title="重做（Ctrl / ⌘ + Shift + Z）"
        aria-label="重做"
        @click="history.redo()"
      >
        <Redo2 :size="16" />
      </button>
      <b class="divider" />
      <button
        class="history-button"
        type="button"
        title="从当前节点开新分支"
        aria-label="从当前节点开新分支"
        @click="fork"
      >
        <GitFork :size="16" />
      </button>
    </div>
    <div class="history-branch-select">
      <GitBranch :size="14" />
      <select
        aria-label="切换历史分支"
        :value="history.activeBranchId"
        @change="
          history.switchBranch(($event.target as HTMLSelectElement).value)
        "
      >
        <option v-for="b in history.branches" :key="b.id" :value="b.id">
          {{ b.name }}
        </option>
      </select>
    </div>
    <p v-if="history.message" class="history-message" role="status">
      {{ history.message }}
    </p>
  </section>
</template>

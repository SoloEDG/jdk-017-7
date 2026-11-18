<script setup lang="ts">
import { computed } from "vue";
import { History, GitFork, Trash2, ArrowRight } from "lucide-vue-next";
import type { HistoryController } from "../../history";
const props = defineProps<{ history: HistoryController }>();
const { history } = props;

const nodeIndex = computed(() => {
  const branch = history.activeBranch;
  if (!branch) return [] as { id: string; index: number }[];
  return branch.nodes.map((n, index) => ({ id: n.id, index }));
});
const branchNodeCount = computed(
  () => history.activeBranch?.nodes.length ?? 0,
);

function depthLabel(i: number) {
  return String(i + 1).padStart(2, "0");
}
</script>
<template>
  <section class="panel history-panel" aria-label="操作历史">
    <div class="section-label">
      <span>操作历史</span><History :size="15" />
    </div>
    <div class="history-meta">
      <span
        >{{ history.stats.nodes }} / {{ history.maxNodesPerBranch }} 步 ·
        {{ history.stats.branches }} / {{ history.maxBranches }} 分支</span
      >
      <span title="共享素材数量与占用">{{ history.stats.assets }} 张素材</span>
    </div>
    <ol class="history-list" role="listbox" aria-label="当前分支的历史节点">
      <li
        v-for="item in nodeIndex"
        :key="item.id"
        role="option"
        :aria-selected="item.index === (history.activeBranch?.cursor ?? -1)"
        :class="{
          active: item.index === (history.activeBranch?.cursor ?? -1),
          future: item.index > (history.activeBranch?.cursor ?? -1),
        }"
      >
        <button
          type="button"
          class="history-node"
          @click="history.browse(item.id)"
        >
          <span class="node-index">{{ depthLabel(item.index) }}</span>
          <span class="node-body">
            <strong>{{ history.activeBranch?.nodes[item.index].label }}</strong>
            <small>{{
              new Date(
                history.activeBranch?.nodes[item.index].createdAt ?? 0,
              ).toLocaleTimeString("zh-CN", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })
            }}</small>
          </span>
        </button>
        <button
          type="button"
          class="node-fork"
          :title="`从第 ${item.index + 1} 步开新分支`"
          :aria-label="`从第 ${item.index + 1} 步开新分支`"
          @click="history.forkFrom(item.id)"
        >
          <GitFork :size="13" />
        </button>
      </li>
    </ol>
    <p v-if="!history.canRedo && history.activeBranch" class="mini">
      当前位于第 {{ (history.activeBranch.cursor ?? 0) + 1 }} /
      {{ branchNodeCount }} 步。选择任一节点即可回看，继续调整会在该节点后记录新操作。
    </p>
    <div class="branch-list">
      <div
        v-for="b in history.branches"
        :key="b.id"
        class="branch-chip"
        :class="{ active: b.id === history.activeBranchId }"
      >
        <button
          type="button"
          class="branch-select"
          :aria-label="`切换到分支 ${b.name}`"
          @click="history.switchBranch(b.id)"
        >
          <i :style="{ background: b.color }" />{{ b.name }}
          <small>{{ b.nodes.length }} 步</small>
        </button>
        <button
          v-if="history.branches.length > 1"
          type="button"
          class="branch-close"
          :aria-label="`关闭分支 ${b.name}`"
          :title="`关闭分支 ${b.name}`"
          @click="history.closeBranch(b.id)"
        >
          <Trash2 :size="12" />
        </button>
      </div>
    </div>
    <p class="history-foot">
      <ArrowRight :size="11" />共同素材在分支间共享；无人引用的素材会在容量回收时释放。
    </p>
  </section>
</template>

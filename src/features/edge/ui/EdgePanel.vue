<script setup lang="ts">
import { Blend } from "lucide-vue-next";
import type { StudioDocument } from "../../../shared/types";
import type { HistoryController } from "../../history";
import { useRangeGesture } from "../../history/lib/rangeGesture";
import { setSeam, setFeather, setBackground } from "../model/settings";
const props = defineProps<{
  doc: StudioDocument;
  history: HistoryController;
}>();
const { doc, history } = props;
const seamGesture = useRangeGesture(history, "调整接缝融合", "edge");
const featherGesture = useRangeGesture(history, "调整边缘羽化", "edge");

function onSeam(e: Event) {
  seamGesture.prepare();
  setSeam(doc.edge, Number((e.target as HTMLInputElement).value));
}
function onFeather(e: Event) {
  featherGesture.prepare();
  setFeather(doc.edge, Number((e.target as HTMLInputElement).value));
}
function onBackground(e: Event) {
  const value = (e.target as HTMLInputElement).value;
  history.transact("修改画面底色", "edge", () => setBackground(doc.edge, value));
}
function onTransparent(e: Event) {
  const checked = (e.target as HTMLInputElement).checked;
  history.transact(checked ? "开启透明背景" : "关闭透明背景", "edge", () => {
    doc.edge.transparent = checked;
  });
}
</script>
<template>
  <section class="panel">
    <div class="section-label">
      <span>04 / 边缘处理</span><Blend :size="16" />
    </div>
    <label class="control"
      >接缝融合 <output>{{ Math.round(doc.edge.seam * 100) }}%</output
      ><input
        aria-label="接缝融合"
        type="range"
        min="0"
        max="0.15"
        step="0.005"
        :value="doc.edge.seam"
        v-on="seamGesture"
        @input="onSeam" /></label
    ><label class="control"
      >圆形边缘羽化 <output>{{ Math.round(doc.edge.feather * 100) }}%</output
      ><input
        aria-label="边缘羽化"
        type="range"
        min="0"
        max="0.4"
        step="0.01"
        :value="doc.edge.feather"
        v-on="featherGesture"
        @input="onFeather"
    /></label>
    <div class="background-row">
      <label
        >画面底色
        <input
          aria-label="画面底色"
          type="color"
          :value="doc.edge.background"
          @change="onBackground" /></label
      ><label class="check"
        ><input
          type="checkbox"
          :checked="doc.edge.transparent"
          @change="onTransparent" />透明</label
      >
    </div>
    <p class="mini">羽化作用于圆形外缘，预览与导出同步。</p>
  </section>
</template>

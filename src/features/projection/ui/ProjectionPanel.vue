<script setup lang="ts">
import { Orbit, RotateCcw } from "lucide-vue-next";
import type { StudioDocument } from "../../../shared/types";
import type { HistoryController } from "../../history";
import { useRangeGesture } from "../../history/lib/rangeGesture";
import { updateProjection, resetProjection } from "../model/parameters";
const props = defineProps<{
  doc: StudioDocument;
  history: HistoryController;
}>();
const { doc, history } = props;
const zoomGesture = useRangeGesture(history, "调整星球尺度");

function setMode(mode: "planet" | "tunnel") {
  history.transact(
    mode === "planet" ? "切换为小行星投影" : "切换为时空隧道",
    "projection",
    () => updateProjection(doc.projection, "mode", mode),
  );
}
function setZoom(e: Event) {
  zoomGesture.prepare();
  updateProjection(doc.projection, "zoom", (e.target as HTMLInputElement).value);
}
function reset() {
  history.transact("重置投影与取景", "projection", () =>
    resetProjection(doc.projection),
  );
}
</script>
<template>
  <section class="panel">
    <div class="section-label"><span>02 / 投影</span><Orbit :size="16" /></div>
    <div class="segmented">
      <button
        :class="{ active: doc.projection.mode === 'planet' }"
        @click="setMode('planet')"
      >
        小行星</button
      ><button
        :class="{ active: doc.projection.mode === 'tunnel' }"
        @click="setMode('tunnel')"
      >
        时空隧道
      </button>
    </div>
    <label class="control"
      >星球尺度 <output>{{ doc.projection.zoom.toFixed(2) }}×</output
      ><input
        aria-label="星球尺度"
        type="range"
        min="0.3"
        max="3"
        step="0.01"
        :value="doc.projection.zoom"
        v-on="zoomGesture"
        @input="setZoom"
    /></label>
    <div class="range-labels"><span>更辽阔</span><span>更紧凑</span></div>
    <button class="text-button" @click="reset">
      <RotateCcw :size="13" /> 重置投影与取景
    </button>
  </section>
</template>

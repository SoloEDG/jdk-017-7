<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
import {
  Move,
  Maximize,
  MousePointer2,
  Plus,
  Minus,
  ScanLine,
} from "lucide-vue-next";
import type { StudioDocument, Projection } from "../../../shared/types";
import type { HistoryController } from "../../history";
import { usePreview } from "../model/usePreview";
import { dragView, wheelZoom } from "../lib/gestures";
const props = defineProps<{
  doc: StudioDocument;
  history: HistoryController;
}>();
const { doc, history } = props;
const canvas = ref<HTMLCanvasElement>();
const { rendering } = usePreview(doc, canvas);
const guides = ref(false);
let start: { x: number; y: number; p: Projection } | null = null;

function down(e: PointerEvent) {
  if (e.button !== 0) return;
  // A wheel gesture may still be coalescing; finish it separately so this drag
  // becomes its own operation.
  flushWheelGesture();
  start = { x: e.clientX, y: e.clientY, p: { ...doc.projection } };
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  // Escape aborts the drag: stop tracking so later pointermove can't resurrect
  // the half-finished view after history has rolled it back.
  history.beginGesture("拖动旋转视角", "view", () => (start = null));
}

function move(e: PointerEvent) {
  if (!start) return;
  Object.assign(
    doc.projection,
    dragView(
      start.p,
      e.clientX - start.x,
      e.clientY - start.y,
      (e.currentTarget as HTMLElement).clientWidth,
    ),
  );
}

/** Ends a drag. `committed` is false for pointercancel / lost capture. */
function end(committed: boolean) {
  if (!start) return;
  start = null;
  if (committed) history.endGesture();
  else history.cancelGesture();
}

let wheelTimer = 0;
function flushWheelGesture() {
  if (!wheelTimer) return;
  clearTimeout(wheelTimer);
  wheelTimer = 0;
  history.endGesture();
}
function wheel(e: WheelEvent) {
  // A burst of wheel events counts as one continuous zoom operation.
  if (!wheelTimer) history.beginGesture("滚轮缩放视角", "view");
  doc.projection.zoom = wheelZoom(doc.projection.zoom, e.deltaY);
  clearTimeout(wheelTimer);
  wheelTimer = window.setTimeout(flushWheelGesture, 220);
}
onBeforeUnmount(flushWheelGesture);
function zoomStep(delta: number) {
  history.transact(delta < 0 ? "放大视角" : "缩小视角", "view", () => {
    doc.projection.zoom = wheelZoom(doc.projection.zoom, delta);
  });
}
function resetZoom() {
  history.transact("重置缩放", "view", () => {
    doc.projection.zoom = 1;
  });
}
</script>
<template>
  <main class="viewport">
    <div class="viewport-heading">
      <div>
        <span class="eyebrow">LIVE CANVAS</span>
        <h1>换个视角，世界很小。</h1>
      </div>
      <span class="live"><i />{{ rendering ? "正在渲染" : "实时预览" }}</span>
    </div>
    <div class="canvas-area">
      <span class="corner-label"
        >{{
          doc.projection.mode === "planet" ? "LITTLE PLANET" : "INFINITE TUNNEL"
        }}
        / 01</span
      >
      <div
        class="canvas-wrap"
        :class="{ guides }"
        @pointerdown="down"
        @pointermove="move"
        @pointerup="end(true)"
        @pointercancel="end(false)"
        @lostpointercapture="end(false)"
        @wheel.prevent="wheel"
      >
        <canvas ref="canvas" aria-label="小行星实时投影画布" />
        <div v-if="!doc.asset" class="empty">导入一张照片，开启你的星球</div>
        <div v-if="guides" class="crosshair" />
      </div>
      <div class="canvas-caption">
        <span>STEREOGRAPHIC PROJECTION</span><span>600 × 600 · 预览</span>
      </div>
    </div>
    <div class="viewport-toolbar">
      <div class="gesture-hint">
        <MousePointer2 :size="14" /> 拖动旋转 <span>·</span
        ><Move :size="14" /> 滚轮缩放
      </div>
      <div class="tool-buttons">
        <button aria-label="缩小" @click="zoomStep(100)">
          <Minus :size="16" /></button
        ><span>{{ Math.round(doc.projection.zoom * 100) }}%</span
        ><button aria-label="放大" @click="zoomStep(-100)">
          <Plus :size="16" /></button
        ><b /><button
          aria-label="切换辅助线"
          :class="{ selected: guides }"
          @click="guides = !guides"
        >
          <ScanLine :size="17" /></button
        ><button aria-label="重置缩放" @click="resetZoom">
          <Maximize :size="16" />
        </button>
      </div>
    </div>
    <div class="inspiration">
      <span class="spark">✳</span>
      <div>
        <strong>每一片风景，都有另一个宇宙。</strong
        ><span>试试切换隧道模式，或轻轻拖动星球，寻找意想不到的构图。</span>
      </div>
      <span class="inspiration-number">017</span>
    </div>
  </main>
</template>

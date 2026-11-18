import { ref } from "vue";
import type {
  StudioDocument,
  ExportSettings,
  RenderSnapshot,
} from "../../../shared/types";
import type { HistoryController } from "../../history";
import { encodeImage } from "../lib/encode";

export function useExport(doc: StudioDocument, history: HistoryController) {
  const busy = ref(false),
    progress = ref(0),
    message = ref(""),
    exportingFrom = ref("");
  let controller: AbortController | null = null;
  async function download(settings: ExportSettings) {
    if (!doc.asset || busy.value) return;
    // Freeze the selected history node now. The image is pinned for the whole
    // job, so later edits, branch switches or history compaction cannot alter
    // what this export renders.
    const frozen = history.freezeContent();
    if (!frozen) {
      message.value = "当前历史节点没有可导出的素材";
      return;
    }
    busy.value = true;
    progress.value = 0;
    message.value = "";
    exportingFrom.value = frozen.label;
    controller = new AbortController();
    const snapshot: RenderSnapshot = frozen.snapshot,
      options = { ...settings };
    try {
      const blob = await encodeImage(
        snapshot,
        options,
        controller.signal,
        (n) => (progress.value = n),
      );
      controller.signal.throwIfAborted();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orbit-${snapshot.projection.mode}-${options.size}.${options.format === "png" ? "png" : "jpg"}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      message.value = "图片已导出，去下载目录看看吧";
    } catch (e) {
      message.value = controller.signal.aborted
        ? "已取消导出"
        : e instanceof Error
          ? e.message
          : "导出失败";
    } finally {
      frozen.release();
      busy.value = false;
      controller = null;
      exportingFrom.value = "";
    }
  }
  return {
    busy,
    progress,
    message,
    exportingFrom,
    download,
    cancel: () => controller?.abort(),
  };
}

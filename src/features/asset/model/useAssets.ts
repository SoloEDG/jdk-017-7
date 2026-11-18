import { ref } from "vue";
import type { StudioDocument } from "../../../shared/types";
import type { HistoryController } from "../../history";
import { decodeAsset } from "../lib/decode";
import { loadDemo } from "../lib/demo";

export function useAssets(doc: StudioDocument, history: HistoryController) {
  const busy = ref(false),
    error = ref("");
  let revision = 0;
  async function load(file?: File) {
    const ticket = ++revision;
    busy.value = true;
    error.value = "";
    try {
      const asset = file ? await decodeAsset(file, file.name) : await loadDemo();
      // A superseded import is discarded and never enters history.
      if (ticket !== revision) return;
      history.replaceAsset(asset);
    } catch (e) {
      // Failed imports surface an error but leave the document/history intact.
      if (ticket === revision)
        error.value = e instanceof Error ? e.message : "无法读取图片";
    } finally {
      if (ticket === revision) busy.value = false;
    }
  }
  return { busy, error, load };
}

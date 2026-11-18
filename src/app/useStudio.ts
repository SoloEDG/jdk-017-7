import { reactive } from "vue";
import type { StudioDocument } from "../shared/types";
import { defaultEdge, defaultProjection } from "../shared/defaults";
import { createHistory } from "../features/history";

export function useStudio() {
  const doc = reactive<StudioDocument>({
    asset: null,
    projection: defaultProjection(),
    edge: defaultEdge(),
  });
  const history = createHistory(doc);
  return { doc, history };
}

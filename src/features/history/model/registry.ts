import type { Asset } from "../../../shared/types";

interface Registration {
  asset: Asset;
  /** How many history nodes (in every branch) reference this image. */
  refs: number;
  /** Active export jobs that must keep reading this image. */
  pins: number;
  /** Monotonic insertion order, used to evict the oldest idle image first. */
  seq: number;
}

/**
 * Shared image resource registry.
 *
 * History nodes only carry an `assetId`; the decoded ImageData lives here
 * exactly once no matter how many nodes or branches point at it. An image is
 * released only when it has no node references *and* no active export pin, so
 * neither history compaction nor branch changes can pull the pixels out from
 * under a running export.
 */
export class AssetRegistry {
  private entries = new Map<string, Registration>();
  private seq = 0;

  constructor(private readonly maxAssets = 12) {}

  add(asset: Asset) {
    const existing = this.entries.get(asset.id);
    if (existing) {
      existing.asset = asset;
      return existing.asset;
    }
    // The cap is not enforced here: the caller records the node (and thereby
    // retains the image) immediately after this call. Enforcing here could
    // evict a brand-new, not-yet-referenced import.
    this.entries.set(asset.id, {
      asset,
      refs: 0,
      pins: 0,
      seq: ++this.seq,
    });
    return asset;
  }

  get(id: string | null): Asset | null {
    return (id && this.entries.get(id)?.asset) || null;
  }

  has(id: string): boolean {
    return this.entries.has(id);
  }

  retain(id: string) {
    const entry = this.entries.get(id);
    if (entry) entry.refs += 1;
  }

  release(id: string) {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.refs = Math.max(0, entry.refs - 1);
    this.evictIdle();
  }

  pin(id: string) {
    const entry = this.entries.get(id);
    if (entry) entry.pins += 1;
  }

  unpin(id: string) {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.pins = Math.max(0, entry.pins - 1);
    this.evictIdle();
  }

  /** Drops every image that no node references and no export is using. */
  sweep(liveIds: ReadonlySet<string>) {
    for (const [id, entry] of this.entries)
      if (!liveIds.has(id) && entry.refs <= 0 && entry.pins <= 0)
        this.entries.delete(id);
  }

  private evictIdle() {
    for (const [id, entry] of this.entries)
      if (entry.refs <= 0 && entry.pins <= 0) this.entries.delete(id);
    this.enforceCap();
  }

  /** Caps idle images so aborted or abandoned imports cannot pile up. */
  private enforceCap() {
    if (this.entries.size <= this.maxAssets) return;
    const idle = [...this.entries]
      .filter(([, entry]) => entry.refs <= 0 && entry.pins <= 0)
      .sort((a, b) => a[1].seq - b[1].seq);
    for (const [id] of idle) {
      if (this.entries.size <= this.maxAssets) break;
      this.entries.delete(id);
    }
  }

  stats() {
    let assetBytes = 0;
    let pinnedAssets = 0;
    for (const entry of this.entries.values()) {
      assetBytes += entry.asset.data.data.byteLength;
      if (entry.refs > 0 || entry.pins > 0) pinnedAssets += 1;
    }
    return { assets: this.entries.size, assetBytes, pinnedAssets };
  }

  clear() {
    this.entries.clear();
  }
}

/** Recursively index artwork under a FilePicker directory with bounded parallelism. */
import { cleanAssetPath, isBrowsableAssetFolder } from './asset-browser-model.js';

/**
 * Traverse in breadth-first order so the gallery remains deterministic, even
 * when FilePicker replies out of order. Four concurrent browse calls avoid
 * long serial waits without flooding a remote S3/WebDAV provider.
 */
export async function collectGalleryTree(root, getListing, {
  cancelled = () => false, onProgress = () => {}, concurrency = 4,
  maxFolders = 10000, maxFiles = 100000
} = {}) {
  const start = cleanAssetPath(root);
  if (!isBrowsableAssetFolder(start)) throw Error('Invalid image-library root folder.');
  const queued = new Set([start]);
  const images = new Map();
  const failedPaths = [];
  const limit = Math.max(1, Math.min(8, Math.trunc(Number(concurrency) || 4)));
  const folderBudget = Math.max(1, Math.min(100000, Math.trunc(Number(maxFolders) || 10000)));
  const fileBudget = Math.max(1, Math.min(500000, Math.trunc(Number(maxFiles) || 100000)));
  let frontier = [start];
  let folders = 0;
  let truncated = false;
  const within = (child, parent) => child && isBrowsableAssetFolder(child) &&
    (parent === '' || child.startsWith(`${parent}/`));
  const cancelledResult = () => ({files:[], folders, failures:failedPaths.length, failedPaths, cancelled:true});
  while (frontier.length) {
    if (cancelled()) return cancelledResult();
    const next = [];
    for (let startIndex = 0; startIndex < frontier.length; startIndex += limit) {
      if (cancelled()) return cancelledResult();
      const batch = frontier.slice(startIndex, startIndex + limit);
      const results = await Promise.all(batch.map(path =>
        Promise.resolve().then(() => getListing(path)).then(node => ({node}), error => ({error}))));
      if (cancelled()) return cancelledResult();
      // Consume in directory order, not resolution order.
      for (let i = 0; i < batch.length; i++) {
        const path = batch[i];
        if (folders >= folderBudget || images.size >= fileBudget)
          return {files:[...images.values()], folders, failures:failedPaths.length, failedPaths,
            cancelled:false, truncated:true};
        folders++;
        const {node,error} = results[i];
        if (error) { failedPaths.push(path); continue; }
        for (const file of node?.files ?? []) {
          const target = cleanAssetPath(file?.path);
          if (within(target,path)) {
            if (images.size >= fileBudget) { truncated = true; break; }
            images.set(target,{...file,path:target});
          }
        }
        if (truncated) return {files:[...images.values()],folders,failures:failedPaths.length,
          failedPaths,cancelled:false,truncated:true};
        for (const dir of node?.dirs ?? []) {
          const child = cleanAssetPath(dir?.path);
          if (within(child,path) && !queued.has(child)) {
            queued.add(child);
            next.push(child);
          }
        }
        if (folders % 8 === 0) onProgress({folders, images:images.size});
      }
    }
    frontier = next;
  }
  if (!cancelled()) onProgress({folders, images:images.size});
  return {files:[...images.values()],folders,failures:failedPaths.length,failedPaths,cancelled:false,truncated};
}

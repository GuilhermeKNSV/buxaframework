## 0.13.43 — Ground storage item drag regression

- Fix dragging items out of open board storage windows: pointerdown now passes the actual content element into the pointer-move controller. The previous handler threw a `ReferenceError` on the first drag movement, leaving contents stuck in place.
- Preserve the existing drag origin, rotation key, preview, cleanup and GM-authoritative transfer behavior, including v0.13.42's backpack contents rotation/restore fix.
- Add a DOM-like interaction regression test that dispatches pointerdown, moves past the drag threshold, rotates, cancels and verifies cleanup of the tile and ghost.

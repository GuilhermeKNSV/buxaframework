/** Pure viewport and duration presentation shared by the floating Effect HUD. */
export function effectHudPlacement(box, width, height) {
  const gap = 10, edge = 8;
  const roomRight = width - box.right - gap - edge;
  const roomLeft = box.left - gap - edge;
  const side = roomRight >= 196 || roomRight >= roomLeft ? 'right' : 'left';
  const room = Math.max(roomRight, roomLeft);
  const compact = room < 148;
  const w = Math.max(32, Math.min(compact ? 48 : 212, compact ? width - edge * 2 : room));
  const x = side === 'right' ? box.right + gap : box.left - gap - w;
  const top = Math.max(edge, Math.min(height - 80, box.top + 42));
  return {side, compact, width:w, left:Math.max(edge, Math.min(width-w-edge, x)),
    top, maxHeight:Math.max(32, height-top-edge)};
}

export function effectHudClock(entry, rules) {
  const permanent = entry.behavior === 'passive' || rules.duration.mode === 'permanent';
  const total = Math.max(1, Number(rules.duration.value) || 1);
  const remaining = Math.max(0, total - (Number(entry.progress) || 0));
  return {permanent, remaining, expiring:!permanent && remaining <= 1,
    ratio:permanent ? 1 : Math.min(1, remaining / total),
    text:permanent ? 'Permanent' : remaining <= 1 ? 'Expires this turn' : `${remaining} turns remaining`};
}

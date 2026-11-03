/** Pure perimeter geometry for complex inventory item decorations.
 * No individual inventory cell paints its own frame: both the settled item
 * and the drag ghost draw this same footprint outline in one SVG overlay.
 * This avoids internal seams and rectangular borders around L/T shapes.
 */
import { exteriorShapeEdges } from './complex-drag-geometry.js';
import { shapeBounds } from './inventory-shapes.js';

const CO = 0.24; // corner arm length, as a fraction of a grid cell
const fmt = n => Number(n.toFixed(4));

export function complexDecorationGeometry(cells) {
  if (!Array.isArray(cells) || !cells.length) {
    return { width: 1, height: 1, viewBox: '0 0 1 1', perimeter: '', corners: '', ornaments: '' };
  }
  const { width, height } = shapeBounds(cells);
  const boundary = exteriorShapeEdges(cells);
  const perimeter = [];
  const corners = [];
  const ornaments = [];
  const addCorner = (x, y, ax, ay, bx, by) => {
    corners.push(`M${fmt(x + ax * CO)} ${fmt(y + ay * CO)}L${x} ${y}L${fmt(x + bx * CO)} ${fmt(y + by * CO)}`);
    ornaments.push(`M${fmt(x + (ax + bx) * .13)} ${fmt(y + (ay + by) * .13)}h0`);
  };
  for (const c of boundary) {
    const x = c.x, y = c.y;
    if (c.top) perimeter.push(`M${x} ${y}H${x + 1}`);
    if (c.right) perimeter.push(`M${x + 1} ${y}V${y + 1}`);
    if (c.bottom) perimeter.push(`M${x} ${y + 1}H${x + 1}`);
    if (c.left) perimeter.push(`M${x} ${y}V${y + 1}`);
    // Convex vertices only. A concave notch is outlined, never decorated as
    // if it were an outer corner of a rectangular bounding box.
    if (c.top && c.left) addCorner(x, y, 1, 0, 0, 1);
    if (c.top && c.right) addCorner(x + 1, y, -1, 0, 0, 1);
    if (c.bottom && c.right) addCorner(x + 1, y + 1, -1, 0, 0, -1);
    if (c.bottom && c.left) addCorner(x, y + 1, 1, 0, 0, -1);
  }
  return {
    width, height, viewBox: `0 0 ${width} ${height}`,
    perimeter: perimeter.join(''), corners: corners.join(''), ornaments: ornaments.join('')
  };
}

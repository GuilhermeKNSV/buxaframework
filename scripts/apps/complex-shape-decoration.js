/** DOM adapter for the pure complex-shape-decoration geometry. */
import { complexDecorationGeometry } from '../core/complex-shape-decoration.js';

const NS = 'http://www.w3.org/2000/svg';
export function createComplexDecorationSvg(doc, cells) {
  const geometry = complexDecorationGeometry(cells);
  const svg = doc.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', geometry.viewBox);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('buxa-complex-decoration');
  for (const [className, path] of [
    ['buxa-complex-outline', geometry.perimeter],
    ['buxa-complex-corners', geometry.corners],
    ['buxa-complex-ornaments', geometry.ornaments]
  ]) {
    const node = doc.createElementNS(NS, 'path');
    node.classList.add(className);
    node.setAttribute('d', path);
    svg.append(node);
  }
  return svg;
}

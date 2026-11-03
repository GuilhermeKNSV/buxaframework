/** Human-readable dice notation shared by Item dice, Resource rules and editors.
 * This formats display only; Foundry Roll formulas and saved rules remain unchanged.
 */
const finite = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const decimal = value => String(Math.round(finite(value) * 100000) / 100000);

export function formatItemDiceFormula({ count = 1, faces = 20, bonus = 0, unresolvedModifier = '', missingSource = false } = {}) {
  const sides = Math.max(2, Math.round(finite(faces) || 20));
  const amount = Math.max(0, Math.round(finite(count)));
  const dice = missingSource ? `?d${sides}` : amount ? `${amount}d${sides}` : '0';
  const total = finite(bonus);
  const sign = total < 0 ? '-' : '+';
  const result = `${dice} ${sign} ${decimal(Math.abs(total))}`;
  return unresolvedModifier ? `${result} + ${unresolvedModifier}` : result;
}

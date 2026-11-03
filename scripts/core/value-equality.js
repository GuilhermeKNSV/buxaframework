/** Compare persisted structured Item data without allocating giant JSON strings.
 * World settings contain JSON-compatible primitives, arrays and plain objects. */
export function sameStoredValue(a,b) {
  if(Object.is(a,b))return true;
  if(!a || !b || typeof a!=='object' || typeof b!=='object')return false;
  const aa=Array.isArray(a),ab=Array.isArray(b);
  if(aa!==ab)return false;
  if(aa){
    if(a.length!==b.length)return false;
    for(let i=0;i<a.length;i++)if(!sameStoredValue(a[i],b[i]))return false;
    return true;
  }
  if(Object.getPrototypeOf(a)!==Object.prototype && Object.getPrototypeOf(a)!==null)return false;
  if(Object.getPrototypeOf(b)!==Object.prototype && Object.getPrototypeOf(b)!==null)return false;
  const keys=Object.keys(a);
  if(keys.length!==Object.keys(b).length)return false;
  for(const key of keys)if(!Object.hasOwn(b,key)||!sameStoredValue(a[key],b[key]))return false;
  return true;
}

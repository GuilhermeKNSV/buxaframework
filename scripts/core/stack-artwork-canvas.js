/** Browser-only composition for PIXI scene sprites. No files or permanent
 * generated assets are created: each artwork stays editable as image layers. */
const cache=new Map();
export async function compositeStackArtwork(art) {
  if(!art?.custom || !art.layers?.length)return art?.img||'icons/svg/item-bag.svg';
  const key=JSON.stringify([art.img,art.layers.map(l=>[l.img,l.x,l.y,l.size,l.rotation,l.opacity])]);
  if(cache.has(key))return cache.get(key);
  const task=(async()=>{
    if(typeof document==='undefined'||typeof Image==='undefined')return art.img;
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
    const ctx=canvas.getContext('2d');if(!ctx)return art.img;
    let drawn=0;
    for(const layer of art.layers){
      const image=await new Promise(resolve=>{
        const img=new Image();img.crossOrigin='anonymous';
        img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src=layer.img;
      });
      if(!image)continue;
      const number=(value,fallback)=>Number.isFinite(Number(value)) ? Number(value) : fallback;
      const side=256*Math.max(.05,Math.min(8,number(layer.size,100)/100));
      ctx.save();
      try {
        ctx.globalAlpha=Math.max(0,Math.min(1,number(layer.opacity,1)));
        ctx.translate(256*number(layer.x,50)/100,256*number(layer.y,50)/100);
        ctx.rotate(number(layer.rotation,0)*Math.PI/180);
        ctx.drawImage(image,-side/2,-side/2,side,side);
        drawn++;
      } catch { /* Corrupt layer must not poison the whole composite cache. */ }
      finally {ctx.restore();}
    }
    if(!drawn)return art.img;
    try{return canvas.toDataURL('image/png');}catch{return art.img;}
  })();
  cache.set(key,task);
  if(cache.size>120)cache.delete(cache.keys().next().value);
  return task;
}

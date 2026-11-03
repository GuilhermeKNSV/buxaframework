/** Stable, viewport-space placement for the sidebar editor. Dock to the far
 * opposite EDGE of the screen, in the user's indicated lower-left empty lane.
 * If that edge is occupied by actual controls/windows at the chosen height,
 * retreat just far enough to avoid them. Keep expanded geometry while folded. */
const GAP = 7;
const clamp = (v,min,max) => Math.max(min,Math.min(max,v));
const intersects = (a,b,pad=0) => a.x < b.right + pad && a.x+a.width > b.left-pad && a.y < b.bottom+pad && a.y+a.height > b.top-pad;
export function dockOverlap(box, obstacles=[],pad=4){
  return obstacles.reduce((total,b)=>{
    if(!intersects(box,b,pad))return total;
    const width=Math.max(0,Math.min(box.x+box.width,b.right+pad)-Math.max(box.x,b.left-pad));
    const height=Math.max(0,Math.min(box.y+box.height,b.bottom+pad)-Math.max(box.y,b.top-pad));
    return total+width*height;
  },0);
}
export function findOppositeDockPlacement({width,height,sidebarRect,dockWidth,dockHeight,obstacles=[]}){
  const opposite = sidebarRect.left>=width*.5?'left':'right';
  const maxX=Math.max(GAP,width-dockWidth-GAP),maxY=Math.max(GAP,height-dockHeight-GAP);
  // Place the dock right against the opposite viewport edge (the native
  // control rail is high above it in a normal Foundry layout). Never reserve
  // that whole rail for the entire screen height; overlap checks below move
  // the dock inward only when a real control occupies the same vertical lane.
  const preferredX=opposite==='left' ? GAP : maxX;
  // Approx. the indicated lower-left area, not the center of the board.
  const preferredY=clamp(height*.73-dockHeight*.5,GAP,maxY);
  const low=opposite==='left'?GAP:Math.max(GAP,sidebarRect.right+GAP);
  const high=opposite==='left'?Math.min(maxX,sidebarRect.left-dockWidth-GAP):maxX;
  const xs=new Set([preferredX,low,high]);
  const ys=new Set([preferredY,GAP,maxY]);
  for(const b of obstacles){
    xs.add(clamp(b.right+GAP,low,high));
    xs.add(clamp(b.left-dockWidth-GAP,low,high));
    ys.add(clamp(b.bottom+GAP,GAP,maxY));
    ys.add(clamp(b.top-dockHeight-GAP,GAP,maxY));
  }
  // In a crowded viewport retreat from the edge in small steps. Do not jump
  // inward while the preferred edge is actually clear.
  for(let distance=16;distance<=160;distance+=16)
    xs.add(clamp(preferredX+(opposite==='left'?distance:-distance),low,high));
  for(let dy=-140;dy<=140;dy+=28)ys.add(clamp(preferredY+dy,GAP,maxY));
  let best=null;
  for(const x of xs)for(const y of ys){
    if(x<low||x>high||y<GAP||y>maxY)continue;
    const overlap=dockOverlap({x,y,width:dockWidth,height:dockHeight},obstacles);
    const score=overlap*250 + Math.abs(x-preferredX)*5 + Math.abs(y-preferredY)*.8;
    if(!best||score<best.score)best={x,y,side:opposite,score,overlap};
  }
  return best??{x:clamp(preferredX,GAP,maxX),y:preferredY,side:opposite,overlap:0};
}

/** Avoid transparent Foundry containers, the scene canvas, and our own UI.
 * Collect real buttons, controls, chrome and visible application windows. */
export function findFoundryUiObstacles(documentRef=globalThis.document,viewport=globalThis.window){
  if(!documentRef?.querySelectorAll||!viewport)return [];
  // Only treat actual Foundry controls/windows as obstacles. Broad selectors
  // like #ui-left > * can match transparent full-height wrappers that have no
  // visible controls in the lower lane, pushing the dock far onto the board.
  const selectors=['#sidebar','#controls','#navigation','#hotbar','#players','#pause','#notifications',
    '.window-app','.application','.dialog','[role="dialog"]'];
  const nodes=new Set(documentRef.querySelectorAll(selectors.join(',')));
  const ignore='.buxa-sb-toolbar,.buxa-sb-context,.buxa-sb-dialog,.buxa-sb-drawer,.buxa-sb-flyout,.buxa-sb-save-menu,.buxa-sb-drag-preview';
  const boxes=[];
  for(const node of nodes){
    if(node.matches?.(ignore)||node.closest?.(ignore))continue;
    if(!node.isConnected||typeof node.getBoundingClientRect!=='function')continue;
    const css=viewport.getComputedStyle?.(node);
    if(css?.display==='none'||css?.visibility==='hidden'||Number(css?.opacity)===0)continue;
    const box=node.getBoundingClientRect();
    if(!box||box.width<12||box.height<12)continue;
    if(box.width>viewport.innerWidth*.94&&box.height>viewport.innerHeight*.86)continue;
    if(box.bottom<0||box.right<0||box.left>viewport.innerWidth||box.top>viewport.innerHeight)continue;
    boxes.push({left:box.left,right:box.right,top:box.top,bottom:box.bottom});
  }
  return boxes;
}

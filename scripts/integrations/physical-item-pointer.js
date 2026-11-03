/** Dragging a scene item uses the actual DOM pointer until release, even if
 * the pointer leaves the image. Pixi only decides whether pickup can start.
 * No tickers or full-canvas re-renders during movement. */
export function globalFromClient(clientX, clientY) {
  const app = globalThis.canvas?.app;
  const mapped = { x:0, y:0 };
  if (app?.renderer?.events?.mapPositionToPoint) {
    app.renderer.events.mapPositionToPoint(mapped,clientX,clientY);
    return mapped;
  }
  const view = app?.canvas ?? app?.view ?? globalThis.document?.getElementById?.('board');
  const rect = view?.getBoundingClientRect?.();
  if (!rect?.width || !rect?.height) return null;
  const screen = app?.renderer?.screen ?? {width:rect.width,height:rect.height};
  return {x:(clientX-rect.left)*screen.width/rect.width,y:(clientY-rect.top)*screen.height/rect.height};
}
export function bindPhysicalItemPointer(sprite,parent,{allow,commit,warn,preview,clearPreview,onStart,onSelect}) {
  let drag=null;
  let originGhost=null;
  const root = () => parent.parent;
  const local = position => position && root()?.toLocal?.(position);
  const clear = (keepPreview=false) => {
    globalThis.window?.removeEventListener?.('pointermove',move,true);
    globalThis.window?.removeEventListener?.('pointerup',end,true);
    globalThis.window?.removeEventListener?.('pointercancel',cancel,true);
    globalThis.window?.removeEventListener?.('blur',cancel,true);
    originGhost?.destroy?.();originGhost=null;
    if(!keepPreview)clearPreview?.();
    drag=null;parent._buxaDragging=false;sprite.cursor='grab';
  };
  const cancel = () => {
    if(!drag)return;
    const {from}=drag;clear();parent.position.set(from.x,from.y);
  };
  const pointerMatches = event => drag && (event.pointerId==null || drag.pointerId==null || event.pointerId===drag.pointerId);
  const move = event => {
    if(!pointerMatches(event))return;
    const position=local(globalFromClient(event.clientX,event.clientY));
    if(!position)return;
    const dx=position.x-drag.start.x,dy=position.y-drag.start.y;
    if(!drag.moved && Math.hypot(dx,dy)<4)return;
    drag.moved=true;
    parent.position.set(drag.from.x+dx,drag.from.y+dy);
    preview?.(event.clientX,event.clientY);
    event.preventDefault?.();event.stopPropagation?.();
  };
  const end = event => {
    if(!pointerMatches(event))return;
    move(event);
    const state=drag;
    const destination={x:parent.x,y:parent.y};
    clear(state.moved);
    if(!state.moved)return;
    event.preventDefault?.();event.stopPropagation?.();
    void Promise.resolve().then(()=>commit(destination,{clientX:event.clientX,clientY:event.clientY})).catch(error=>{
      // Server validation always wins, including collision/range changes.
      parent.position.set(state.from.x,state.from.y);
      warn?.(error?.message||'Could not move this item.');
    }).finally(()=>clearPreview?.());
  };
  const start = event => {
    if (event.button!==0 || drag)return;
    if(onSelect?.(event) === true) {event.stopPropagation?.();event.nativeEvent?.preventDefault?.();return;}
    const allowed=allow();
    if (!allowed.allowed){warn?.(allowed.reason);return;}
    const position=local(event.global);
    if(!position)return;
    drag={pointerId:event.pointerId,start:position,from:{x:parent.x,y:parent.y},moved:false};
    // Preserve the grabbed point through external Inventory previews. Otherwise
    // a 3x2 item jumps a cell away when the mouse enters a backpack or grid.
    const footprint=Math.max(1,Number(parent._buxaRecord?.size)||76);
    onStart?.({gripX:Math.max(0,Math.min(.999,(position.x-parent.x)/footprint)),
      gripY:Math.max(0,Math.min(.999,(position.y-parent.y)/footprint))});
    parent._buxaDragging=true;sprite.cursor='grabbing';
    // Leave an artwork-only translucent origin while dragging the real sprite.
    // This is a visual preview, not another physical item document.
    if(globalThis.PIXI?.Sprite && sprite.texture && parent.addChild){
      originGhost=new PIXI.Sprite(sprite.texture);
      originGhost.anchor?.set?.(0.5);
      // The origin preview belongs to the nonmoving scene container. Putting
      // it under `parent` makes it follow the dragged artwork instead.
      originGhost.position?.set?.(parent.x+sprite.x,parent.y+sprite.y);
      originGhost.width=sprite.width;originGhost.height=sprite.height;
      originGhost.rotation=sprite.rotation||0;
      originGhost.alpha=.28;originGhost.eventMode='none';
      if(typeof root()?.addChildAt==='function')root().addChildAt(originGhost,0);
      else root()?.addChild?.(originGhost);
    }
    globalThis.window?.addEventListener?.('pointermove',move,true);
    globalThis.window?.addEventListener?.('pointerup',end,true);
    globalThis.window?.addEventListener?.('pointercancel',cancel,true);
    globalThis.window?.addEventListener?.('blur',cancel,true);
    event.stopPropagation?.();event.nativeEvent?.preventDefault?.();
  };
  sprite.on('pointerdown',start);
  sprite.on('destroyed',cancel);
  return {cancel};
}

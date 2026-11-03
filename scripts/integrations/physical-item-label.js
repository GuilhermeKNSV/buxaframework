/** Ground item nameplates attached to the item canvas container.
 * Visual direction: Path of Exile / Diablo style ARPG loot labels.
 * The item name itself is the loot action; GMs can reveal an edit affordance. */
import { MODULE_ID } from '../core/constants.js';
import { itemBoardImageOf } from '../core/item-board-image.js';
import { PHYSICAL_SETTINGS, normalizePhysicalSettings, physicalQuantity } from '../core/physical-items.js';
import { requestPhysicalAction } from './physical-item-transfers.js';
import { notifySuccess, notifyWarning, notifyError } from '../core/notifications.js';

const safeHex = (value, fallback=0x91a7bb) => /^#[0-9a-f]{6}$/i.test(String(value)) ? parseInt(value.slice(1),16) : fallback;
const blend = (a,b,t) => {
  const ch=shift=>Math.round(((a>>shift)&255)*(1-t)+((b>>shift)&255)*t);
  return (ch(16)<<16)|(ch(8)<<8)|ch(0);
};
const luminance = color => {
  const r=(color>>16)&255,g=(color>>8)&255,b=color&255;
  return 0.299*r + 0.587*g + 0.114*b;
};
const isHighTier = rarity => ['epic','legendary','mythical','relic','masterwork','secret','divine','special'].includes(String(rarity?.id||'').toLowerCase());
function shapeRect(graphics, x,y,w,h,color,alpha) {
  if (typeof graphics.rect==='function' && typeof graphics.fill==='function') graphics.rect(x,y,w,h).fill({color,alpha});
  else if(typeof graphics.drawRect==='function') {graphics.beginFill(color,alpha);graphics.drawRect(x,y,w,h);graphics.endFill();}
}
function makeText(text, style={}) {
  const Text=globalThis.PIXI?.Text;
  if (!Text) return null;
  const safeStyle={
    fontFamily: style.fontFamily || 'Georgia',
    fontSize: Number(style.fontSize)||16,
    fontWeight: style.fontWeight || '700',
    fill: style.fill || '#f6faff',
    align: style.align || 'center'
  };
  const version=String(globalThis.PIXI?.VERSION||'');
  return version.startsWith('7') ? new Text(String(text),safeStyle) : new Text({text:String(text),style:safeStyle});
}
function stop(event) {event?.stopPropagation?.();event?.nativeEvent?.preventDefault?.();}

export function positionPhysicalItemLabel(label, record, beamHeight=0, visualMode='beam') {
  if (!label) return;
  const size=Math.max(20, Number(record?.size)||76);
  let y=-8;
  if (beamHeight>0) y = visualMode === 'beam'
    ? -Math.max(42, Math.min(82, beamHeight*0.34 || size*0.44))
    : -Math.max(20, Math.min(32, size*0.22));
  const visual=itemBoardImageOf(record?.data).sceneFx.label;
  label.position?.set?.(size/2+visual.x,y+visual.y);
  label.scale?.set?.(visual.scale);
}

export function createPhysicalItemLabel({record,parent,rarity,onEdit,beamHeight=0,visualMode='beam',onOpen,onContext,hasStorage=false,disableLooting=false}) {
  const pixi=globalThis.PIXI;
  if (!pixi?.Text || !pixi?.Graphics || !pixi?.Container) return null;
  const accent=safeHex(rarity?.color);
  const opaqueShadow=visualMode==='shadow';
  const highTier=isHighTier(rarity);
  const labelText=String(record?.data?.name||'Item').slice(0,70);
  const count=physicalQuantity(record);
  const amount=count>1?` x${count}`:'';
  const textColor = luminance(accent) > 170 ? '#11151d' : (highTier ? '#fff6de' : '#eef5ff');
  const shadowText=makeText(labelText+amount,{fontFamily:'Georgia',fontSize:17,fontWeight:'700',fill:'#000000'});
  const text=makeText(labelText+amount,{fontFamily:'Georgia',fontSize:17,fontWeight:'700',fill:textColor});
  if (!text || !shadowText) return null;

  const measured=Math.max(Number(text.width||110), Number(shadowText.width||110));
  const nameWidth=Math.min(400,Math.max(140,measured+34));
  const height=32;
  const root=new pixi.Container();root.label=`Ground item: ${labelText}${amount}`;
  root.eventMode='static';root.interactiveChildren=true;root.cursor='pointer';

  const plateWrap=new pixi.Container();
  plateWrap.eventMode='static';plateWrap.cursor='pointer';
  const plateShadow=new pixi.Graphics();
  shapeRect(plateShadow,-nameWidth/2-4,-height-3,nameWidth+8,height+6,accent,0.10);
  plateShadow.alpha=0.82;
  const plate=new pixi.Graphics();
  const plateFill=blend(accent,0x081018, highTier ? 0.34 : 0.54);
  const topLine=blend(accent,0xffffff,0.2);
  const bottomLine=blend(accent,0x0a1016,0.15);
  shapeRect(plate,-nameWidth/2,-height,nameWidth,height,plateFill,opaqueShadow ? 1 : (highTier?0.90:0.82));
  shapeRect(plate,-nameWidth/2,-height,3,height,topLine,0.98);
  shapeRect(plate,nameWidth/2-3,-height,3,height,topLine,0.62);
  shapeRect(plate,-nameWidth/2,-height,nameWidth,1.5,topLine,0.94);
  shapeRect(plate,-nameWidth/2,-1.5,nameWidth,1.5,bottomLine,0.92);
  const sheen=new pixi.Graphics();
  shapeRect(sheen,-nameWidth/2+10,-height+2,nameWidth*0.28,2,0xffffff,0.12);
  sheen.alpha = highTier ? 0.9 : 0.55;
  shadowText.anchor?.set?.(.5,.5); shadowText.position?.set?.(1,-height/2+1); shadowText.alpha=0.42; shadowText.eventMode='none';
  plateWrap.addChild(plateShadow,plate,sheen,shadowText);
  root.addChild(plateWrap);

  text.anchor?.set?.(.5,.5); text.position?.set?.(0,-height/2); text.eventMode='none';
  root.addChild(text);
  const hasEdit=Boolean(globalThis.game?.user?.isGM);
  let editor=null, editPlate=null, editVisible=false;
  if(hasEdit) {
    editor=makeText('✎',{fontFamily:'Arial',fontSize:15,fontWeight:'700',fill:'#f4fbff'});
    if(editor){
      editPlate=new pixi.Graphics();
      const editX=nameWidth/2+5; const editW=28;
      const editFill=blend(accent,0x0d1622,0.7);
      shapeRect(editPlate,editX,-height,editW,height,editFill,0.92);
      shapeRect(editPlate,editX,-height,1.5,height,topLine,0.8);
      shapeRect(editPlate,editX,-height,editW,1.5,topLine,0.8);
      shapeRect(editPlate,editX,-1.5,editW,1.5,bottomLine,0.8);
      editPlate.eventMode='static';editPlate.cursor='pointer';
      editor.position?.set?.(editX + editW/2,-height/2);
      editor.anchor?.set?.(.5,.5);editor.eventMode='none';
      const trigger=event=>{stop(event);onEdit?.();};
      editPlate.on('pointertap',trigger);editPlate.on('click',trigger);
      root.addChild(editPlate,editor);
      editPlate.visible=false;editor.visible=false;
    }
  }
  function toggleEdit(show) {
    editVisible=Boolean(show);
    if(editPlate) editPlate.visible=editVisible;
    if(editor) editor.visible=editVisible;
  }
  let busy=false;
  const doLoot=async event=>{
    stop(event);
    if(busy)return;
    const policy=normalizePhysicalSettings(game.settings.get(MODULE_ID,PHYSICAL_SETTINGS));
    if(!policy.lootEnabled) {notifyWarning('Looting is disabled by the GM.');return;}
    busy=true;
    try {
      await requestPhysicalAction({action:'loot',sceneId:globalThis.canvas?.scene?.id,itemId:record.id});
      notifySuccess(`${labelText} added to your linked character.`);
    } catch(error) { notifyError(error?.message||'Could not loot this item.'); }
    finally {busy=false;}
  };
  if(disableLooting) {
    // The fixed chest cannot be picked up, but clicking its label opens storage.
    if(hasStorage)plateWrap.on('pointertap',event=>{stop(event);onOpen?.();});
  } else plateWrap.on('pointertap',doLoot);
  // Storage is opened from the single scene-item context menu, not another
  // stacked green rectangle above this nameplate.
  // Foundry/Pixi can fire pointerdown, rightdown AND rightclick for one
  // physical right-click. A toggle would open, then immediately close Edit.
  const rightClick=event=>{stop(event);if(typeof onContext==='function')onContext(event);else if(hasEdit)toggleEdit(true);};
  root.on('rightdown',rightClick);
  root.on('rightclick',rightClick);
  root.on('pointerdown',event=>{if(event.button===2)rightClick(event);});
  root._buxaToggleEdit=toggleEdit;
  root._buxaVisualMode=visualMode;
  root._buxaBeamHeight=beamHeight;
  positionPhysicalItemLabel(root, record, beamHeight, visualMode);
  return parent.addChild(root);
}

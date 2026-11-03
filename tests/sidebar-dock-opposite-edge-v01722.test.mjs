import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {findOppositeDockPlacement,findFoundryUiObstacles} from '../scripts/apps/sidebar-dock-placement.js';
const rect=(left,top,right,bottom)=>({left,right,top,bottom});
const overlaps=(p,b)=>p.x<b.right && p.x+p.width>b.left && p.y<b.bottom && p.y+p.height>b.top;
const place=(overrides={})=>findOppositeDockPlacement({width:1366,height:768,sidebarRect:rect(1300,0,1366,768),dockWidth:52,dockHeight:330,obstacles:[],...overrides});

test('right-side Foundry sidebar places dock flush to the far-left edge when the lower lane is clear',()=>{
  const p=place();
  assert.equal(p.side,'left');
  assert.ok(p.x>=6 && p.x<=12,`must stay near the far-left edge: ${p.x}`);
  assert.ok(p.y>260 && p.y<520,`must sit in the lower-left area: ${p.y}`);
  assert.ok(p.x+52<1366/2);
  assert.equal(p.overlap,0);
});
test('left-side Foundry sidebar places dock at opposite RIGHT viewport edge',()=>{
  const p=place({sidebarRect:rect(0,0,66,768)});
  assert.equal(p.side,'right');
  assert.ok(p.x>1200,`expected right edge: ${p.x}`);
  assert.equal(p.overlap,0);
});
test('dock retreats from the far-left edge only when obstructed, avoiding Foundry controls',()=>{
  const obstacles=[rect(0,0,66,520),rect(0,530,70,768),rect(74,0,330,90),rect(280,190,590,660)];
  const p=place({obstacles});
  assert.equal(p.side,'left');
  assert.equal(p.overlap,0);
  assert.ok(obstacles.every(o=>!overlaps({...p,width:52,height:330},o)),JSON.stringify(p));
});
test('dock prefers an unoccupied vertical lane when a Foundry window opens at center',()=>{
  const obstacles=[rect(0,0,66,768),rect(70,250,240,570)];
  const p=place({obstacles});
  assert.equal(p.overlap,0);
  assert.ok(obstacles.every(o=>!overlaps({...p,width:52,height:330},o)));
});
test('dock remains inside the viewport on narrow screens and cramped UI',()=>{
  const p=findOppositeDockPlacement({width:390,height:540,sidebarRect:rect(346,0,390,540),dockWidth:46,dockHeight:350,obstacles:[rect(0,0,92,400)]});
  assert.ok(p.x>=0 && p.x+46<=390);
  assert.ok(p.y>=0 && p.y+350<=540);
  assert.ok(p.x+46 < 195);
});
test('real Foundry chrome is collected, but not background canvas, hidden UI, or editor itself',()=>{
  const nodes=[
    {name:'sidebar',visible:true,box:rect(1300,0,1366,768)},
    {name:'app',visible:true,box:rect(80,150,410,500)},
    {name:'hidden',visible:false,box:rect(0,0,100,400)},
    {name:'editor',visible:true,editor:true,box:rect(12,200,60,530)},
  ];
  const fake=nodes.map(n=>({isConnected:true,matches:(selector)=>!!n.editor,getBoundingClientRect:()=>({...n.box,width:n.box.right-n.box.left,height:n.box.bottom-n.box.top}),visible:n.visible,closest:()=>null}));
  const doc={querySelectorAll:()=>fake};
  const viewport={innerWidth:1366,innerHeight:768,getComputedStyle:(node)=>({display:node.visible?'block':'none',visibility:'visible',opacity:'1'})};
  assert.deepEqual(findFoundryUiObstacles(doc,viewport),[nodes[0].box,nodes[1].box]);
});
test('popouts remain anchored to native sidebar controls, not the opposite-edge dock',async()=>{
  const src=await readFile(new URL('../scripts/apps/sidebar-edit-buttons.js',import.meta.url),'utf8');
  const dock=await readFile(new URL('../scripts/apps/sidebar-edit-dock.js',import.meta.url),'utf8');
  assert.match(src,/const edge=rightSidebar \? navBox\.left : navBox\.right/);
  assert.match(src,/const left=rightSidebar \? r\.left-w-9 : r\.right\+9/);
  assert.match(dock,/findOppositeDockPlacement/);
  assert.match(dock,/findFoundryUiObstacles/);
  assert.match(dock,/position\.side==='left'/);
  const base = await readFile(new URL('../styles/181-sidebar-edit-buttons.css',import.meta.url),'utf8');
  assert.match(base,/\.buxa-sb-toolbar:not\(\.buxa-sb-dock\)/);
  assert.doesNotMatch(dock,/rect\.left-width-12/);
});

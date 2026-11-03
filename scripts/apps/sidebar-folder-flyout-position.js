import { nativeSidebarTabMetrics } from './sidebar-flyout-metrics.js';
import { sidebarFlyoutLane, sidebarFlyoutX, visibleSidebarPane } from './sidebar-flyout-placement.js';

/** Follow the *visible directory pane* (not just the tab rail). For cramped
 * windows, a vertical row fits in the gutter without obscuring native UI. */
export function positionSidebarFolderFlyout({flyout,nav,tabs,openFolder,
  documentRef=globalThis.document,viewportWidth=globalThis.innerWidth,viewportHeight=globalThis.innerHeight}) {
  if (!flyout || !nav) return;
  const source=[...nav.querySelectorAll('[data-buxa-button-id]')].find(n=>n.dataset.buxaButtonId===openFolder);
  const sr=(source||nav).getBoundingClientRect(), navRect=nav.getBoundingClientRect();
  const isRight=navRect.left>viewportWidth/2;
  const nativeSize=nativeSidebarTabMetrics(tabs,nav);
  flyout.style.setProperty('--buxa-sb-native-tab-width',`${nativeSize.width}px`);
  flyout.style.setProperty('--buxa-sb-native-tab-height',`${nativeSize.height}px`);
  flyout.style.setProperty('--buxa-sb-native-icon-size',`${nativeSize.icon}px`);
  const root=documentRef.querySelector('#sidebar');
  const pane=visibleSidebarPane(root,{viewportWidth});
  const lane=sidebarFlyoutLane({viewportWidth,navRect,sourceRect:sr,
    sidebarRect:root?.getBoundingClientRect?.(),paneRect:pane,rightSidebar:isRight});
  const count=flyout.querySelectorAll('.buxa-sb-flyout-tab').length;
  const preferredWidth=Math.max(nativeSize.width+8,count*(nativeSize.width+4)+2);
  const vertical=lane.room<preferredWidth;
  flyout.classList.toggle('is-vertical',vertical);
  flyout.classList.toggle('is-right-sidebar',lane.rightSidebar);
  flyout.style.maxWidth=`${Math.max(nativeSize.width+8,lane.room)}px`;
  flyout.style.maxHeight=`${viewportHeight-12}px`;
  const w=flyout.offsetWidth || nativeSize.width+8;
  const h=flyout.offsetHeight || nativeSize.height+8;
  flyout.style.left=`${sidebarFlyoutX({viewportWidth,width:w,lane})}px`;
  flyout.style.top=`${Math.max(6,Math.min(viewportHeight-h-6,sr.top+(sr.height-h)/2))}px`;
}

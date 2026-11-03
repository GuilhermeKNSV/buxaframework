/** Native HTML5 Item Directory drag identity (Chromium does not expose
 * dataTransfer data during dragover). Keep the resolved Item document only
 * for the current drag and never use it for server authorization. */
let draggingItem=null;
export const setNativeWorldDragItem=item=>{draggingItem=item||null;};
export const nativeWorldDragItem=()=>draggingItem;

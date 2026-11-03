# Buxa Framework 0.16.4

- Trashcan deletes Actor Items and scene Items without showing a confirmation popup.
- Added a separate GM-only **Select Main Items** mode in GM Controls > Item > Trashcan. Select world Items in the Buxa Items directory or floating folder panels, then delete selected in one action with no confirmation.
- Selection highlights survive directory/folder rerenders and cannot delete Actors or Scene documents.
- Item folders in Main are now draggable into other Item folders or to the visible ROOT drop zone, including from floating folder panels.
- Added a **Move folder** option to the Item-folder context menu for mouse-free moves to root/Main/other safe parents. The pinned Main folder cannot be renamed, moved or deleted.
- Added cycle protection (folder cannot move inside itself or a descendant) and GM permission checks.
- Item-to-scene copy drag remains available.
- Existing individual Item/folder right-click context delete confirmations remain unchanged; only GM Trashcan deletion is immediate.

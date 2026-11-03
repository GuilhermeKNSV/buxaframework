# Buxa Framework v0.13.31 — Linked vision and GM Item View

- Physical items use the explicitly linked Actor's live token vision even when the user has not selected a token. Multiple linked tokens may jointly cover the item's occupied area; hidden or sight-disabled tokens cannot reveal it.
- A GM sees all physical items by default, including when controlling a token. **GM Controls → ITEM → LOOTING → Item visibility → GM Item View** switches that override off, causing item visibility to follow controlled or explicitly linked character sight.
- Visibility applies to entire physical item containers (sprite, nameplate, beam/shadow, and pointer interaction), and ground-container drop targets use the same settings.
- Updating Actor links or canvas sight refreshes the visibility state without recreating sprites.
- Preserves v0.13.30 item storage, transfer, and inventory data; no migration needed.
- 509 automated tests passed; 147 JS files syntax checked; architecture check passed with 8 nonblocking file-size warnings. Live Foundry V14 testing remains necessary for vision-source behavior.

# Buxa Framework v0.16.9 — Directory usability fixes

- Accept drops across the full empty directory workspace for Items, Actors and Scenes.
- Dropping in Main tab empty space now moves records OUT of Main into the normal root. Other tab backgrounds move records to that tab; dropping on Main folder still moves them into shared Main.
- Keep floating folder windows open and refresh them when switching bottom tabs.
- Treat the whole floating folder panel as a valid drop destination, including header and footer.
- Avoid re-rendering the source Item folder panel during active drag operations.
- Fix global Item-folder drag/context listeners mistakenly intercepting Actor and Scene panel interactions.
- Recognize native/external Folder drag sources in Actor/Scene directory drops.
- Added subtle blank-workspace drop highlighting without adding UI rows or bars.
- Added focused regression coverage for tab destinations, panel routing, and moving contents out of Main.

Existing gameplay, item rarities, and folder data are preserved. Live Foundry V14 drag/drop still requires manual verification.

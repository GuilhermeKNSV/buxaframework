# Buxa Framework v0.14.06

## Scene items
- Rebuilt right-click interactions as a compact, mouse-anchored rarity-accented menu (Open storage, Take item, GM Edit artwork). No duplicated green OPEN/Crate/Edit button stack.
- Fixed pointer-coordinate mapping for Foundry's canvas/Pixi right-click events and deduplicated multiple synthetic right-click events.
- Replaced the opaque colored Shadow-mode ovals with soft neutral translucent contact-shadow layers and a subtle rarity-colored edge.
- Preserved original drop, loot authorization, item ownership, and drag placement rules.

## Optional module integrations
- Added installed/active Addons status for Sequencer, Automated Animations, socketlib, Game-icons.net, and existing Carousel Combat Tracker.
- Added Sequencer integration for scene item Open/Take interactions: GM can enable it and choose an optional animation path. No asset or Sequencer required; silent fallback to built-in graphics. The Sequencer path is validated before playback.
- Added a browse button for the optional VFX asset and Game-icons.net shortcut for SVG icon source.
- Listed all external modules as recommendations, not hard requirements.
- Automated Animations remains responsible for its own item/action triggers; socketlib is displayed as available, without replacing Buxa's existing secure transfer channel.

## Tests
- Regression tests cover contextual menus, opacity/shadow treatment, safe optional integration checks, addon status/config persistence, and Sequencer playback.
- Live Foundry V14 appearance and cross-module interaction must be verified in the user's world.

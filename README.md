# Buxa Framework

A modular, configurable character-sheet and gameplay framework for **Foundry Virtual Tabletop V14** and **D&D 5e 6.x**.

Buxa brings character progression, resources, inventory and equipment, custom item rules, effects, scene interactions, GM utilities, and a highly configurable interface into one integrated module. Its design emphasizes a responsive UI, explicit data ownership, modular feature boundaries, and regression-tested behavior.

> **Current repository version:** `0.17.35`  
> **Foundry compatibility:** minimum V14, verified V14  
> **System compatibility:** D&D 5e minimum 6.0.0, verified 6.0.5

---

## Contents

- [What Buxa includes](#what-buxa-includes)
- [Compatibility and installation](#compatibility-and-installation)
- [Feature guide](#feature-guide)
- [Architecture](#architecture)
- [Project layout](#project-layout)
- [Development and validation](#development-and-validation)
- [Data, safety, and known limitations](#data-safety-and-known-limitations)
- [Changelog and technical documents](#changelog-and-technical-documents)

## What Buxa includes

| Area | Capabilities |
|---|---|
| **Player Sheet** | Character identity and portrait, resources, attributes, stats, proficiencies, progression, rebirth-related controls, and configurable sheet sections |
| **Resources and token HUD** | Per-resource token bars/gauges, display and viewer settings, position/size/opacity/color controls, optional labels and values |
| **Inventory** | Grid-based inventory, sorting, stacking, splitting, drag-and-drop, footprint-aware placement, overflow handling, and item previews |
| **Equipment** | Configurable equipment layouts, slot rules, equipment loadouts, item artwork sizing, drag previews, and equipment-granted bonuses |
| **Items** | Custom Buxa item configuration, rarity presentation, descriptions, dice rules, increases, uses, recharge, discovery/reveal controls, and item actions |
| **Storage** | Equipped containers, external pouch compartments, simple or footprint-based storage, custom shapes, nested ground containers, and transfer handling |
| **Effects** | Configurable effect rules, lifecycle controls, passive/permanent/timed behavior, effect HUD cards, duration and stack presentation |
| **Scene interactions** | Physical items on scenes, ground containers, item placement and pickup, token-facing interactions, and progression visual effects |
| **Combat utilities** | Encounter tools, NPC/GM-facing controls, and a document-driven combat lifecycle observer |
| **World directories and sidebar** | Custom world Actor/Item directory experiences, folder navigation, sidebar organization, and configurable hidden buttons |
| **GM tools** | Physical-item and encounter utilities, item control/reveal actions, NPC drop configuration, and other GM-oriented panels |
| **Configuration** | Dedicated configuration workspaces for Player Sheet, Inventory, Addons, item rules, rarities, notifications, and presentation |

The exact available controls depend on the active module configuration and the relevant Actor/Item data.

## Compatibility and installation

### Requirements

- Foundry Virtual Tabletop **V14**.
- D&D 5e system **6.0.0 or newer** (the manifest currently verifies 6.0.5).
- No additional module is declared as a hard dependency.

The manifest recommends these optional integrations:

- `combat-tracker-dock`
- `sequencer`
- `autoanimations`
- `socketlib`
- `game-icons-net`

Buxa also bundles its own SVG interface assets; its core icon set does not require the Game-icons.net module.

### Install through Foundry

1. Open **Add-on Modules → Install Module**.
2. Paste this manifest URL into the Manifest URL field:

   `https://raw.githubusercontent.com/GuilhermeKNSV/buxaframework/main/module.json`

3. Select **Install**.
4. Enable **Buxa Framework** in the world.
5. Back up an existing world before upgrading and test the module in a copy before using it in a live session.

You can also clone or download this repository and place the module folder in Foundry's `Data/modules/` directory. The folder must contain `module.json` at its root.

## Feature guide

### Player Sheet and progression

The Player Sheet is the central character interface. It brings together identity, resources, attributes, stats, proficiencies, and progression. Module Configuration controls which sections and presentation options are enabled.

Progression features include level and point feedback, attribute/proficiency controls, and rebirth-related mechanics. Scene progression effects can display level-up and rebirth celebrations above tokens.

### Inventory, equipment, and storage

The inventory uses grid-based placement and supports item footprints, stacks, sorting, splitting, drag previews, and overflow recovery. Equipment slots are configurable and can be arranged through the equipment layout editor.

Items can grant equipment-dependent increases without permanently baking those bonuses into base Actor values. Removing or changing equipment recalculates the derived bonuses.

Equipped containers can grant capacity, hidden equipment slots, and external pouch compartments. Compartments can use a simple one-item-per-cell mode or preserve an item's configured footprint. Custom complex shapes and masks are supported. When a container is removed, its contents are retained as overflow rather than intentionally discarded.

### Custom items and item rules

Buxa adds its own Item configuration and presentation layer. Depending on the configured item, rules can include:

- Rarity, labels, artwork, descriptions, and display properties.
- Dice rolls and item-use actions.
- Flat and percentage increases to supported targets.
- Resource effects and use limits.
- Recharge behavior and recharge templates.
- Discovery states such as revealed, locked, hidden, and GM-only presentation.
- Modular descriptions and GM-controlled reveal actions.

**GM-only presentation is not a security boundary.** Foundry document data may still be available to users who can access the underlying document. Do not store highly confidential secrets in player-accessible Item flags.

### Effects and combat lifecycle

The Effect editor provides rule configuration and lifecycle controls. The Effect HUD presents active effects, duration, stacks, and access to the related sheet.

The combat lifecycle observer listens to Foundry Combat and Combatant document changes rather than relying on a specific tracker button. This allows native controls, macros, remote GM changes, and Buxa encounter UI to share the same observed timeline. See [Combat lifecycle documentation](docs/COMBAT_LIFECYCLE.md) for event names, snapshots, persistence behavior, and limitations.

### World directories and GM utilities

Buxa includes custom directory and sidebar workflows for managing world Actors and Items, organizing folders, editing directory presentation, and configuring which native buttons are visible. GM-facing utilities cover encounter preparation, NPC drops, physical items, and related scene workflows.

## Architecture

Buxa is intentionally split by responsibility:

- `scripts/main.js` is the bootstrap entry point. It registers settings, sheets, hooks, and the public API.
- `scripts/apps/` contains application and UI behavior.
- `scripts/core/` contains domain rules, data normalization, state, transactions, and reusable logic.
- `scripts/integrations/` bridges Buxa behavior into Foundry and D&D 5e workflows.
- `templates/` contains Handlebars application templates.
- `styles/` contains the stylesheet entry point and focused feature styles.
- `assets/` contains bundled visual assets.
- `tests/` contains automated regression tests.
- `docs/` and `Changelog/` contain technical documentation, audits, and release history.

### Dependency direction

The intended dependency flow is:

1. Application modules may depend on core modules.
2. Core modules must not depend on application classes.
3. Integrations may use core/public APIs but should not own sheet business rules.
4. D&D 5e document paths and system-specific compatibility belong in focused integration/core adapters.
5. `scripts/core/runtime.js` is a compatibility re-export layer, not a place for new business logic.

See [Architecture Rules](Changelog/ARCHITECTURE.md) for the detailed module boundaries, stylesheet rules, file-size limits, and persistence conventions.

## Project layout

```text
buxaframework/
├── assets/          # Bundled SVG and visual assets
├── Changelog/       # Release notes, audits, architecture rules
├── docs/            # Focused technical documentation
├── scripts/
│   ├── apps/        # Sheets, dialogs, editors, HUDs, directory UI
│   ├── core/        # Rules, models, persistence, transactions
│   └── integrations/# Foundry and D&D 5e integration adapters
├── styles/          # Modular CSS
├── templates/       # Handlebars templates
├── tests/           # Node-based regression tests
├── module.json      # Foundry module manifest
└── check-architecture.mjs
```

## Development and validation

The repository includes Node-based tests and an architecture guard. Run these commands from the repository root with a compatible Node.js installation:

```bash
# Run the full automated test suite
node --experimental-default-type=module --test tests/*.test.mjs

# Check architecture and source-size constraints
node check-architecture.mjs
```

The v0.17.35 release notes report **2,985 passing Node tests**, a passing architecture check, and successful compilation of all 17 Handlebars templates. These are the validation results recorded for that release; rerun the commands against your current checkout to verify the current state.

Automated tests do not replace in-Foundry testing. Validate actual sheet behavior, drag-and-drop, canvas rendering, permissions, multiplayer interactions, and compatibility with other enabled modules in a disposable V14 world.

## Data, safety, and known limitations

- **Back up worlds before upgrades.** Buxa touches Actor, Item, Combat, and module-owned flag data.
- **Test migrations on a world copy.** The changelog and audits document normalization, compatibility, and data-preservation decisions.
- **GM-only UI is not cryptographic secrecy.** Do not treat hidden presentation as protection for data stored on player-readable documents.
- **Scene and inventory transactions are complex.** Multi-GM concurrency, crash recovery, and partial Foundry document-write recovery require live integration testing beyond isolated Node tests.
- **Some audit findings remain open.** The audit documents unresolved risks, source limitations, and items requiring browser/Foundry verification. Review the latest audit before making assumptions about edge-case guarantees.
- **Optional integrations are optional.** Recommended modules can enhance workflows, but they are not listed as hard requirements in `module.json`.

For the detailed risk register and module-configuration review, see [Module Configuration Audit](docs/MODULE_CONFIG_AUDIT_01726.md) and the versioned audit files in [Changelog](Changelog/).

## Changelog and technical documents

- [Latest release: v0.17.35](Changelog/CHANGELOG-0.17.35.md)
- [Full consolidated changelog](Changelog/CHANGELOG.md)
- [Changelog index and historical feature notes](Changelog/README.md)
- [Architecture rules](Changelog/ARCHITECTURE.md)
- [Combat lifecycle API and event model](docs/COMBAT_LIFECYCLE.md)
- [Module configuration audit](docs/MODULE_CONFIG_AUDIT_01726.md)
- [All release audits](Changelog/)

The changelog contains the historical progression of the module, including inventory and storage reliability, item configuration and rarity systems, scene interactions, resource HUDs, directory workflows, UI refinements, performance work, and regression fixes.

---

## Repository

[GitHub: GuilhermeKNSV/buxaframework](https://github.com/GuilhermeKNSV/buxaframework)


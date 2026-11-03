# Buxa Framework — Hidden Combat Lifecycle (v0.17.16)

No UI, sidebar elements, notifications, or changes to combat rules are introduced.
The observer uses Foundry **Combat** and **Combatant** document updates, not button handlers, so native buttons, macros, remote GM updates, and Buxa's encounter UI use the same timeline.

## API for future features

```js
const tracker = game.buxaframework.combatLifecycle;
const unsubscribe = tracker.on('turn:started', event => {
  // event.combatId, event.sceneId, event.round, event.turn,
  // event.combatantId, event.previousRound, event.previousTurn,
  // event.previousCombatantId, event.reason, event.sequence, event.timestamp
});
const snapshot = tracker.getSnapshot(combatId);
const events = tracker.getHistory(combatId, { type: 'round:started', limit: 50 });
unsubscribe();
```

Alternatively listen to the public Foundry hook `Hooks.on('buxaCombatLifecycle', event => ...)`. Subscribe to `'*'` for all types. Subscribe in a module's `ready` hook or later. Snapshots and events returned to consumers are copies; consumer code cannot mutate tracked state. Errors thrown by a listener do not block other listeners.

## Event types

| Kind | Meaning |
|---|---|
| `combat:created` / `combat:deleted` | The Combat document was created/deleted **during the current session** |
| `combat:started` / `combat:ended` | Actual `started` transition, not opening a panel or changing active tab |
| `combat:activated` / `combat:deactivated` | Combat's active flag changed |
| `combat:scene-changed` | Combat's scene identity changed |
| `round:started` / `round:ended` | Actual observed round boundary. `round:started.roundsElapsed` / `skippedRounds` describe jumps |
| `turn:started` / `turn:ended` | Actual round/turn-index advancement or rewind, including first and final turns |
| `turn:reassigned` | Same round/index but current combatant changed through reorder/removal. Not treated as a new turn for per-turn effects |
| `turn:reindexed` | Current combatant stayed the same but the numeric turn changed because of an order/roster edit. No actual turn passed |
| `initiative:order-changed` | Sorted participant order changed; includes old/new combatant ID arrays |
| `combatant:joined` / `combatant:left` | Participant added/removed from Combat |
| `combatant:updated` | Actor/token link, name, initiative, defeat, or visibility changed; includes changed fields |
| `roster:changed` | Buxa preparation roster gained/lost entries |
| `combatant:archived` / `combatant:unarchived` | Buxa dead-drawer membership changed; no inference of death from deletion alone |

Each event includes a **monotonically increasing per-combat `sequence`**, `combatId`, `sceneId`, `timestamp` (epoch milliseconds), `round`, `turn`, and `combatantId`. Turn and round boundary events include `previousRound`, `previousTurn`, and `previousCombatantId`. `turn:ended` and `round:ended` report the **outgoing** combatant/position, not the incoming one. `reason` distinguishes `advance`, `rewind`, `combat-start`, `combat-ended`, `stopped`, and `deleted`.

## State and persistence

- On ready, a **baseline is captured for existing combats**. A world loaded mid-battle is not misreported as a new start, round, or turn. Existing recent event history is restored without replaying hooks.
- Snapshots include `started`, `active`, `round`, `turn`, `currentCombatantId`, `sceneId`, `order`, combatant identities, initiative, defeated/hidden flags, and preparation/death rosters.
- Only the **primary active GM** persists history to `flags.buxaframework.lifecycleHistory` on the Combat document. Other clients track events locally but never write history. Writes are serialized and merged to the newest in-memory revision.
- Only the newest **192 events per combat** are retained (bounded size). The sequence does **not** reset when older entries are evicted. The observer ignores its own flag-only update hooks (no recursion).
- Combat deletion emits final events and retains the history **in this session** only. Deleted combat journals cannot persist on deleted documents; external long-term storage should be added when needed.
- Pure diff/snapshot code lives in `scripts/core/combat-lifecycle-model.js`; the Foundry hook and persistence adapter lives in `scripts/integrations/combat-lifecycle.js`.

## Behavioral guarantees and limitations

- Duplicate hooks and unchanged document updates emit no extra transition.
- Initiative reorder or automatic death removal does **not** generate an extra `turn:started` unless the actual round or turn index changed.
- Jumping multiple rounds produces one observed boundary with explicit `roundsElapsed`/`skippedRounds`, **not imaginary intermediate events**.
- Rewinds are marked as rewinds; this stream does not automatically grant bonuses or recharge resources. Consumers must define their own rewind policy.
- `updateCombatant` is checked immediately and again in a microtask to accommodate derived turn order recalculation.
- History is a bounded, best-effort operational journal rather than an atomic multi-GM ledger. Network failure, deleted combats, and simultaneous GM leadership changes remain outside atomic guarantees. Consumers requiring transactional exactly-once effects should persist their own idempotency cursor (`combatId + sequence`) and use GM-authoritative writes.

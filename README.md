# RIVALS — every coin is born in a fight

A paper-trading launchpad arena. No coin launches alone: every launch is a **bout** between two coins on one clock.

- **Buys pull the rope.** Each corner has its own bonding curve.
- **KO:** the first corner to fill its curve target wins on the spot.
- **Decision:** otherwise, whoever raised more ETH at the final bell wins (too close = 45s sudden death → split decision).
- **Absorption:** loser holders are converted into the winner at 70% of their bag's value.
- **The Belt:** winners graduate into an open pool and keep trading.

Everything is simulated in the browser with a 10 ETH practice purse (saved to localStorage). No wallets, no chain calls.

**Stack:** Vite · React 19 · TypeScript · plain CSS · Anton / Archivo / IBM Plex Mono.

```bash
npm install
npm run dev
npm run build
```

## Map

```
src/sim/engine.ts   curve math, bouts, bots, settlement, purse, persistence
src/sim/roster.ts   the house fighters
src/components/     Crest (procedural badges), Rope, FightChart, FightCard, Chrome (header/feed/modal/footer/toast)
src/pages/          Arena · PitPage · CallOut · Belt · Corner · Rulebook
```

Tuning knobs (weight classes, fees, absorb rate, round length, bot sizes) are constants at the top of `engine.ts`.

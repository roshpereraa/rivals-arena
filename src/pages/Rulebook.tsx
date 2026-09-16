import { ABSORB_RATE, CLASSES, FEE, FEE_SPLIT, LAUNCH_FEE, OVERTIME_MS, SPLIT_DECISION_GAP, START_PURSE, type WeightClass } from '../sim/engine';

export function Rulebook() {
  const pct = (n: number) => `${+(n * 100).toFixed(1)}%`;
  return (
    <main className="wrap page-pad rulebook">
      <header className="page-head">
        <p className="eyebrow">Official rules of the arena</p>
        <h1 className="display page-title">The Rule<span className="red">book</span></h1>
      </header>

      <nav className="toc mono" aria-label="Rulebook sections">
        <a href="#/rulebook" onClick={(e) => { e.preventDefault(); document.getElementById('art-1')?.scrollIntoView({ behavior: 'smooth' }); }}>I · The idea</a>
        <a href="#/rulebook" onClick={(e) => { e.preventDefault(); document.getElementById('art-2')?.scrollIntoView({ behavior: 'smooth' }); }}>II · Weigh-in</a>
        <a href="#/rulebook" onClick={(e) => { e.preventDefault(); document.getElementById('art-3')?.scrollIntoView({ behavior: 'smooth' }); }}>III · Scoring</a>
        <a href="#/rulebook" onClick={(e) => { e.preventDefault(); document.getElementById('art-4')?.scrollIntoView({ behavior: 'smooth' }); }}>IV · After the bell</a>
        <a href="#/rulebook" onClick={(e) => { e.preventDefault(); document.getElementById('art-5')?.scrollIntoView({ behavior: 'smooth' }); }}>V · Fees</a>
        <a href="#/rulebook" onClick={(e) => { e.preventDefault(); document.getElementById('art-6')?.scrollIntoView({ behavior: 'smooth' }); }}>VI · Below the belt</a>
      </nav>

      <article id="art-1">
        <span className="art-no display">I</span>
        <div>
          <h2 className="display">The idea</h2>
          <p>Most launchpads let a coin appear alone and fade out alone. RIVALS doesn’t. Every coin enters the arena with an opponent in the other corner, and both run on the same clock.</p>
          <p>That gives every launch a story, a deadline and an ending. Attention goes to the pit, not a feed of a thousand coins that never stood a chance.</p>
        </div>
      </article>

      <article id="art-2">
        <span className="art-no display">II</span>
        <div>
          <h2 className="display">Weigh-in</h2>
          <p>To start a bout, you launch a coin and either <b>name a rival</b> or post an <b>open challenge</b>. The bout starts the moment both corners are filled. Launching costs {LAUNCH_FEE} ETH. You can add an optional <b>opening punch</b>, a first buy that lands the instant the bell rings.</p>
          <div className="table-wrap">
            <table className="table mono">
              <thead><tr><th>Weight class</th><th>KO target per corner</th></tr></thead>
              <tbody>
                {(Object.keys(CLASSES) as WeightClass[]).map((c) => (
                  <tr key={c}><td>{c}</td><td>{CLASSES[c].target} ETH raised</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>Each corner has its own bonding curve starting from zero. Supply is 1,000,000,000 tokens per coin. A bout runs 3, 5 or 8 rounds, one minute each on the sim clock.</p>
        </div>
      </article>

      <article id="art-3">
        <span className="art-no display">III</span>
        <div>
          <h2 className="display">Scoring</h2>
          <p><b>Knockout.</b> The first corner to fill its curve target wins on the spot. The bout ends even if there’s time left on the clock.</p>
          <p><b>Decision.</b> If nobody fills their curve, the corner with more ETH raised at the final bell wins.</p>
          <p><b>Sudden death.</b> If the corners are within {pct(SPLIT_DECISION_GAP)} of each other at the bell, the bout gets {OVERTIME_MS / 1000} seconds of overtime. Whoever leads when overtime ends wins by split decision.</p>
          <p>The judges’ scorecard on each bout shows who won each round. It’s there to follow the action. Only total ETH raised decides the bout.</p>
        </div>
      </article>

      <article id="art-4">
        <span className="art-no display">IV</span>
        <div>
          <h2 className="display">After the bell</h2>
          <p><b>The winner graduates.</b> Its curve closes and it moves to an open pool on The Belt, where it keeps trading.</p>
          <p><b>The loser is absorbed.</b> Every holder of the losing coin has their bag valued at the loser’s final curve price. They receive {pct(ABSORB_RATE)} of that value in the winner’s tokens. The other {pct(1 - ABSORB_RATE)} is the price of backing the wrong corner.</p>
          <p>So losing hurts, but it doesn’t zero you out. You end up holding the coin that beat you.</p>
        </div>
      </article>

      <article id="art-5">
        <span className="art-no display">V</span>
        <div>
          <h2 className="display">Fees</h2>
          <p>Every curve trade pays {pct(FEE)}. That fee splits three ways:</p>
          <ul className="fee-split mono">
            <li><b>{pct(FEE_SPLIT.creator)}</b> to the coin’s creator</li>
            <li><b>{pct(FEE_SPLIT.purse)}</b> to the bout’s purse</li>
            <li><b>{pct(FEE_SPLIT.arena)}</b> to the arena</li>
          </ul>
          <p>Creators can also set a creator tax of up to 3%. Champion pools on The Belt charge a flat {pct(FEE)}.</p>
        </div>
      </article>

      <article id="art-6">
        <span className="art-no display">VI</span>
        <div>
          <h2 className="display">Below the belt</h2>
          <p><b>This is a paper arena.</b> Every fighter, trade, price and purse is simulated in your browser with practice ETH. Your purse starts at {START_PURSE} ETH and is saved on this device only. Bouts never touch a blockchain.</p>
          <p><b>Wallets are real, trades are not.</b> You can connect MetaMask, Rabby, Coinbase Wallet, Phantom and other EVM wallets. The site reads your address, network and Robinhood Chain balance. It never asks you to sign a message or send a transaction.</p>
          <p><b>The crowd is simulated too.</b> The other traders are bots with momentum, comebacks and the odd whale. They’re built to feel like a real launch, not to predict one.</p>
          <p><b>Real launches are harsher.</b> Newly launched tokens mostly go to zero. Head starts, coordinated buyers and snipers can decide a real fight before it begins. Use this arena to learn the mechanics, not to size real bets. Nothing here is investment advice.</p>
        </div>
      </article>
    </main>
  );
}

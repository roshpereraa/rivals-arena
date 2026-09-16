import { useEffect, useState } from 'react';
import { ago, fmtEth, netWorth, START_PURSE } from '../sim/engine';
import { WalletButton } from './WalletUI';
import { useArena } from '../lib/hooks';

const NAV: { path: string; label: string; short?: string }[] = [
  { path: '/', label: 'Arena' },
  { path: '/call-out', label: 'Call out' },
  { path: '/belt', label: 'The Belt' },
  { path: '/lab', label: 'Token Lab', short: 'Lab' },
  { path: '/corner', label: 'Corner' },
  { path: '/rulebook', label: 'Rulebook' },
];

const isActive = (route: string, path: string) =>
  path === '/' ? route === '/' || route.startsWith('/pit') : route.startsWith(path);

export function Logo() {
  return (
    <a href="#/" className="logo" aria-label="RIVALS home">
      <svg viewBox="0 0 40 40" width="30" height="30" aria-hidden>
        <path d="M20 3 L4 37 H20Z" fill="var(--red)" />
        <path d="M20 3 L36 37 H20Z" fill="var(--blue)" />
        <rect x="18" y="3" width="4" height="34" fill="var(--bell)" />
      </svg>
      <span>RIVALS</span>
    </a>
  );
}

export function Header({ route, onEnter }: { route: string; onEnter: (tab?: 'evm' | 'sol') => void }) {
  const s = useArena();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  const worth = netWorth();
  const pnl = worth - START_PURSE;

  return (
    <>
      <header className={`header${scrolled ? ' header--scrolled' : ''}`}>
        <Logo />
        <nav className="nav" aria-label="Primary">
          {NAV.map((n) => (
            <a key={n.path} href={`#${n.path}`} className={isActive(route, n.path) ? 'is-active' : ''}>
              {n.label}
            </a>
          ))}
        </nav>
        <div className="header__right">
          <span className="chip chip--paper mono" title="Every trade here uses practice ETH">
            <i /> Paper arena
          </span>
          {s.purse.entered && (
            <a href="#/corner" className="purse-chip mono" title="Practice purse">
              <span>{fmtEth(s.purse.eth, 2)}</span>
              <b className={pnl >= 0 ? 'up' : 'down'}>
                {pnl >= 0 ? '+' : ''}
                {pnl.toFixed(2)}
              </b>
            </a>
          )}
          <WalletButton onOpen={onEnter} />
        </div>
      </header>
      <nav className="tabbar" aria-label="Primary mobile">
        {NAV.map((n) => (
          <a key={n.path} href={`#${n.path}`} className={isActive(route, n.path) ? 'is-active' : ''}>
            {n.short ?? n.label}
          </a>
        ))}
      </nav>
    </>
  );
}

export function FeedStrip() {
  const s = useArena();
  const items = s.feed.slice(0, 14);
  if (!items.length) return null;
  const row = items.map((e) => (
    <a key={e.id} href={e.pitId ? `#/pit/${e.pitId}` : '#/'} className={`strip__item strip__item--${e.kind}`}>
      <b>{e.kind === 'ko' ? 'KO' : e.kind === 'dec' ? 'DEC' : e.kind === 'whale' ? 'HIT' : e.kind === 'bell' ? 'OT' : e.kind === 'you' ? 'YOU' : 'NEW'}</b>
      {e.text}
      <em>{ago(e.t)}</em>
    </a>
  ));
  return (
    <div className="strip mono" aria-label="Arena feed">
      <div className="strip__track">
        {row}
        <span aria-hidden className="strip__dup">{row}</span>
      </div>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer__top">
        <div>
          <Logo />
          <p>Every coin is born in a fight. A paper-trading launchpad arena built around Robinhood Chain culture. Connect any wallet; bouts are settled with practice ETH.</p>
        </div>
        <div>
          <h4>Fight</h4>
          <a href="#/">Live bouts</a>
          <a href="#/call-out">Call someone out</a>
          <a href="#/belt">The Belt</a>
          <a href="#/lab">Token Lab</a>
        </div>
        <div>
          <h4>You</h4>
          <a href="#/corner">Your corner</a>
          <a href="#/corner">Fight record</a>
        </div>
        <div>
          <h4>Learn</h4>
          <a href="#/rulebook">Rulebook</a>
          <a href="#/rulebook">Scoring</a>
          <a href="#/rulebook">Below the belt</a>
        </div>
      </div>
      <div className="footer__bottom mono">
        <span>© 2026 RIVALS · paper arena</span>
        <span>All prices, trades and fighters are simulated with practice ETH. Connected wallets are never asked to sign or send. Nothing here is investment advice.</span>
      </div>
    </footer>
  );
}

type ToastMsg = { text: string; ok: boolean; key: number };

export const toast = (text: string, ok = true) =>
  window.dispatchEvent(new CustomEvent<ToastMsg>('rivals:toast', { detail: { text, ok, key: Date.now() } }));

export function Toaster() {
  const [msg, setMsg] = useState<ToastMsg | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const on = (e: Event) => {
      setMsg((e as CustomEvent<ToastMsg>).detail);
      clearTimeout(timer);
      timer = setTimeout(() => setMsg(null), 2600);
    };
    window.addEventListener('rivals:toast', on);
    return () => {
      window.removeEventListener('rivals:toast', on);
      clearTimeout(timer);
    };
  }, []);
  if (!msg) return null;
  return (
    <div key={msg.key} className={`toast ${msg.ok ? 'toast--ok' : 'toast--err'}`} role="status">
      {msg.text}
    </div>
  );
}

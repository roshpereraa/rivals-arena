import { useEffect, useRef, useState } from 'react';
import { enterArena, START_PURSE } from '../sim/engine';
import { useArena } from '../lib/hooks';
import {
  ROBINHOOD,
  SOL_SUGGESTED,
  SUGGESTED,
  chainName,
  clearError,
  connectCoinbase,
  connectInjected,
  connectSolana,
  connectWalletConnect,
  disconnect,
  disconnectSolana,
  fmtBalance,
  hasWalletConnect,
  isDetected,
  isMobile,
  isSolDetected,
  refreshBalance,
  shortAddress,
  switchToRobinhood,
  useWallet,
  type Suggested,
} from '../wallet/wallet';
import { toast } from './Chrome';

export type WalletTab = 'evm' | 'sol';

function WalletIcon({ name, icon, color }: { name: string; icon?: string; color?: string }) {
  if (icon) return <img className="wicon" src={icon} alt="" width={28} height={28} />;
  return (
    <span className="wicon wicon--letter" style={{ background: color ?? 'var(--line-2)' }} aria-hidden>
      {name.slice(0, 1)}
    </span>
  );
}

function Row({ name, icon, color, note, active, onClick, href, external }: {
  name: string;
  icon?: string;
  color?: string;
  note: string;
  active?: boolean;
  onClick?: () => void;
  href?: string;
  external?: boolean;
}) {
  const body = (
    <>
      <WalletIcon name={name} icon={icon} color={color} />
      <span>{name}</span>
      <em className="mono">{note}</em>
    </>
  );
  return (
    <li>
      {href ? (
        <a href={href} className="wallet-link" {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>{body}</a>
      ) : (
        <button onClick={onClick} className={active ? 'is-picked' : ''}>{body}</button>
      )}
    </li>
  );
}

function Missing({ list }: { list: Suggested[] }) {
  const mobile = isMobile();
  return (
    <>
      {list.map((s) =>
        mobile && s.deeplink ? (
          <Row key={s.name} name={s.name} color={s.color} note="Open in app ↗" href={s.deeplink()} />
        ) : (
          <Row key={s.name} name={s.name} color={s.color} note="Install ↗" href={s.install} external />
        ),
      )}
    </>
  );
}

export function ConnectModal({ open, tab: initialTab, onClose }: { open: boolean; tab: WalletTab; onClose: () => void }) {
  const w = useWallet();
  const arena = useArena();
  const [tab, setTab] = useState<WalletTab>(initialTab);

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    clearError();
    const on = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [open, initialTab, onClose]);

  if (!open) return null;

  const done = (ok: boolean, label: string) => {
    if (!ok) return;
    enterArena();
    toast(`${label} wallet connected`);
    onClose();
  };

  // The Coinbase row already covers the Coinbase app and Smart Wallet.
  const evmMissing = SUGGESTED.filter((s) => !isDetected(s) && s.name !== 'Coinbase Wallet');
  const solMissing = SOL_SUGGESTED.filter((s) => !isSolDetected(s));

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="connect-title" onClick={onClose}>
      <div className="modal__card" onClick={(e) => e.stopPropagation()}>
        <button className="modal__x" onClick={onClose} aria-label="Close">×</button>
        <div className="modal__left">
          <p className="eyebrow">Weigh-in</p>
          <h2 id="connect-title" className="display">Connect a wallet</h2>

          <div className="seg mono" role="tablist">
            <button role="tab" aria-selected={tab === 'evm'} className={tab === 'evm' ? 'is-on' : ''} onClick={() => setTab('evm')}>
              Ethereum {w.address ? '✓' : ''}
            </button>
            <button role="tab" aria-selected={tab === 'sol'} className={tab === 'sol' ? 'is-on' : ''} onClick={() => setTab('sol')}>
              Solana {w.sol ? '✓' : ''}
            </button>
          </div>

          {tab === 'evm' ? (
            <>
              {w.detected.length > 0 && (
                <>
                  <p className="eyebrow eyebrow--dim">Detected in this browser</p>
                  <ul className="wallets">
                    {w.detected.map((d) => (
                      <Row
                        key={d.info.uuid}
                        name={d.info.name}
                        icon={d.info.icon}
                        color={SUGGESTED.find((s) => s.rdns.includes(d.info.rdns))?.color}
                        active={w.connectingTo === d.info.name}
                        note={w.connectingTo === d.info.name ? 'Check wallet…' : w.wallet?.uuid === d.info.uuid ? 'Connected' : 'Installed'}
                        onClick={async () => done(await connectInjected(d), 'Ethereum')}
                      />
                    ))}
                  </ul>
                </>
              )}
              <p className="eyebrow eyebrow--dim">{w.detected.length ? 'More wallets' : 'Wallets'}</p>
              <ul className="wallets">
                <Row
                  name="Coinbase Wallet"
                  color="#0052ff"
                  active={w.connectingTo === 'Coinbase Wallet'}
                  note={w.connectingTo === 'Coinbase Wallet' ? 'Check popup…' : 'App · Smart Wallet'}
                  onClick={async () => done(await connectCoinbase(), 'Ethereum')}
                />
                {hasWalletConnect() && (
                  <Row
                    name="WalletConnect"
                    color="#3b99fc"
                    active={w.connectingTo === 'WalletConnect'}
                    note={w.connectingTo === 'WalletConnect' ? 'Scan the QR…' : 'Any mobile wallet'}
                    onClick={async () => done(await connectWalletConnect(), 'Ethereum')}
                  />
                )}
                <Missing list={evmMissing} />
              </ul>
            </>
          ) : (
            <>
              {w.solWallets.length > 0 && (
                <>
                  <p className="eyebrow eyebrow--dim">Detected in this browser</p>
                  <ul className="wallets">
                    {w.solWallets.map((d) => (
                      <Row
                        key={d.info.uuid}
                        name={d.info.name}
                        icon={d.info.icon}
                        active={w.solConnectingTo === d.info.name}
                        note={w.solConnectingTo === d.info.name ? 'Check wallet…' : w.sol?.wallet.name === d.info.name ? 'Connected' : 'Installed'}
                        onClick={async () => done(await connectSolana(d), 'Solana')}
                      />
                    ))}
                  </ul>
                </>
              )}
              {solMissing.length > 0 && (
                <>
                  <p className="eyebrow eyebrow--dim">{w.solWallets.length ? 'More wallets' : 'Wallets'}</p>
                  <ul className="wallets">
                    <Missing list={solMissing} />
                  </ul>
                </>
              )}
            </>
          )}

          {w.error && <p className="wallet-error mono" role="alert">{w.error}</p>}
        </div>

        <div className="modal__right">
          <button
            className="purse-option"
            onClick={() => {
              enterArena();
              onClose();
            }}
          >
            <span className="purse-option__badge">{arena.purse.entered ? 'Active' : 'No wallet needed'}</span>
            <strong>Practice purse</strong>
            <span>{START_PURSE} ETH of practice money. Back corners, launch coins, learn the fight. No risk.</span>
          </button>
          <h3>What connecting does</h3>
          <ol className="mini-rules">
            <li><b>Shows your address</b> in the header. Connect one Ethereum and one Solana wallet at the same time.</li>
            <li><b>Never asks you to sign or send anything.</b> Bouts are still settled with your practice purse.</li>
            <li><b>Disconnect any time</b> from the wallet menu.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast('Address copied');
  } catch {
    toast('Could not copy', false);
  }
};

export function WalletButton({ onOpen }: { onOpen: (tab: WalletTab) => void }) {
  const w = useWallet();
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    refreshBalance();
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setMenu(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false);
    document.addEventListener('mousedown', close);
    window.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', esc);
    };
  }, [menu]);

  const evm = w.status === 'connected' && w.address;
  if (!evm && !w.sol) {
    return (
      <button className="btn btn--bell wallet-btn" onClick={() => onOpen('evm')}>
        {w.status === 'connecting' || w.solConnectingTo ? 'Connecting…' : 'Connect wallet'}
      </button>
    );
  }

  const onRobinhood = w.chainId === ROBINHOOD.id;

  return (
    <div className="wallet-menu" ref={ref}>
      <button className="wallet-chip mono" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-haspopup="menu">
        {evm && (
          <span className="wallet-chip__acct">
            <WalletIcon name={w.wallet?.name ?? 'E'} icon={w.wallet?.icon} />
            <span className="wallet-chip__addr">{shortAddress(w.address)}</span>
          </span>
        )}
        {w.sol && (
          <span className="wallet-chip__acct">
            <WalletIcon name={w.sol.wallet.name} icon={w.sol.wallet.icon} />
            <span className="wallet-chip__addr">{shortAddress(w.sol.address)}</span>
          </span>
        )}
      </button>
      {menu && (
        <div className="wallet-pop" role="menu">
          <section>
            <p className="mono wallet-pop__who">Ethereum{evm ? ` · ${w.wallet?.name}` : ''}</p>
            {evm ? (
              <>
                <p className="mono wallet-pop__addr">{w.address}</p>
                <dl className="mono">
                  <div><dt>Network</dt><dd className={onRobinhood ? 'up' : 'dim'}>{chainName(w.chainId)}</dd></div>
                  <div><dt>Balance on {ROBINHOOD.name}</dt><dd>{fmtBalance(w.balance)}</dd></div>
                </dl>
                {!onRobinhood && (
                  <button
                    className="btn btn--ghost btn--block btn--sm"
                    onClick={async () => {
                      if (await switchToRobinhood()) toast(`Switched to ${ROBINHOOD.name}`);
                      else toast('Network switch was not completed', false);
                    }}
                  >
                    Switch to {ROBINHOOD.name}
                  </button>
                )}
                <div className="wallet-pop__row">
                  <button className="btn btn--ghost btn--sm" onClick={() => copy(w.address!)}>Copy</button>
                  <button className="btn btn--ghost btn--sm" onClick={async () => { await disconnect(); toast('Ethereum wallet disconnected'); }}>Disconnect</button>
                </div>
              </>
            ) : (
              <button className="btn btn--bell btn--block btn--sm" onClick={() => { setMenu(false); onOpen('evm'); }}>Connect Ethereum wallet</button>
            )}
          </section>
          <section>
            <p className="mono wallet-pop__who">Solana{w.sol ? ` · ${w.sol.wallet.name}` : ''}</p>
            {w.sol ? (
              <>
                <p className="mono wallet-pop__addr">{w.sol.address}</p>
                <div className="wallet-pop__row">
                  <button className="btn btn--ghost btn--sm" onClick={() => copy(w.sol!.address)}>Copy</button>
                  <button className="btn btn--ghost btn--sm" onClick={async () => { await disconnectSolana(); toast('Solana wallet disconnected'); }}>Disconnect</button>
                </div>
              </>
            ) : (
              <button className="btn btn--bell btn--block btn--sm" onClick={() => { setMenu(false); onOpen('sol'); }}>Connect Solana wallet</button>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

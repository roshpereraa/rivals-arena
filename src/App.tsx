import { useCallback, useEffect, useState } from 'react';
import { useRoute } from './lib/hooks';
import { FeedStrip, Footer, Header, Toaster } from './components/Chrome';
import { ConnectModal, type WalletTab } from './components/WalletUI';
import { useWallet } from './wallet/wallet';
import { arena, enterArena } from './sim/engine';
import { Arena } from './pages/Arena';
import { PitPage } from './pages/PitPage';
import { CallOut } from './pages/CallOut';
import { Belt } from './pages/Belt';
import { Corner } from './pages/Corner';
import { Rulebook } from './pages/Rulebook';
import { Lab } from './pages/Lab';

export function App() {
  const route = useRoute();
  const [entering, setEntering] = useState<WalletTab | null>(null);
  // Pages pass click events; the wallet menu passes a tab.
  const onEnter = useCallback((tab?: unknown) => setEntering(tab === 'sol' ? 'sol' : 'evm'), []);
  const onClose = useCallback(() => setEntering(null), []);
  const wallet = useWallet();

  // A connected wallet (including a restored one) gets a practice purse to trade with.
  useEffect(() => {
    if ((wallet.status === 'connected' || wallet.sol) && !arena().purse.entered) enterArena();
  }, [wallet.status, wallet.sol]);

  let page;
  if (route.startsWith('/pit/')) page = <PitPage id={route.slice(5)} onEnter={onEnter} />;
  else if (route === '/call-out') page = <CallOut onEnter={onEnter} />;
  else if (route === '/belt') page = <Belt onEnter={onEnter} />;
  else if (route === '/corner') page = <Corner onEnter={onEnter} />;
  else if (route === '/rulebook') page = <Rulebook />;
  else if (route === '/lab') page = <Lab />;
  else page = <Arena onEnter={onEnter} />;

  return (
    <div className="app">
      <Header route={route} onEnter={onEnter} />
      <FeedStrip />
      {page}
      <Footer />
      <ConnectModal open={entering !== null} tab={entering ?? 'evm'} onClose={onClose} />
      <Toaster />
    </div>
  );
}

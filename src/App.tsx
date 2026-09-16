import { useCallback, useState } from 'react';
import { useRoute } from './lib/hooks';
import { EnterModal, FeedStrip, Footer, Header, Toaster } from './components/Chrome';
import { Arena } from './pages/Arena';
import { PitPage } from './pages/PitPage';
import { CallOut } from './pages/CallOut';
import { Belt } from './pages/Belt';
import { Corner } from './pages/Corner';
import { Rulebook } from './pages/Rulebook';

export function App() {
  const route = useRoute();
  const [entering, setEntering] = useState(false);
  const onEnter = useCallback(() => setEntering(true), []);
  const onClose = useCallback(() => setEntering(false), []);

  let page;
  if (route.startsWith('/pit/')) page = <PitPage id={route.slice(5)} onEnter={onEnter} />;
  else if (route === '/call-out') page = <CallOut onEnter={onEnter} />;
  else if (route === '/belt') page = <Belt onEnter={onEnter} />;
  else if (route === '/corner') page = <Corner onEnter={onEnter} />;
  else if (route === '/rulebook') page = <Rulebook />;
  else page = <Arena onEnter={onEnter} />;

  return (
    <div className="app">
      <Header route={route} onEnter={onEnter} />
      <FeedStrip />
      {page}
      <Footer />
      <EnterModal open={entering} onClose={onClose} />
      <Toaster />
    </div>
  );
}

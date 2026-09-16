import { useEffect, useState, useSyncExternalStore } from 'react';
import { arena, getVersion, subscribe } from '../sim/engine';

/** Re-render whenever the arena simulation changes. */
export const useArena = () => {
  useSyncExternalStore(subscribe, getVersion);
  return arena();
};

export const useNow = (ms = 250) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
};

const parse = () => {
  const h = window.location.hash.replace(/^#/, '') || '/';
  return h.split('?')[0];
};

export const useRoute = () => {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => {
      setRoute(parse());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
};

export const go = (path: string) => {
  window.location.hash = path;
};

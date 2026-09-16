// Real wallet connections.
//
// - Browser extension wallets are discovered with EIP-6963 (MetaMask, Rabby,
//   Coinbase, Phantom, OKX, Trust, Brave, …), with a window.ethereum fallback.
// - Coinbase Wallet SDK covers the Coinbase mobile app and Smart Wallet (QR / passkey).
// - WalletConnect covers every other mobile wallet once VITE_WALLETCONNECT_PROJECT_ID is set.
// - Solana wallets (Phantom, Solflare, Backpack, …) are discovered with the Wallet Standard.
// - On phones without an injected wallet, deep links open this site inside the wallet's browser.
//
// Connecting only reads the address (plus network and balance for EVM). RIVALS never asks a
// wallet to sign or send anything — trading still uses the practice purse.

import { useSyncExternalStore } from 'react';
import { getWallets } from '@wallet-standard/app';
import type { Wallet } from '@wallet-standard/base';

export interface Eip1193 {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, fn: (...args: any[]) => void): void;
  removeListener?(event: string, fn: (...args: any[]) => void): void;
  disconnect?(): Promise<void>;
  [k: string]: unknown;
}

export interface WalletInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

export interface Detected {
  info: WalletInfo;
  provider: Eip1193;
}

export const ROBINHOOD = {
  id: 4663,
  hex: '0x1237',
  name: 'Robinhood Chain',
  rpc: 'https://rpc.mainnet.chain.robinhood.com',
  readRpc: 'https://robinhood-rpc.publicnode.com',
  explorer: 'https://robinhoodchain.blockscout.com',
};

const KNOWN_CHAINS: Record<number, string> = {
  1: 'Ethereum',
  10: 'Optimism',
  56: 'BNB Chain',
  137: 'Polygon',
  8453: 'Base',
  42161: 'Arbitrum',
  4663: 'Robinhood Chain',
  46630: 'Robinhood Testnet',
  11155111: 'Sepolia',
};
export const chainName = (id?: number) => (id ? KNOWN_CHAINS[id] ?? `Chain ${id}` : '—');

const WC_PROJECT_ID = (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined) ?? '';
export const hasWalletConnect = () => !!WC_PROJECT_ID;

export type Status = 'idle' | 'connecting' | 'connected';

export interface WalletState {
  status: Status;
  connectingTo?: string;
  error?: string;
  wallet?: WalletInfo;
  address?: string;
  chainId?: number;
  balance?: bigint; // on Robinhood Chain
  detected: Detected[];
  sol?: { wallet: WalletInfo; address: string };
  solConnectingTo?: string;
  solWallets: SolDetected[];
}

export interface SolDetected {
  info: WalletInfo;
  wallet: Wallet;
}

let state: WalletState = { status: 'idle', detected: [], solWallets: [] };
let active: Eip1193 | undefined;
const listeners = new Set<() => void>();
const set = (patch: Partial<WalletState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

export const useWallet = () =>
  useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => state,
  );
export const walletState = () => state;

// ─── discovery ───────────────────────────────────────────────────────────────

const detected = new Map<string, Detected>();

const legacyName = (p: Eip1193) =>
  p.isRabby ? 'Rabby' : p.isCoinbaseWallet ? 'Coinbase Wallet' : p.isPhantom ? 'Phantom' : p.isTrust ? 'Trust Wallet' : p.isOkxWallet ? 'OKX Wallet' : p.isBraveWallet ? 'Brave Wallet' : p.isMetaMask ? 'MetaMask' : 'Browser wallet';

const publishDetected = () => {
  const list = [...detected.values()];
  const eth = (window as unknown as { ethereum?: Eip1193 & { providers?: Eip1193[] } }).ethereum;
  if (eth) {
    // Older wallets that don't announce via EIP-6963.
    const providers = eth.providers?.length ? eth.providers : [eth];
    providers.forEach((p, i) => {
      if (list.some((d) => d.provider === p)) return;
      const name = legacyName(p);
      if (list.some((d) => d.info.name === name)) return;
      list.push({ info: { uuid: `legacy-${i}`, name, icon: '', rdns: `legacy.${name.toLowerCase().replace(/\W/g, '')}` }, provider: p });
    });
  }
  set({ detected: list });
};

let discovered = false;
export const discoverWallets = () => {
  if (discovered) return;
  discovered = true;
  window.addEventListener('eip6963:announceProvider', (e: Event) => {
    const { info, provider } = (e as CustomEvent<Detected>).detail;
    if (!info?.rdns || !provider) return;
    detected.set(info.rdns, { info, provider });
    publishDetected();
  });
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  // Some extensions inject window.ethereum late.
  setTimeout(publishDetected, 400);
  setTimeout(reconnect, 500);
  discoverSolana();
};

// ─── catalogue for the modal ────────────────────────────────────────────────

const here = () => window.location.href;
export const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export interface Suggested {
  name: string;
  rdns: string[];
  color: string;
  install: string;
  deeplink?: () => string;
}

export const SUGGESTED: Suggested[] = [
  { name: 'MetaMask', rdns: ['io.metamask', 'io.metamask.flask'], color: '#f6851b', install: 'https://metamask.io/download', deeplink: () => `https://metamask.app.link/dapp/${here().replace(/^https?:\/\//, '')}` },
  { name: 'Rabby', rdns: ['io.rabby'], color: '#7084ff', install: 'https://rabby.io' },
  { name: 'Coinbase Wallet', rdns: ['com.coinbase.wallet'], color: '#0052ff', install: 'https://www.coinbase.com/wallet/downloads', deeplink: () => `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(here())}` },
  { name: 'Phantom', rdns: ['app.phantom'], color: '#ab9ff2', install: 'https://phantom.com/download', deeplink: () => `https://phantom.app/ul/browse/${encodeURIComponent(here())}?ref=${encodeURIComponent(location.origin)}` },
  { name: 'Trust Wallet', rdns: ['com.trustwallet.app'], color: '#3375bb', install: 'https://trustwallet.com/download', deeplink: () => `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(here())}` },
  { name: 'OKX Wallet', rdns: ['com.okex.wallet'], color: '#e6e6e6', install: 'https://www.okx.com/web3', deeplink: () => `https://www.okx.com/download?deeplink=${encodeURIComponent(`okx://wallet/dapp/url?dappUrl=${encodeURIComponent(here())}`)}` },
];

export const isDetected = (s: Suggested) =>
  state.detected.some((d) => s.rdns.includes(d.info.rdns) || d.info.name.toLowerCase() === s.name.toLowerCase());

// ─── connect / disconnect ───────────────────────────────────────────────────

const STORE_KEY = 'rivals.wallet.v1';
const remember = (rdns?: string) => {
  try {
    if (rdns) localStorage.setItem(STORE_KEY, rdns);
    else localStorage.removeItem(STORE_KEY);
  } catch {
    /* storage unavailable */
  }
};
const remembered = () => {
  try {
    return localStorage.getItem(STORE_KEY);
  } catch {
    return null;
  }
};

const onAccounts = (accounts: unknown) => {
  const list = accounts as string[];
  if (!list?.length) return void teardown();
  set({ address: list[0] });
  refreshBalance();
};
const onChain = (id: unknown) => set({ chainId: parseInt(String(id), 16) });
const onDisconnect = () => teardown();

const attach = (p: Eip1193) => {
  p.on?.('accountsChanged', onAccounts);
  p.on?.('chainChanged', onChain);
  p.on?.('disconnect', onDisconnect);
};
const detach = (p?: Eip1193) => {
  p?.removeListener?.('accountsChanged', onAccounts);
  p?.removeListener?.('chainChanged', onChain);
  p?.removeListener?.('disconnect', onDisconnect);
};

const teardown = () => {
  detach(active);
  active = undefined;
  remember();
  set({ status: 'idle', wallet: undefined, address: undefined, chainId: undefined, balance: undefined, connectingTo: undefined });
};

const describe = (e: unknown) => {
  const err = e as { code?: number; message?: string };
  if (err?.code === 4001) return 'Request rejected in your wallet.';
  if (err?.code === -32002) return 'Your wallet already has a request open. Check the extension.';
  return err?.message?.split('\n')[0]?.slice(0, 140) || 'Could not connect to that wallet.';
};

const finish = async (info: WalletInfo, provider: Eip1193, accounts: string[]) => {
  if (!accounts?.length) throw new Error('No account was shared.');
  const chainId = parseInt(String(await provider.request({ method: 'eth_chainId' })), 16);
  detach(active);
  active = provider;
  attach(provider);
  remember(info.rdns);
  set({ status: 'connected', wallet: info, address: accounts[0], chainId, error: undefined, connectingTo: undefined });
  refreshBalance();
};

export const connectInjected = async (d: Detected) => {
  set({ status: 'connecting', connectingTo: d.info.name, error: undefined });
  try {
    const accounts = (await d.provider.request({ method: 'eth_requestAccounts' })) as string[];
    await finish(d.info, d.provider, accounts);
    return true;
  } catch (e) {
    set({ status: state.address ? 'connected' : 'idle', connectingTo: undefined, error: describe(e) });
    return false;
  }
};

let coinbaseProvider: Eip1193 | undefined;
const getCoinbase = async () => {
  if (coinbaseProvider) return coinbaseProvider;
  const { createCoinbaseWalletSDK } = await import('@coinbase/wallet-sdk');
  const sdk = createCoinbaseWalletSDK({
    appName: 'RIVALS',
    appLogoUrl: `${location.origin}/favicon.svg`,
    appChainIds: [ROBINHOOD.id, 8453, 1],
    preference: { options: 'all' },
  });
  coinbaseProvider = sdk.getProvider() as unknown as Eip1193;
  return coinbaseProvider;
};
const COINBASE_INFO: WalletInfo = { uuid: 'coinbase-sdk', name: 'Coinbase Wallet', icon: '', rdns: 'sdk.coinbase' };

export const connectCoinbase = async () => {
  set({ status: 'connecting', connectingTo: 'Coinbase Wallet', error: undefined });
  try {
    const p = await getCoinbase();
    const accounts = (await p.request({ method: 'eth_requestAccounts' })) as string[];
    await finish(COINBASE_INFO, p, accounts);
    return true;
  } catch (e) {
    set({ status: state.address ? 'connected' : 'idle', connectingTo: undefined, error: describe(e) });
    return false;
  }
};

let wcProvider: Eip1193 | undefined;
export const connectWalletConnect = async () => {
  if (!WC_PROJECT_ID) {
    set({ error: 'WalletConnect needs a project ID before it can be used.' });
    return false;
  }
  set({ status: 'connecting', connectingTo: 'WalletConnect', error: undefined });
  try {
    const { EthereumProvider } = await import('@walletconnect/ethereum-provider');
    const p = await EthereumProvider.init({
      projectId: WC_PROJECT_ID,
      optionalChains: [ROBINHOOD.id, 1, 8453],
      showQrModal: true,
      rpcMap: { [ROBINHOOD.id]: ROBINHOOD.rpc },
      metadata: { name: 'RIVALS', description: 'Every coin is born in a fight', url: location.origin, icons: [`${location.origin}/favicon.svg`] },
    });
    await p.connect();
    wcProvider = p as unknown as Eip1193;
    const peer = (p.session?.peer?.metadata ?? {}) as { name?: string; icons?: string[] };
    const accounts = (await wcProvider.request({ method: 'eth_accounts' })) as string[];
    await finish({ uuid: 'walletconnect', name: peer.name || 'WalletConnect', icon: peer.icons?.[0] ?? '', rdns: 'walletconnect' }, wcProvider, accounts);
    return true;
  } catch (e) {
    set({ status: state.address ? 'connected' : 'idle', connectingTo: undefined, error: describe(e) });
    return false;
  }
};

export const disconnect = async () => {
  const p = active;
  const rdns = state.wallet?.rdns;
  teardown();
  try {
    if (rdns === 'walletconnect' || rdns === 'sdk.coinbase') await p?.disconnect?.();
    else await p?.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] });
  } catch {
    /* not every wallet supports revoking; the site forgets the connection either way */
  }
};

/** Quietly restore the last connection if the wallet still trusts this site. */
const reconnect = async () => {
  const rdns = remembered();
  if (!rdns || state.status !== 'idle') return;
  try {
    if (rdns === 'sdk.coinbase') {
      const p = await getCoinbase();
      const accounts = (await p.request({ method: 'eth_accounts' })) as string[];
      if (accounts?.length) await finish(COINBASE_INFO, p, accounts);
      return;
    }
    if (rdns === 'walletconnect') {
      if (!WC_PROJECT_ID) return;
      const { EthereumProvider } = await import('@walletconnect/ethereum-provider');
      const p = await EthereumProvider.init({ projectId: WC_PROJECT_ID, optionalChains: [ROBINHOOD.id, 1, 8453], showQrModal: true, rpcMap: { [ROBINHOOD.id]: ROBINHOOD.rpc } });
      if (!p.session) return;
      wcProvider = p as unknown as Eip1193;
      const peer = (p.session.peer?.metadata ?? {}) as { name?: string; icons?: string[] };
      const accounts = (await wcProvider.request({ method: 'eth_accounts' })) as string[];
      if (accounts?.length) await finish({ uuid: 'walletconnect', name: peer.name || 'WalletConnect', icon: peer.icons?.[0] ?? '', rdns: 'walletconnect' }, wcProvider, accounts);
      return;
    }
    const d = state.detected.find((x) => x.info.rdns === rdns);
    if (!d) return;
    const accounts = (await d.provider.request({ method: 'eth_accounts' })) as string[];
    if (accounts?.length) await finish(d.info, d.provider, accounts);
  } catch {
    remember();
  }
};

// ─── network & balance ──────────────────────────────────────────────────────

export const refreshBalance = async () => {
  const address = state.address;
  if (!address) return;
  try {
    const res = await fetch(ROBINHOOD.readRpc, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [address, 'latest'] }),
    });
    const json = (await res.json()) as { result?: string };
    if (json.result && state.address === address) set({ balance: BigInt(json.result) });
  } catch {
    /* balance is optional */
  }
};

export const switchToRobinhood = async () => {
  if (!active) return false;
  try {
    await active.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: ROBINHOOD.hex }] });
    return true;
  } catch (e) {
    const code = (e as { code?: number; data?: { originalError?: { code?: number } } }).code ?? (e as any)?.data?.originalError?.code;
    if (code === 4902 || code === -32603) {
      try {
        await active.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: ROBINHOOD.hex,
              chainName: ROBINHOOD.name,
              nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
              rpcUrls: [ROBINHOOD.rpc],
              blockExplorerUrls: [ROBINHOOD.explorer],
            },
          ],
        });
        return true;
      } catch (e2) {
        set({ error: describe(e2) });
        return false;
      }
    }
    set({ error: describe(e) });
    return false;
  }
};

export const clearError = () => set({ error: undefined });

export const fmtBalance = (wei?: bigint) => {
  if (wei === undefined) return '…';
  const eth = Number(wei) / 1e18;
  return `${eth < 0.0001 && eth > 0 ? '<0.0001' : eth.toFixed(4)} ETH`;
};
export const shortAddress = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');

// ─── Solana (Wallet Standard) ───────────────────────────────────────────────

type ConnectFeature = { connect(input?: { silent?: boolean }): Promise<{ accounts: readonly { address: string }[] }> };
type DisconnectFeature = { disconnect(): Promise<void> };
type EventsFeature = { on(event: 'change', fn: (props: { accounts?: readonly { address: string }[] }) => void): () => void };

const SOL_KEY = 'rivals.wallet.sol.v1';
let solOff: (() => void) | undefined;
let solActive: Wallet | undefined;

const isSolana = (w: Wallet) => w.chains.some((c) => c.startsWith('solana:')) && 'standard:connect' in w.features;
const solInfo = (w: Wallet): WalletInfo => ({ uuid: `sol-${w.name}`, name: w.name, icon: w.icon, rdns: `sol.${w.name.toLowerCase().replace(/\W/g, '')}` });

const discoverSolana = () => {
  const { get, on } = getWallets();
  const publish = () => set({ solWallets: get().filter(isSolana).map((wallet) => ({ info: solInfo(wallet), wallet })) });
  publish();
  on('register', publish);
  on('unregister', publish);
  setTimeout(reconnectSolana, 600);
};

const setSolAddress = (wallet: Wallet, address?: string) => {
  if (!address) return void teardownSol();
  set({ sol: { wallet: solInfo(wallet), address }, solConnectingTo: undefined, error: undefined });
};

const teardownSol = () => {
  solOff?.();
  solOff = undefined;
  solActive = undefined;
  try {
    localStorage.removeItem(SOL_KEY);
  } catch {
    /* storage unavailable */
  }
  set({ sol: undefined, solConnectingTo: undefined });
};

const bindSol = (wallet: Wallet, address: string) => {
  solOff?.();
  solActive = wallet;
  const events = wallet.features['standard:events'] as EventsFeature | undefined;
  solOff = events?.on('change', ({ accounts }) => {
    if (accounts) setSolAddress(wallet, accounts[0]?.address);
  });
  try {
    localStorage.setItem(SOL_KEY, wallet.name);
  } catch {
    /* storage unavailable */
  }
  setSolAddress(wallet, address);
};

export const connectSolana = async (d: SolDetected) => {
  set({ solConnectingTo: d.info.name, error: undefined });
  try {
    const { accounts } = await (d.wallet.features['standard:connect'] as ConnectFeature).connect();
    const address = accounts[0]?.address ?? d.wallet.accounts[0]?.address;
    if (!address) throw new Error('No Solana account was shared.');
    bindSol(d.wallet, address);
    return true;
  } catch (e) {
    set({ solConnectingTo: undefined, error: describe(e) });
    return false;
  }
};

export const disconnectSolana = async () => {
  const w = solActive;
  teardownSol();
  try {
    await (w?.features['standard:disconnect'] as DisconnectFeature | undefined)?.disconnect();
  } catch {
    /* the site forgets the connection either way */
  }
};

const reconnectSolana = async () => {
  let name: string | null = null;
  try {
    name = localStorage.getItem(SOL_KEY);
  } catch {
    return;
  }
  const d = state.solWallets.find((x) => x.info.name === name);
  if (!name || !d || state.sol) return;
  try {
    const { accounts } = await (d.wallet.features['standard:connect'] as ConnectFeature).connect({ silent: true });
    if (accounts[0]) bindSol(d.wallet, accounts[0].address);
  } catch {
    /* wallet no longer trusts the site; stay disconnected */
  }
};

export const SOL_SUGGESTED: Suggested[] = [
  { name: 'Phantom', rdns: [], color: '#ab9ff2', install: 'https://phantom.com/download', deeplink: () => `https://phantom.app/ul/browse/${encodeURIComponent(here())}?ref=${encodeURIComponent(location.origin)}` },
  { name: 'Solflare', rdns: [], color: '#fc7227', install: 'https://solflare.com/download', deeplink: () => `https://solflare.com/ul/v1/browse/${encodeURIComponent(here())}?ref=${encodeURIComponent(location.origin)}` },
  { name: 'Backpack', rdns: [], color: '#e33e3f', install: 'https://backpack.app/download', deeplink: () => `https://backpack.app/ul/v1/browse/${encodeURIComponent(here())}?ref=${encodeURIComponent(location.origin)}` },
];
export const isSolDetected = (s: Suggested) => state.solWallets.some((d) => d.info.name.toLowerCase() === s.name.toLowerCase());

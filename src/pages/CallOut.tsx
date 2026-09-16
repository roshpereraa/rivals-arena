import { useEffect, useRef, useState } from 'react';
import { CLASSES, LAUNCH_FEE, callOut, fmtEth, quoteBuy, type WeightClass } from '../sim/engine';
import { go, useArena } from '../lib/hooks';
import { Crest } from '../components/Crest';
import { toast } from '../components/Chrome';

const ROUNDS = [
  { n: 3, label: 'Scrap', note: '3 rounds · 3 min' },
  { n: 5, label: 'Main card', note: '5 rounds · 5 min' },
  { n: 8, label: 'Title fight', note: '8 rounds · 8 min' },
];

export function CallOut({ onEnter }: { onEnter: () => void }) {
  const s = useArena();
  const [name, setName] = useState('');
  const [ticker, setTicker] = useState('');
  const [bio, setBio] = useState('');
  const [hue, setHue] = useState(8);
  const [pattern, setPattern] = useState(0);
  const [image, setImage] = useState<string>();
  const [mode, setMode] = useState<'open' | 'named'>('named');
  const [rivalName, setRivalName] = useState('');
  const [rivalTicker, setRivalTicker] = useState('');
  const [cls, setCls] = useState<WeightClass>('Featherweight');
  const [rounds, setRounds] = useState(5);
  const [tax, setTax] = useState(100);
  const [opening, setOpening] = useState('0.1');
  const [waiting, setWaiting] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Once the challenge is answered, jump straight into the pit.
  const answeredPit = waiting ? s.fighters[waiting]?.pitId : undefined;
  useEffect(() => {
    if (answeredPit) go(`/pit/${answeredPit}`);
  }, [answeredPit]);

  const t = ticker || 'TICKER';
  const n = name || 'Your Coin';
  const openingEth = parseFloat(opening) || 0;
  const opener = quoteBuy(0, openingEth, tax);
  const target = CLASSES[cls].target;
  const valid = name.trim().length >= 2 && ticker.length >= 2 && (mode === 'open' || rivalName.trim().length >= 2);

  const onFile = (file?: File) => {
    if (!file) return;
    if (file.size > 1_500_000) return toast('Keep images under 1.5 MB.', false);
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.readAsDataURL(file);
  };

  const submit = () => {
    if (!s.purse.entered) return onEnter();
    if (!valid) return toast('Give your coin a name, a ticker and a rival.', false);
    const res = callOut({
      name: name.trim(),
      ticker,
      bio: bio.trim(),
      hue,
      pattern,
      image,
      taxBps: tax,
      cls,
      rounds,
      rivalName: mode === 'named' ? rivalName.trim() : undefined,
      rivalTicker: mode === 'named' ? rivalTicker : undefined,
      openingEth,
    });
    if (!res.ok) return toast(res.message, false);
    setWaiting(res.message);
    window.scrollTo({ top: 0 });
  };

  if (waiting) {
    const f = s.fighters[waiting];
    return (
      <main className="wrap page-pad waiting">
        {f && <Crest fighter={f} size={140} corner="red" />}
        <p className="eyebrow"><i className="live-dot" /> Call-out posted</p>
        <h1 className="display page-title">Waiting for {mode === 'named' ? rivalName : 'a challenger'} to step in…</h1>
        <p className="section-sub">Your bout goes live the moment the other corner is filled.</p>
      </main>
    );
  }

  return (
    <main className="wrap page-pad callout">
      <header className="page-head">
        <p className="eyebrow">New bout</p>
        <h1 className="display page-title">Call someone <span className="red">out</span></h1>
        <p className="section-sub">
          Launch your coin with a rival already in the other corner. {LAUNCH_FEE} ETH launch fee, paid from your practice purse.
        </p>
      </header>

      <div className="callout__grid">
        <div className="callout__form">
          <fieldset className="panel">
            <legend className="mono"><b>01</b> Your fighter</legend>
            <div className="row2">
              <label className="field">
                <span className="mono">Name</span>
                <input value={name} maxLength={28} placeholder="Midnight Snack" onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="field">
                <span className="mono">Ticker</span>
                <div className="field__input">
                  <em className="mono">$</em>
                  <input value={ticker} maxLength={9} placeholder="SNACK" onChange={(e) => setTicker(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
                </div>
              </label>
            </div>
            <label className="field">
              <span className="mono">Walkout line</span>
              <input value={bio} maxLength={70} placeholder="Raids the fridge. Raids your curve." onChange={(e) => setBio(e.target.value)} />
            </label>
            <div className="row2">
              <div className="field">
                <span className="mono">Colours</span>
                <input type="range" min={0} max={359} value={hue} onChange={(e) => setHue(+e.target.value)} className="hue" aria-label="Crest colour" />
              </div>
              <div className="field">
                <span className="mono">Pattern</span>
                <div className="patterns">
                  {[0, 1, 2, 3, 4, 5].map((p) => (
                    <button key={p} className={pattern === p ? 'is-on' : ''} onClick={() => setPattern(p)} aria-label={`Pattern ${p + 1}`}>
                      <Crest fighter={{ ticker: t, hue, pattern: p }} size={30} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="upload">
              <button className="btn btn--ghost" onClick={() => fileRef.current?.click()}>{image ? 'Replace artwork' : 'Upload artwork'}</button>
              {image && <button className="linkish mono" onClick={() => setImage(undefined)}>Use generated crest</button>}
              <span className="mono dim">PNG, JPG, GIF or WebP · square works best</span>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
            </div>
          </fieldset>

          <fieldset className="panel">
            <legend className="mono"><b>02</b> The rival</legend>
            <div className="seg mono">
              <button className={mode === 'named' ? 'is-on' : ''} onClick={() => setMode('named')}>Name a rival</button>
              <button className={mode === 'open' ? 'is-on' : ''} onClick={() => setMode('open')}>Open challenge</button>
            </div>
            {mode === 'named' ? (
              <div className="row2">
                <label className="field">
                  <span className="mono">Rival name</span>
                  <input value={rivalName} maxLength={28} placeholder="Breakfast Burrito" onChange={(e) => setRivalName(e.target.value)} />
                </label>
                <label className="field">
                  <span className="mono">Rival ticker</span>
                  <div className="field__input">
                    <em className="mono">$</em>
                    <input value={rivalTicker} maxLength={9} placeholder="BURRITO" onChange={(e) => setRivalTicker(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
                  </div>
                </label>
              </div>
            ) : (
              <p className="hint">Anyone can answer an open challenge. The first coin to step in takes the blue corner.</p>
            )}
          </fieldset>

          <fieldset className="panel">
            <legend className="mono"><b>03</b> Fight terms</legend>
            <span className="mono field-label">Weight class</span>
            <div className="choice">
              {(Object.keys(CLASSES) as WeightClass[]).map((c) => (
                <button key={c} className={cls === c ? 'is-on' : ''} onClick={() => setCls(c)}>
                  <strong>{c}</strong>
                  <span className="mono">{CLASSES[c].blurb}</span>
                </button>
              ))}
            </div>
            <span className="mono field-label">Length</span>
            <div className="choice">
              {ROUNDS.map((r) => (
                <button key={r.n} className={rounds === r.n ? 'is-on' : ''} onClick={() => setRounds(r.n)}>
                  <strong>{r.label}</strong>
                  <span className="mono">{r.note}</span>
                </button>
              ))}
            </div>
            <label className="field">
              <span className="mono">Creator tax · {(tax / 100).toFixed(1)}% <em className="dim">(max 3%, taken from your coin’s trades)</em></span>
              <input type="range" min={0} max={300} step={25} value={tax} onChange={(e) => setTax(+e.target.value)} />
            </label>
            <label className="field">
              <span className="mono">Opening punch · first buy in ETH (optional)</span>
              <div className="field__input">
                <input inputMode="decimal" value={opening} onChange={(e) => setOpening(e.target.value.replace(/[^0-9.]/g, ''))} />
                <em className="mono">ETH</em>
              </div>
              <span className="hint mono">
                {openingEth > 0 ? `Lands the moment the rival shows up · ${((opener.net / target) * 100).toFixed(1)}% toward KO` : 'No opening punch. The curve starts untouched.'}
              </span>
            </label>
          </fieldset>
        </div>

        <aside className="callout__side">
          <div className="poster" style={{ ['--hue' as string]: hue }}>
            <p className="poster__top mono">RIVALS presents · {cls}</p>
            <div className="poster__faces">
              <Crest fighter={{ ticker: t, hue, pattern, image }} size={120} corner="red" />
              <div className="poster__mystery">
                {mode === 'named' && rivalName ? (
                  <Crest fighter={{ ticker: rivalTicker || 'RIVAL', hue: (hue + 180) % 360, pattern: (pattern + 3) % 6 }} size={120} corner="blue" />
                ) : (
                  <span className="display">?</span>
                )}
              </div>
            </div>
            <h2 className="display poster__names">
              <span className="red">{n}</span>
              <em>vs</em>
              <span className="blue">{mode === 'named' ? rivalName || 'Your Rival' : 'Anyone'}</span>
            </h2>
            <p className="poster__line">“{bio || 'New in the arena.'}”</p>
            <dl className="poster__terms mono">
              <div><dt>Rounds</dt><dd>{rounds}</dd></div>
              <div><dt>KO at</dt><dd>{target} ETH</dd></div>
              <div><dt>Tax</dt><dd>{(tax / 100).toFixed(1)}%</dd></div>
              <div><dt>Opener</dt><dd>{openingEth ? `${openingEth} ETH` : '—'}</dd></div>
            </dl>
          </div>

          <div className="panel slip mono">
            <div><span>Launch fee</span><b>{fmtEth(LAUNCH_FEE, 2)}</b></div>
            <div><span>Opening punch</span><b>{fmtEth(openingEth, 3)}</b></div>
            <div><span>Total</span><b>{fmtEth(LAUNCH_FEE + openingEth, 3)}</b></div>
            <div><span>Your purse</span><b>{s.purse.entered ? fmtEth(s.purse.eth, 3) : 'not entered'}</b></div>
            <button className="btn btn--red btn--block btn--lg" onClick={submit} disabled={s.purse.entered && !valid}>
              {s.purse.entered ? (mode === 'named' ? `Call out ${rivalName || 'your rival'}` : 'Post open challenge') : 'Enter the arena first'}
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}

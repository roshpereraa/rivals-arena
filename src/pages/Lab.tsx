import { useMemo, useState, type ReactNode } from 'react';
import { DEFAULTS, SCENARIOS, compact, simulate, usd, type LabInputs, type ScenarioKey } from '../sim/utility';
import { LabChart } from '../components/LabChart';

type Field = {
  key: keyof LabInputs;
  label: string;
  hint?: string;
  min: number;
  max: number;
  step: number;
  prefix?: string;
  suffix?: string;
};

const MARKET: Field[] = [
  { key: 'price0', label: 'Initial token price', min: 0.001, max: 10, step: 0.001, prefix: '$' },
  { key: 'supply', label: 'Total token supply', min: 1_000_000, max: 10_000_000_000, step: 1_000_000 },
  { key: 'circPct', label: 'Circulating at launch', min: 1, max: 100, step: 1, suffix: '%' },
  { key: 'unlockMonths', label: 'Full unlock after', min: 1, max: 120, step: 1, suffix: 'mo' },
];

const USAGE: Field[] = [
  { key: 'users', label: 'Users at launch', min: 100, max: 50_000_000, step: 100 },
  { key: 'tokensPerUser', label: 'Tokens used per active user / month', min: 1, max: 5000, step: 1 },
  { key: 'velocity', label: 'Token velocity', hint: 'Times a token changes hands each month', min: 0.5, max: 50, step: 0.5, suffix: '×' },
  { key: 'growth', label: 'Platform growth', min: -10, max: 50, step: 0.5, suffix: '% / mo' },
  { key: 'burn', label: 'Token burn', hint: 'Share of every token spent that is destroyed', min: 0, max: 20, step: 0.1, suffix: '%' },
  { key: 'fade', label: 'Speculative premium fade', hint: 'How fast price not backed by usage wears off', min: 0, max: 25, step: 0.5, suffix: '% / mo' },
  { key: 'months', label: 'Adoption period', min: 3, max: 60, step: 1, suffix: 'mo' },
];

const within = (a: LabInputs, patch: Partial<LabInputs>) =>
  (Object.keys(patch) as (keyof LabInputs)[]).every((k) => Math.abs(a[k] - (patch[k] as number)) < 1e-9);

export function Lab() {
  const [inputs, setInputs] = useState<LabInputs>(DEFAULTS);
  const [cursorRaw, setCursor] = useState<number | null>(null);
  const rows = useMemo(() => simulate(inputs), [inputs]);
  const cursor = Math.min(cursorRaw ?? inputs.months, inputs.months);
  const r = rows[cursor];
  const r0 = rows[0];

  const set = (k: keyof LabInputs, v: number) => setInputs((p) => ({ ...p, [k]: v }));
  const active = (Object.keys(SCENARIOS) as ScenarioKey[]).find((k) => within(inputs, SCENARIOS[k].patch));

  const scenarioRows = useMemo(
    () =>
      (Object.keys(SCENARIOS) as ScenarioKey[]).map((k) => {
        const res = simulate({ ...inputs, ...SCENARIOS[k].patch });
        return { k, s: SCENARIOS[k], end: res[res.length - 1] };
      }),
    [inputs],
  );

  const series = <K extends keyof (typeof rows)[number]>(key: K) => rows.map((x) => x[key] as number);

  return (
    <main className="wrap page-pad lab">
      <header className="page-head lab__head">
        <p className="eyebrow">Token Lab · utility coin simulator</p>
        <h1 className="display page-title">
          Usage is the <span className="bell">only</span> real punch.
        </h1>
        <p className="section-sub">
          Explore how token utility, adoption and supply mechanics interact. Set your assumptions and watch users turn into token usage,
          demand and circulating supply, month by month.
        </p>
        <p className="lab__warning mono">Model, not a prediction · not investment advice · every number comes from the inputs you set</p>
      </header>

      <section className="lab__scenarios" aria-label="Scenarios">
        {(Object.keys(SCENARIOS) as ScenarioKey[]).map((k) => (
          <button
            key={k}
            className={`scenario scenario--${k}${active === k ? ' is-on' : ''}`}
            onClick={() => setInputs((p) => ({ ...p, ...SCENARIOS[k].patch }))}
          >
            <span className="display">{SCENARIOS[k].label}</span>
            <span className="mono">
              {SCENARIOS[k].patch.adoption}% adoption · {SCENARIOS[k].usage} usage · {SCENARIOS[k].patch.burn}% burn
            </span>
          </button>
        ))}
        <button className="scenario scenario--reset" onClick={() => { setInputs(DEFAULTS); setCursor(null); }}>
          <span className="display">Reset</span>
          <span className="mono">Back to the starting example</span>
        </button>
      </section>

      <div className="lab__grid">
        <aside className="lab__inputs">
          <div className="panel adoption">
            <div className="adoption__top">
              <span className="mono">Platform adoption</span>
              <b className="display">{inputs.adoption}%</b>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={inputs.adoption}
              onChange={(e) => set('adoption', +e.target.value)}
              className="adoption__slider"
              style={{ ['--fill' as string]: `${inputs.adoption}%` }}
              aria-label="Platform adoption"
            />
            <p className="mono dim">
              Share of users active each month · {compact(r0.mau)} monthly active users at launch
            </p>
          </div>

          <InputGroup title="Token & supply" fields={MARKET} inputs={inputs} set={set} />
          <InputGroup title="Usage & growth" fields={USAGE} inputs={inputs} set={set} />
        </aside>

        <div className="lab__out">
          <div className="panel lab__hero">
            <p className="mono lab__hero-label">
              Estimated utility demand · month {cursor}
            </p>
            <p className="display lab__hero-num">
              {compact(r.tokensUsed)} <small>tokens / month</small>
            </p>
            <p className="lab__hero-sub">
              {compact(r.mau)} active users spending {usd(r.volumeUsd)} a month on the platform. At {inputs.velocity}× velocity,
              about {usd(r.floatUsd)} of tokens have to sit in wallets to keep that flowing.
            </p>

            <div className="scrub">
              <span className="mono">M0</span>
              <input
                type="range"
                min={0}
                max={inputs.months}
                value={cursor}
                onChange={(e) => setCursor(+e.target.value)}
                aria-label="Month"
              />
              <span className="mono">M{inputs.months}</span>
            </div>
          </div>

          <div className="lab__stats">
            <Stat icon="📈" label="Token demand" value={`${compact(r.tokensUsed)}/mo`} sub={`${compact(r.floatTokens)} held for utility`} />
            <Stat icon="💰" label="Utility volume" value={`${usd(r.volumeUsd)}/mo`} sub={`${usd(r.volumeUsd * 12)} a year`} />
            <Stat icon="🔥" label="Tokens burned" value={compact(r.burnedCum)} sub={`${((r.burnedCum / inputs.supply) * 100).toFixed(2)}% of supply · ${compact(r.burned)} this month`} />
            <Stat icon="👥" label="Holders / users" value={compact(r.mau)} sub={`of ${compact(r.users)} total users`} />
            <Stat icon="🪙" label="Tokens circulating" value={compact(r.circulating)} sub={`${((r.circulating / inputs.supply) * 100).toFixed(1)}% of supply`} />
            <Stat
              icon="📊"
              label="Utilization"
              value={`${(r.utilization * 100).toFixed(1)}%`}
              sub="of market cap backed by usage"
              meter={r.utilization}
            />
          </div>

          <div className="panel">
            <div className="panel__head mono">
              <span>Users → Token usage → Demand → Circulating supply</span>
              <span className="dim">drag any chart to scrub months</span>
            </div>
            <div className="flow">
              <FlowStep title="Active users" value={compact(r.mau)} color="var(--blue)">
                <LabChart compact series={[{ key: 'mau', values: series('mau'), color: 'var(--blue)', label: 'Active users', fill: true }]} cursor={cursor} onCursor={setCursor} format={compact} />
              </FlowStep>
              <FlowStep title="Token usage / mo" value={compact(r.tokensUsed)} color="var(--bell)">
                <LabChart compact series={[{ key: 'used', values: series('tokensUsed'), color: 'var(--bell)', label: 'Tokens used per month', fill: true }]} cursor={cursor} onCursor={setCursor} format={compact} />
              </FlowStep>
              <FlowStep title="Utility demand" value={usd(r.floatUsd)} color="var(--up)">
                <LabChart compact series={[{ key: 'float', values: series('floatUsd'), color: 'var(--up)', label: 'USD held for utility', fill: true }]} cursor={cursor} onCursor={setCursor} format={usd} />
              </FlowStep>
              <FlowStep title="Circulating" value={compact(r.circulating)} color="var(--red)">
                <LabChart compact series={[{ key: 'circ', values: series('circulating'), color: 'var(--red)', label: 'Circulating supply', fill: true }]} cursor={cursor} onCursor={setCursor} format={compact} />
              </FlowStep>
            </div>
          </div>

          <div className="panel">
            <div className="panel__head mono">
              <span>Projected token price · model, not a prediction</span>
              <span className="legend">
                <i style={{ background: 'var(--bone)' }} />Modeled price
                <i style={{ background: 'var(--up)' }} />Usage-backed price
                <i style={{ background: 'var(--muted)' }} />Launch price
              </span>
            </div>
            <LabChart
              series={[
                { key: 'launch', values: rows.map(() => inputs.price0), color: 'var(--muted)', label: 'Launch price', dashed: true },
                { key: 'utility', values: series('utilityPrice'), color: 'var(--up)', label: 'Usage-backed price', fill: true },
                { key: 'price', values: series('price'), color: 'var(--bone)', label: 'Modeled price' },
              ]}
              cursor={cursor}
              onCursor={setCursor}
              format={usd}
            />
            <div className="price-read mono">
              <div><span>Modeled price · M{cursor}</span><b>{usd(r.price)}</b></div>
              <div><span>Usage-backed part</span><b className="up">{usd(r.utilityPrice)}</b></div>
              <div><span>Speculative part</span><b>{usd(r.price - r.utilityPrice)}</b></div>
              <div><span>vs launch</span><b className={r.price >= inputs.price0 ? 'up' : 'down'}>{r.price >= inputs.price0 ? '+' : ''}{((r.price / inputs.price0 - 1) * 100).toFixed(0)}%</b></div>
            </div>
            <p className="hint">
              The model starts the price at your launch price. Whatever part of that price isn’t backed by usage fades by{' '}
              {inputs.fade}% a month. The usage-backed part rises and falls with utility demand ÷ circulating supply.
            </p>
          </div>
        </div>
      </div>

      <section className="lab__compare">
        <div className="section-head">
          <h2 className="display">Three corners</h2>
          <p className="section-sub">The same token, supply and velocity, run under three adoption stories to month {inputs.months}.</p>
        </div>
        <div className="table-wrap">
          <table className="table mono table--static">
            <thead>
              <tr>
                <th>Scenario</th><th>Adoption</th><th>Usage</th><th>Burn</th><th>Growth</th>
                <th>Demand / mo</th><th>Burned</th><th>Utilization</th><th>Modeled price</th><th>Result</th>
              </tr>
            </thead>
            <tbody>
              {scenarioRows.map(({ k, s, end }) => (
                <tr key={k} className={active === k ? 'is-active' : ''} onClick={() => setInputs((p) => ({ ...p, ...s.patch }))}>
                  <td><span className={`tag tag--${k}`}>{s.label}</span></td>
                  <td>{s.patch.adoption}%</td>
                  <td>{s.usage} · {s.patch.tokensPerUser}/user</td>
                  <td>{s.patch.burn}%</td>
                  <td>{s.patch.growth}%/mo</td>
                  <td>{compact(end.tokensUsed)}</td>
                  <td>{compact(end.burnedCum)}</td>
                  <td>{(end.utilization * 100).toFixed(1)}%</td>
                  <td>{usd(end.price)}</td>
                  <td className="dim">{s.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="lab__how">
        <h2 className="display">How the model works</h2>
        <ol className="formula mono">
          <li><b>Spend per active user</b><span>tokens used per user × launch price</span></li>
          <li><b>Utility volume</b><span>active users × spend per user</span></li>
          <li><b>Utility demand</b><span>utility volume ÷ velocity: the value that has to be held to settle the flow</span></li>
          <li><b>Tokens used</b><span>utility volume ÷ last month’s modeled price</span></li>
          <li><b>Tokens burned</b><span>tokens used × burn rate</span></li>
          <li><b>Circulating</b><span>unlocked supply − everything burned so far</span></li>
          <li><b>Modeled price</b><span>(utility demand + fading speculative value) ÷ circulating</span></li>
          <li><b>Utilization</b><span>utility demand ÷ modeled market cap</span></li>
        </ol>
        <p className="hint lab__disclaimer">
          This is a teaching model with made-up inputs. Real token prices are driven by liquidity, sentiment, unlock selling, market makers and
          plenty of things no formula captures. Use it to see how the mechanics pull on each other, not to price a coin or decide a trade.
        </p>
      </section>
    </main>
  );
}

function InputGroup({ title, fields, inputs, set }: { title: string; fields: Field[]; inputs: LabInputs; set: (k: keyof LabInputs, v: number) => void }) {
  return (
    <fieldset className="panel lab__group">
      <legend className="mono">{title}</legend>
      {fields.map((f) => (
        <NumberField key={f.key} f={f} value={inputs[f.key]} onChange={(v) => set(f.key, v)} />
      ))}
    </fieldset>
  );
}

function NumberField({ f, value, onChange }: { f: Field; value: number; onChange: (v: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (Math.abs(value) >= 1000 ? value.toLocaleString('en-US') : String(+value.toFixed(4)));
  const commit = (s: string) => {
    const n = parseFloat(s.replace(/,/g, ''));
    if (Number.isFinite(n)) onChange(Math.min(f.max, Math.max(f.min, n)));
    setDraft(null);
  };
  return (
    <label className="lab-field">
      <span className="lab-field__label">
        {f.label}
        {f.hint && <em>{f.hint}</em>}
      </span>
      <span className="field__input">
        {f.prefix && <em className="mono">{f.prefix}</em>}
        <input
          className="mono"
          inputMode="decimal"
          value={shown}
          onChange={(e) => {
            setDraft(e.target.value);
            const n = parseFloat(e.target.value.replace(/,/g, ''));
            if (Number.isFinite(n) && n >= f.min && n <= f.max) onChange(n);
          }}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && commit((e.target as HTMLInputElement).value)}
        />
        {f.suffix && <em className="mono">{f.suffix}</em>}
      </span>
    </label>
  );
}

function Stat({ icon, label, value, sub, meter }: { icon: string; label: string; value: string; sub: string; meter?: number }) {
  return (
    <div className="panel stat">
      <span className="stat__label mono"><i aria-hidden>{icon}</i>{label}</span>
      <b className="stat__value mono">{value}</b>
      {meter !== undefined && (
        <span className="stat__meter"><span style={{ width: `${Math.min(100, meter * 100)}%` }} /></span>
      )}
      <span className="stat__sub">{sub}</span>
    </div>
  );
}

function FlowStep({ title, value, color, children }: { title: string; value: string; color: string; children: ReactNode }) {
  return (
    <div className="flow__step" style={{ ['--c' as string]: color }}>
      <span className="mono flow__title">{title}</span>
      <b className="mono flow__value">{value}</b>
      {children}
    </div>
  );
}

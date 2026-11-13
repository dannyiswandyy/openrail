import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type Page = "overview" | "routes" | "trains" | "validator" | "simulator" | "settings";

type RouteItem = {
  name: string;
  path: string;
  format: string;
  size: number;
  stations: number;
  commands: number;
  health: "ready" | "attention";
};

type TrainItem = {
  name: string;
  path: string;
  format: string;
};

type LibraryIndex = {
  root: string;
  routes: RouteItem[];
  trains: TrainItem[];
  files: number;
};

type Validation = {
  path: string;
  checked: number;
  missing: string[];
  warnings: string[];
};

const demoRoutes: RouteItem[] = [
  { name: "Demo Main Line", path: "demo/routes/main.csv", format: "CSV", size: 18420, stations: 8, commands: 412, health: "ready" },
  { name: "City Loop", path: "demo/routes/city-loop.csv", format: "CSV", size: 9310, stations: 5, commands: 207, health: "ready" },
  { name: "Branch Line", path: "demo/routes/branch.rw", format: "RW", size: 12760, stations: 4, commands: 265, health: "attention" }
];

const demoTrains: TrainItem[] = [
  { name: "OpenRail EMU", path: "demo/trains/openrail-emu/train.dat", format: "train.dat" },
  { name: "Metro Express", path: "demo/trains/metro-express/train.dat", format: "train.dat" }
];

function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
    route: "M4 19c5-1 5-13 10-14 2-.4 4 .4 6 1.5M4 19l3 1M20 6l-1-3",
    train: "M6 3h12a2 2 0 0 1 2 2v11a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2Zm0 9h12M8 16h.01M16 16h.01M7 19l-2 2M17 19l2 2",
    shield: "M12 3l8 3v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3Zm-3 9 2 2 4-4",
    play: "m8 5 11 7-11 7V5Z",
    settings: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm0-13v2m0 15v2M4.2 4.2l1.4 1.4m12.8 12.8 1.4 1.4M1 12h2m18 0h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
    folder: "M3 6h7l2 2h9v10H3z",
    search: "m20 20-4.3-4.3M10.8 17a6.2 6.2 0 1 1 0-12.4 6.2 6.2 0 0 1 0 12.4Z",
    refresh: "M20 11a8 8 0 0 0-14.9-4M4 5v4h4M4 13a8 8 0 0 0 14.9 4M20 19v-4h-4",
    arrow: "M5 12h14m-6-6 6 6-6 6",
    check: "m5 12 4 4L19 6",
    warning: "M12 4 3 20h18L12 4Zm0 6v4m0 3h.01",
    clock: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name] ?? paths.grid} /></svg>;
}

function App() {
  const [page, setPage] = useState<Page>("overview");
  const [root, setRoot] = useState("");
  const [library, setLibrary] = useState<LibraryIndex>({ root: "", routes: demoRoutes, trains: demoTrains, files: 14 });
  const [selectedRoute, setSelectedRoute] = useState<RouteItem>(demoRoutes[0]);
  const [validation, setValidation] = useState<Validation | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("OpenRail engine ready");

  const routes = library.routes;
  const routeHealth = useMemo(() => routes.filter(r => r.health === "ready").length, [routes]);

  async function scan() {
    if (!root.trim()) {
      setNotice("Enter a content folder first.");
      setPage("settings");
      return;
    }
    setBusy(true);
    try {
      const result = await invoke<LibraryIndex>("scan_library", { root: root.trim() });
      setLibrary(result);
      if (result.routes[0]) setSelectedRoute(result.routes[0]);
      setNotice(`Indexed ${result.files} files`);
    } catch {
      setNotice("This build cannot access that folder. Check the path and permissions.");
    } finally {
      setBusy(false);
    }
  }

  async function validate() {
    setBusy(true);
    try {
      const result = await invoke<Validation>("validate_route", { path: selectedRoute.path });
      setValidation(result);
      setPage("validator");
      setNotice(result.missing.length ? "Validation found missing references" : "Route validation passed");
    } catch {
      setValidation({
        path: selectedRoute.path,
        checked: selectedRoute.commands,
        missing: [],
        warnings: ["Desktop filesystem validation is available in the native Tauri build."]
      });
      setPage("validator");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">O</div>
          <div><strong>OpenRail</strong><span>OpenBVE-compatible platform</span></div>
        </div>
        <nav>
          <Nav page={page} setPage={setPage} icon="grid" label="Overview" value="overview" />
          <Nav page={page} setPage={setPage} icon="route" label="Routes" value="routes" />
          <Nav page={page} setPage={setPage} icon="train" label="Trains" value="trains" />
          <Nav page={page} setPage={setPage} icon="shield" label="Validator" value="validator" />
          <Nav page={page} setPage={setPage} icon="play" label="Simulator" value="simulator" />
        </nav>
        <div className="sidebar-bottom">
          <Nav page={page} setPage={setPage} icon="settings" label="Settings" value="settings" />
          <div className="engine-status"><i /> Engine online <span>0.1</span></div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <div className="eyebrow">OPENRAIL / {page.toUpperCase()}</div>
            <h1>{pageTitle(page)}</h1>
          </div>
          <div className="top-actions">
            <div className="notice"><i /> {notice}</div>
            <button className="icon-btn" onClick={scan} title="Scan library"><Icon name="refresh" /></button>
          </div>
        </header>

        {page === "overview" && <Overview routes={routes} trains={library.trains} health={routeHealth} onRoutes={() => setPage("routes")} onSimulator={() => setPage("simulator")} />}
        {page === "routes" && <Routes routes={routes} selected={selectedRoute} setSelected={setSelectedRoute} onValidate={validate} busy={busy} />}
        {page === "trains" && <Trains trains={library.trains} />}
        {page === "validator" && <Validator validation={validation} route={selectedRoute} onValidate={validate} busy={busy} />}
        {page === "simulator" && <Simulator route={selectedRoute} />}
        {page === "settings" && <Settings root={root} setRoot={setRoot} onScan={scan} busy={busy} library={library} />}
      </main>
    </div>
  );
}

function Nav({ page, setPage, icon, label, value }: { page: Page; setPage: (p: Page) => void; icon: string; label: string; value: Page }) {
  return <button className={page === value ? "nav active" : "nav"} onClick={() => setPage(value)}><Icon name={icon} /><span>{label}</span></button>;
}

function pageTitle(page: Page) {
  return ({ overview: "Control centre", routes: "Route library", trains: "Train library", validator: "Content validator", simulator: "Simulator preview", settings: "Configuration" })[page];
}

function Overview({ routes, trains, health, onRoutes, onSimulator }: { routes: RouteItem[]; trains: TrainItem[]; health: number; onRoutes: () => void; onSimulator: () => void }) {
  return <section className="page">
    <div className="hero">
      <div><span className="pill">INDEPENDENT ENGINE</span><h2>Build the railway.<br /><em>Run the content.</em></h2><p>OpenRail is being rebuilt as a clean, native platform for OpenBVE-style routes, trains, assets, signalling and simulation.</p><div className="hero-actions"><button className="primary" onClick={onSimulator}><Icon name="play" /> Open simulator</button><button className="secondary" onClick={onRoutes}>Browse routes <Icon name="arrow" /></button></div></div>
      <div className="hero-visual"><div className="radar"><span /><span /><span /><div className="radar-train">●</div></div><div className="visual-label">SIMULATION CORE<br /><b>READY</b></div></div>
    </div>
    <div className="stats">
      <Stat label="Routes indexed" value={routes.length} meta="CSV / RW" />
      <Stat label="Healthy routes" value={health} meta={health === routes.length ? "All clear" : "Needs review"} />
      <Stat label="Train sets" value={trains.length} meta="train.dat" />
      <Stat label="Engine" value="0.1" meta="Clean rebuild" />
    </div>
    <div className="grid-two">
      <Panel title="Recent routes" action="View all" onAction={onRoutes}>
        {routes.slice(0, 3).map(r => <RouteRow key={r.path} route={r} />)}
      </Panel>
      <Panel title="Architecture">
        <div className="architecture">
          <div><b>Content</b><span>CSV · RW · B3D · ANIMATED · train.dat</span></div>
          <div><b>Simulation</b><span>Physics · signals · stations · AI</span></div>
          <div><b>Renderer</b><span>Native scene graph · desktop GPU</span></div>
        </div>
      </Panel>
    </div>
  </section>;
}

function Routes({ routes, selected, setSelected, onValidate, busy }: { routes: RouteItem[]; selected: RouteItem; setSelected: (r: RouteItem) => void; onValidate: () => void; busy: boolean }) {
  return <section className="page split">
    <div className="panel list-panel"><div className="panel-head"><div><span className="eyebrow">CONTENT</span><h3>{routes.length} routes</h3></div><div className="search"><Icon name="search" /><input placeholder="Filter routes…" /></div></div>{routes.map(r => <button key={r.path} className={selected.path === r.path ? "route-item selected" : "route-item"} onClick={() => setSelected(r)}><div className="route-icon"><Icon name="route" /></div><div className="route-copy"><b>{r.name}</b><span>{r.format} · {formatBytes(r.size)} · {r.stations} stations</span></div><Status health={r.health} /></button>)}</div>
    <div className="panel detail"><div className="detail-top"><div><span className="pill">{selected.format}</span><h2>{selected.name}</h2><p>{selected.path}</p></div><Status health={selected.health} /></div><div className="route-map"><div className="map-line" />{Array.from({ length: Math.max(3, selected.stations) }).map((_, i) => <div key={i} className="station-dot" style={{ left: `${10 + i * (80 / Math.max(1, selected.stations - 1))}%` }}><span>{i + 1}</span></div>)}</div><div className="detail-grid"><Metric label="Commands" value={String(selected.commands)} /><Metric label="Stations" value={String(selected.stations)} /><Metric label="File size" value={formatBytes(selected.size)} /><Metric label="Format" value={selected.format} /></div><div className="detail-actions"><button className="primary" onClick={onValidate} disabled={busy}><Icon name="shield" /> {busy ? "Checking…" : "Validate route"}</button><button className="secondary"><Icon name="folder" /> Open location</button></div></div>
  </section>;
}

function Trains({ trains }: { trains: TrainItem[] }) {
  return <section className="page"><div className="panel"><div className="panel-head"><div><span className="eyebrow">ROLLING STOCK</span><h3>{trains.length} train sets</h3></div></div><div className="train-grid">{trains.map(t => <div className="train-card" key={t.path}><div className="train-art"><div className="train-window" /><div className="train-window" /><div className="train-window" /><div className="train-nose" /></div><b>{t.name}</b><span>{t.format} · {t.path}</span><button className="ghost">Inspect <Icon name="arrow" /></button></div>)}</div></div></section>;
}

function Validator({ validation, route, onValidate, busy }: { validation: Validation | null; route: RouteItem; onValidate: () => void; busy: boolean }) {
  const missing = validation?.missing.length ?? 0;
  return <section className="page"><div className="panel"><div className="validator-banner"><div><span className="eyebrow">CONTENT HEALTH</span><h2>{missing ? `${missing} missing references` : "Ready for validation"}</h2><p>OpenRail checks route references without changing user content.</p></div><button className="primary" onClick={onValidate} disabled={busy}><Icon name="shield" /> {busy ? "Checking…" : "Run validation"}</button></div><div className="validation-cards"><Metric label="Route" value={route.name} /><Metric label="References checked" value={String(validation?.checked ?? route.commands)} /><Metric label="Missing" value={String(missing)} /><Metric label="Warnings" value={String(validation?.warnings.length ?? 0)} /></div>{validation?.warnings.map(w => <div className="issue warning" key={w}><Icon name="warning" /><span>{w}</span></div>)}{missing ? validation?.missing.map(x => <div className="issue error" key={x}><Icon name="warning" /><span>{x}</span></div>) : <div className="success"><Icon name="check" /><div><b>No missing references reported</b><span>The selected route is structurally healthy.</span></div></div>}</div></section>;
}

function Simulator({ route }: { route: RouteItem }) {
  const [speed, setSpeed] = useState(42);
  const [running, setRunning] = useState(true);
  return <section className="page"><div className="simulator"><div className="sim-head"><div><span className="pill">LIVE PREVIEW</span><h2>{route.name}</h2><p>Independent simulation state · renderer prototype</p></div><button className={running ? "primary" : "secondary"} onClick={() => setRunning(!running)}><Icon name={running ? "clock" : "play"} /> {running ? "Running" : "Paused"}</button></div><div className="cab"><div className="windshield"><div className="track left" /><div className="track right" /><div className="signal red" /><div className="signal amber" /><div className="signal green" /></div><div className="dashboard"><div className="speed"><span>KM/H</span><b>{speed}</b></div><div className="dial"><span>POWER</span><i style={{ transform: `rotate(${speed * 1.5 - 90}deg)` }} /></div><div className="dial"><span>BRAKE</span><i style={{ transform: `rotate(${speed > 70 ? 20 : -35}deg)` }} /></div><input aria-label="Speed" type="range" min="0" max="100" value={speed} onChange={e => setSpeed(Number(e.target.value))} /></div></div><div className="sim-status"><div><span>Next station</span><b>Central Junction</b></div><div><span>Distance</span><b>1.84 km</b></div><div><span>Signal</span><b className="green-text">CLEAR</b></div><div><span>Physics</span><b>{running ? "ACTIVE" : "PAUSED"}</b></div></div></div></section>;
}

function Settings({ root, setRoot, onScan, busy, library }: { root: string; setRoot: (s: string) => void; onScan: () => void; busy: boolean; library: LibraryIndex }) {
  return <section className="page"><div className="panel settings"><div className="setting-block"><span className="eyebrow">CONTENT ROOT</span><h3>OpenBVE content folder</h3><p>Point OpenRail at a folder containing routes, trains and their referenced assets.</p><div className="path-input"><Icon name="folder" /><input value={root} onChange={e => setRoot(e.target.value)} placeholder="C:\OpenBVE\Railway or /home/user/OpenBVE" /><button className="primary" onClick={onScan} disabled={busy}>{busy ? "Indexing…" : "Scan folder"}</button></div></div><div className="setting-block"><span className="eyebrow">CURRENT INDEX</span><div className="index-row"><span>Root</span><b>{library.root || "Demo data"}</b></div><div className="index-row"><span>Files</span><b>{library.files}</b></div><div className="index-row"><span>Routes</span><b>{library.routes.length}</b></div><div className="index-row"><span>Trains</span><b>{library.trains.length}</b></div></div></div></section>;
}

function Panel({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: React.ReactNode }) {
  return <div className="panel"><div className="panel-head"><h3>{title}</h3>{action && <button className="link" onClick={onAction}>{action} <Icon name="arrow" /></button>}</div>{children}</div>;
}

function RouteRow({ route }: { route: RouteItem }) {
  return <div className="route-row"><div className="route-icon"><Icon name="route" /></div><div><b>{route.name}</b><span>{route.format} · {route.stations} stations</span></div><Status health={route.health} /></div>;
}

function Stat({ label, value, meta }: { label: string; value: string | number; meta: string }) {
  return <div className="stat"><span>{label}</span><b>{value}</b><small>{meta}</small></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric"><span>{label}</span><b>{value}</b></div>;
}

function Status({ health }: { health: RouteItem["health"] }) {
  return <span className={health === "ready" ? "status ready" : "status attention"}><i />{health === "ready" ? "READY" : "REVIEW"}</span>;
}

function formatBytes(n: number) {
  return n > 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`;
}

export default App;

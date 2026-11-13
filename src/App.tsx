import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/* ------------------------------------------------------------------ types */

type Page = "Home" | "Routes" | "Trains" | "Content" | "GitHub" | "Validator" | "Settings";
type RouteItem = {
  name: string; path: string; group: string; comment: string;
  stations: string[]; lengthKm: number | null; image: string | null; format: string;
};
type TrainItem = { name: string; path: string; group: string; comment: string; image: string | null };
type ScanResult = { routes: RouteItem[]; trains: TrainItem[]; filesScanned: number; warnings: string[] };
type Installation = { found: boolean; executable: string | null; contentHints: string[] };
type Recent = { route: string; train: string | null; at: number };
type LaunchPrefs = { ai: boolean; fullscreen: boolean; width: number; height: number };

const nav: Page[] = ["Home", "Routes", "Trains", "Content", "GitHub", "Validator", "Settings"];
const EMPTY_SCAN: ScanResult = { routes: [], trains: [], filesScanned: 0, warnings: [] };
const DEFAULT_PREFS: LaunchPrefs = { ai: false, fullscreen: false, width: 1920, height: 1080 };

/* ------------------------------------------------------------------ helpers */

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const mod = await import("@tauri-apps/api/core");
  return mod.invoke<T>(cmd, args);
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

/** Older versions stored plain strings; read those too. */
function loadLegacy(): { exe: string | null; roots: string[] } {
  let exe: string | null = null;
  let roots: string[] = [];
  try {
    const rawExe = localStorage.getItem("openrail.openbveExecutable");
    if (rawExe) exe = rawExe.startsWith("\"") ? JSON.parse(rawExe) : rawExe;
    roots = load<string[]>("openrail.contentRoots", []);
    const oldRoot = localStorage.getItem("openrail.contentRoot");
    if (!roots.length && oldRoot) roots = [oldRoot];
  } catch { /* ignore */ }
  return { exe, roots };
}

const imageCache = new Map<string, Promise<string | null>>();
function loadImage(path: string): Promise<string | null> {
  if (!imageCache.has(path)) imageCache.set(path, call<string>("read_image", { path }).catch(() => null));
  return imageCache.get(path)!;
}

function errorText(e: unknown) { return typeof e === "string" ? e : e instanceof Error ? e.message : String(e); }

/* ------------------------------------------------------------------ app */

export default function App() {
  const legacy = useMemo(loadLegacy, []);
  const [page, setPage] = useState<Page>("Home");
  const [executable, setExecutable] = useState<string | null>(legacy.exe);
  const [roots, setRoots] = useState<string[]>(legacy.roots);
  const [scan, setScan] = useState<ScanResult>(EMPTY_SCAN);
  const [routePath, setRoutePath] = useState<string | null>(() => load("openrail.route", null));
  const [trainPath, setTrainPath] = useState<string | null>(() => load("openrail.train", null));
  const [station, setStation] = useState("");
  const [startTime, setStartTime] = useState("");
  const [prefs, setPrefs] = useState<LaunchPrefs>(() => ({ ...DEFAULT_PREFS, ...load("openrail.prefs", {}) }));
  const [favourites, setFavourites] = useState<string[]>(() => load("openrail.favourites", []));
  const [recent, setRecent] = useState<Recent[]>(() => load("openrail.recent", []));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const toastTimer = useRef<number | undefined>(undefined);

  const route = scan.routes.find(r => r.path === routePath) ?? null;
  const train = scan.trains.find(t => t.path === trainPath) ?? null;

  function notify(text: string) {
    setMessage(text);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setMessage(""), 4500);
  }

  // persist
  useEffect(() => { if (executable) save("openrail.openbveExecutable", executable); }, [executable]);
  useEffect(() => save("openrail.contentRoots", roots), [roots]);
  useEffect(() => save("openrail.route", routePath), [routePath]);
  useEffect(() => save("openrail.train", trainPath), [trainPath]);
  useEffect(() => save("openrail.prefs", prefs), [prefs]);
  useEffect(() => save("openrail.favourites", favourites), [favourites]);
  useEffect(() => save("openrail.recent", recent), [recent]);
  useEffect(() => { setStation(""); }, [routePath]);

  // first start: find OpenBVE and its content folders, then scan
  useEffect(() => {
    call<Installation>("detect_openbve").then(found => {
      if (found.executable && !legacy.exe) setExecutable(found.executable);
      if (!legacy.roots.length && found.contentHints.length) {
        setRoots(found.contentHints);
        runScan(found.contentHints);
      }
    }).catch(() => { /* running outside the desktop app */ });
    if (legacy.roots.length) runScan(legacy.roots);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runScan(folders = roots) {
    if (!folders.length) { notify("Add a content folder first."); return; }
    setBusy(true);
    try {
      const result = await call<ScanResult>("scan_content", { roots: folders });
      setScan(result);
      notify(`Found ${result.routes.length} routes and ${result.trains.length} trains.`);
    } catch (e) {
      notify(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function addFolder() {
    const picked = await call<string | null>("pick_folder", { title: "Select an OpenBVE content folder" }).catch(e => { notify(errorText(e)); return null; });
    if (!picked) return;
    if (roots.includes(picked)) { notify("That folder is already in your library."); return; }
    const next = [...roots, picked];
    setRoots(next);
    await runScan(next);
  }

  function removeFolder(folder: string) {
    const next = roots.filter(r => r !== folder);
    setRoots(next);
    if (next.length) runScan(next); else setScan(EMPTY_SCAN);
  }

  async function chooseExecutable() {
    const picked = await call<string | null>("pick_executable").catch(e => { notify(errorText(e)); return null; });
    if (picked) { setExecutable(picked); notify("OpenBVE location saved."); }
  }

  async function detect() {
    try {
      const found = await call<Installation>("detect_openbve");
      if (found.executable) { setExecutable(found.executable); notify("OpenBVE found."); }
      else notify("OpenBVE wasn't found automatically. Use Browse.");
      const newHints = found.contentHints.filter(h => !roots.includes(h));
      if (newHints.length) { const next = [...roots, ...newHints]; setRoots(next); runScan(next); }
    } catch (e) { notify(errorText(e)); }
  }

  function toggleFavourite(path: string) {
    setFavourites(f => f.includes(path) ? f.filter(x => x !== path) : [...f, path]);
  }

  async function play(r: RouteItem | null = route, t: TrainItem | null = train) {
    if (!executable) { notify("Set your OpenBVE location in Settings first."); setPage("Settings"); return; }
    if (!r) { notify("Pick a route first."); setPage("Routes"); return; }
    try {
      const text = await call<string>("launch_openbve", {
        options: {
          executable, route: r.path, train: t?.path ?? null,
          station: r.path === routePath ? station || null : null,
          startTime: startTime.trim() || null,
          ai: prefs.ai, fullscreen: prefs.fullscreen,
          width: prefs.width || null, height: prefs.height || null,
        },
      });
      notify(text);
      setRecent(list => [{ route: r.path, train: t?.path ?? null, at: Date.now() }, ...list.filter(x => x.route !== r.path)].slice(0, 8));
    } catch (e) { notify(errorText(e)); }
  }

  const stats = { routes: scan.routes.length, trains: scan.trains.length, files: scan.filesScanned, warnings: scan.warnings.length };

  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">OR</div><div><strong>OPENRAIL</strong><span>OPENBVE LAUNCHER</span></div></div>
      <nav>{nav.map(x => <button key={x} className={page === x ? "nav active" : "nav"} onClick={() => setPage(x)}>
        <span className="nav-icon">{icon(x)}</span>{x}
        {x === "Validator" && stats.warnings > 0 && <span className="badge">{stats.warnings}</span>}
      </button>)}</nav>
      <div className="sidebar-bottom"><div className={executable ? "status good" : "status"}></div>{executable ? "OpenBVE ready" : "OpenBVE not configured"}</div>
    </aside>
    <main>
      <header className="topbar"><div><div className="eyebrow">OPENBVE ECOSYSTEM</div><h1>{page}</h1></div>
        <div className="top-actions">{busy && <span className="scanning">Scanning…</span>}<button className="gear" title="Rescan" onClick={() => runScan()}>↻</button><button className="gear" title="Settings" onClick={() => setPage("Settings")}>⚙</button></div></header>
      {message && <div className="toast" onClick={() => setMessage("")}>{message}</div>}

      {page === "Home" && <Home stats={stats} executable={executable} route={route} train={train}
        station={station} setStation={setStation} startTime={startTime} setStartTime={setStartTime}
        prefs={prefs} setPrefs={setPrefs} onPlay={() => play()} onScan={addFolder} roots={roots}
        recent={recent} scan={scan} onReplay={(r, t) => { setRoutePath(r.path); setTrainPath(t?.path ?? null); play(r, t); }}
        go={setPage} />}
      {page === "Routes" && <Library<RouteItem> title="Routes" items={scan.routes} selected={routePath}
        onSelect={x => { setRoutePath(x.path); notify(`Route: ${x.name}`); }} favourites={favourites} onFavourite={toggleFavourite}
        empty="Add an OpenBVE content folder to discover routes." busy={busy}
        searchText={r => [r.name, r.group, r.comment, ...r.stations].join(" ")}
        subtitle={r => [r.group, r.stations.length ? `${r.stations.length} stations` : "", r.lengthKm ? `${r.lengthKm} km` : ""].filter(Boolean).join(" · ")}
        fallback="🛤️" />}
      {page === "Trains" && <Library<TrainItem> title="Trains" items={scan.trains} selected={trainPath}
        onSelect={x => { setTrainPath(trainPath === x.path ? null : x.path); notify(trainPath === x.path ? "Using the route's default train." : `Train: ${x.name}`); }}
        favourites={favourites} onFavourite={toggleFavourite} busy={busy}
        empty="Add an OpenBVE content folder to discover trains."
        searchText={t => [t.name, t.group, t.comment].join(" ")}
        subtitle={t => t.comment.split("\n")[0] || t.group}
        fallback="🚇" />}
      {page === "Content" && <Content scan={scan} roots={roots} busy={busy} onAdd={addFolder} onRemove={removeFolder} onRescan={() => runScan()} />}
      {page === "GitHub" && <Simple title="GitHub Content" text="Installing routes and trains straight from GitHub releases is planned. Packages will be checked by the validator before they are installed." />}
      {page === "Validator" && <Validator scan={scan} />}
      {page === "Settings" && <Settings executable={executable} prefs={prefs} setPrefs={setPrefs}
        onDetect={detect} onBrowse={chooseExecutable} roots={roots} onAdd={addFolder} onRemove={removeFolder} />}
    </main>
  </div>;
}

/* ------------------------------------------------------------------ pieces */

function Thumb({ path, fallback, className = "cover" }: { path: string | null; fallback: ReactNode; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setSrc(null);
    if (!path || !ref.current) return;
    let alive = true;
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) {
        io.disconnect();
        loadImage(path).then(s => { if (alive) setSrc(s); });
      }
    }, { rootMargin: "300px" });
    io.observe(ref.current);
    return () => { alive = false; io.disconnect(); };
  }, [path]);
  return <div className={className} ref={ref}>{src ? <img src={src} alt="" /> : <span>{fallback}</span>}</div>;
}

function Home(p: {
  stats: { routes: number; trains: number; files: number; warnings: number }; executable: string | null;
  route: RouteItem | null; train: TrainItem | null; station: string; setStation: (s: string) => void;
  startTime: string; setStartTime: (s: string) => void; prefs: LaunchPrefs; setPrefs: (p: LaunchPrefs) => void;
  onPlay: () => void; onScan: () => void; roots: string[]; recent: Recent[]; scan: ScanResult;
  onReplay: (r: RouteItem, t: TrainItem | null) => void; go: (p: Page) => void;
}) {
  const { route, train, prefs } = p;
  const recentItems = p.recent
    .map(x => ({ x, r: p.scan.routes.find(r => r.path === x.route), t: p.scan.trains.find(t => t.path === x.train) ?? null }))
    .filter((y): y is { x: Recent; r: RouteItem; t: TrainItem | null } => !!y.r)
    .slice(0, 5);
  return <section className="content">
    <div className="hero">
      <Thumb key={route?.image ?? "none"} path={route?.image ?? null} fallback="" className="hero-bg" />
      <div className="hero-body">
        <div className="eyebrow">SIMULATOR CONTROL CENTER</div>
        <h2>{route ? route.name : "Run your railway."}</h2>
        <p>{route ? (route.comment || "No description in this route file.") : "One place for OpenBVE routes, trains and content."}</p>
        <div className="selection">
          <button className="link" onClick={() => p.go("Routes")}>{route?.name ?? "Choose a route"}</button><span>→</span>
          <button className="link" onClick={() => p.go("Trains")}>{train?.name ?? "Route default train"}</button>
        </div>
        <div className="options">
          <label>Start station
            <select value={p.station} onChange={e => p.setStation(e.target.value)} disabled={!route?.stations.length}>
              <option value="">First station</option>
              {route?.stations.map(s => <option key={s} value={s}>{s}</option>)}
            </select></label>
          <label>Start time<input value={p.startTime} onChange={e => p.setStartTime(e.target.value)} placeholder="Timetable" /></label>
          <label className="check"><input type="checkbox" checked={prefs.fullscreen} onChange={e => p.setPrefs({ ...prefs, fullscreen: e.target.checked })} />Full screen</label>
          <label className="check"><input type="checkbox" checked={prefs.ai} onChange={e => p.setPrefs({ ...prefs, ai: e.target.checked })} />AI driver</label>
        </div>
      </div>
      <button className="play" onClick={p.onPlay}>▶ DRIVE</button>
    </div>
    <div className="stats"><Stat n={p.stats.routes} t="Routes" /><Stat n={p.stats.trains} t="Trains" /><Stat n={p.stats.files} t="Files scanned" /><Stat n={p.stats.warnings} t="Warnings" /></div>
    <div className="columns">
      <div className="panel">
        <PanelTitle t="RECENT" />
        {!p.executable && <div className="action"><div><b>OpenBVE needs configuration</b><small>Tell OpenRail where OpenBVE is installed.</small></div><button onClick={() => p.go("Settings")}>SETTINGS</button></div>}
        {!p.roots.length && <div className="action"><div><b>No content folders yet</b><small>Add the folder that holds your Railway and Train folders.</small></div><button onClick={p.onScan}>ADD FOLDER</button></div>}
        {recentItems.length ? <div className="recent">{recentItems.map(({ x, r, t }) =>
          <button key={x.at} className="recent-row" onClick={() => p.onReplay(r, t)}>
            <Thumb path={r.image} fallback="🛤️" className="mini" />
            <div><b>{r.name}</b><small>{t?.name ?? "Default train"} · {new Date(x.at).toLocaleDateString()}</small></div><span>▶</span>
          </button>)}</div>
          : <div className="empty">Routes you drive will show up here.</div>}
      </div>
      <div className="panel"><PanelTitle t="RENDERING ROADMAP" /><div className="roadmap">
        <Road label="Native OpenBVE" state="AVAILABLE" /><Road label="Renderer abstraction" state="READY" />
        <Road label="DLSS Super Resolution" state="ENGINE WORK REQUIRED" /><Road label="Frame Generation" state="FUTURE" /></div></div>
    </div>
  </section>;
}

function Library<T extends { name: string; path: string; image: string | null }>(p: {
  title: string; items: T[]; selected: string | null; onSelect: (x: T) => void; empty: string; busy: boolean;
  favourites: string[]; onFavourite: (path: string) => void;
  searchText: (x: T) => string; subtitle: (x: T) => string; fallback: string;
}) {
  const [query, setQuery] = useState("");
  const [onlyFav, setOnlyFav] = useState(false);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return p.items.filter(x => (!onlyFav || p.favourites.includes(x.path)) && (!q || p.searchText(x).toLowerCase().includes(q)));
  }, [p.items, query, onlyFav, p.favourites]);
  return <section className="content">
    <div className="library-head">
      <div><div className="eyebrow">CONTENT LIBRARY</div><h2>{p.title}</h2></div>
      <div className="filters">
        <input className="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={`Search ${p.title.toLowerCase()}…`} />
        <button className={onlyFav ? "chip on" : "chip"} onClick={() => setOnlyFav(!onlyFav)}>★ Favourites</button>
        <span>{shown.length} of {p.items.length}</span>
      </div>
    </div>
    {p.items.length === 0 ? <div className="panel empty large">{p.busy ? "Scanning…" : p.empty}</div>
      : shown.length === 0 ? <div className="panel empty large">Nothing matches.</div>
      : <div className="cards">{shown.map(x =>
        <div key={x.path} className={p.selected === x.path ? "card selected" : "card"} onClick={() => p.onSelect(x)} role="button" tabIndex={0}
          onKeyDown={e => { if (e.key === "Enter") p.onSelect(x); }}>
          <Thumb path={x.image} fallback={p.fallback} />
          <button className="star" title="Favourite" onClick={e => { e.stopPropagation(); p.onFavourite(x.path); }}>{p.favourites.includes(x.path) ? "★" : "☆"}</button>
          <div><b>{x.name}</b><small>{p.subtitle(x) || " "}</small></div>
        </div>)}</div>}
  </section>;
}

function Folders({ roots, onAdd, onRemove }: { roots: string[]; onAdd: () => void; onRemove: (f: string) => void }) {
  return <div className="folders">
    {roots.length === 0 && <div className="empty small">No folders yet.</div>}
    {roots.map(f => <div className="folder" key={f}><span>{f}</span><button className="secondary ghost" onClick={() => onRemove(f)}>REMOVE</button></div>)}
    <button className="secondary" onClick={onAdd}>ADD FOLDER</button>
  </div>;
}

function Content(p: { scan: ScanResult; roots: string[]; busy: boolean; onAdd: () => void; onRemove: (f: string) => void; onRescan: () => void }) {
  return <section className="content"><div className="panel large">
    <PanelTitle t="CONTENT FOLDERS" />
    <h2>{p.busy ? "Scanning…" : "OpenBVE content"}</h2>
    <p className="muted">Add the folders that hold your <b>Railway</b> and <b>Train</b> folders. Sub-folders are searched too.</p>
    <Folders roots={p.roots} onAdd={p.onAdd} onRemove={p.onRemove} />
    <div className="scanline"><span>Routes</span><b>{p.scan.routes.length}</b><span>Trains</span><b>{p.scan.trains.length}</b><span>Files</span><b>{p.scan.filesScanned}</b></div>
    <button className="secondary" style={{ marginTop: 16 }} onClick={p.onRescan} disabled={p.busy || !p.roots.length}>RESCAN</button>
  </div></section>;
}

function Validator({ scan }: { scan: ScanResult }) {
  return <section className="content"><div className="panel large"><PanelTitle t="VALIDATOR" />
    <h2>{scan.warnings.length ? `${scan.warnings.length} warning${scan.warnings.length === 1 ? "" : "s"}` : "No scanner warnings"}</h2>
    {scan.warnings.length ? <ul>{scan.warnings.map((x, i) => <li key={i}>{x}</li>)}</ul>
      : <p className="muted">Scan your content to check it. Checking that every object a route uses actually exists is the next milestone.</p>}
  </div></section>;
}

function Settings(p: {
  executable: string | null; prefs: LaunchPrefs; setPrefs: (p: LaunchPrefs) => void; onDetect: () => void; onBrowse: () => void;
  roots: string[]; onAdd: () => void; onRemove: (f: string) => void;
}) {
  const { prefs } = p;
  const num = (v: string) => Math.max(0, Math.min(16384, parseInt(v, 10) || 0));
  return <section className="content"><div className="panel large"><PanelTitle t="SETTINGS" />
    <div className="setting"><b>OpenBVE program</b><span>{p.executable ?? "Not found yet"}</span>
      <div className="setting-actions"><button className="secondary" onClick={p.onDetect}>FIND</button><button className="secondary" onClick={p.onBrowse}>BROWSE</button></div></div>
    <div className="setting top"><b>Content folders</b><Folders roots={p.roots} onAdd={p.onAdd} onRemove={p.onRemove} /><span /></div>
    <div className="setting"><b>Window size</b>
      <div className="res"><input type="number" value={prefs.width || ""} onChange={e => p.setPrefs({ ...prefs, width: num(e.target.value) })} placeholder="Width" />
        <span>×</span><input type="number" value={prefs.height || ""} onChange={e => p.setPrefs({ ...prefs, height: num(e.target.value) })} placeholder="Height" /></div>
      <div className="setting-actions">
        <label className="check"><input type="checkbox" checked={prefs.fullscreen} onChange={e => p.setPrefs({ ...prefs, fullscreen: e.target.checked })} />Full screen</label></div></div>
    <div className="setting"><b>Upscaling</b><span>Native — DLSS needs renderer work inside OpenBVE itself.</span><span /></div>
  </div></section>;
}

function Simple({ title, text }: { title: string; text: string }) { return <section className="content"><div className="panel large"><PanelTitle t="OPENRAIL" /><h2>{title}</h2><p className="muted">{text}</p></div></section>; }
function Stat({ n, t }: { n: number; t: string }) { return <div className="stat"><span>{t}</span><b>{n}</b></div>; }
function PanelTitle({ t }: { t: string }) { return <div className="panel-title">{t}</div>; }
function Road({ label, state }: { label: string; state: string }) { return <div className="road"><span>{label}</span><small>{state}</small></div>; }
function icon(x: Page) { return ({ Home: "⌂", Routes: "▱", Trains: "▣", Content: "◈", GitHub: "◉", Validator: "✓", Settings: "⚙" } as Record<Page, string>)[x]; }

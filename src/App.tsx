import { useEffect, useMemo, useState } from "react";
import "./styles.css";

declare global { interface Window { __TAURI__?: unknown } }

type Page = "Home" | "Routes" | "Trains" | "Content" | "GitHub" | "Validator" | "Settings";
type Item = { name: string; path: string; kind: string; files: number };
type ScanResult = { routes: Item[]; trains: Item[]; files_scanned: number; warnings: string[] };

const nav: Page[] = ["Home", "Routes", "Trains", "Content", "GitHub", "Validator", "Settings"];
const invoke = async (cmd: string, args?: Record<string, unknown>) => {
  const mod = await import("@tauri-apps/api/core");
  return mod.invoke(cmd, args);
};

export default function App() {
  const [page, setPage] = useState<Page>("Home");
  const [installation, setInstallation] = useState<{found:boolean; executable?:string}>({found:false});
  const [contentRoot, setContentRoot] = useState("");
  const [scan, setScan] = useState<ScanResult>({routes:[], trains:[], files_scanned:0, warnings:[]});
  const [selectedRoute, setSelectedRoute] = useState<Item | null>(null);
  const [selectedTrain, setSelectedTrain] = useState<Item | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const savedExe = localStorage.getItem("openrail.openbveExecutable");
    const savedRoot = localStorage.getItem("openrail.contentRoot");
    if (savedExe) setInstallation({ found: true, executable: savedExe });
    if (savedRoot) setContentRoot(savedRoot);
    invoke("detect_openbve").then((detected: any) => {
      if (detected?.found && detected.executable && !savedExe) setInstallation(detected);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (installation.executable) localStorage.setItem("openrail.openbveExecutable", installation.executable);
  }, [installation.executable]);

  useEffect(() => {
    if (contentRoot) localStorage.setItem("openrail.contentRoot", contentRoot);
  }, [contentRoot]);

  async function chooseExecutable() {
    const dialog = await import("@tauri-apps/plugin-dialog");
    const picked = await dialog.open({
      multiple: false,
      title: "Select OpenBVE executable",
      filters: [{ name: "OpenBVE executable", extensions: ["exe", "app", "bin"] }]
    });
    if (typeof picked === "string") {
      setInstallation({ found: true, executable: picked });
      setMessage("OpenBVE executable saved.");
    }
  }

  async function chooseContent() {
    const dialog = await import("@tauri-apps/plugin-dialog");
    const picked = await dialog.open({ directory: true, multiple: false, title: "Select OpenBVE content folder" });
    if (typeof picked === "string") { setContentRoot(picked); await scanFolder(picked); }
  }

  async function scanFolder(root = contentRoot) {
    if (!root) return;
    setBusy(true); setMessage("");
    try { setScan(await invoke("scan_content", { root }) as ScanResult); }
    catch (e) { setMessage(String(e)); }
    finally { setBusy(false); }
  }

  async function play() {
    if (!installation.found || !installation.executable) { setMessage("Configure an OpenBVE executable in Settings first."); return; }
    if (!selectedRoute) { setMessage("Select a route first."); return; }
    try {
      await invoke("launch_openbve", { executable: installation.executable, route: selectedRoute.path, train: selectedTrain?.path ?? null });
      setMessage("OpenBVE launched.");
    } catch (e) { setMessage(String(e)); }
  }

  const stats = useMemo(() => ({ routes: scan.routes.length, trains: scan.trains.length, files: scan.files_scanned, warnings: scan.warnings.length }), [scan]);

  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">OR</div><div><strong>OPENRAIL</strong><span>OPENBVE LAUNCHER</span></div></div>
      <nav>{nav.map(x => <button key={x} className={page===x?"nav active":"nav"} onClick={()=>setPage(x)}><span className="nav-icon">{icon(x)}</span>{x}</button>)}</nav>
      <div className="sidebar-bottom"><div className={installation.found?"status good":"status"}></div>{installation.found?"OpenBVE detected":"OpenBVE not configured"}</div>
    </aside>
    <main>
      <header className="topbar"><div><div className="eyebrow">OPENBVE ECOSYSTEM</div><h1>{page}</h1></div><button className="gear" onClick={()=>setPage("Settings")}>⚙</button></header>
      {message && <div className="toast">{message}</div>}
      {page === "Home" && <Home stats={stats} scan={scan} installation={installation} onScan={chooseContent} onPlay={play} route={selectedRoute} train={selectedTrain} />}
      {page === "Routes" && <Library title="Routes" items={scan.routes} selected={selectedRoute} onSelect={setSelectedRoute} empty="Scan an OpenBVE content folder to discover routes." />}
      {page === "Trains" && <Library title="Trains" items={scan.trains} selected={selectedTrain} onSelect={setSelectedTrain} empty="Scan an OpenBVE content folder to discover trains." />}
      {page === "Content" && <Content scan={scan} root={contentRoot} onChoose={chooseContent} busy={busy} />}
      {page === "GitHub" && <Simple title="GitHub Content" text="Repository and release installation will be connected next. The package system will validate content before installation." />}
      {page === "Validator" && <Validator scan={scan} />}
      {page === "Settings" && <Settings installation={installation} root={contentRoot} onChoose={chooseContent} onChooseExecutable={chooseExecutable} onDetect={()=>invoke("detect_openbve").then(setInstallation)} />}
    </main>
  </div>;
}

function Home({stats, scan, installation, onScan, onPlay, route, train}:{stats:any;scan:ScanResult;installation:any;onScan:()=>void;onPlay:()=>void;route:Item|null;train:Item|null}) {
 return <section className="content"><div className="hero"><div><div className="eyebrow">SIMULATOR CONTROL CENTER</div><h2>Run your railway.</h2><p>One place for OpenBVE routes, trains, content and future rendering enhancements.</p><div className="selection">{route?.name ?? "No route selected"}<span>→</span>{train?.name ?? "No train selected"}</div></div><button className="play" onClick={onPlay}>▶ DRIVE</button></div>
 <div className="stats"><Stat n={stats.routes} t="Routes"/><Stat n={stats.trains} t="Trains"/><Stat n={stats.files} t="Files scanned"/><Stat n={stats.warnings} t="Warnings"/></div>
 <div className="columns"><div className="panel"><PanelTitle t="LIBRARY"/><div className="action"><div><b>{installation.found?"OpenBVE detected":"OpenBVE needs configuration"}</b><small>{installation.executable ?? "Select your installation in Settings."}</small></div><button onClick={onScan}>SCAN CONTENT</button></div><div className="empty">{scan.routes.length+scan.trains.length ? `Discovered ${scan.routes.length} routes and ${scan.trains.length} trains.` : "Your library is waiting for its first scan."}</div></div><div className="panel"><PanelTitle t="RENDERING ROADMAP"/><div className="roadmap"><Road label="Native OpenBVE" state="AVAILABLE"/><Road label="Renderer abstraction" state="READY"/><Road label="DLSS Super Resolution" state="ENGINE WORK REQUIRED"/><Road label="Frame Generation" state="FUTURE"/></div></div></div></section>
}
function Library({title,items,selected,onSelect,empty}:{title:string;items:Item[];selected:Item|null;onSelect:(x:Item)=>void;empty:string}) { return <section className="content"><div className="library-head"><div><div className="eyebrow">CONTENT LIBRARY</div><h2>{title}</h2></div><span>{items.length} detected</span></div>{items.length===0?<div className="panel empty large">{empty}</div>:<div className="cards">{items.map((x,i)=><button className={selected?.path===x.path?"card selected":"card"} key={x.path+i} onClick={()=>onSelect(x)}><div className="cover">{x.kind==="train"?"🚇":"🛤️"}</div><div><b>{x.name}</b><small>{x.path}</small><small>{x.files} files</small></div></button>)}</div>}</section> }
function Content({scan,root,onChoose,busy}:{scan:ScanResult;root:string;onChoose:()=>void;busy:boolean}) { return <section className="content"><div className="panel large"><PanelTitle t="CONTENT SCANNER"/><h2>{busy?"Scanning…":"OpenBVE content"}</h2><p>{root || "No folder selected."}</p><button className="secondary" onClick={onChoose}>CHOOSE FOLDER</button><div className="scanline"><span>Routes</span><b>{scan.routes.length}</b><span>Trains</span><b>{scan.trains.length}</b><span>Files</span><b>{scan.files_scanned}</b></div></div></section> }
function Validator({scan}:{scan:ScanResult}) { return <section className="content"><div className="panel large"><PanelTitle t="VALIDATOR"/><h2>{scan.warnings.length?`${scan.warnings.length} warnings`:`No scanner warnings`}</h2>{scan.warnings.length?<ul>{scan.warnings.map((x,i)=><li key={i}>{x}</li>)}</ul>:<p>Run a content scan to populate validation diagnostics. Full route-reference validation is the next parser milestone.</p>}</div></section> }
function Settings({installation,root,onChoose,onChooseExecutable,onDetect}:{installation:any;root:string;onChoose:()=>void;onChooseExecutable:()=>void;onDetect:()=>void}) { return <section className="content"><div className="panel large"><PanelTitle t="SETTINGS"/><div className="setting"><b>OpenBVE executable</b><span>{installation.executable ?? "Not detected"}</span><div className="setting-actions"><button className="secondary" onClick={onDetect}>RESCAN</button><button className="secondary" onClick={onChooseExecutable}>BROWSE</button></div></div><div className="setting"><b>Content directory</b><span>{root || "Not selected"}</span><button className="secondary" onClick={onChoose}>CHOOSE</button></div><div className="setting"><b>Upscaling</b><span>Native — DLSS requires engine-side renderer integration.</span></div></div></section> }
function Simple({title,text}:{title:string;text:string}) { return <section className="content"><div className="panel large"><PanelTitle t="OPENRAIL"/><h2>{title}</h2><p>{text}</p></div></section> }
function Stat({n,t}:{n:number;t:string}){return <div className="stat"><span>{t}</span><b>{n}</b></div>}
function PanelTitle({t}:{t:string}){return <div className="panel-title">{t}</div>}
function Road({label,state}:{label:string;state:string}){return <div className="road"><span>{label}</span><small>{state}</small></div>}
function icon(x:Page){return ({Home:"⌂",Routes:"▱",Trains:"▣",Content:"◈",GitHub:"◉",Validator:"✓",Settings:"⚙"}[x])}

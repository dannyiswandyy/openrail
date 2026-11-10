import { useState } from "react";

type Page = "Home" | "Routes" | "Trains" | "Content" | "GitHub" | "Validator" | "Settings";

const nav: Page[] = ["Home", "Routes", "Trains", "Content", "GitHub", "Validator", "Settings"];

function App() {
  const [page, setPage] = useState<Page>("Home");

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">OB</div>
          <div>
            <strong>OpenBVE</strong>
            <span>LAUNCHER</span>
          </div>
        </div>

        <nav>
          {nav.map((item) => (
            <button
              key={item}
              className={page === item ? "nav-item active" : "nav-item"}
              onClick={() => setPage(item)}
            >
              <span className="nav-dot" />
              {item}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="status-dot" />
          OpenBVE status: not configured
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <div className="eyebrow">OPENBVE ECOSYSTEM</div>
            <h1>{page}</h1>
          </div>
          <button className="icon-button" title="Settings" onClick={() => setPage("Settings")}>⚙</button>
        </header>

        {page === "Home" && <Home setPage={setPage} />}
        {page !== "Home" && <Placeholder page={page} />}
      </main>
    </div>
  );
}

function Home({ setPage }: { setPage: (p: Page) => void }) {
  return (
    <section className="content">
      <div className="hero">
        <div>
          <div className="eyebrow">SIMULATOR READY</div>
          <h2>Your OpenBVE library.</h2>
          <p>
            Manage routes, trains, dependencies and installations from one place.
          </p>
        </div>
        <button className="play-button" onClick={() => setPage("Routes")}>
          ▶ PLAY
        </button>
      </div>

      <div className="grid">
        <Stat title="Routes" value="0" />
        <Stat title="Trains" value="0" />
        <Stat title="Content" value="0" />
        <Stat title="Warnings" value="0" />
      </div>

      <div className="two-column">
        <div className="panel">
          <div className="panel-title">RECENTLY PLAYED</div>
          <div className="empty">
            <span>🚆</span>
            <strong>No journeys yet</strong>
            <small>Your recently played routes will appear here.</small>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">GRAPHICS</div>
          <div className="graphics-card">
            <div>
              <strong>Rendering backend</strong>
              <span>OpenBVE native</span>
            </div>
            <div>
              <strong>Upscaling</strong>
              <span className="experimental">DLSS — ENGINE INTEGRATION REQUIRED</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div className="stat">
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Placeholder({ page }: { page: Page }) {
  return (
    <section className="content">
      <div className="panel large">
        <div className="panel-title">{page.toUpperCase()}</div>
        <h2>{page} manager</h2>
        <p>This module is part of the v0.1 foundation and will be connected to the Rust core next.</p>
      </div>
    </section>
  );
}

export default App;

import { useMemo, useState } from "react";
import "./styles.css";

type Page = "Home" | "Routes" | "Trains" | "Library" | "Settings";

type Route = {
  name: string;
  author: string;
  description: string;
  status: "Ready" | "Missing files";
};

const routes: Route[] = [
  {
    name: "No routes installed",
    author: "OpenRail",
    description: "Add your OpenBVE route folder to begin.",
    status: "Missing files",
  },
];

const navItems: Page[] = [
  "Home",
  "Routes",
  "Trains",
  "Library",
  "Settings",
];

function App() {
  const [page, setPage] = useState<Page>("Home");
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [openBvePath, setOpenBvePath] = useState("");

  const readyRoutes = useMemo(
    () => routes.filter((route) => route.status === "Ready").length,
    []
  );

  const renderPage = () => {
    switch (page) {
      case "Routes":
        return (
          <section className="page">
            <div className="page-heading">
              <div>
                <p className="eyebrow">CONTENT</p>
                <h1>Routes</h1>
                <p className="muted">
                  Your installed OpenBVE routes will appear here.
                </p>
              </div>

              <button className="primary-button">
                + Add Route
              </button>
            </div>

            <div className="route-grid">
              {routes.map((route) => (
                <button
                  className="route-card"
                  key={route.name}
                  onClick={() => setSelectedRoute(route)}
                >
                  <div className="route-image">
                    <span>🚆</span>
                  </div>

                  <div className="route-info">
                    <div className="route-title-row">
                      <h3>{route.name}</h3>
                      <span
                        className={
                          route.status === "Ready"
                            ? "status ready"
                            : "status warning"
                        }
                      >
                        {route.status}
                      </span>
                    </div>

                    <p>{route.author}</p>
                    <small>{route.description}</small>
                  </div>
                </button>
              ))}
            </div>
          </section>
        );

      case "Trains":
        return (
          <section className="page">
            <div className="page-heading">
              <div>
                <p className="eyebrow">CONTENT</p>
                <h1>Trains</h1>
                <p className="muted">
                  Your OpenBVE train sets will appear here.
                </p>
              </div>

              <button className="primary-button">
                + Add Train
              </button>
            </div>

            <div className="empty-state">
              <div className="empty-icon">🚄</div>
              <h2>No trains installed</h2>
              <p>
                OpenRail will automatically scan your OpenBVE train
                directory once it is configured.
              </p>
            </div>
          </section>
        );

      case "Library":
        return (
          <section className="page">
            <div className="page-heading">
              <div>
                <p className="eyebrow">COLLECTION</p>
                <h1>Library</h1>
                <p className="muted">
                  Manage your OpenBVE content from one place.
                </p>
              </div>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <span>Routes</span>
                <strong>{readyRoutes}</strong>
              </div>

              <div className="stat-card">
                <span>Trains</span>
                <strong>0</strong>
              </div>

              <div className="stat-card">
                <span>Add-ons</span>
                <strong>0</strong>
              </div>
            </div>
          </section>
        );

      case "Settings":
        return (
          <section className="page">
            <div className="page-heading">
              <div>
                <p className="eyebrow">CONFIGURATION</p>
                <h1>Settings</h1>
                <p className="muted">
                  Configure OpenRail and your OpenBVE installation.
                </p>
              </div>
            </div>

            <div className="settings-card">
              <div className="setting">
                <div>
                  <h3>OpenBVE executable</h3>
                  <p>
                    The OpenBVE installation that OpenRail will launch.
                  </p>
                </div>

                <input
                  value={openBvePath}
                  onChange={(event) =>
                    setOpenBvePath(event.target.value)
                  }
                  placeholder="Select OpenBVE executable..."
                />

                <button className="secondary-button">
                  Browse
                </button>
              </div>

              <div className="setting">
                <div>
                  <h3>Graphics</h3>
                  <p>
                    Graphics and upscaling options will be connected to
                    the rendering backend later.
                  </p>
                </div>

                <select defaultValue="auto">
                  <option value="auto">Automatic</option>
                  <option value="quality">Quality</option>
                  <option value="balanced">Balanced</option>
                  <option value="performance">Performance</option>
                </select>
              </div>

              <div className="setting">
                <div>
                  <h3>DLSS / Upscaling</h3>
                  <p>
                    Experimental support — unavailable until the
                    compatible rendering path is implemented.
                  </p>
                </div>

                <span className="status disabled">Unavailable</span>
              </div>
            </div>
          </section>
        );

      default:
        return (
          <section className="home">
            <div className="hero">
              <div className="hero-content">
                <p className="eyebrow">OPENRAIL</p>

                <h1>
                  Your railway.
                  <br />
                  <span>One launcher.</span>
                </h1>

                <p className="hero-description">
                  A modern, OpenOMSI-inspired launcher built from
                  scratch for OpenBVE.
                </p>

                <div className="hero-actions">
                  <button className="primary-button large">
                    ▶ Play OpenBVE
                  </button>

                  <button
                    className="secondary-button large"
                    onClick={() => setPage("Routes")}
                  >
                    Browse Routes
                  </button>
                </div>
              </div>

              <div className="train-display">
                <div className="train-glow" />
                <div className="train-icon">🚆</div>
                <div className="train-lines" />
              </div>
            </div>

            <div className="home-grid">
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">RECENT</p>
                    <h2>Recent routes</h2>
                  </div>

                  <button
                    className="text-button"
                    onClick={() => setPage("Routes")}
                  >
                    View all →
                  </button>
                </div>

                <div className="recent-route">
                  <div className="mini-route-icon">🚆</div>

                  <div>
                    <strong>No route selected</strong>
                    <p>Install an OpenBVE route to get started.</p>
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">SYSTEM</p>
                    <h2>OpenRail status</h2>
                  </div>
                </div>

                <div className="status-row">
                  <span className="status-dot" />
                  <span>Launcher ready</span>
                </div>

                <div className="status-row">
                  <span className="status-dot inactive" />
                  <span>OpenBVE not configured</span>
                </div>
              </div>
            </div>
          </section>
        );
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">O</div>
          <div>
            <strong>OpenRail</strong>
            <span>OpenBVE Launcher</span>
          </div>
        </div>

        <nav className="navigation">
          <p className="nav-label">LAUNCHER</p>

          {navItems.map((item) => (
            <button
              key={item}
              className={`nav-item ${page === item ? "active" : ""}`}
              onClick={() => setPage(item)}
            >
              <span className="nav-icon">
                {item === "Home" && "⌂"}
                {item === "Routes" && "▰"}
                {item === "Trains" && "🚆"}
                {item === "Library" && "▤"}
                {item === "Settings" && "⚙"}
              </span>

              {item}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="version">
            <span>OpenRail</span>
            <small>Development build</small>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="topbar-title">{page}</span>
          </div>

          <div className="topbar-actions">
            <span className="connection">
              <span className="status-dot" />
              Local
            </span>
          </div>
        </header>

        {renderPage()}

        {selectedRoute && (
          <div
            className="modal-backdrop"
            onClick={() => setSelectedRoute(null)}
          >
            <div
              className="route-modal"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                className="modal-close"
                onClick={() => setSelectedRoute(null)}
              >
                ×
              </button>

              <div className="modal-icon">🚆</div>

              <p className="eyebrow">ROUTE</p>
              <h2>{selectedRoute.name}</h2>
              <p className="muted">{selectedRoute.description}</p>

              <button className="primary-button large">
                ▶ Play Route
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;

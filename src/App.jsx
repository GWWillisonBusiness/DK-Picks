import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./App.css";

function App() {
  const [games, setGames] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [activeGame, setActiveGame] = useState(null);

  useEffect(() => {
    axios
      .get("http://localhost:3001/api/ev-results")
      .then((res) => setGames(res.data || []))
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (modalOpen) {
      document.body.classList.add("no-scroll");
    } else {
      document.body.classList.remove("no-scroll");
    }
  }, [modalOpen]);

  const weeks = Array.from({ length: 18 }, (_, i) => i + 1);

  const grouped = useMemo(() => {
    const filtered = selectedWeek
      ? games.filter((g) => Number(g.week) === Number(selectedWeek))
      : games;

    const map = new Map();
    for (const g of filtered) {
      if (!map.has(g.game)) map.set(g.game, []);
      map.get(g.game).push(g);
    }

    const arr = Array.from(map.entries());
    arr.sort(
      (a, b) =>
        Math.max(...b[1].map((x) => x.ev)) - Math.max(...a[1].map((x) => x.ev))
    );
    return arr;
  }, [games, selectedWeek]);

  const openModal = (name, entries) => {
    setActiveGame({ name, entries });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setActiveGame(null);
  };

  const overlayClick = (e) => {
    if (e.target.classList.contains("modal-overlay")) {
      closeModal();
    }
  };

  // Team abbrevs for logo lookup (all lowercase)
  const teamToAbbr = {
    "Buffalo Bills": "buf",
    "Miami Dolphins": "mia",
    "New England Patriots": "ne",
    "New York Jets": "nyj",
    "Baltimore Ravens": "bal",
    "Cincinnati Bengals": "cin",
    "Cleveland Browns": "cle",
    "Pittsburgh Steelers": "pit",
    "Houston Texans": "hou",
    "Indianapolis Colts": "ind",
    "Jacksonville Jaguars": "jax",
    "Tennessee Titans": "ten",
    "Denver Broncos": "den",
    "Kansas City Chiefs": "kc",
    "Las Vegas Raiders": "lv",
    "Los Angeles Chargers": "lac",
    "Dallas Cowboys": "dal",
    "New York Giants": "nyg",
    "Philadelphia Eagles": "phi",
    "Washington Commanders": "was",
    "Chicago Bears": "chi",
    "Detroit Lions": "det",
    "Green Bay Packers": "gb",
    "Minnesota Vikings": "min",
    "Atlanta Falcons": "atl",
    "Carolina Panthers": "car",
    "New Orleans Saints": "no",
    "Tampa Bay Buccaneers": "tb",
    "Arizona Cardinals": "ari",
    "Los Angeles Rams": "lar",
    "San Francisco 49ers": "sf",
    "Seattle Seahawks": "sea",
  };

  const getLogo = (team) => {
    const abbr = teamToAbbr[team];
    if (!abbr) {
      console.warn("No logo found for:", team);
      return null;
    }
    return `/NFLTeamLogo/${abbr}.png`;
  };

  return (
    <div className="min-h-screen text-white p-6">
      <h1 className="fancy-title text-5xl">NFL EV Results</h1>

      <div className="flex justify-center mb-8">
        <div className="week-container">
          <select
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
            className="week-select"
          >
            <option value="">All Weeks</option>
            {weeks.map((w) => (
              <option key={w} value={w}>
                Week {w}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Game Buttons */}
      <div className="game-list mx-auto">
        {grouped.map(([gameName, entries]) => {
          const best = entries.reduce((a, b) => (a.ev > b.ev ? a : b));
          const home = entries.find((e) => e.isHome);
          const away = entries.find((e) => !e.isHome);

          return (
            <button
              key={gameName}
              className="game-btn"
              onClick={() => openModal(gameName, entries)}
            >
              <div className="team-logos">
                <div className="team-column">
                  <img
                    src={getLogo(home.team)}
                    alt={home.team}
                    className="team-logo"
                  />
                  <div className="score-final">
                    {home.expectedScore.split(" - ")[0]}
                  </div>
                </div>

                <div className="vs-text">vs</div>

                <div className="team-column">
                  <img
                    src={getLogo(away.team)}
                    alt={away.team}
                    className="team-logo"
                  />
                  <div className="score-final">
                    {away.expectedScore.split(" - ")[0]}
                  </div>
                </div>
              </div>

              <div className="game-btn__meta">
                <span className="chip win">
                  {Number(best.myProbPct).toFixed(1)}%
                </span>
                <span className="sep">•</span>
                <span className={best.ev > 0 ? "ev-positive" : "ev-negative"}>
                  EV: {best.ev}
                </span>
                <span className="sep">•</span>
                <span className="chip alt">{best.team}</span>
              </div>
            </button>
          );
        })}
        {!grouped.length && (
          <p className="text-center text-gray-300 col-span-full">
            No games found for that week.
          </p>
        )}
      </div>

      {/* Modal */}
      {modalOpen && activeGame && (
        <div className="modal-overlay" onClick={overlayClick}>
          <div className="modal">
            <div className="modal__header">
              <h2 className="modal__title">{activeGame.name}</h2>
              <button className="modal__close" onClick={closeModal}>
                ×
              </button>
            </div>

            <div className="modal__body">
              {activeGame.entries
                .slice()
                .sort((a, b) => b.ev - a.ev)
                .map((g, idx) => (
                  <div key={`${g.team}-${idx}`} className="team-card">
                    <div className="team-card__header">
                      <div className="team-card__team">{g.team}</div>
                      <div
                        className={`team-card__ev ${
                          g.ev > 0 ? "ev-positive" : "ev-negative"
                        }`}
                      >
                        EV: {g.ev}
                      </div>
                    </div>
                    <div className="team-card__grid">
                      <div>
                        <span className="muted">Odds:</span>{" "}
                        <b className="accent">{g.odds}</b>
                      </div>
                      <div>
                        <span className="muted">Our Prob:</span>{" "}
                        <b className="info">{g.myProbPct}%</b>
                      </div>
                      <div>
                        <span className="muted">DK Prob:</span>{" "}
                        <b className="pink">{g.dkImpliedPct}%</b>
                      </div>
                      <div>
                        <span className="muted">Week:</span>{" "}
                        <b className="indigo">{g.week}</b>
                      </div>
                      <div className="col-span-2">
                        <span className="muted">Expected Score:</span>{" "}
                        <b className="orange">{g.expectedScore}</b>
                      </div>
                      <div className="col-span-2">
                        <span className="muted">Spread:</span>{" "}
                        <b className="teal">
                          {g.predictedWinner} by {g.margin}
                        </b>
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            <div className="modal__footer">
              <button className="close-btn" onClick={closeModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

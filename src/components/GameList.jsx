// src/components/GameList.jsx
import { useEffect, useState } from "react";

export default function GameList() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchGames() {
      try {
        const res = await fetch("/api/games"); // proxied to backend
        const data = await res.json();
        setGames(data);
      } catch (err) {
        console.error("❌ Failed to fetch games:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchGames();
  }, []);

  if (loading) return <p>Loading games...</p>;

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">NFL EV Results</h2>
      {games.map((g, i) => (
        <div key={i} className="border rounded p-2 mb-2 shadow">
          <p className="font-semibold">{g.game}</p>
          <p>
            <span className="text-blue-600">{g.team}</span> vs{" "}
            <span className="text-red-600">{g.opponent}</span>
          </p>
          <p>Odds: {g.odds}</p>
          <p>Our Probability: {g.myProbPct}%</p>
          <p>DraftKings Probability: {g.dkImpliedPct}%</p>
          <p>
            EV:{" "}
            <span
              className={
                g.positiveEV ? "text-green-600 font-bold" : "text-red-600"
              }
            >
              {g.ev}
            </span>
          </p>
        </div>
      ))}
    </div>
  );
}

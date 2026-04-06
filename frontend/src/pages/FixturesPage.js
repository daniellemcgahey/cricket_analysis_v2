// src/pages/FixturesPage.js
import React, { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../theme/ThemeContext";
import { useLanguage } from "../language/LanguageContext";

const API_BASE = "http://127.0.0.1:8001"; // adjust if needed

const FixturesPage = () => {
  const { user } = useAuth();
  const theme = useTheme();
  const { t } = useLanguage();

  // Try to read from user/theme; fall back to Brazil Women as default
  const countryId = user?.countryId;
  const teamCategory = user?.teamCategory || theme.teamCategory || "Women";

  const [fixtures, setFixtures] = useState([]);
  const [loadingFixtures, setLoadingFixtures] = useState(false);

  const [opponents, setOpponents] = useState([]);
  const [loadingOpponents, setLoadingOpponents] = useState(false);

  const [tournaments, setTournaments] = useState([]);
  const [loadingTournaments, setLoadingTournaments] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    fixture_date: "",
    opponent_country_id: "",
    tournament_id: "",
    time_of_day: "Day",
    ground_name: "",
  });

  const isAdmin = user?.role === "admin";

  // ---- Load fixtures ----
  const loadFixtures = async () => {
    setLoadingFixtures(true);
    setError("");
    try {
      const params = new URLSearchParams({
        country_id: countryId.toString(),
        team_category: teamCategory,
        include_past: "false",
      });
      const res = await fetch(`${API_BASE}/fixtures?${params.toString()}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setFixtures(data || []);
    } catch (err) {
      console.error(err);
      setError(t("fixtures.errors.loadFixtures"));
    } finally {
      setLoadingFixtures(false);
    }
  };

  // ---- Load opponent options (countries) ----
  const loadOpponents = async () => {
    setLoadingOpponents(true);
    setError("");
    try {
      const params = new URLSearchParams({
        country_id: countryId.toString(),
        team_category: teamCategory,
      });
      const res = await fetch(
        `${API_BASE}/fixtures/opponent-options?${params.toString()}`
      );
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();

      // data is [{ country_id, country_name }, ...]
      setOpponents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError(t("fixtures.errors.loadOpponents"));
    } finally {
      setLoadingOpponents(false);
    }
  };

  // ---- Load tournament options ----
  const loadTournaments = async () => {
    setLoadingTournaments(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/fixtures/tournament-options`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setTournaments(data || []);
    } catch (err) {
      console.error(err);
      setError(t("fixtures.errors.loadTournaments"));
    } finally {
      setLoadingTournaments(false);
    }
  };

  useEffect(() => {
    loadFixtures();
    loadOpponents();
    loadTournaments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.fixture_date || !form.opponent_country_id) {
      setError(t("fixtures.validation.dateAndOpponent"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        country_id: countryId,
        team_category: teamCategory,
        tournament_id: form.tournament_id ? Number(form.tournament_id) : null,
        opponent_country_id: Number(form.opponent_country_id),
        fixture_date: form.fixture_date || null,
        time_of_day: form.time_of_day || null,
        ground_name: form.ground_name || null,
      };
      const res = await fetch(`${API_BASE}/fixtures/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed");
      await loadFixtures();
      setForm({
        fixture_date: "",
        opponent_country_id: "",
        tournament_id: "",
        time_of_day: "Day",
        ground_name: "",
      });
    } catch (err) {
      console.error(err);
      setError(t("fixtures.errors.createFixture"));
    } finally {
      setSaving(false);
    }
  };

  // ---- Add new opponent team ----
  const handleAddOpponent = async () => {
    const baseName = window.prompt(t("fixtures.prompts.addOpponent"));
    if (!baseName || !baseName.trim()) return;

    try {
      const payload = {
        base_name: baseName.trim(),
        team_category: teamCategory,
      };
      const res = await fetch(`${API_BASE}/fixtures/add-country`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed");
      const newCountry = await res.json();
      setOpponents((prev) => [...prev, newCountry]);
      setForm((prev) => ({
        ...prev,
        opponent_country_id: String(newCountry.country_id),
      }));
    } catch (err) {
      console.error(err);
      setError(t("fixtures.errors.addOpponent"));
    }
  };

  // ---- Add new tournament ----
  const handleAddTournament = async () => {
    const name = window.prompt(t("fixtures.prompts.addTournament"));
    if (!name || !name.trim()) return;

    try {
      const payload = { tournament_name: name.trim() };
      const res = await fetch(`${API_BASE}/fixtures/add-tournament`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed");
      const newTournament = await res.json();
      setTournaments((prev) => [...prev, newTournament]);
      setForm((prev) => ({
        ...prev,
        tournament_id: String(newTournament.tournament_id),
      }));
    } catch (err) {
      console.error(err);
      setError(t("fixtures.errors.addTournament"));
    }
  };

  // ---- Group fixtures by month for simple calendar-style list ----
  const groupedByMonth = fixtures.reduce((acc, fx) => {
    const month = fx.fixture_date?.slice(0, 7) || "Unknown";
    if (!acc[month]) acc[month] = [];
    acc[month].push(fx);
    return acc;
  }, {});

  if (!isAdmin) {
    return (
      <div className="alert alert-warning">
        {t("fixtures.adminOnly")}
      </div>
    );
  }

  return (
    <div>
      <h3 className="mb-3">{t("fixtures.title")}</h3>
      <p style={{ fontSize: "0.9rem", color: theme.textSecondary }}>
        {t("fixtures.description")}
      </p>

      {error && (
        <div className="alert alert-danger py-2" style={{ fontSize: "0.85rem" }}>
          {error}
        </div>
      )}

      <div className="row">
        {/* Left: fixture input */}
        <div className="col-md-5 mb-4">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title mb-2">
                {t("fixtures.addFixtureTitle")}
              </h5>
              <div
                className="mb-3"
                style={{
                  width: 40,
                  height: 3,
                  borderRadius: 999,
                  backgroundColor: theme.accentColor,
                }}
              />
              <form onSubmit={handleCreate} className="d-grid gap-3">
                <div>
                  <label className="form-label small">
                    {t("fixtures.labels.date")}
                  </label>
                  <input
                    type="date"
                    name="fixture_date"
                    className="form-control form-control-sm"
                    value={form.fixture_date}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <div className="d-flex justify-content-between align-items-center">
                    <label className="form-label small mb-1">
                      {t("fixtures.labels.opponent")}
                    </label>
                    <button
                      type="button"
                      onClick={handleAddOpponent}
                      className="btn btn-sm d-inline-flex align-items-center"
                      style={{
                        fontSize: "0.7rem",
                        borderRadius: 999,
                        padding: "2px 10px",
                        border: `1px solid ${theme.accentColor}`,
                        background: "transparent",
                        color: theme.accentColor,
                        fontWeight: 600,
                      }}
                    >
                      {t("fixtures.buttons.addOpponent")}
                    </button>
                  </div>
                  <select
                    name="opponent_country_id"
                    className="form-select form-select-sm"
                    value={form.opponent_country_id}
                    onChange={handleChange}
                  >
                    <option value="">
                      {loadingOpponents
                        ? t("fixtures.placeholders.loadingTeams")
                        : t("fixtures.placeholders.selectOpponent")}
                    </option>
                    {opponents.map((c) => (
                      <option key={c.country_id} value={c.country_id}>
                        {c.country_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="d-flex justify-content-between align-items-center">
                    <label className="form-label small mb-1">
                      {t("fixtures.labels.tournament")}
                    </label>
                    <button
                      type="button"
                      onClick={handleAddTournament}
                      className="btn btn-sm d-inline-flex align-items-center"
                      style={{
                        fontSize: "0.7rem",
                        borderRadius: 999,
                        padding: "2px 10px",
                        border: `1px solid ${theme.accentColor}`,
                        background: "transparent",
                        color: theme.accentColor,
                        fontWeight: 600,
                      }}
                    >
                      {t("fixtures.buttons.addTournament")}
                    </button>

                  </div>
                  <select
                    name="tournament_id"
                    className="form-select form-select-sm"
                    value={form.tournament_id}
                    onChange={handleChange}
                  >
                    <option value="">
                      {loadingTournaments
                        ? t("fixtures.placeholders.loadingTournaments")
                        : t("fixtures.placeholders.selectTournamentOptional")}
                    </option>
                    {tournaments.map((tmt) => (
                      <option
                        key={tmt.tournament_id}
                        value={tmt.tournament_id}
                      >
                        {tmt.tournament_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label small">
                    {t("fixtures.labels.timeOfDay")}
                  </label>
                  <select
                    name="time_of_day"
                    className="form-select form-select-sm"
                    value={form.time_of_day}
                    onChange={handleChange}
                  >
                    <option value="Day">
                      {t("fixtures.timeOfDay.day")}
                    </option>
                    <option value="D/N">
                      {t("fixtures.timeOfDay.dayNight")}
                    </option>
                    <option value="Night">
                      {t("fixtures.timeOfDay.night")}
                    </option>
                  </select>
                </div>

                <div>
                  <label className="form-label small">
                    {t("fixtures.labels.ground")}
                  </label>
                  <input
                    type="text"
                    name="ground_name"
                    className="form-control form-control-sm"
                    value={form.ground_name}
                    onChange={handleChange}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-sm"
                  disabled={saving}
                  style={{
                    backgroundColor: theme.accentColor,
                    borderColor: theme.accentColor,
                    color: "#000",
                    fontWeight: 600,
                  }}
                >
                  {saving
                    ? t("fixtures.buttons.saving")
                    : t("fixtures.buttons.addFixture")}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Right: upcoming fixtures list */}
        <div className="col-md-7 mb-4">
          <div className="card h-100">
            <div className="card-body d-flex flex-column">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h5 className="card-title mb-0">
                  {t("fixtures.upcomingTitle")}
                </h5>
                {loadingFixtures && (
                  <span
                    style={{ fontSize: "0.8rem", color: theme.textSecondary }}
                  >
                    {t("fixtures.loadingFixtures")}
                  </span>
                )}
              </div>
              <div
                className="mb-3"
                style={{
                  width: 40,
                  height: 3,
                  borderRadius: 999,
                  backgroundColor: theme.accentColor,
                }}
              />

              {fixtures.length === 0 && !loadingFixtures && (
                <p
                  style={{ fontSize: "0.9rem", color: theme.textSecondary }}
                >
                  {t("fixtures.noUpcoming")}
                </p>
              )}

              <div
                className="flex-grow-1"
                style={{ overflowY: "auto", maxHeight: 420 }}
              >
                {Object.entries(groupedByMonth).map(([month, items]) => {
                  const monthLabel =
                    month === "Unknown"
                      ? t("fixtures.unknownMonth")
                      : month;
                  return (
                    <div key={month} className="mb-3">
                      <div
                        className="mb-1"
                        style={{
                          fontSize: "0.8rem",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          color: theme.textSecondary,
                        }}
                      >
                        {monthLabel}
                      </div>
                      <ul className="list-unstyled mb-0">
                        {items.map((fx) => (
                          <li
                            key={fx.fixture_id}
                            className="d-flex justify-content-between align-items-center py-1 border-bottom border-secondary-subtle"
                            style={{ fontSize: "0.85rem" }}
                          >
                            <div>
                              <div>{fx.fixture_date || t("fixtures.tbc")}</div>
                              <div
                                style={{
                                  fontSize: "0.8rem",
                                  opacity: 0.85,
                                }}
                              >
                                {t("fixtures.vs")}{" "}
                                <strong>{fx.opponent_name}</strong>{" "}
                                {fx.ground_name
                                  ? `${t("fixtures.at")} ${fx.ground_name}`
                                  : ""}
                              </div>
                            </div>
                            <span
                              style={{
                                fontSize: "0.7rem",
                                padding: "2px 8px",
                                borderRadius: 999,
                                border: `1px solid ${theme.accentColor}`,
                              }}
                            >
                              {fx.time_of_day || t("fixtures.timeOfDay.day")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>

              <p
                className="mt-3 mb-0"
                style={{ fontSize: "0.8rem", color: theme.textSecondary }}
              >
                {t("fixtures.footerNote")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FixturesPage;

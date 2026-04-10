// src/pages/HomeDashboard.js
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../theme/ThemeContext";
import { useLanguage } from "../language/LanguageContext";

const API_BASE = process.env.REACT_APP_API_BASE_URL;

const HomeDashboard = () => {
  const { user } = useAuth();
  const theme = useTheme();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [nextFixture, setNextFixture] = useState(null);
  const [loadingFixture, setLoadingFixture] = useState(false);
  const [fixtureError, setFixtureError] = useState("");

  const [lastMatch, setLastMatch] = useState(null);
  const [loadingLastMatch, setLoadingLastMatch] = useState(false);
  const [lastMatchError, setLastMatchError] = useState("");

  const countryId = user?.countryId;
  const teamCategory = user?.teamCategory || theme.teamCategory || "Women";

  // ---- Load next fixture ----
  useEffect(() => {
    if (countryId == null || !teamCategory) {
      setNextFixture(null);
      return;
    }

    const fetchNextFixture = async () => {
      setLoadingFixture(true);
      setFixtureError("");
      try {
        const params = new URLSearchParams({
          country_id: String(countryId),
          team_category: teamCategory,
        });

        const res = await fetch(
          `${API_BASE}/fixtures/next?${params.toString()}`
        );
        if (!res.ok) throw new Error("Failed to load next fixture");
        const data = await res.json(); // null or fixture object
        setNextFixture(data);
      } catch (err) {
        setFixtureError(err.message || "Error loading next fixture");
        setNextFixture(null);
      } finally {
        setLoadingFixture(false);
      }
    };

    fetchNextFixture();
  }, [countryId, teamCategory]);

  // ---- Load last match ----
  useEffect(() => {
    if (countryId == null || !teamCategory) {
      setLastMatch(null);
      return;
    }

    const fetchLastMatch = async () => {
      setLoadingLastMatch(true);
      setLastMatchError("");
      try {
        const params = new URLSearchParams({
          country_id: String(countryId),
          team_category: teamCategory,
        });

        const res = await fetch(
          `${API_BASE}/team-last-match?${params.toString()}`
        );
        if (!res.ok) throw new Error("Failed to load last match");
        const data = await res.json();

        if (data && data.status === "ok") {
          setLastMatch(data);
        } else {
          setLastMatch(null);
        }
      } catch (err) {
        setLastMatchError(err.message || "Error loading last match");
        setLastMatch(null);
      } finally {
        setLoadingLastMatch(false);
      }
    };

    fetchLastMatch();
  }, [countryId, teamCategory]);

  const handleViewLastMatch = () => {
    if (!lastMatch || !lastMatch.match_id) return;
    // 🔧 Adjust this route to whatever your match analysis page expects
    navigate(`/match-analysis`);
  };

  return (
    <div>
      {/* Hero section */}
      <div
        className="mb-4 p-4 rounded-3 position-relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${theme.primaryColor}33, ${theme.accentColor}33)`,
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* subtle accent bar on the left */}
        <div
          className="position-absolute top-0 bottom-0"
          style={{
            left: 0,
            width: 4,
            background: `linear-gradient(to bottom, ${theme.accentColor}, ${theme.primaryColor})`,
          }}
        />

        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
          <div>

            <h2
              className="mb-2"
              style={{ color: "var(--color-text-primary)" }}
            >
              {theme.teamName}
            </h2>
            <p className="mb-0" style={{ maxWidth: 480 }}>
              {t("home.heroDescription")}
            </p>
          </div>

          <div className="text-end d-flex flex-column align-items-end gap-2">
            {theme.flagUrl && (
              <img
                src={theme.flagUrl}
                alt={t("home.teamFlagAlt") || "Team flag"}
                style={{
                  width: 56,
                  height: 36,
                  borderRadius: 6,
                  objectFit: "cover",
                  boxShadow: "0 0 10px rgba(0,0,0,0.6)",
                }}
              />
            )}
            <div
              className="px-2 py-1 rounded-pill"
              style={{
                fontSize: "0.8rem",
                backgroundColor: "rgba(0,0,0,0.4)",
                border: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              <span style={{ color: "var(--color-text-secondary)" }}>
                {t("home.modeLabel")}
              </span>{" "}
              <span style={{ color: theme.accentColor, fontWeight: 600 }}>
                {t("home.modeCoaching")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Cards row */}
      <div className="row g-3">
        {/* Next Fixture */}
        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-body d-flex flex-column">
              {/* Header */}
              <h5 className="card-title mb-1">
                {nextFixture
                  ? t("home.nextFixtureTitle")
                  : t("home.matchPreparationTitle")}
              </h5>
              <div
                className="mb-2"
                style={{
                  width: 40,
                  height: 3,
                  borderRadius: 999,
                  backgroundColor: theme.accentColor,
                }}
              />

              {/* Loading state */}
              {loadingFixture && (
                <p
                  className="card-text mb-1"
                  style={{ fontSize: "0.9rem", color: theme.textSecondary }}
                >
                  {t("home.nextFixtureLoading")}
                </p>
              )}

              {/* Error state */}
              {!loadingFixture && fixtureError && (
                <p
                  className="card-text mb-1 text-danger"
                  style={{ fontSize: "0.85rem" }}
                >
                  {fixtureError}
                </p>
              )}

              {/* Has next fixture */}
              {!loadingFixture && !fixtureError && nextFixture && (
                <>
                  <p
                    className="card-text mb-1"
                    style={{ fontSize: "0.9rem", color: theme.textPrimary }}
                  >
                    {t("home.vs")}{" "}
                    <strong>{nextFixture.opponent_name}</strong>
                  </p>
                  <p
                    className="card-text mb-1"
                    style={{ fontSize: "0.85rem", color: theme.textSecondary }}
                  >
                    {nextFixture.fixture_date || t("home.dateTbc")}
                    {nextFixture.ground_name
                      ? ` • ${nextFixture.ground_name}`
                      : ""}
                  </p>

                  <p
                    className="card-text"
                    style={{
                      fontSize: "0.85rem",
                      color: theme.textSecondary,
                    }}
                  >
                    {t("home.nextFixtureDescription")}
                  </p>
                </>
              )}

              {/* No fixture (and no error) */}
              {!loadingFixture && !fixtureError && !nextFixture && (
                <p
                  className="card-text"
                  style={{ fontSize: "0.85rem", color: theme.textSecondary }}
                >
                  {t("home.noUpcomingFixtures")}
                </p>
              )}

              {/* Coaches Hub button – always visible at the bottom */}
              <div className="mt-auto">
                <Link
                  to="/coaches"
                  className="btn btn-sm"
                  style={{
                    backgroundColor: theme.accentColor,
                    borderColor: theme.accentColor,
                    color: "#000",
                    fontWeight: 600,
                  }}
                >
                  {t("home.goToCoachesHubButton")}
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Last Match */}
        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-body d-flex flex-column">
              <h5 className="card-title mb-1">
                {t("home.lastFixtureTitle")}
              </h5>
              <div
                className="mb-2"
                style={{
                  width: 40,
                  height: 3,
                  borderRadius: 999,
                  backgroundColor: "var(--color-accent)",
                }}
              />

              {/* Loading / error / empty */}
              {loadingLastMatch && (
                <p
                  className="card-text mb-1"
                  style={{ fontSize: "0.9rem", color: theme.textSecondary }}
                >
                  {/* You can add a translation key later if you want */}
                  Loading last match…
                </p>
              )}

              {!loadingLastMatch && lastMatchError && (
                <p
                  className="card-text mb-1 text-danger"
                  style={{ fontSize: "0.85rem" }}
                >
                  {lastMatchError}
                </p>
              )}

              {!loadingLastMatch && !lastMatchError && !lastMatch && (
                <p
                  className="card-text mb-1"
                  style={{ fontSize: "0.9rem", color: theme.textSecondary }}
                >
                  {/* Again, can be moved to i18n later */}
                  No completed matches yet.
                </p>
              )}

              {!loadingLastMatch && !lastMatchError && lastMatch && (
                <>
                  <p className="card-text mb-1">
                    {t("home.vs")} <strong>{lastMatch.opponent}</strong>
                  </p>
                  <p className="card-text mb-1">{lastMatch.result}</p>
                  <p className="card-text mb-1">
                    <strong>{t("home.usLabel") || "Us:"}</strong>{" "}
                    {lastMatch.ourScore}
                    <br />
                    <strong>{t("home.themLabel") || "Them:"}</strong>{" "}
                    {lastMatch.theirScore}
                  </p>
                  <p
                    className="card-text mb-1"
                    style={{ fontSize: "0.85rem" }}
                  >
                    {t("home.lastFixtureDescription")}
                  </p>
                  <p>

                  </p>
                </>
              )}


              <div className="mt-auto">
                <button
                  className="btn btn-outline-light btn-sm"
                  type="button"                 
                  style={{
                    backgroundColor: theme.accentColor,
                    borderColor: theme.accentColor,
                    color: "#000",
                    fontWeight: 600,
                  }}
                  onClick={handleViewLastMatch}
                  disabled={!lastMatch || !lastMatch.match_id}
                >
                  {t("home.viewMatchAnalysisButton")}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-body d-flex flex-column">
              <h5 className="card-title">
                {t("home.quickLinksTitle")}
              </h5>
              <div
                className="mb-2"
                style={{
                  width: 40,
                  height: 3,
                  borderRadius: 999,
                  backgroundColor: "var(--color-accent)",
                }}
              />
              <ul className="list-unstyled mb-3" style={{ fontSize: "0.9rem" }}>
                <li className="mb-2">
                  <Link to="/coaches" className="text-decoration-none">
                    🧠 {t("home.quickLinkCoachesHub")}
                  </Link>
                </li>
                <li className="mb-2">
                  <span className="text-muted">
                    📊 {t("home.quickLinkPlayerAnalysis")}
                  </span>
                </li>
                <li className="mb-2">
                  <Link to="/tournaments" className="text-decoration-none">
                    🏆 {t("home.quickLinkTournamentSummary")}
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeDashboard;

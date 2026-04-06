import React, { useEffect, useState } from "react";
import { Accordion, Form } from "react-bootstrap";
import api from "../api";

const teamCategories = ["Men", "Women", "U19 Men", "U19 Women", "Training"];
const phases = ["Powerplay", "Middle Overs", "Death Overs"];
const bowlingArms = ["Left", "Right"];
const bowlerTypes = ["Pace", "Medium", "Off Spin", "Leg Spin"];
const battingHands = ["Left", "Right"];
const lengths = ["Full Toss", "Yorker", "Full", "Good", "Short"];


const PitchMapFilters = ({ filters, setFilters }) => {
  const [countries, setCountries] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    if (!filters.teamCategory) return;
      api.get("/countries", { params: { teamCategory: filters.teamCategory } })
        .then((res) => setCountries(res.data));

      api.get("/tournaments", { params: { teamCategory: filters.teamCategory } })
        .then((res) => setTournaments(res.data));

      api.get("/matches", { params: { teamCategory: filters.teamCategory } })
        .then((res) => setMatches(res.data));

  }, [filters.teamCategory]);

  const handleCheckboxChange = (field, value) => {
    setFilters(prev => {
      const current = prev[field];
      const updated = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];
      return { ...prev, [field]: updated };
    });
  };

  const handleMatchToggle = (matchId) => {
    setFilters(prev => {
      const updated = prev.selectedMatches.includes(matchId)
        ? prev.selectedMatches.filter((id) => id !== matchId)
        : [...prev.selectedMatches, matchId];
      return { ...prev, selectedMatches: updated };
    });
  };

  return (
    <Accordion alwaysOpen>
      {/* TEAM CATEGORY FILTER */}
      <Accordion.Item eventKey="0">
        <Accordion.Header>
          <h5 className="fw-bold m-0">Team Category</h5>
        </Accordion.Header>
        <Accordion.Body>
          <Form.Select
            value={filters.teamCategory}
            onChange={(e) => setFilters({ ...filters, teamCategory: e.target.value })}
          >
            {teamCategories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </Form.Select>
        </Accordion.Body>
      </Accordion.Item>

      {/* Country Selection */}
      <Accordion.Item eventKey="1">
        <Accordion.Header>
          <h5 className="fw-bold m-0">Country Selection</h5>
        </Accordion.Header>
        <Accordion.Body>
          <Form.Select
            className="mb-3"
            value={filters.country1}
            onChange={(e) => setFilters({ ...filters, country1: e.target.value })}
          >
            <option value="">Select Country 1</option>
            {countries.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Form.Select>
        </Accordion.Body>
      </Accordion.Item>

      {/* FILTERS with Nested Accordions */}
      <Accordion.Item eventKey="2">
        <Accordion.Header>
          <h5 className="fw-bold m-0">Filters</h5>
        </Accordion.Header>
        <Accordion.Body>
          <Accordion alwaysOpen>
            {/* Tournaments */}
            <Accordion.Item eventKey="1-0">
              <Accordion.Header>Tournaments</Accordion.Header>
              <Accordion.Body>
                {tournaments.map((t) => (
                  <Form.Check
                    key={t}
                    label={t}
                    type="checkbox"
                    checked={filters.tournaments.includes(t)}
                    onChange={() => handleCheckboxChange("tournaments", t)}
                  />
                ))}
              </Accordion.Body>
            </Accordion.Item>

            {/* Phases */}
            <Accordion.Item eventKey="1-1">
              <Accordion.Header>Phases</Accordion.Header>
              <Accordion.Body>
                {phases.map((p) => (
                  <Form.Check
                    key={p}
                    label={p}
                    type="checkbox"
                    checked={filters.selectedPhases.includes(p)}
                    onChange={() => handleCheckboxChange("selectedPhases", p)}
                  />
                ))}
              </Accordion.Body>
            </Accordion.Item>

            {/* Bowling Arm */}
            <Accordion.Item eventKey="1-2">
              <Accordion.Header>Bowling Arm</Accordion.Header>
              <Accordion.Body>
                {bowlingArms.map((arm) => (
                  <Form.Check
                    key={arm}
                    label={arm}
                    type="checkbox"
                    checked={filters.selectedBowlingArms.includes(arm)}
                    onChange={() => handleCheckboxChange("selectedBowlingArms", arm)}
                  />
                ))}
              </Accordion.Body>
            </Accordion.Item>

            {/* Bowler Type */}
            <Accordion.Item eventKey="1-3">
              <Accordion.Header>Bowling Style</Accordion.Header>
              <Accordion.Body>
                {bowlerTypes.map((type) => (
                  <Form.Check
                    key={type}
                    label={type}
                    type="checkbox"
                    checked={filters.selectedBowlerTypes.includes(type)}
                    onChange={() => handleCheckboxChange("selectedBowlerTypes", type)}
                  />
                ))}
              </Accordion.Body>
            </Accordion.Item>

            {/* Batting Hand */}
            <Accordion.Item eventKey="1-4">
              <Accordion.Header>Batting Hand</Accordion.Header>
              <Accordion.Body>
                {battingHands.map((hand) => (
                  <Form.Check
                    key={hand}
                    label={hand}
                    type="checkbox"
                    checked={filters.selectedBattingHands.includes(hand)}
                    onChange={() => handleCheckboxChange("selectedBattingHands", hand)}
                  />
                ))}
              </Accordion.Body>
            </Accordion.Item>
            {/* Length */}
            <Accordion.Item eventKey="1-5">
            <Accordion.Header>Length</Accordion.Header>
            <Accordion.Body>
                {lengths.map((length) => (
                <Form.Check
                    key={length}
                    label={length}
                    type="checkbox"
                    checked={filters.selectedLengths.includes(length)}
                    onChange={() => handleCheckboxChange("selectedLengths", length)}
                />
                ))}
            </Accordion.Body>
            </Accordion.Item>

          </Accordion>
        </Accordion.Body>
      </Accordion.Item>

      {/* MATCH SELECTION */}
      <Accordion.Item eventKey="3">
        <Accordion.Header>
          <h5 className="fw-bold m-0">Match Selection</h5>
        </Accordion.Header>
        <Accordion.Body>
          <Form.Check
            className="mb-2"
            type="checkbox"
            label="Select All Matches"
            checked={filters.allMatchesSelected}
            onChange={(e) =>
              setFilters({ ...filters, allMatchesSelected: e.target.checked, selectedMatches: [] })
            }
          />
          {!filters.allMatchesSelected && (
            <div style={{ maxHeight: "150px", overflowY: "auto" }}>
              {matches.map((match) => (
                <Form.Check
                  key={match.match_id}
                  type="checkbox"
                  label={`${match.tournament}: ${match.team_a} vs ${match.team_b} (${match.match_date})`}
                  checked={filters.selectedMatches.includes(match.match_id)}
                  onChange={() => handleMatchToggle(match.match_id)}
                />
              ))}
            </div>
          )}
        </Accordion.Body>
      </Accordion.Item>
    </Accordion>
  );
};

export default PitchMapFilters;

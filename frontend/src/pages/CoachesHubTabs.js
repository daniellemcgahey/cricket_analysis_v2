// src/pages/CoachesHubTabs.jsx
import React, { useContext } from "react";
import { Tabs, Tab } from "react-bootstrap";
import DarkModeContext from "../DarkModeContext";
import BackButton from "../components/BackButton";

import PreGame from "./PreGame";
import PostGame from "./PostGame";
import PostTournament from "./PostTournament";
import Training from "./Training";

import "./TabStyles.css"; // keep your custom tab styling

const CoachesHubTabs = () => {
  const { isDarkMode } = useContext(DarkModeContext);
  const containerClass = isDarkMode ? "bg-dark text-white" : "bg-light text-dark";

  return (
    <div className={containerClass} style={{ minHeight: "100vh" }}>
      <div className="mb-3 custom-tabs nav-pills">
        <BackButton isDarkMode={isDarkMode} />

        <div
          className="comparison-heading-wrapper mb-4 text-center"
          style={{
            backgroundColor: "#ffcc29",
            padding: "5px",
            borderRadius: "10px",
          }}
        >
          <h2 className="fw-bold display-4" style={{ color: "#1b5e20" }}>
            Coaches Hub
          </h2>
        </div>

        <Tabs
          defaultActiveKey="pre"
          className="mb-3"
          fill
          variant={isDarkMode ? "dark" : "tabs"}
        >
          <Tab eventKey="pre" title="Pre-game">
            <PreGame />
          </Tab>
          <Tab eventKey="post" title="Post-game">
            <PostGame />
          </Tab>
          <Tab eventKey="posttournament" title="Post-Tournament">
            <PostTournament />
          </Tab>
          <Tab eventKey="training" title="Training">
            <Training />
          </Tab>
        </Tabs>
      </div>
    </div>
  );
};

export default CoachesHubTabs;

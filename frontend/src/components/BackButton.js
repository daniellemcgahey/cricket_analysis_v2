// src/components/BackButton.js
import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "react-bootstrap";

const BackButton = ({ isDarkMode }) => {
  const navigate = useNavigate();
  return (
    <div style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 1000 }}>
        <Button
            variant={isDarkMode ? "outline-light" : "outline-dark"}
            onClick={() => navigate(-1)}
        >
            ← Back
        </Button>
    </div>
  );
};

export default BackButton;

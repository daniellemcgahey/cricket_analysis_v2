import React from "react";
import { ButtonGroup, ToggleButton } from "react-bootstrap";

const BattingBowlingToggle = ({ selected, onChange }) => {
  const options = ["Batting", "Bowling"];

  return (
    <ButtonGroup className="mb-3">
      {options.map((value, idx) => (
        <ToggleButton
          key={idx}
          id={`toggle-${value.toLowerCase()}`}
          type="radio"
          variant="outline-primary"
          name="batbowl"
          value={value}
          checked={selected === value}
          onChange={(e) => onChange(e.currentTarget.value)}
        >
          {value}
        </ToggleButton>
      ))}
    </ButtonGroup>
  );
};

export default BattingBowlingToggle;

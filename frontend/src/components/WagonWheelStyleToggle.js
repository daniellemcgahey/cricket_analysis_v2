import React from "react";
import { ButtonGroup, ToggleButton } from "react-bootstrap";

const WagonWheelStyleToggle = ({ selected, onChange }) => {
  const options = ["Lines", "Zones"];

  return (
    <div className="mb-4 text-center">
      <ButtonGroup>
        {options.map((val, idx) => (
          <ToggleButton
            key={idx}
            id={`radio-${val}`}
            type="radio"
            variant={selected === val ? "primary" : "outline-primary"}
            name="radio"
            value={val}
            checked={selected === val}
            onChange={(e) => onChange(e.currentTarget.value)}
          >
            {val}
          </ToggleButton>
        ))}
      </ButtonGroup>
    </div>
  );
};

export default WagonWheelStyleToggle;

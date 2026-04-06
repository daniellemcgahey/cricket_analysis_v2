import React from "react";
import { Row, Col, Badge } from "react-bootstrap";

const medalVariant = (m) => ({
  Platinum: "primary",
  Gold: "warning",
  Silver: "secondary",
  Bronze: "danger",
  None: "light",
}[m] || "light");

export default function KpiMedalGridRB({ kpis = [], isDarkMode }) {
  return (
    <Row className="g-3">
      {kpis.map((k, i) => (
        <Col md={6} key={i}>
          <div className={`rounded p-3 shadow-sm d-flex justify-content-between align-items-start ${isDarkMode ? "bg-dark text-white border" : "bg-white text-dark border"}`}>
            <div>
              <div className="fw-semibold">{k.name}</div>
              <div className="small opacity-75">
                Target: {typeof k.targets === "string" ? k.targets : JSON.stringify(k.targets)}
              </div>
            </div>
            <div className="text-end">
              <div className="fw-bold">{k.actual}</div>
              <Badge bg={medalVariant(k.medal)}>{k.medal}</Badge>
            </div>
          </div>
        </Col>
      ))}
    </Row>
  );
}

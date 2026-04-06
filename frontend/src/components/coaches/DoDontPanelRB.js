import React from "react";
import { Row, Col, ListGroup } from "react-bootstrap";

export default function DoDontPanelRB({ dos = [], donts = [], isDarkMode }) {
  const cardClass = `rounded p-3 shadow-sm ${isDarkMode ? "bg-dark text-white border" : "bg-white text-dark border"}`;
  return (
    <Row className="g-3">
      <Col md={6}>
        <div className={cardClass}>
          <div className="h6 mb-2">✅ Do</div>
          <ListGroup variant={isDarkMode ? "dark" : ""}>
            {dos.map((d, i) => <ListGroup.Item key={i} className={isDarkMode ? "bg-dark text-white" : ""}>{d}</ListGroup.Item>)}
          </ListGroup>
        </div>
      </Col>
      <Col md={6}>
        <div className={cardClass}>
          <div className="h6 mb-2">❌ Don’t</div>
          <ListGroup variant={isDarkMode ? "dark" : ""}>
            {donts.map((d, i) => <ListGroup.Item key={i} className={isDarkMode ? "bg-dark text-white" : ""}>{d}</ListGroup.Item>)}
          </ListGroup>
        </div>
      </Col>
    </Row>
  );
}

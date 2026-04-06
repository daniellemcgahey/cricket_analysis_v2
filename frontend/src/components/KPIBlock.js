// src/components/KPIBlock.js
const KPIBlock = ({ label, value, icon, suffix }) => {
  return (
    <div
      className="p-3 rounded-2"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 13, opacity: 0.6 }}>{label}</div>
        {icon}
      </div>

      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, display: "flex", alignItems: "center" }}>
        {value}
        {suffix && <span style={{ marginLeft: 6 }}>{suffix}</span>}
      </div>
    </div>
  );
};

export default KPIBlock;

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAllShipments } from "../../services/api";

const STATUS_CONFIG = {
  IN_TRANSIT: { className: "status-transit", label: "In Transit" },
  AT_PORT: { className: "status-transit", label: "At Port" },
  IN_CUSTOMS: { className: "status-pending", label: "In Customs" },
  DELAYED: { className: "status-rejected", label: "Delayed" },
  DELIVERED: { className: "status-cleared", label: "Delivered" },
  CREATED: { className: "status-pending", label: "Created" },
};

export default function WatchlistPanel({ title = "Priority Watchlist", subtitle = "Highest-risk active shipments" }) {
  const [shipments, setShipments] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const loadShipments = () => {
      getAllShipments()
        .then((response) => setShipments(response.data || []))
        .catch(() => setShipments([]));
    };

    loadShipments();
    const interval = setInterval(loadShipments, 5000);
    return () => clearInterval(interval);
  }, []);

  const featured = useMemo(() => {
    return [...shipments]
      .filter((shipment) => shipment.status !== "DELIVERED")
      .sort((a, b) => (b.delayRiskScore || 0) - (a.delayRiskScore || 0))
      .slice(0, 6);
  }, [shipments]);

  return (
    <div className="card">
      <div className="card-header">📋 {title}</div>
      <div className="portal-section-copy">{subtitle}</div>
      <div className="shipment-list" style={{ marginTop: 12 }}>
        {featured.length === 0 ? (
          <div className="portal-empty">No active watchlist shipments right now.</div>
        ) : (
          featured.map((shipment) => {
            const status = STATUS_CONFIG[shipment.status] || STATUS_CONFIG.CREATED;
            return (
              <button
                key={shipment.shipmentId}
                className="shipment-row portal-row-button"
                onClick={() => navigate(`/shipments/${shipment.shipmentId}`)}
              >
                <div>
                  <div className="ship-id">{shipment.shipmentId}</div>
                  <div className="ship-route">
                    <span>{shipment.origin}</span> to <span>{shipment.destination}</span>
                  </div>
                  <div className="portal-row-meta">
                    {shipment.carrier} · Risk {Math.round((shipment.delayRiskScore || 0) * 100)}%
                  </div>
                </div>
                <span className={`status ${status.className}`}>{status.label}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

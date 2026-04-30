// fabricService.js — MOCK ONLY (no Fabric needed)
const { v4: uuidv4 } = require("uuid");

let ledger = [
  {
    shipmentId: "SHP-001", containerId: "CONT-ABC123", origin: "Shanghai, CN", destination: "Rotterdam, NL", carrier: "OceanFreight Co", shipper: "Org1MSP", currentHolder: "Org1MSP", status: "IN_TRANSIT", cargoType: "Electronics", weightKg: 14200, createdAt: "2024-01-15T08:00:00Z", estimatedArrival: "2024-03-15T00:00:00Z", actualArrival: null, delayRiskScore: 0.71,
    events: [
      { eventId: "EVT-001-1", eventType: "SHIPMENT_CREATED", location: "Shanghai, CN", actor: "Org1MSP", timestamp: "2024-01-15T08:00:00Z", description: "Shipment created", txId: "tx_abc001" },
      { eventId: "EVT-001-2", eventType: "DEPARTED_PORT", location: "Shanghai Port", actor: "Org1MSP", timestamp: "2024-01-16T10:00:00Z", description: "Vessel MSC Beatrice departed", txId: "tx_abc002" },
    ]
  },
  {
    shipmentId: "SHP-002", containerId: "CONT-XYZ789", origin: "Mumbai, IN", destination: "Felixstowe, UK", carrier: "GlobalShip Ltd", shipper: "Org2MSP", currentHolder: "Org2MSP", status: "AT_PORT", cargoType: "Textiles", weightKg: 9800, createdAt: "2024-01-20T10:00:00Z", estimatedArrival: "2024-03-28T00:00:00Z", actualArrival: null, delayRiskScore: 0.85,
    events: [
      { eventId: "EVT-002-1", eventType: "SHIPMENT_CREATED", location: "Mumbai, IN", actor: "Org2MSP", timestamp: "2024-01-20T10:00:00Z", description: "Shipment registered", txId: "tx_xyz001" },
      { eventId: "EVT-002-2", eventType: "DEPARTED_PORT", location: "Nhava Sheva, Mumbai", actor: "Org2MSP", timestamp: "2024-01-22T06:00:00Z", description: "Vessel departed", txId: "tx_xyz002" },
      { eventId: "EVT-002-3", eventType: "ARRIVED_PORT", location: "Port Said, Egypt", actor: "Org2MSP", timestamp: "2024-01-29T14:30:00Z", description: "Arrived at transit port", txId: "tx_xyz003" },
    ]
  },
  {
    shipmentId: "SHP-003", containerId: "CONT-SG003", origin: "Singapore", destination: "Los Angeles, US", carrier: "MarineX", shipper: "Org1MSP", currentHolder: "Org1MSP", status: "IN_TRANSIT", cargoType: "Machinery", weightKg: 22000, createdAt: "2024-02-01T09:00:00Z", estimatedArrival: "2024-04-02T00:00:00Z", actualArrival: null, delayRiskScore: 0.34,
    events: [
      { eventId: "EVT-003-1", eventType: "SHIPMENT_CREATED", location: "Singapore", actor: "Org1MSP", timestamp: "2024-02-01T09:00:00Z", description: "Heavy lift equipment containerised", txId: "tx_sg001" },
      { eventId: "EVT-003-2", eventType: "DEPARTED_PORT", location: "Singapore Port", actor: "Org1MSP", timestamp: "2024-02-03T12:00:00Z", description: "Vessel departed for LA", txId: "tx_sg002" },
    ]
  },
  {
    shipmentId: "SHP-004", containerId: "CONT-DU004", origin: "Dubai, UAE", destination: "Hamburg, DE", carrier: "AquaLine", shipper: "Org2MSP", currentHolder: "Org2MSP", status: "DELIVERED", cargoType: "Food", weightKg: 6500, createdAt: "2024-01-10T07:00:00Z", estimatedArrival: "2024-02-20T00:00:00Z", actualArrival: "2024-02-18T14:00:00Z", delayRiskScore: 0.12,
    events: [
      { eventId: "EVT-004-1", eventType: "SHIPMENT_CREATED", location: "Dubai, UAE", actor: "Org2MSP", timestamp: "2024-01-10T07:00:00Z", description: "Perishable goods loaded", txId: "tx_du001" },
      { eventId: "EVT-004-2", eventType: "DEPARTED_PORT", location: "Jebel Ali Port", actor: "Org2MSP", timestamp: "2024-01-12T08:00:00Z", description: "Reefer containers departed", txId: "tx_du002" },
      { eventId: "EVT-004-3", eventType: "CUSTOMS_CLEARED", location: "Hamburg, DE", actor: "Org2MSP", timestamp: "2024-02-18T10:00:00Z", description: "Customs cleared", txId: "tx_du003" },
      { eventId: "EVT-004-4", eventType: "DELIVERED", location: "Hamburg, DE", actor: "Org2MSP", timestamp: "2024-02-18T14:00:00Z", description: "Delivered to consignee", txId: "tx_du004" },
    ]
  },
  {
    shipmentId: "SHP-005", containerId: "CONT-BS005", origin: "Busan, KR", destination: "Rotterdam, NL", carrier: "SeaRoute Express", shipper: "Org1MSP", currentHolder: "Org1MSP", status: "DELAYED", cargoType: "Chemicals", weightKg: 11000, createdAt: "2024-01-25T11:00:00Z", estimatedArrival: "2024-03-10T00:00:00Z", actualArrival: null, delayRiskScore: 0.91,
    events: [
      { eventId: "EVT-005-1", eventType: "SHIPMENT_CREATED", location: "Busan, KR", actor: "Org1MSP", timestamp: "2024-01-25T11:00:00Z", description: "Hazmat class 3 registered", txId: "tx_bs001" },
      { eventId: "EVT-005-2", eventType: "DEPARTED_PORT", location: "Busan Port", actor: "Org1MSP", timestamp: "2024-01-27T09:00:00Z", description: "Vessel departed", txId: "tx_bs002" },
      { eventId: "EVT-005-3", eventType: "DELAY_REPORTED", location: "South China Sea", actor: "Org1MSP", timestamp: "2024-02-05T16:00:00Z", description: "Storm — rerouted, ETA +8 days", txId: "tx_bs003" },
    ]
  },
  {
    shipmentId: "SHP-006", containerId: "CONT-LA006", origin: "Los Angeles, US", destination: "Tokyo, JP", carrier: "MarineX", shipper: "Org3MSP", currentHolder: "Org3MSP", status: "IN_TRANSIT", cargoType: "General", weightKg: 8000, createdAt: "2024-02-10T06:00:00Z", estimatedArrival: "2024-03-20T00:00:00Z", actualArrival: null, delayRiskScore: 0.22,
    events: [
      { eventId: "EVT-006-1", eventType: "SHIPMENT_CREATED", location: "Los Angeles, US", actor: "Org3MSP", timestamp: "2024-02-10T06:00:00Z", description: "Shipment created by Org3", txId: "tx_la001" },
      { eventId: "EVT-006-2", eventType: "DEPARTED_PORT", location: "Port of LA", actor: "Org3MSP", timestamp: "2024-02-12T09:00:00Z", description: "Vessel departed for Tokyo", txId: "tx_la002" },
    ]
  },
];

const history = {};
ledger.forEach(s => {
  history[s.shipmentId] = [{ txId: "tx_genesis_" + s.shipmentId, timestamp: { seconds: Math.floor(new Date(s.createdAt).getTime() / 1000) }, isDelete: false, value: { ...s } }];
});

function find(id) {
  const s = ledger.find(x => x.shipmentId === id);
  if (!s) throw new Error(`Shipment ${id} does not exist`);
  return s;
}

function normalizeIntegrityPayload(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeIntegrityPayload);
  }

  if (value && typeof value === "object") {
    const normalized = {};

    Object.keys(value)
      .filter((key) => !["meta", "_id", "__v"].includes(key))
      .sort()
      .forEach((key) => {
        normalized[key] = normalizeIntegrityPayload(value[key]);
      });

    return normalized;
  }

  return value;
}

const STATUS_MAP = { DEPARTED_PORT: "IN_TRANSIT", ARRIVED_PORT: "AT_PORT", CUSTOMS_ENTRY: "IN_CUSTOMS", CUSTOMS_CLEARED: "IN_TRANSIT", DELIVERED: "DELIVERED" };

module.exports = {
  async createShipment(data) {
    const { shipmentId, containerId, origin, destination, carrier, cargoType, weightKg, estimatedArrival } = data;
    const now = new Date().toISOString();
    const s = {
      shipmentId, containerId, origin, destination, carrier, shipper: "Org1MSP", currentHolder: "Org1MSP", status: "CREATED", cargoType, weightKg, createdAt: now, estimatedArrival, actualArrival: null, delayRiskScore: 0,
      events: [{ eventId: `EVT-${shipmentId}-1`, eventType: "SHIPMENT_CREATED", location: origin, actor: "Org1MSP", timestamp: now, description: "Shipment created on blockchain (mock ledger)", txId: `tx_${uuidv4().slice(0, 8)}` }]
    };
    ledger.push(s);
    history[shipmentId] = [{ txId: `tx_${uuidv4().slice(0, 8)}`, timestamp: { seconds: Math.floor(Date.now() / 1000) }, isDelete: false, value: { ...s } }];
    return s;
  },
  async getShipment(id) { return find(id); },
  async getAllShipments() { return ledger; },
  async recordEvent(shipmentId, eventType, location, description) {
    const s = find(shipmentId);
    const now = new Date().toISOString();
    const txId = `tx_${uuidv4().slice(0, 8)}`;
    s.events.push({ eventId: `EVT-${shipmentId}-${s.events.length + 1}`, eventType, location, actor: "Org1MSP", timestamp: now, description, txId });
    if (STATUS_MAP[eventType]) s.status = STATUS_MAP[eventType];
    history[shipmentId]?.push({ txId, timestamp: { seconds: Math.floor(Date.now() / 1000) }, isDelete: false, value: { ...s } });
    return s;
  },
  async transferCustody(shipmentId, newHolder, location) {
    const s = find(shipmentId); const prev = s.currentHolder; s.currentHolder = newHolder;
    const now = new Date().toISOString();
    s.events.push({ eventId: `EVT-${shipmentId}-${s.events.length + 1}`, eventType: "CUSTODY_TRANSFERRED", location, actor: "Org1MSP", timestamp: now, description: `Custody: ${prev} → ${newHolder}`, txId: `tx_${uuidv4().slice(0, 8)}` });
    return s;
  },
  async updateDelayRisk(shipmentId, riskScore) {
    const s = find(shipmentId); s.delayRiskScore = riskScore;
    if (riskScore >= 0.85 && s.status === "IN_TRANSIT") s.status = "DELAYED";
    return s;
  },
  async markDelivered(shipmentId) {
    const s = find(shipmentId); s.status = "DELIVERED"; s.actualArrival = new Date().toISOString();
    s.events.push({ eventId: `EVT-${shipmentId}-${s.events.length + 1}`, eventType: "DELIVERED", location: s.destination, actor: "Org1MSP", timestamp: s.actualArrival, description: "Delivered to final destination", txId: `tx_${uuidv4().slice(0, 8)}` });
    return s;
  },
  async getShipmentHistory(shipmentId) { return history[shipmentId] || []; },
  async updateStatus(shipmentId, newStatus, reason) {
    const s = find(shipmentId); const old = s.status; s.status = newStatus;
    const now = new Date().toISOString(); const txId = `tx_${uuidv4().slice(0, 8)}`;
    s.events.push({ eventId: `EVT-${shipmentId}-${s.events.length + 1}`, eventType: "STATUS_UPDATED", location: "N/A", actor: "Org1MSP", timestamp: now, description: `Status: ${old} → ${newStatus}. Reason: ${reason}`, txId });
    history[shipmentId]?.push({ txId, timestamp: { seconds: Math.floor(Date.now() / 1000) }, isDelete: false, value: { ...s } });
    return s;
  },
  async verifyIntegrity(shipmentId, claimedDataJSON) {
    const s = find(shipmentId);
    let claimed; try { claimed = JSON.parse(claimedDataJSON); } catch (e) { throw new Error("Invalid JSON"); }
    const normalizedClaimed = normalizeIntegrityPayload(claimed);
    const normalizedLedger = normalizeIntegrityPayload(s);
    const isMatch = JSON.stringify(normalizedClaimed) === JSON.stringify(normalizedLedger);
    return {
      shipmentId, integrityPass: isMatch, verifiedAt: new Date().toISOString(), txId: `tx_verify_${uuidv4().slice(0, 8)}`,
      message: isMatch ? "INTEGRITY VERIFIED — data matches ledger exactly" : "INTEGRITY FAILED — data has been tampered with"
    };
  },
};

const fs = require("fs");
const path = require("path");
const { Gateway, Wallets } = require("fabric-network");

const CHANNEL_NAME = process.env.FABRIC_CHANNEL || "dlnchannel";
const CHAINCODE_NAME = process.env.FABRIC_CHAINCODE || "shipment";
const FABRIC_ORG = {
  shipper: {
    label: "shipperAdmin",
    mspId: "ShipperMSP",
    domain: "shipper.dln.com",
    admin: "Admin@shipper.dln.com",
  },
  carrier: {
    label: "carrierAdmin",
    mspId: "CarrierMSP",
    domain: "carrier.dln.com",
    admin: "Admin@carrier.dln.com",
  },
  customs: {
    label: "customsAdmin",
    mspId: "CustomsMSP",
    domain: "customs.dln.com",
    admin: "Admin@customs.dln.com",
  },
};

const TRANSPORT_EVENTS = new Set([
  "DEPARTED_PORT",
  "ARRIVED_PORT",
  "DELAY_REPORTED",
  "CUSTODY_PICKED_UP",
  "CHECKPOINT_REACHED",
  "TRANSSHIPMENT",
]);
const CUSTOMS_EVENTS = new Set(["CUSTOMS_ENTRY", "CUSTOMS_CLEARED", "CUSTOMS_REJECTED", "INSPECTION"]);

let walletPromise;
let ccpCache;

function cryptoRoot() {
  return process.env.FABRIC_CRYPTO_CONFIG_PATH
    ? path.resolve(process.env.FABRIC_CRYPTO_CONFIG_PATH)
    : path.resolve(__dirname, "../../blockchain/network/crypto-config");
}

function connectionProfilePath() {
  return process.env.FABRIC_CONNECTION_PROFILE
    ? path.resolve(process.env.FABRIC_CONNECTION_PROFILE)
    : path.resolve(__dirname, "../../blockchain/network/connection-profile.json");
}

function normalizeConnectionProfilePaths(value, baseDir) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeConnectionProfilePaths(item, baseDir));
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  const normalized = {};
  Object.entries(value).forEach(([key, child]) => {
    if (key === "path" && typeof child === "string" && !path.isAbsolute(child)) {
      const withoutCryptoPrefix = child.replace(/^crypto-config[\\/]/, "");
      normalized[key] = path.join(cryptoRoot(), withoutCryptoPrefix);
    } else {
      normalized[key] = normalizeConnectionProfilePaths(child, baseDir);
    }
  });
  return normalized;
}

function useDockerNetworkProfile(ccp) {
  if (process.env.FABRIC_NETWORK_MODE !== "docker") {
    return ccp;
  }

  const replacements = {
    "grpcs://localhost:7051": "grpcs://peer0.shipper.dln.com:7051",
    "grpcs://localhost:9051": "grpcs://peer0.carrier.dln.com:9051",
    "grpcs://localhost:11051": "grpcs://peer0.customs.dln.com:11051",
    "grpcs://localhost:7050": "grpcs://orderer.dln.com:7050",
    "http://localhost:7054": "http://ca.shipper.dln.com:7054",
    "http://localhost:8054": "http://ca.carrier.dln.com:8054",
    "http://localhost:10054": "http://ca.customs.dln.com:10054",
  };

  const json = JSON.stringify(ccp).replace(
    /grpcs:\/\/localhost:(7051|9051|11051|7050)|http:\/\/localhost:(7054|8054|10054)/g,
    (match) => replacements[match] || match
  );
  return JSON.parse(json);
}

function loadConnectionProfile() {
  if (ccpCache) {
    return ccpCache;
  }

  const profilePath = connectionProfilePath();
  const rawProfile = JSON.parse(fs.readFileSync(profilePath, "utf8"));
  const absolutePathProfile = normalizeConnectionProfilePaths(rawProfile, path.dirname(profilePath));
  ccpCache = useDockerNetworkProfile(absolutePathProfile);
  return ccpCache;
}

function readPrivateKey(keyStorePath) {
  const files = fs.readdirSync(keyStorePath).filter((file) => !file.startsWith("."));
  if (!files.length) {
    throw new Error(`No private key found in ${keyStorePath}`);
  }
  return fs.readFileSync(path.join(keyStorePath, files[0]), "utf8");
}

async function getWallet() {
  if (walletPromise) {
    return walletPromise;
  }

  walletPromise = (async () => {
    const wallet = await Wallets.newInMemoryWallet();
    const root = cryptoRoot();

    for (const org of Object.values(FABRIC_ORG)) {
      const mspPath = path.join(root, "peerOrganizations", org.domain, "users", org.admin, "msp");
      const certificate = fs.readFileSync(path.join(mspPath, "signcerts", `${org.admin}-cert.pem`), "utf8");
      const privateKey = readPrivateKey(path.join(mspPath, "keystore"));

      await wallet.put(org.label, {
        credentials: { certificate, privateKey },
        mspId: org.mspId,
        type: "X.509",
      });
    }

    return wallet;
  })();

  return walletPromise;
}

async function withContract(orgKey, fn) {
  const gateway = new Gateway();
  const org = FABRIC_ORG[orgKey];
  if (!org) {
    throw new Error(`Unknown Fabric org ${orgKey}`);
  }

  try {
    await gateway.connect(loadConnectionProfile(), {
      wallet: await getWallet(),
      identity: org.label,
      discovery: {
        enabled: true,
        asLocalhost: process.env.FABRIC_NETWORK_MODE !== "docker",
      },
    });

    const network = await gateway.getNetwork(CHANNEL_NAME);
    const contract = network.getContract(CHAINCODE_NAME);
    return await fn(contract);
  } finally {
    gateway.disconnect();
  }
}

function parsePayload(buffer) {
  if (!buffer || buffer.length === 0) {
    return null;
  }
  return normalizeShipmentPayload(JSON.parse(buffer.toString("utf8")));
}

async function evaluate(orgKey, transactionName, ...args) {
  return withContract(orgKey, async (contract) => {
    const result = await contract.evaluateTransaction(transactionName, ...args.map(String));
    return parsePayload(result);
  });
}

async function submit(orgKey, transactionName, ...args) {
  return withContract(orgKey, async (contract) => {
    const result = await contract.submitTransaction(transactionName, ...args.map(String));
    return parsePayload(result);
  });
}

function orgForEvent(eventType) {
  if (eventType === "SHIPMENT_READY") {
    return "shipper";
  }
  if (TRANSPORT_EVENTS.has(eventType)) {
    return "carrier";
  }
  if (CUSTOMS_EVENTS.has(eventType)) {
    return "customs";
  }
  return "shipper";
}

function normalizeShipmentPayload(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeShipmentPayload);
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  const normalized = { ...value };
  if (normalized.shipmentId && normalized.actualArrival === undefined) {
    normalized.actualArrival = "";
  }
  return normalized;
}

async function getCurrentHolder(shipmentId) {
  const shipment = await evaluate("shipper", "GetShipment", shipmentId);
  switch (shipment.currentHolder) {
    case FABRIC_ORG.carrier.mspId:
      return "carrier";
    case FABRIC_ORG.customs.mspId:
      return "customs";
    default:
      return "shipper";
  }
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

module.exports = {
  async createShipment(data) {
    const { shipmentId, containerId, origin, destination, carrier, cargoType, weightKg, estimatedArrival } = data;
    return submit(
      "shipper",
      "CreateShipment",
      shipmentId,
      containerId,
      origin,
      destination,
      carrier,
      cargoType,
      Number(weightKg),
      estimatedArrival
    );
  },

  async getShipment(id) {
    return evaluate("shipper", "GetShipment", id);
  },

  async getAllShipments() {
    return evaluate("shipper", "GetAllShipments");
  },

  async recordEvent(shipmentId, eventType, location, description) {
    const orgKey = orgForEvent(eventType);
    const shipment = await evaluate("shipper", "GetShipment", shipmentId);

    if (orgKey === "carrier" && shipment.currentHolder === FABRIC_ORG.shipper.mspId) {
      await submit("shipper", "TransferCustody", shipmentId, FABRIC_ORG.carrier.mspId, location);
    }

    if (orgKey === "customs" && shipment.currentHolder !== FABRIC_ORG.customs.mspId) {
      if (shipment.currentHolder === FABRIC_ORG.shipper.mspId) {
        await submit("shipper", "TransferCustody", shipmentId, FABRIC_ORG.carrier.mspId, location);
      }
      await submit("carrier", "TransferCustody", shipmentId, FABRIC_ORG.customs.mspId, location);
    }

    return submit(orgKey, "RecordEvent", shipmentId, eventType, location, description);
  },

  async transferCustody(shipmentId, newHolder, location) {
    return submit(await getCurrentHolder(shipmentId), "TransferCustody", shipmentId, newHolder, location);
  },

  async updateDelayRisk(shipmentId, riskScore) {
    return submit("shipper", "UpdateDelayRisk", shipmentId, Number(riskScore));
  },

  async markDelivered(shipmentId) {
    const shipment = await evaluate("shipper", "GetShipment", shipmentId);
    const hasCustomsEntry = shipment.events?.some((event) => event.eventType === "CUSTOMS_ENTRY");
    const hasCustomsCleared = shipment.events?.some((event) => event.eventType === "CUSTOMS_CLEARED");

    if (shipment.currentHolder !== FABRIC_ORG.customs.mspId) {
      if (shipment.currentHolder === FABRIC_ORG.shipper.mspId) {
        await submit("shipper", "TransferCustody", shipmentId, FABRIC_ORG.carrier.mspId, shipment.destination);
      }
      await submit("carrier", "TransferCustody", shipmentId, FABRIC_ORG.customs.mspId, shipment.destination);
    }

    if (!hasCustomsEntry) {
      await submit("customs", "RecordEvent", shipmentId, "CUSTOMS_ENTRY", shipment.destination, "Shipment entered customs verification");
    }
    if (!hasCustomsCleared) {
      await submit("customs", "RecordEvent", shipmentId, "CUSTOMS_CLEARED", shipment.destination, "Shipment cleared by customs");
    }

    return submit("customs", "MarkDelivered", shipmentId);
  },

  async getShipmentHistory(shipmentId) {
    return evaluate("shipper", "GetShipmentHistory", shipmentId);
  },

  async updateStatus(shipmentId, newStatus, reason) {
    let orgKey = "shipper";
    if (["IN_TRANSIT", "AT_PORT", "DELAYED"].includes(newStatus)) {
      orgKey = "carrier";
    } else if (["IN_CUSTOMS", "DELIVERED"].includes(newStatus)) {
      orgKey = "customs";
    }
    return submit(orgKey, "UpdateStatus", shipmentId, newStatus, reason);
  },

  async verifyIntegrity(shipmentId, claimedDataJSON) {
    const claimed = normalizeIntegrityPayload(JSON.parse(claimedDataJSON));
    return submit("customs", "VerifyIntegrity", shipmentId, JSON.stringify(claimed));
  },
};

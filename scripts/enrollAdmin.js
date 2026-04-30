"use strict";

require("dotenv").config({ path: "../backend/.env.example" });

const FabricCAServices = require("fabric-ca-client");
const { Wallets } = require("fabric-network");
const path = require("path");
const fs = require("fs");

const CONNECTION_PROFILE_PATH = path.resolve(__dirname, "../blockchain/network/connection-profile.json");
const WALLET_PATH = path.resolve(__dirname, "../backend/wallet");

const ORGS = {
  shipper: {
    caName: "ca.shipper.dln.com",
    walletId: "shipperAdmin",
    mspId: "ShipperMSP",
  },
  carrier: {
    caName: "ca.carrier.dln.com",
    walletId: "carrierAdmin",
    mspId: "CarrierMSP",
  },
  customs: {
    caName: "ca.customs.dln.com",
    walletId: "customsAdmin",
    mspId: "CustomsMSP",
  },
};

async function enrollOrgAdmin(wallet, ccp, org) {
  const caInfo = ccp.certificateAuthorities[org.caName];
  const ca = new FabricCAServices(caInfo.url, { verify: false }, caInfo.caName);

  const existing = await wallet.get(org.walletId);
  if (existing) {
    console.log(`${org.walletId} already exists in wallet. Skipping.`);
    return;
  }

  const enrollment = await ca.enroll({
    enrollmentID: "admin",
    enrollmentSecret: "adminpw",
  });

  await wallet.put(org.walletId, {
    credentials: {
      certificate: enrollment.certificate,
      privateKey: enrollment.key.toBytes(),
    },
    mspId: org.mspId,
    type: "X.509",
  });

  console.log(`Enrolled ${org.walletId} for ${org.mspId}`);
}

async function main() {
  const ccp = JSON.parse(fs.readFileSync(CONNECTION_PROFILE_PATH, "utf8"));
  const wallet = await Wallets.newFileSystemWallet(WALLET_PATH);
  console.log(`Wallet path: ${WALLET_PATH}`);

  for (const org of Object.values(ORGS)) {
    await enrollOrgAdmin(wallet, ccp, org);
  }
}

main().catch((err) => {
  console.error("Enrollment failed:", err);
  process.exit(1);
});

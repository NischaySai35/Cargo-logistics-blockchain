#!/bin/bash
# DLN-Lite Hyperledger Fabric Network Startup Script
# Starts a logistics network:
#   ShipperMSP - creates and sends shipments
#   CarrierMSP - transports shipments between ports
#   CustomsMSP - verifies/clears shipments at the end

set -e

CHANNEL_NAME="dlnchannel"
CHAINCODE_NAME="shipment"
CHAINCODE_VERSION="1.0"
CHAINCODE_SEQUENCE="1"
TOOLS_IMAGE="hyperledger/fabric-tools:2.5"
COMPOSE_FILE="../../docker/fabric-docker-compose.yml"
ORDERER_CA="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/dln.com/orderers/orderer.dln.com/msp/tlscacerts/tlsca.dln.com-cert.pem"

SHIPPER_PEER_ENV=(
  -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/shipper.dln.com/users/Admin@shipper.dln.com/msp
  -e CORE_PEER_ADDRESS=peer0.shipper.dln.com:7051
  -e CORE_PEER_LOCALMSPID=ShipperMSP
  -e CORE_PEER_TLS_ENABLED=true
  -e CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt
)

CARRIER_PEER_ENV=(
  -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/carrier.dln.com/users/Admin@carrier.dln.com/msp
  -e CORE_PEER_ADDRESS=peer0.carrier.dln.com:9051
  -e CORE_PEER_LOCALMSPID=CarrierMSP
  -e CORE_PEER_TLS_ENABLED=true
  -e CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt
)

CUSTOMS_PEER_ENV=(
  -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/customs.dln.com/users/Admin@customs.dln.com/msp
  -e CORE_PEER_ADDRESS=peer0.customs.dln.com:11051
  -e CORE_PEER_LOCALMSPID=CustomsMSP
  -e CORE_PEER_TLS_ENABLED=true
  -e CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt
)

echo "============================================"
echo " DLN-Lite Logistics Network Startup"
echo "============================================"

if ! command -v docker &>/dev/null; then
  echo "Docker not found. Please install Docker."
  exit 1
fi

mkdir -p channel-artifacts

echo ""
echo "Step 1: Generating crypto material..."
docker run --rm \
  -v "$PWD:/network" \
  -w /network \
  "$TOOLS_IMAGE" \
  cryptogen generate --config=./crypto-config.yaml --output=./crypto-config

echo ""
echo "Step 2: Creating genesis block..."
docker run --rm \
  -v "$PWD:/network" \
  -w /network \
  -e FABRIC_CFG_PATH=/network \
  "$TOOLS_IMAGE" \
  configtxgen -profile LogisticsOrdererGenesis \
    -channelID system-channel \
    -outputBlock ./channel-artifacts/genesis.block

echo ""
echo "Step 3: Creating channel transaction..."
docker run --rm \
  -v "$PWD:/network" \
  -w /network \
  -e FABRIC_CFG_PATH=/network \
  "$TOOLS_IMAGE" \
  configtxgen -profile LogisticsChannel \
    -outputCreateChannelTx ./channel-artifacts/${CHANNEL_NAME}.tx \
    -channelID ${CHANNEL_NAME}

echo ""
echo "Step 4: Starting Fabric containers..."
docker compose -f "$COMPOSE_FILE" up -d

sleep 8

echo ""
echo "Step 5: Creating and joining channel..."
docker exec cli peer channel create \
  -o orderer.dln.com:7050 \
  -c ${CHANNEL_NAME} \
  -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${CHANNEL_NAME}.tx \
  --tls --cafile "$ORDERER_CA"

docker exec cli cp \
  /opt/gopath/src/github.com/hyperledger/fabric/peer/${CHANNEL_NAME}.block \
  /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${CHANNEL_NAME}.block

docker exec "${SHIPPER_PEER_ENV[@]}" peer0.shipper.dln.com peer channel join \
  -b /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${CHANNEL_NAME}.block

docker exec "${CARRIER_PEER_ENV[@]}" peer0.carrier.dln.com peer channel join \
  -b /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${CHANNEL_NAME}.block

docker exec "${CUSTOMS_PEER_ENV[@]}" peer0.customs.dln.com peer channel join \
  -b /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${CHANNEL_NAME}.block

echo ""
echo "Step 6: Packaging and installing chaincode..."
docker exec cli peer lifecycle chaincode package ${CHAINCODE_NAME}.tar.gz \
  --path /opt/gopath/src/github.com/chaincode/${CHAINCODE_NAME} \
  --lang golang \
  --label ${CHAINCODE_NAME}_${CHAINCODE_VERSION}

docker exec cli cp \
  /opt/gopath/src/github.com/hyperledger/fabric/peer/${CHAINCODE_NAME}.tar.gz \
  /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${CHAINCODE_NAME}.tar.gz

docker exec "${SHIPPER_PEER_ENV[@]}" peer0.shipper.dln.com peer lifecycle chaincode install \
  /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${CHAINCODE_NAME}.tar.gz

docker exec "${CARRIER_PEER_ENV[@]}" peer0.carrier.dln.com peer lifecycle chaincode install \
  /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${CHAINCODE_NAME}.tar.gz

docker exec "${CUSTOMS_PEER_ENV[@]}" peer0.customs.dln.com peer lifecycle chaincode install \
  /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${CHAINCODE_NAME}.tar.gz

PACKAGE_ID=$(docker exec "${SHIPPER_PEER_ENV[@]}" peer0.shipper.dln.com peer lifecycle chaincode queryinstalled 2>&1 | grep "Package ID" | awk '{print $3}' | tr -d ',')
if [ -z "$PACKAGE_ID" ]; then
  echo "Could not find installed chaincode package ID. Check Step 6 install logs before approving chaincode."
  exit 1
fi

echo ""
echo "Step 7: Approving chaincode for all logistics orgs..."
docker exec "${SHIPPER_PEER_ENV[@]}" peer0.shipper.dln.com peer lifecycle chaincode approveformyorg \
  -o orderer.dln.com:7050 \
  --channelID ${CHANNEL_NAME} \
  --name ${CHAINCODE_NAME} \
  --version ${CHAINCODE_VERSION} \
  --package-id ${PACKAGE_ID} \
  --sequence ${CHAINCODE_SEQUENCE} \
  --tls --cafile "$ORDERER_CA"

docker exec "${CARRIER_PEER_ENV[@]}" peer0.carrier.dln.com peer lifecycle chaincode approveformyorg \
    -o orderer.dln.com:7050 \
    --channelID ${CHANNEL_NAME} \
    --name ${CHAINCODE_NAME} \
    --version ${CHAINCODE_VERSION} \
    --package-id ${PACKAGE_ID} \
    --sequence ${CHAINCODE_SEQUENCE} \
    --tls --cafile "$ORDERER_CA"

docker exec "${CUSTOMS_PEER_ENV[@]}" peer0.customs.dln.com peer lifecycle chaincode approveformyorg \
    -o orderer.dln.com:7050 \
    --channelID ${CHANNEL_NAME} \
    --name ${CHAINCODE_NAME} \
    --version ${CHAINCODE_VERSION} \
    --package-id ${PACKAGE_ID} \
    --sequence ${CHAINCODE_SEQUENCE} \
    --tls --cafile "$ORDERER_CA"

echo ""
echo "Step 8: Committing chaincode..."
docker exec "${SHIPPER_PEER_ENV[@]}" peer0.shipper.dln.com peer lifecycle chaincode commit \
  -o orderer.dln.com:7050 \
  --channelID ${CHANNEL_NAME} \
  --name ${CHAINCODE_NAME} \
  --version ${CHAINCODE_VERSION} \
  --sequence ${CHAINCODE_SEQUENCE} \
  --tls --cafile "$ORDERER_CA" \
  --peerAddresses peer0.shipper.dln.com:7051 \
  --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/shipper.dln.com/peers/peer0.shipper.dln.com/tls/ca.crt \
  --peerAddresses peer0.carrier.dln.com:9051 \
  --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/carrier.dln.com/peers/peer0.carrier.dln.com/tls/ca.crt \
  --peerAddresses peer0.customs.dln.com:11051 \
  --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/customs.dln.com/peers/peer0.customs.dln.com/tls/ca.crt

echo ""
echo "Step 9: Initialising ledger..."
docker exec "${SHIPPER_PEER_ENV[@]}" peer0.shipper.dln.com peer chaincode invoke \
  -o orderer.dln.com:7050 \
  --channelID ${CHANNEL_NAME} \
  --name ${CHAINCODE_NAME} \
  --tls --cafile "$ORDERER_CA" \
  --peerAddresses peer0.shipper.dln.com:7051 \
  --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/shipper.dln.com/peers/peer0.shipper.dln.com/tls/ca.crt \
  --peerAddresses peer0.carrier.dln.com:9051 \
  --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/carrier.dln.com/peers/peer0.carrier.dln.com/tls/ca.crt \
  --peerAddresses peer0.customs.dln.com:11051 \
  --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/customs.dln.com/peers/peer0.customs.dln.com/tls/ca.crt \
  -c '{"function":"InitLedger","Args":[]}'

echo ""
echo "============================================"
echo " DLN-Lite Logistics Network is running"
echo " Channel: ${CHANNEL_NAME}"
echo " Chaincode: ${CHAINCODE_NAME}"
echo " Orgs: ShipperMSP, CarrierMSP, CustomsMSP"
echo "============================================"

#!/bin/bash
# Upgrades the shipment chaincode on the already-running DLN Fabric network.
# This keeps the existing channel and ledger data intact.

set -e

CHANNEL_NAME="dlnchannel"
CHAINCODE_NAME="shipment"
CHAINCODE_VERSION="1.1"
CHAINCODE_SEQUENCE="2"
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

echo "Packaging shipment chaincode ${CHAINCODE_VERSION}..."
docker exec cli peer lifecycle chaincode package ${CHAINCODE_NAME}_${CHAINCODE_VERSION}.tar.gz \
  --path /opt/gopath/src/github.com/chaincode/${CHAINCODE_NAME} \
  --lang golang \
  --label ${CHAINCODE_NAME}_${CHAINCODE_VERSION}

docker exec cli cp \
  /opt/gopath/src/github.com/hyperledger/fabric/peer/${CHAINCODE_NAME}_${CHAINCODE_VERSION}.tar.gz \
  /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${CHAINCODE_NAME}_${CHAINCODE_VERSION}.tar.gz

echo "Installing on all peers..."
docker exec "${SHIPPER_PEER_ENV[@]}" peer0.shipper.dln.com peer lifecycle chaincode install \
  /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${CHAINCODE_NAME}_${CHAINCODE_VERSION}.tar.gz

docker exec "${CARRIER_PEER_ENV[@]}" peer0.carrier.dln.com peer lifecycle chaincode install \
  /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${CHAINCODE_NAME}_${CHAINCODE_VERSION}.tar.gz

docker exec "${CUSTOMS_PEER_ENV[@]}" peer0.customs.dln.com peer lifecycle chaincode install \
  /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${CHAINCODE_NAME}_${CHAINCODE_VERSION}.tar.gz

PACKAGE_ID=$(docker exec "${SHIPPER_PEER_ENV[@]}" peer0.shipper.dln.com peer lifecycle chaincode queryinstalled 2>&1 | grep "${CHAINCODE_NAME}_${CHAINCODE_VERSION}" | awk '{print $3}' | tr -d ',')
if [ -z "$PACKAGE_ID" ]; then
  echo "Could not find package ID for ${CHAINCODE_NAME}_${CHAINCODE_VERSION}."
  exit 1
fi

echo "Approving upgrade for all orgs..."
for PEER in shipper carrier customs; do
  case "$PEER" in
    shipper) ENV=("${SHIPPER_PEER_ENV[@]}"); CONTAINER="peer0.shipper.dln.com" ;;
    carrier) ENV=("${CARRIER_PEER_ENV[@]}"); CONTAINER="peer0.carrier.dln.com" ;;
    customs) ENV=("${CUSTOMS_PEER_ENV[@]}"); CONTAINER="peer0.customs.dln.com" ;;
  esac

  docker exec "${ENV[@]}" "$CONTAINER" peer lifecycle chaincode approveformyorg \
    -o orderer.dln.com:7050 \
    --channelID ${CHANNEL_NAME} \
    --name ${CHAINCODE_NAME} \
    --version ${CHAINCODE_VERSION} \
    --package-id ${PACKAGE_ID} \
    --sequence ${CHAINCODE_SEQUENCE} \
    --tls --cafile "$ORDERER_CA"
done

echo "Committing upgrade..."
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

echo "Chaincode upgraded to ${CHAINCODE_NAME} ${CHAINCODE_VERSION}, sequence ${CHAINCODE_SEQUENCE}."

#!/bin/bash
# Runs one real shipment flow against the running DLN Fabric network.

set -e

CHANNEL_NAME="dlnchannel"
CHAINCODE_NAME="shipment"
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

ENDORSEMENT_ARGS=(
  --peerAddresses peer0.shipper.dln.com:7051
  --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/shipper.dln.com/peers/peer0.shipper.dln.com/tls/ca.crt
  --peerAddresses peer0.carrier.dln.com:9051
  --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/carrier.dln.com/peers/peer0.carrier.dln.com/tls/ca.crt
  --peerAddresses peer0.customs.dln.com:11051
  --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/customs.dln.com/peers/peer0.customs.dln.com/tls/ca.crt
)

SHIPMENT_ID=${1:-SHP-RT-$(date +%Y%m%d%H%M%S)}

invoke_as_shipper() {
  docker exec "${SHIPPER_PEER_ENV[@]}" peer0.shipper.dln.com peer chaincode invoke \
    -o orderer.dln.com:7050 \
    --channelID "$CHANNEL_NAME" \
    --name "$CHAINCODE_NAME" \
    --tls --cafile "$ORDERER_CA" \
    "${ENDORSEMENT_ARGS[@]}" \
    -c "$1"
}

invoke_as_carrier() {
  docker exec "${CARRIER_PEER_ENV[@]}" peer0.carrier.dln.com peer chaincode invoke \
    -o orderer.dln.com:7050 \
    --channelID "$CHANNEL_NAME" \
    --name "$CHAINCODE_NAME" \
    --tls --cafile "$ORDERER_CA" \
    "${ENDORSEMENT_ARGS[@]}" \
    -c "$1"
}

invoke_as_customs() {
  docker exec "${CUSTOMS_PEER_ENV[@]}" peer0.customs.dln.com peer chaincode invoke \
    -o orderer.dln.com:7050 \
    --channelID "$CHANNEL_NAME" \
    --name "$CHAINCODE_NAME" \
    --tls --cafile "$ORDERER_CA" \
    "${ENDORSEMENT_ARGS[@]}" \
    -c "$1"
}

query_as_shipper() {
  docker exec "${SHIPPER_PEER_ENV[@]}" peer0.shipper.dln.com peer chaincode query \
    --channelID "$CHANNEL_NAME" \
    --name "$CHAINCODE_NAME" \
    -c "$1"
}

echo "Creating shipment $SHIPMENT_ID as ShipperMSP..."
invoke_as_shipper "{\"function\":\"CreateShipment\",\"Args\":[\"$SHIPMENT_ID\",\"CONT-$SHIPMENT_ID\",\"Mumbai, IN\",\"Rotterdam, NL\",\"Carrier Demo Line\",\"Electronics\",\"12000\",\"2026-05-20T00:00:00Z\"]}"
sleep 2

echo "Transferring custody ShipperMSP -> CarrierMSP..."
invoke_as_shipper "{\"function\":\"TransferCustody\",\"Args\":[\"$SHIPMENT_ID\",\"CarrierMSP\",\"Mumbai Port\"]}"
sleep 2

echo "Recording carrier departure..."
invoke_as_carrier "{\"function\":\"RecordEvent\",\"Args\":[\"$SHIPMENT_ID\",\"DEPARTED_PORT\",\"Mumbai Port\",\"Carrier departed origin port\"]}"
sleep 2

echo "Recording carrier checkpoint update..."
invoke_as_carrier "{\"function\":\"RecordEvent\",\"Args\":[\"$SHIPMENT_ID\",\"CHECKPOINT_REACHED\",\"Arabian Sea Checkpoint 1\",\"Carrier reached checkpoint 1 and broadcast the update to the ledger\"]}"
sleep 2

echo "Transferring custody CarrierMSP -> CustomsMSP..."
invoke_as_carrier "{\"function\":\"TransferCustody\",\"Args\":[\"$SHIPMENT_ID\",\"CustomsMSP\",\"Rotterdam Port\"]}"
sleep 2

echo "Recording customs entry..."
invoke_as_customs "{\"function\":\"RecordEvent\",\"Args\":[\"$SHIPMENT_ID\",\"CUSTOMS_ENTRY\",\"Rotterdam Port\",\"Shipment entered customs verification\"]}"
sleep 2

echo "Recording customs clearance..."
invoke_as_customs "{\"function\":\"RecordEvent\",\"Args\":[\"$SHIPMENT_ID\",\"CUSTOMS_CLEARED\",\"Rotterdam Port\",\"Shipment cleared by customs\"]}"
sleep 2

echo "Marking shipment delivered..."
invoke_as_customs "{\"function\":\"MarkDelivered\",\"Args\":[\"$SHIPMENT_ID\"]}"
sleep 2

echo ""
echo "Current shipment state:"
query_as_shipper "{\"function\":\"GetShipment\",\"Args\":[\"$SHIPMENT_ID\"]}"

echo ""
echo "Immutable history:"
query_as_shipper "{\"function\":\"GetShipmentHistory\",\"Args\":[\"$SHIPMENT_ID\"]}"

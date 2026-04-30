#!/bin/bash
# Stops the DLN-Lite Fabric containers and cleans generated artifacts.

set -e

echo "============================================"
echo " DLN-Lite Logistics Network Teardown"
echo "============================================"

echo ""
echo "Stopping Fabric containers..."
docker compose -f ../../docker/fabric-docker-compose.yml down --volumes --remove-orphans

echo ""
echo "Removing generated crypto material and channel artifacts..."
rm -rf ./crypto-config
rm -rf ./channel-artifacts

echo ""
echo "Removing generated chaincode Docker images..."
docker rmi $(docker images dev-* -q) 2>/dev/null || true

echo ""
echo "============================================"
echo " Network stopped and cleaned"
echo "============================================"

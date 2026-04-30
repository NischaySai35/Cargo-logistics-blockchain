# DLN-Lite — Decentralised Logistics Network (Lite)

A neutral, blockchain-powered supply chain visibility platform with ML delay prediction.
Built as a final-year dissertation project addressing TradeLens failure points.

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                  React Dashboard                    │
│              (Port 3000 — Frontend)                 │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP
┌──────────────────────▼──────────────────────────────┐
│              Node.js REST API                       │
│            (Port 4000 — Backend)                    │
└──────┬───────────────┬──────────────────────────────┘
       │               │
┌──────▼──────┐ ┌──────▼──────────────────────────────┐
│ Hyperledger │ │         Python ML Service            │
│   Fabric    │ │         (Port 5000 — Flask)          │
│ Blockchain  │ └─────────────────────────────────────┘
│ (Port 7051) │
└─────────────┘
```

## Stack

| Layer | Technology |
|-------|-----------|
| Blockchain | Hyperledger Fabric 2.x + Chaincode (Go) |
| Backend API | Node.js + Express |
| ML Service | Python + Flask + XGBoost |
| Frontend | React + Tailwind CSS |
| Database | MongoDB (off-chain bulk data) |
| Runtime | Local Node.js + Python services |

## Quick Start

```bash
# 1. Start the ML service
cd ml
pip install -r requirements.txt
python app.py

# 2. Start the backend API
cd ../backend
npm install
npm start

# 3. Start the frontend
cd ../frontend
npm install
npm start
```

## Project Structure

```
dln-lite/
├── blockchain/          # Hyperledger Fabric network + chaincode
├── backend/             # Node.js REST API
├── ml/                  # Python ML delay prediction service
├── frontend/            # React dashboard
├── tests/               # All test files
├── docs/                # Documentation
└── scripts/             # Utility scripts
```

## Dissertation Context

This project directly addresses 3 of 5 TradeLens failure points:
- ✅ Neutral governance (no single controlling org)
- ✅ Hybrid architecture (blockchain only for critical events)
- ✅ Predictive ML (proactive delay risk scoring)
- 🟡 REST API integration layer (partial fix for integration complexity)
- ❌ Incentive mechanisms (acknowledged limitation, out of scope)

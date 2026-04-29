# ─────────────────────────────────────────────────────────────────────────────
# app.py — DLN-Lite ML Service Entry Point
# Flask REST API serving XGBoost delay predictions.
# ─────────────────────────────────────────────────────────────────────────────

import os
from flask import Flask, request, jsonify
from flask_cors import CORS

from predictor import DelayPredictor
from utils import encode_features, validate_features

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__)
CORS(app)

MODEL_PATH = os.getenv("MODEL_PATH", os.path.join(BASE_DIR, "models", "xgboost_model.pkl"))
predictor  = DelayPredictor(MODEL_PATH)


# ─────────────────────────────────────────────────────────────────────────────
# POST /predict — single shipment prediction
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No input data"}), 400

    missing = validate_features(data)
    if missing:
        return jsonify({"error": f"Missing fields: {missing}"}), 400

    try:
        result = predictor.predict_single(data)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─────────────────────────────────────────────────────────────────────────────
# POST /batch-predict — multiple shipments at once
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/batch-predict", methods=["POST"])
def batch_predict():
    data      = request.get_json()
    shipments = data.get("shipments", [])
    if not shipments:
        return jsonify({"error": "No shipments provided"}), 400

    try:
        predictions = predictor.predict_batch(shipments)
        return jsonify({"predictions": predictions})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─────────────────────────────────────────────────────────────────────────────
# GET /health
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status":       "ok",
        "model_loaded": predictor.model is not None,
        "model_path":   MODEL_PATH,
    })


# ─────────────────────────────────────────────────────────────────────────────
# GET /model-info — returns feature importances (useful for dashboard)
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/model-info", methods=["GET"])
def model_info():
    if predictor.model is None:
        return jsonify({"error": "Model not loaded"}), 503

    feature_names = [
        "distance_km", "num_stops", "weight_kg", "month",
        "origin_congestion", "destination_congestion",
        "weather_severity_encoded", "carrier_delay_rate",
        "route_avg_delay_days", "cargo_type_encoded",
        "origin_port_encoded", "destination_port_encoded", "carrier_encoded",
    ]

    importances = predictor.model.feature_importances_.tolist()

    return jsonify({
        "model_type":   "XGBoost",
        "feature_importances": dict(zip(feature_names, importances)),
    })


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    print(f"🚀 DLN-Lite ML Service running on port {port}")
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_ENV") == "development")

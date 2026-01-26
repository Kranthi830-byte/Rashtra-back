from flask import Flask, request, jsonify
from flask_cors import CORS
from ultralytics import YOLO
from PIL import Image
import io, os, uuid
from datetime import datetime

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

print("---- RASTRA AI GEO BACKEND STARTING ----")

# Load models
model1 = YOLO("pothole_model.pt")
model2 = YOLO("damage_model.pt")

# Memory DB (Phase 2 = PostgreSQL)
MAIN_LIST = []
WAITING_LIST = []

# Helper function
def process_results(results, model):
    detected = False
    max_conf = 0
    label = "Unknown"

    for r in results:
        for box in r.boxes:
            conf = float(box.conf[0])
            cls = int(box.cls[0])
            name = model.names[cls]

            if conf > max_conf:
                max_conf = conf
                label = name
                detected = True

    return detected, max_conf, label


# 🔥 SMART DETECT API (Image + GPS)
@app.route("/api/detect/smart", methods=["POST"])
def smart_detect():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    lat = request.form.get("lat")
    lon = request.form.get("lon")

    # Save image
    uid = str(uuid.uuid4())
    filename = f"{uid}.jpg"
    path = os.path.join(UPLOAD_FOLDER, filename)
    file.save(path)

    # Timestamp
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    img = Image.open(path)

    # Run Model 1
    r1 = model1(img)
    d1, c1, l1 = process_results(r1, model1)

    if d1 and c1 > 0.6:
        data = {
            "id": uid,
            "lat": lat,
            "lon": lon,
            "time": now,
            "label": l1,
            "confidence": c1,
            "model": "Model 1 (Pothole)",
            "status": "MAIN_LIST",
            "image": path
        }
        MAIN_LIST.append(data)
        return jsonify(data)

    # Run Model 2 fallback
    r2 = model2(img)
    d2, c2, l2 = process_results(r2, model2)

    if d2 and c2 > 0.6:
        data = {
            "id": uid,
            "lat": lat,
            "lon": lon,
            "time": now,
            "label": l2,
            "confidence": c2,
            "model": "Model 2 (General Damage)",
            "status": "MAIN_LIST",
            "image": path
        }
        MAIN_LIST.append(data)
        return jsonify(data)

    # If nothing detected
    data = {
        "id": uid,
        "lat": lat,
        "lon": lon,
        "time": now,
        "label": "Unknown",
        "confidence": 0,
        "model": "None",
        "status": "WAITING_LIST",
        "image": path
    }
    WAITING_LIST.append(data)
    return jsonify(data)


# View lists
@app.route("/api/main-list")
def main_list():
    return jsonify(MAIN_LIST)

@app.route("/api/waiting-list")
def waiting_list():
    return jsonify(WAITING_LIST)


if __name__ == "__main__":
     app.run(debug=False, port=5000, use_reloader=False)


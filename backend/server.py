from flask import Flask, request, jsonify
from flask_cors import CORS
from ultralytics import YOLO
from PIL import Image
import io, os, uuid
from datetime import datetime

# ================= ROAD SEVERITY MODEL ================= #

ROAD_SEVERITY = {
    "NH": 10,        # National Highway
    "STATE": 7,       # State Highway
    "CITY": 5,        # City Main Road
    "STREET": 2,      # Local Street
    "VILLAGE": 1
}

def severity_score(road_type="STREET"):
    return ROAD_SEVERITY.get(road_type, 2)

# ================= YOLO AREA (FOR LOGGING ONLY) ================= #

def calculate_area(box, img_width, img_height):
    x1, y1, x2, y2 = box.xyxy[0].tolist()
    box_area = (x2 - x1) * (y2 - y1)
    img_area = img_width * img_height
    return box_area / img_area   # fraction 0–1

# ================= FLASK INIT ================= #

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

print("---- RASTRA AI GEO BACKEND STARTING ----")

# Load YOLO models
model1 = YOLO("models/pothole_model.pt")
model2 = YOLO("models/damage_model.pt")

# Memory DB (later PostgreSQL)
MAIN_LIST = []
WAITING_LIST = []

# ================= HELPER FUNCTION ================= #

def process_results(results, model, img):
    detected = False
    max_conf = 0
    label = "Unknown"
    max_area = 0

    img_width, img_height = img.size

    for r in results:
        for box in r.boxes:
            conf = float(box.conf[0])
            cls = int(box.cls[0])
            name = model.names[cls]

            area = calculate_area(box, img_width, img_height)

            if conf > max_conf:
                max_conf = conf
                label = name
                detected = True
                max_area = area

    return detected, max_conf, label, max_area


# ================= SMART DETECT API ================= #

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

    # 🔥 TEMP ROAD TYPE (later auto detect using GPS)
    road_type = "STREET"

    # ================= MODEL 1 ================= #
    r1 = model1(img)
    d1, c1, l1, area1 = process_results(r1, model1, img)
    S1 = severity_score(road_type)

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
            "area": area1,
            "severity_score": S1,
            "road_type": road_type,
            "image": path
        }
        MAIN_LIST.append(data)
        return jsonify(data)

    # ================= MODEL 2 ================= #
    r2 = model2(img)
    d2, c2, l2, area2 = process_results(r2, model2, img)
    S2 = severity_score(road_type)

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
            "area": area2,
            "severity_score": S2,
            "road_type": road_type,
            "image": path
        }
        MAIN_LIST.append(data)
        return jsonify(data)

    # ================= NO DETECTION ================= #
    data = {
        "id": uid,
        "lat": lat,
        "lon": lon,
        "time": now,
        "label": "Unknown",
        "confidence": 0,
        "model": "None",
        "status": "WAITING_LIST",
        "road_type": road_type,
        "image": path
    }
    WAITING_LIST.append(data)
    return jsonify(data)


# ================= VIEW LISTS ================= #

@app.route("/api/main-list")
def main_list():
    return jsonify(MAIN_LIST)

@app.route("/api/waiting-list")
def waiting_list():
    return jsonify(WAITING_LIST)


# ================= RUN SERVER ================= #

if __name__ == "__main__":
    app.run(debug=False, port=5000, use_reloader=False)

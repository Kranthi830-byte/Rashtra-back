// AdminDashboard.tsx - FULL FIXED VERSION (React 18 + Leaflet Stable)

import React, { useState, useEffect } from "react";
import { api } from "../services/mockApi";
import { Complaint, ComplaintStatus, Severity } from "../types";
import { Card, Button, StatusBadge } from "../components/UI";
import { MapContainer, TileLayer, CircleMarker, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css"; // IMPORTANT
import { BarChart3, AlertCircle, CheckCircle2, HardHat, RefreshCw, Siren, Trash2 } from "lucide-react";
import { COLORS } from "../constants";

// ================== CONSTANTS ==================
const MS_PER_DAY = 86400000;
const DAYS_IN_WEEK = 7;
const DAYS_IN_MONTH = 30;

// ================== UTILS ==================
const getMarkerColor = (s: number) =>
  s >= 7.5 ? COLORS.alert : s >= 3.5 ? COLORS.warning : COLORS.secondary;

// ================== MAP REFRESH FIX ==================
const MapRefresher = ({ timestamp }: { timestamp: number }) => {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();

    return () => {
      // cleanup required for React 18 Strict Mode
    };
  }, [timestamp, map]);

  return null;
};

// ================== MAP COMPONENT ==================
const RealMap = ({
  complaints,
  onSelect,
  selectedId,
  refreshTrigger,
}: {
  complaints: Complaint[];
  onSelect: (c: Complaint) => void;
  selectedId?: string;
  refreshTrigger: number;
}) => (
  <div className="w-full h-[500px] md:h-[600px] bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden border shadow-inner">
    <MapContainer
      center={[17.385, 78.4867]}
      zoom={11}
      scrollWheelZoom
      style={{ height: "100%", width: "100%" }}
    >
      <MapRefresher timestamp={refreshTrigger} />

      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {complaints.map((c) => (
        <CircleMarker
          key={c.id}
          center={[c.latitude, c.longitude]}
          radius={selectedId === c.id ? 12 : 8}
          pathOptions={{
            color: selectedId === c.id ? "#000" : "#fff",
            fillColor: getMarkerColor(c.severityScore),
            fillOpacity: 0.85,
            weight: selectedId === c.id ? 3 : 1,
          }}
          eventHandlers={{ click: () => onSelect(c) }}
        />
      ))}
    </MapContainer>
  </div>
);

// ================== STAT CARD ==================
const StatCard = ({ title, value, subtext, icon: Icon, colorClass, bgClass }: any) => (
  <Card className="p-5 flex justify-between border-l-4" style={{ borderLeftColor: colorClass }}>
    <div>
      <p className="text-xs text-gray-500 uppercase">{title}</p>
      <h3 className="text-2xl font-bold">{value}</h3>
      <p className="text-xs text-gray-400">{subtext}</p>
    </div>
    <div className={`p-3 rounded-lg ${bgClass}`}>
      <Icon size={24} style={{ color: colorClass }} />
    </div>
  </Card>
);

// ================== TYPES ==================
type TimeFilter = "today" | "week" | "month" | "all";
type ActiveTab = "map" | "list" | "waiting";

// ================== MAIN DASHBOARD ==================
const AdminDashboard = () => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [activeTab, setActiveTab] = useState<ActiveTab>("map");
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("month");
  const [mapRefresh, setMapRefresh] = useState(0);

  // ================== FETCH DATA ==================
  const fetchData = async () => {
    try {
      setIsRefreshing(true);
      setError("");
      const data = await api.getComplaints();
      setComplaints(data);
      setMapRefresh((p) => p + 1); // trigger map resize
    } catch (err) {
      setError("Failed to load complaints.");
      console.error(err);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ================== FILTERS ==================
  const filtered = complaints.filter((c) => {
    const d = new Date(c.timestamp);
    const n = new Date();
    if (timeFilter === "all") return true;
    if (timeFilter === "today") return d.toDateString() === n.toDateString();
    if (timeFilter === "week") return d > new Date(n.getTime() - DAYS_IN_WEEK * MS_PER_DAY);
    if (timeFilter === "month") return d > new Date(n.getTime() - DAYS_IN_MONTH * MS_PER_DAY);
    return true;
  });

  const pending = filtered.filter((c) => c.status === ComplaintStatus.WAITING_LIST).length;
  const critical = filtered.filter((c) => c.severity === Severity.HIGH).length;
  const repaired = filtered.filter((c) => c.status === ComplaintStatus.REPAIRED).length;

  const viewData =
    activeTab === "waiting"
      ? filtered.filter((c) => c.status === ComplaintStatus.WAITING_LIST)
      : filtered;

  // ================== STATUS UPDATE ==================
  const handleStatusUpdate = async (id: string, s: ComplaintStatus) => {
    await api.updateComplaintStatus(id, s);
    if (s === ComplaintStatus.ASSIGNED) {
      await api.logAdminActivity("REPAIR_ORDER", `Assigned workers for ${id}`);
    }
    if (s === ComplaintStatus.REPAIRED) {
      await api.logAdminActivity("REPAIR_ORDER", `Marked repaired: ${id}`);
    }
    setComplaints((p) => p.map((c) => (c.id === id ? { ...c, status: s } : c)));
    if (selectedComplaint?.id === id) setSelectedComplaint({ ...selectedComplaint, status: s });
  };

  // ================== DELETE ==================
  const handleDeleteCase = async (id: string) => {
    if (!confirm("Delete permanently?")) return;
    await api.deleteComplaint(id);
    await api.logAdminActivity("DELETE_CASE", `Deleted case ${id}`);
    setComplaints((p) => p.filter((c) => c.id !== id));
    setSelectedComplaint(null);
  };

  // ================== LOADING SCREEN ==================
  if (loading)
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="animate-spin" size={48} />
      </div>
    );

  // ================== UI ==================
  return (
    <div className="p-6 space-y-6 h-full flex flex-col">
      <h1 className="text-2xl font-bold">Command Center</h1>

      {error && <div className="bg-red-100 p-3 text-red-700">{error}</div>}

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total" value={filtered.length} subtext={timeFilter} icon={BarChart3} colorClass={COLORS.primary} bgClass="bg-blue-50" />
        <StatCard title="Critical" value={critical} subtext="High" icon={Siren} colorClass={COLORS.alert} bgClass="bg-red-50" />
        <StatCard title="Pending" value={pending} subtext="Verify" icon={AlertCircle} colorClass="#FBC531" bgClass="bg-yellow-50" />
        <StatCard title="Repaired" value={repaired} subtext="Done" icon={CheckCircle2} colorClass={COLORS.secondary} bgClass="bg-green-50" />
      </div>

      <div className="flex gap-6 h-full">
        <div className="flex-1">
          <div className="flex justify-between items-center mb-2">
            <div className="flex gap-2">
              <Button onClick={() => setActiveTab("map")}>Map</Button>
              <Button onClick={() => setActiveTab("list")}>List</Button>
              <Button onClick={() => setActiveTab("waiting")}>Waiting {pending}</Button>
            </div>

            <div className="flex gap-2">
              <select value={timeFilter} onChange={(e) => setTimeFilter(e.target.value as TimeFilter)} className="border px-2 py-1">
                <option value="today">Today</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
                <option value="all">All</option>
              </select>
              <Button onClick={fetchData} disabled={isRefreshing}>
                <RefreshCw className={isRefreshing ? "animate-spin" : ""} />
              </Button>
            </div>
          </div>

          {activeTab === "map" ? (
            <RealMap complaints={filtered} selectedId={selectedComplaint?.id} onSelect={setSelectedComplaint} refreshTrigger={mapRefresh} />
          ) : (
            <table className="w-full text-sm border">
              <thead>
                <tr className="bg-gray-100">
                  <th>ID</th>
                  <th>Address</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {viewData.map((c) => (
                  <tr key={c.id}>
                    <td>{c.id}</td>
                    <td>{c.address}</td>
                    <td><StatusBadge status={c.status} /></td>
                    <td>{c.severityScore.toFixed(1)}</td>
                    <td><Button onClick={() => setSelectedComplaint(c)}>View</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="w-96">
          {selectedComplaint ? (
            <Card className="p-4 space-y-3">
              <img src={selectedComplaint.imageUrl} className="w-full h-48 object-cover rounded" />
              <p>ID: {selectedComplaint.id}</p>
              <p>Score: {selectedComplaint.severityScore}</p>
              <p>Address: {selectedComplaint.address}</p>
              <StatusBadge status={selectedComplaint.status} />

              {selectedComplaint.status === ComplaintStatus.WAITING_LIST && (
                <Button onClick={() => handleStatusUpdate(selectedComplaint.id, ComplaintStatus.AUTO_VERIFIED)}>Verify</Button>
              )}
              {selectedComplaint.status === ComplaintStatus.AUTO_VERIFIED && (
                <Button onClick={() => handleStatusUpdate(selectedComplaint.id, ComplaintStatus.ASSIGNED)}>Assign Workers</Button>
              )}
              {selectedComplaint.status === ComplaintStatus.ASSIGNED && (
                <Button onClick={() => handleStatusUpdate(selectedComplaint.id, ComplaintStatus.REPAIRED)}>Mark Repaired</Button>
              )}

              <Button className="bg-red-500" onClick={() => handleDeleteCase(selectedComplaint.id)}>Delete Case</Button>
            </Card>
          ) : (
            <Card className="p-8 text-center text-gray-400">Select a complaint</Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;



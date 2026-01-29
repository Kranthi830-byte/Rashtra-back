import React, { useEffect, useState } from "react";
import { api } from "../services/mockApi";
import { AdminStats } from "../types";
import { Card, Button } from "../components/UI";
import { Database, RefreshCw } from "lucide-react";

const AdminDataCenter = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string>("");

  const load = async () => {
    try {
      setError("");
      setIsRefreshing(true);
      const data = await api.getAdminStats();
      setStats(data);
    } catch (e) {
      console.error(e);
      setError("Failed to load data center stats.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <RefreshCw className="animate-spin" size={42} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rastha-primary flex items-center justify-center text-white">
            <Database size={18} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Data Center</h1>
            <p className="text-sm text-gray-500">Aggregate admin metrics</p>
          </div>
        </div>

        <Button onClick={load} isLoading={isRefreshing} variant="white">
          <RefreshCw size={18} />
          Refresh
        </Button>
      </div>

      {error && <div className="bg-red-100 p-3 text-red-700 rounded-lg">{error}</div>}

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-5">
          <p className="text-xs text-gray-500 uppercase">Repair Orders</p>
          <p className="text-3xl font-bold mt-1">{stats?.totalRepairOrders ?? 0}</p>
          <p className="text-sm text-gray-500 mt-2">Count of assignments recorded</p>
        </Card>

        <Card className="p-5">
          <p className="text-xs text-gray-500 uppercase">Deleted Cases</p>
          <p className="text-3xl font-bold mt-1">{stats?.totalDeletedCases ?? 0}</p>
          <p className="text-sm text-gray-500 mt-2">Cases removed by admins</p>
        </Card>
      </div>

      <Card className="p-5 space-y-2">
        <p className="font-semibold">Notes</p>
        <ul className="list-disc pl-6 text-sm text-gray-600 dark:text-gray-300 space-y-1">
          <li>Backed by Firebase Firestore (adminLogs).</li>
          <li>To populate metrics, use Dashboard actions like Assign/Delete/Login.</li>
        </ul>
      </Card>
    </div>
  );
};

export default AdminDataCenter;

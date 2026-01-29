import React, { useEffect, useMemo, useState } from "react";
import { api } from "../services/mockApi";
import { AdminLog } from "../types";
import { Card, Button } from "../components/UI";
import { RefreshCw, Shield } from "lucide-react";

const formatTime = (d: Date) => {
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleString();
};

const AdminAudit = () => {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string>("");

  const load = async () => {
    try {
      setError("");
      setIsRefreshing(true);
      const stats = await api.getAdminStats();
      setLogs(stats.logs);
    } catch (e) {
      console.error(e);
      setError("Failed to load audit logs.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const rows = useMemo(() => logs, [logs]);

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
            <Shield size={18} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Activity Audit</h1>
            <p className="text-sm text-gray-500">Admin actions recorded in Firestore</p>
          </div>
        </div>

        <Button onClick={load} isLoading={isRefreshing} variant="white">
          <RefreshCw size={18} />
          Refresh
        </Button>
      </div>

      {error && <div className="bg-red-100 p-3 text-red-700 rounded-lg">{error}</div>}

      <Card className="p-0">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <p className="font-semibold">Recent Logs</p>
          <p className="text-sm text-gray-500">{rows.length} events</p>
        </div>

        {rows.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No logs yet. Actions like Assign/Delete will appear here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 text-left">
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((log) => (
                  <tr key={log.id} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="px-4 py-3 whitespace-nowrap">{formatTime(log.timestamp)}</td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium">{log.type}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{log.details || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AdminAudit;

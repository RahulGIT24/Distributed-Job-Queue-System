import  { useState, useEffect } from 'react';

export default function QueueDashboard() {
  const [stats, setStats] = useState({ pendingCount: 0, processingCount: 0, dlqCount: 0 });
  const [dlqTasks, setDlqTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const statsRes = await fetch('http://localhost:5002/api/stats');
      const statsData = await statsRes.json();
      setStats(statsData);

      const dlqRes = await fetch('http://localhost:5002/api/dlq');
      const dlqData = await dlqRes.json();
      setDlqTasks(dlqData.tasks);
    } catch (error) {
      console.error("Failed to fetch queue data", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleRetryDlq = async () => {
    try {
      await fetch('http://localhost:5002/api/dlq/retry', { method: 'POST' });
      fetchDashboardData(); 
    } catch (error) {
      console.error("Failed to retry tasks", error);
    }
  };

  const handleInjectTask = async () => {
    try {
      await fetch('http://localhost:5002/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskName: "Manual UI Trigger" })
      });
      fetchDashboardData();
    } catch (error) {
      console.error("Failed to inject task", error);
    }
  };

  if (loading && stats.pendingCount === 0) return <div className="p-10">Loading Engine Stats...</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto font-sans">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Queue Operations</h1>
        <div className="space-x-4">
          <button onClick={handleInjectTask} className="px-4 py-2 bg-blue-600 text-white rounded">
            + Inject Task
          </button>
          <button onClick={fetchDashboardData} className="px-4 py-2 border rounded">
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-10">
        <div className="p-6 bg-gray-50 border rounded-lg text-center">
          <h3 className="text-gray-500 uppercase tracking-wide text-sm mb-2">Pending Tasks</h3>
          <p className="text-4xl font-bold text-gray-800">{stats.pendingCount}</p>
        </div>
        <div className="p-6 bg-blue-50 border border-blue-100 rounded-lg text-center">
          <h3 className="text-blue-500 uppercase tracking-wide text-sm mb-2">Processing</h3>
          <p className="text-4xl font-bold text-blue-800 animate-pulse">{stats.processingCount}</p>
        </div>
        <div className="p-6 bg-red-50 border border-red-100 rounded-lg text-center">
          <h3 className="text-red-500 uppercase tracking-wide text-sm mb-2">Dead Letters</h3>
          <p className="text-4xl font-bold text-red-800">{stats.dlqCount}</p>
        </div>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
          <h2 className="text-xl font-semibold">Dead Letter Queue (Failed)</h2>
          <button 
            onClick={handleRetryDlq}
            disabled={stats.dlqCount === 0}
            className="px-4 py-2 bg-red-600 text-white rounded disabled:opacity-50"
          >
            Retry All Failed
          </button>
        </div>
        
        {dlqTasks.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No dlqCount tasks. The system is healthy.</div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-600 text-sm">
              <tr>
                <th className="p-4 border-b">Task ID</th>
                <th className="p-4 border-b">Payload</th>
                <th className="p-4 border-b">Retries</th>
              </tr>
            </thead>
            <tbody>
              {dlqTasks.map((task, index) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="p-4 font-mono text-sm">{task.id}</td>
                  <td className="p-4">{task.task}</td>
                  <td className="p-4">
                    <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">
                      {task.retries} / 3
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
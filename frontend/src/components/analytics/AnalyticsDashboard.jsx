import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { analyticsService } from '@/services/analytics';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

export const AnalyticsDashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [trendsData, setTrendsData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const [dashboard, trends] = await Promise.all([
        analyticsService.getDashboard(7),
        analyticsService.getTrends('documents', 30)
      ]);
      setDashboardData(dashboard);
      setTrendsData(trends);
    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Activity className="w-8 h-8 animate-spin text-cyan-400" />
          <p className="text-cyan-300 font-mono">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent font-mono">
          ANALYTICS DASHBOARD
        </h1>
        <p className="text-cyan-300/70 mt-1 font-mono">Performance metrics and trends</p>
      </div>

      {dashboardData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-black/60 border-2 border-cyan-500/30">
            <CardHeader>
              <CardTitle className="text-sm font-mono text-cyan-300">Documents Processed</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-black text-cyan-400 font-mono">{dashboardData.documents.total}</p>
              <p className="text-xs text-purple-300/70 mt-1 font-mono">
                {dashboardData.documents.success_rate}% success rate
              </p>
            </CardContent>
          </Card>

          <Card className="bg-black/60 border-2 border-purple-500/30">
            <CardHeader>
              <CardTitle className="text-sm font-mono text-purple-300">Active Exceptions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-black text-purple-400 font-mono">{dashboardData.exceptions.open}</p>
              <p className="text-xs text-purple-300/70 mt-1 font-mono">
                {dashboardData.exceptions.resolution_rate}% resolved
              </p>
            </CardContent>
          </Card>

          <Card className="bg-black/60 border-2 border-pink-500/30">
            <CardHeader>
              <CardTitle className="text-sm font-mono text-pink-300">Active Partners</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-black text-pink-400 font-mono">{dashboardData.partners.active}</p>
              <p className="text-xs text-pink-300/70 mt-1 font-mono">
                of {dashboardData.partners.total} total
              </p>
            </CardContent>
          </Card>

          <Card className="bg-black/60 border-2 border-yellow-500/30">
            <CardHeader>
              <CardTitle className="text-sm font-mono text-yellow-300">Avg Processing Time</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-black text-yellow-400 font-mono">
                {dashboardData.performance.avg_processing_time_seconds}s
              </p>
              <p className="text-xs text-yellow-300/70 mt-1 font-mono">per document</p>
            </CardContent>
          </Card>
        </div>
      )}

      {trendsData && (
        <Card className="bg-black/60 border-2 border-cyan-500/30">
          <CardHeader>
            <CardTitle className="text-xl font-black bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent font-mono">
              DOCUMENT PROCESSING TRENDS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendsData.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#06b6d4" opacity={0.2} />
                <XAxis dataKey="_id" stroke="#06b6d4" />
                <YAxis stroke="#06b6d4" />
                <Tooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #06b6d4' }} />
                <Legend />
                <Line type="monotone" dataKey="count" stroke="#06b6d4" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

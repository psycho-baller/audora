"use client";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";

export default function AnalyticsDashboard() {
  const dashboardData = useQuery(api.analytics.getUserDashboard);

  if (!dashboardData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading analytics...</p>
        </div>
      </div>
    );
  }

  const { overview, performanceTrend, fillerTrend, topKeywords, recentConversations } = dashboardData;

  // Prepare radar chart data for current scores
  const radarData = [
    { metric: "Clarity", score: overview.avgClarity, fullMark: 100 },
    { metric: "Conciseness", score: overview.avgConciseness, fullMark: 100 },
    { metric: "Confidence", score: overview.avgConfidence, fullMark: 100 },
  ];

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 rounded-lg p-6 border border-blue-700/50">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-blue-300">Total Conversations</h3>
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p className="text-3xl font-bold text-white">{overview.totalConversations}</p>
          <p className="text-xs text-blue-300 mt-1">{overview.completedConversations} completed</p>
        </div>

        <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 rounded-lg p-6 border border-purple-700/50">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-purple-300">Total Words</h3>
            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
          </div>
          <p className="text-3xl font-bold text-white">{overview.totalWords.toLocaleString()}</p>
          <p className="text-xs text-purple-300 mt-1">
            {overview.totalMinutes > 0 ? Math.round(overview.totalWords / overview.totalMinutes) : 0} words/min avg
          </p>
        </div>

        <div className="bg-gradient-to-br from-green-900/50 to-green-800/30 rounded-lg p-6 border border-green-700/50">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-green-300">Speaking Time</h3>
            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-3xl font-bold text-white">{overview.totalMinutes}</p>
          <p className="text-xs text-green-300 mt-1">minutes recorded</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-900/50 to-yellow-800/30 rounded-lg p-6 border border-yellow-700/50">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-yellow-300">Avg Score</h3>
            <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </div>
          <p className="text-3xl font-bold text-white">
            {Math.round((overview.avgClarity + overview.avgConciseness + overview.avgConfidence) / 3)}
          </p>
          <p className="text-xs text-yellow-300 mt-1">out of 100</p>
        </div>
      </div>

      {/* Performance Scores Radar */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-xl font-bold text-white mb-4">Overall Performance Scores</h3>
        <ResponsiveContainer width="100%" height={300}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="#374151" />
            <PolarAngleAxis dataKey="metric" tick={{ fill: '#9ca3af' }} />
            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#9ca3af' }} />
            <Radar name="Your Score" dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.5rem' }}
              labelStyle={{ color: '#fff' }}
            />
          </RadarChart>
        </ResponsiveContainer>
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-400">{overview.avgClarity}</p>
            <p className="text-sm text-gray-400">Clarity</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-400">{overview.avgConciseness}</p>
            <p className="text-sm text-gray-400">Conciseness</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-400">{overview.avgConfidence}</p>
            <p className="text-sm text-gray-400">Confidence</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Trend */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-xl font-bold text-white mb-4">Performance Trend</h3>
          {performanceTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={performanceTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="conversation" stroke="#9ca3af" label={{ value: 'Recent Conversations', position: 'insideBottom', offset: -5, fill: '#9ca3af' }} />
                <YAxis stroke="#9ca3af" domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.5rem' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Legend />
                <Line type="monotone" dataKey="clarity" stroke="#3b82f6" strokeWidth={2} name="Clarity" />
                <Line type="monotone" dataKey="conciseness" stroke="#8b5cf6" strokeWidth={2} name="Conciseness" />
                <Line type="monotone" dataKey="confidence" stroke="#10b981" strokeWidth={2} name="Confidence" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-center py-12">No performance data yet. Complete more conversations!</p>
          )}
        </div>

        {/* Filler Words Trend */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-xl font-bold text-white mb-4">Filler Words Reduction</h3>
          {fillerTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={fillerTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="conversation" stroke="#9ca3af" label={{ value: 'Recent Conversations', position: 'insideBottom', offset: -5, fill: '#9ca3af' }} />
                <YAxis stroke="#9ca3af" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.5rem' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Legend />
                <Area type="monotone" dataKey="count" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.6} name="Filler Count" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-center py-12">No filler word data yet.</p>
          )}
        </div>
      </div>

      {/* Top Keywords/Topics */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-xl font-bold text-white mb-4">Your Most Discussed Topics</h3>
        {topKeywords.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topKeywords} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" stroke="#9ca3af" />
              <YAxis dataKey="word" type="category" width={100} stroke="#9ca3af" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.5rem' }}
                labelStyle={{ color: '#fff' }}
              />
              <Bar dataKey="count" fill="#8b5cf6" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-400 text-center py-12">No keyword data yet. Start having conversations!</p>
        )}
      </div>

      {/* Recent Conversations */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-xl font-bold text-white mb-4">Recent Conversations</h3>
        {recentConversations.length > 0 ? (
          <div className="space-y-3">
            {recentConversations.map((conv, idx) => (
              <div key={conv.id} className="flex items-center justify-between p-4 bg-gray-900 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                    <span className="text-blue-400 font-semibold">{idx + 1}</span>
                  </div>
                  <div>
                    <p className="text-white font-medium">{conv.location || "Conversation"}</p>
                    <p className="text-sm text-gray-400">
                      {conv.startedAt ? new Date(conv.startedAt).toLocaleDateString() : "Unknown date"} •{" "}
                      {conv.endedAt && conv.startedAt 
                        ? `${Math.round((conv.endedAt - conv.startedAt) / 60000)} min` 
                        : "In progress"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    conv.status === "ended" 
                      ? "bg-green-500/20 text-green-400" 
                      : "bg-yellow-500/20 text-yellow-400"
                  }`}>
                    {conv.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-center py-12">No conversations yet. Start recording!</p>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, BarChart3, PieChart as PieChartIcon, TrendingUp, TrendingDown, Minus, Activity, Zap } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend, Area, ComposedChart, ReferenceLine,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Background3D from "@/components/Background3D";
import Navbar from "@/components/Navbar";
import { toast } from "sonner";

interface AnalysisRow {
  language: string | null;
  completion_percentage: number | null;
  effort_level: string | null;
  confidence_score: number | null;
  created_at: string;
}

const COLORS = [
  "hsl(142, 71%, 45%)",
  "hsl(185, 70%, 50%)",
  "hsl(262, 60%, 55%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 84%, 60%)",
  "hsl(200, 70%, 50%)",
  "hsl(330, 70%, 55%)",
  "hsl(60, 70%, 45%)",
];

function getWeekLabel(date: Date): string {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());
  return `${start.getMonth() + 1}/${start.getDate()}`;
}

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState<AnalysisRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("analyses")
      .select("language, completion_percentage, effort_level, confidence_score, created_at")
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) toast.error("Failed to load analytics");
        else setAnalyses(data || []);
        setLoading(false);
      });
  }, [user]);

  // --- Computed chart data ---
  const languageData = useMemo(() => {
    const counts: Record<string, number> = {};
    analyses.forEach((a) => {
      const lang = a.language || "Unknown";
      counts[lang] = (counts[lang] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [analyses]);

  const weeklyData = useMemo(() => {
    const weeks: Record<string, { week: string; count: number; avgCompletion: number; totalCompletion: number }> = {};
    analyses.forEach((a) => {
      const week = getWeekLabel(new Date(a.created_at));
      if (!weeks[week]) weeks[week] = { week, count: 0, avgCompletion: 0, totalCompletion: 0 };
      weeks[week].count += 1;
      weeks[week].totalCompletion += a.completion_percentage || 0;
    });
    return Object.values(weeks).map((w) => ({
      ...w,
      avgCompletion: w.count > 0 ? Math.round(w.totalCompletion / w.count) : 0,
    }));
  }, [analyses]);

  // Per-analysis momentum trend data with rolling average
  const trendData = useMemo(() => {
    return analyses.map((a, i) => {
      const score = a.completion_percentage || 0;
      // Rolling average of last 5 analyses
      const windowStart = Math.max(0, i - 4);
      const window = analyses.slice(windowStart, i + 1);
      const rollingAvg = Math.round(
        window.reduce((s, w) => s + (w.completion_percentage || 0), 0) / window.length
      );
      const date = new Date(a.created_at);
      return {
        label: `${date.getMonth() + 1}/${date.getDate()}`,
        score,
        rollingAvg,
        language: a.language || "Unknown",
        confidence: Math.round((Number(a.confidence_score) || 0) * 100),
      };
    });
  }, [analyses]);

  // Trend direction (compare recent 5 vs previous 5)
  const trendDirection = useMemo(() => {
    if (analyses.length < 2) return "neutral";
    const recent = analyses.slice(-Math.min(5, analyses.length));
    const recentAvg = recent.reduce((s, a) => s + (a.completion_percentage || 0), 0) / recent.length;
    const older = analyses.slice(0, -recent.length);
    if (older.length === 0) return "neutral";
    const olderAvg = older.reduce((s, a) => s + (a.completion_percentage || 0), 0) / older.length;
    const diff = recentAvg - olderAvg;
    if (diff > 3) return "improving";
    if (diff < -3) return "declining";
    return "stable";
  }, [analyses]);

  const stats = useMemo(() => {
    if (analyses.length === 0) return { total: 0, avgCompletion: 0, avgConfidence: 0, topLang: "—" };
    const avgCompletion = Math.round(analyses.reduce((s, a) => s + (a.completion_percentage || 0), 0) / analyses.length);
    const avgConfidence = Math.round((analyses.reduce((s, a) => s + (Number(a.confidence_score) || 0), 0) / analyses.length) * 100);
    const topLang = languageData[0]?.name || "—";
    return { total: analyses.length, avgCompletion, avgConfidence, topLang };
  }, [analyses, languageData]);

  if (authLoading || !user) return null;

  const StatCard = ({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string | number; accent?: boolean }) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-border bg-card/80 backdrop-blur-sm p-5 space-y-1"
    >
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <Icon className="w-4 h-4" />
        {label}
      </div>
      <p className={`text-2xl font-bold ${accent ? "text-primary" : "text-foreground"}`}>{value}</p>
    </motion.div>
  );

  const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    color: "hsl(var(--foreground))",
    fontSize: "12px",
  };

  return (
    <div className="min-h-screen relative">
      <Background3D />
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-16 relative z-10">
        <div className="flex items-center gap-4 mb-8">
          <Link to="/" className="text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-foreground">
            Analytics <span className="text-gradient">Dashboard</span>
          </h1>
        </div>

        {loading ? (
          <div className="text-center py-20 text-muted-foreground font-mono">Loading...</div>
        ) : analyses.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20 space-y-4">
            <BarChart3 className="w-12 h-12 text-primary/30 mx-auto" />
            <p className="text-muted-foreground font-mono">No data yet. Analyze some code first!</p>
          </motion.div>
        ) : (
          <div className="space-y-8">
            {/* Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={Activity} label="Total Analyses" value={stats.total} accent />
              <StatCard icon={TrendingUp} label="Avg Completion" value={`${stats.avgCompletion}%`} />
              <StatCard icon={BarChart3} label="Avg Confidence" value={`${stats.avgConfidence}%`} />
              <StatCard icon={PieChartIcon} label="Top Language" value={stats.topLang} />
            </div>

            {/* Charts Row */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Languages Pie */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-lg border border-border bg-card/80 backdrop-blur-sm p-6"
              >
                <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <PieChartIcon className="w-4 h-4 text-primary" /> Languages Analyzed
                </h2>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={languageData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      innerRadius={45}
                      paddingAngle={3}
                      stroke="none"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {languageData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </motion.div>

              {/* Analyses per Week Bar */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-lg border border-border bg-card/80 backdrop-blur-sm p-6"
              >
                <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" /> Analyses per Week
                </h2>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="week" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" name="Analyses" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>
            </div>

            {/* Code Quality Trend — Momentum Score */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-lg border border-border bg-card/80 backdrop-blur-sm p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" /> Code Quality Trend
                </h2>
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                  trendDirection === "improving"
                    ? "bg-primary/15 text-primary"
                    : trendDirection === "declining"
                    ? "bg-destructive/15 text-destructive"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {trendDirection === "improving" && <TrendingUp className="w-3 h-3" />}
                  {trendDirection === "declining" && <TrendingDown className="w-3 h-3" />}
                  {trendDirection === "stable" && <Minus className="w-3 h-3" />}
                  {trendDirection === "neutral" && <Minus className="w-3 h-3" />}
                  {trendDirection === "improving" ? "Improving" : trendDirection === "declining" ? "Declining" : "Stable"}
                </span>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={trendData}>
                  <defs>
                    <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number, name: string) => [
                      `${value}%`,
                      name === "score" ? "Momentum Score" : "Rolling Avg (5)",
                    ]}
                  />
                  <ReferenceLine y={stats.avgCompletion} stroke="hsl(var(--muted-foreground))" strokeDasharray="6 4" strokeOpacity={0.5} label={{ value: `Avg ${stats.avgCompletion}%`, fill: "hsl(var(--muted-foreground))", fontSize: 10, position: "right" }} />
                  <Area type="monotone" dataKey="score" fill="url(#scoreGrad)" stroke="none" />
                  <Line
                    type="monotone"
                    dataKey="score"
                    name="score"
                    stroke="hsl(142, 71%, 45%)"
                    strokeWidth={1.5}
                    dot={{ fill: "hsl(142, 71%, 45%)", r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="rollingAvg"
                    name="rollingAvg"
                    stroke="hsl(262, 60%, 55%)"
                    strokeWidth={2.5}
                    strokeDasharray="5 3"
                    dot={false}
                  />
                  <Legend
                    formatter={(value: string) =>
                      value === "score" ? "Momentum Score" : "Rolling Average"
                    }
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Confidence vs Completion Scatter-style */}
            <div className="grid md:grid-cols-2 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="rounded-lg border border-border bg-card/80 backdrop-blur-sm p-6"
              >
                <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" /> Confidence vs Momentum
                </h2>
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend />
                    <Bar dataKey="score" name="Momentum %" fill="hsl(142, 71%, 45%)" radius={[3, 3, 0, 0]} opacity={0.7} />
                    <Line type="monotone" dataKey="confidence" name="Confidence %" stroke="hsl(38, 92%, 50%)" strokeWidth={2} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </motion.div>

              {/* Weekly Avg Completion (existing, kept) */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="rounded-lg border border-border bg-card/80 backdrop-blur-sm p-6"
              >
                <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" /> Weekly Avg Completion
                </h2>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="week" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line
                      type="monotone"
                      dataKey="avgCompletion"
                      name="Avg Completion %"
                      stroke="hsl(185, 70%, 50%)"
                      strokeWidth={2}
                      dot={{ fill: "hsl(185, 70%, 50%)", r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </motion.div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;

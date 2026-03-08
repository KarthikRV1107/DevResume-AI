import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, BarChart3, PieChart as PieChartIcon, TrendingUp, Activity } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend,
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

            {/* Completion Trend Line */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-lg border border-border bg-card/80 backdrop-blur-sm p-6"
            >
              <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" /> Average Completion Over Time
              </h2>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
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
        )}
      </div>
    </div>
  );
};

export default Dashboard;

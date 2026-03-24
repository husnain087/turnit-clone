import { useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { Shield, Upload, Trash2, ChevronLeft, ChevronRight, Info, Search, Globe, FileText, Bot, User, History, LogOut, Download, Filter, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { extractTextFromFile } from "@/lib/fileExtractor";
import { generateAIWritingReport } from "@/lib/generateAIWritingReport";
import { generateSimilarityReport } from "@/lib/generateSimilarityReport";

interface FlaggedSection {
  text: string;
  reason: string;
  risk: string;
  source_url?: string;
  source_type?: string;
}

interface PlagiarismReport {
  similarity_score: number;
  paraphrase_score: number;
  ai_probability: number;
  flagged_sections: FlaggedSection[];
  summary: string;
  recommendations: string[];
}

// Source colors for highlighting
const SOURCE_COLORS = [
  "bg-red-500", "bg-purple-500", "bg-blue-500", "bg-green-500",
  "bg-orange-500", "bg-teal-500", "bg-amber-700", "bg-slate-500",
  "bg-violet-600", "bg-cyan-500", "bg-rose-500", "bg-indigo-500",
];

const SOURCE_TEXT_COLORS = [
  "text-red-500", "text-purple-500", "text-blue-500", "text-green-500",
  "text-orange-500", "text-teal-500", "text-amber-700", "text-slate-500",
  "text-violet-600", "text-cyan-500", "text-rose-500", "text-indigo-500",
];

const SOURCE_BG_COLORS = [
  "bg-red-500/15", "bg-purple-500/15", "bg-blue-500/15", "bg-green-500/15",
  "bg-orange-500/15", "bg-teal-500/15", "bg-amber-700/15", "bg-slate-500/15",
  "bg-violet-600/15", "bg-cyan-500/15", "bg-rose-500/15", "bg-indigo-500/15",
];

function SimilarityDonut({ percent, label }: { percent: number; label: string }) {
  const r = 54, c = 2 * Math.PI * r;
  const color = percent < 15 ? "hsl(142, 71%, 45%)" : percent < 40 ? "hsl(38, 92%, 50%)" : "hsl(0, 84%, 60%)";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 128 128" className="w-full h-full -rotate-90">
          <circle cx="64" cy="64" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="10" />
          <circle cx="64" cy="64" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c - (c * percent / 100)} className="transition-all duration-700" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold text-foreground tabular-nums">{percent}%</span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function HighlightedText({ text, sections, selectedSource, onSelectSource }: {
  text: string;
  sections: FlaggedSection[];
  selectedSource: number | null;
  onSelectSource: (idx: number | null) => void;
}) {
  // Build highlight ranges
  const highlights = useMemo(() => {
    const result: { start: number; end: number; idx: number }[] = [];
    const lowerText = text.toLowerCase();
    sections.forEach((section, i) => {
      const needle = section.text.toLowerCase().slice(0, 80);
      const idx = lowerText.indexOf(needle);
      if (idx >= 0) {
        result.push({ start: idx, end: idx + Math.min(section.text.length, text.length - idx), idx: i });
      }
    });
    return result.sort((a, b) => a.start - b.start);
  }, [text, sections]);

  // Build segments
  const segments = useMemo(() => {
    const segs: { text: string; sourceIdx: number | null }[] = [];
    let pos = 0;
    highlights.forEach((hl) => {
      if (hl.start > pos) {
        segs.push({ text: text.slice(pos, hl.start), sourceIdx: null });
      }
      segs.push({ text: text.slice(hl.start, hl.end), sourceIdx: hl.idx });
      pos = hl.end;
    });
    if (pos < text.length) {
      segs.push({ text: text.slice(pos), sourceIdx: null });
    }
    return segs;
  }, [text, highlights]);

  return (
    <div className="text-sm leading-relaxed whitespace-pre-wrap font-mono text-foreground/90">
      {segments.map((seg, i) => {
        if (seg.sourceIdx === null) {
          return <span key={i}>{seg.text}</span>;
        }
        const isSelected = selectedSource === seg.sourceIdx;
        const colorIdx = seg.sourceIdx % SOURCE_BG_COLORS.length;
        return (
          <span
            key={i}
            className={`cursor-pointer rounded px-0.5 transition-all ${
              isSelected ? `${SOURCE_BG_COLORS[colorIdx]} ring-2 ring-primary` : SOURCE_BG_COLORS[colorIdx]
            }`}
            onClick={() => onSelectSource(isSelected ? null : seg.sourceIdx)}
            title={`Source ${seg.sourceIdx! + 1}: ${sections[seg.sourceIdx!]?.reason}`}
          >
            <sup className={`text-[9px] font-bold ${SOURCE_TEXT_COLORS[colorIdx]}`}>[{seg.sourceIdx! + 1}]</sup>
            {seg.text}
          </span>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const { signOut, session } = useAuth();
  const [text, setText] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [language, setLanguage] = useState("auto");
  const [superSearch, setSuperSearch] = useState(false);
  const [scholarSearch, setScholarSearch] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [report, setReport] = useState<PlagiarismReport | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");

  // Filter states
  const [excludeBibliography, setExcludeBibliography] = useState(true);
  const [excludeQuotes, setExcludeQuotes] = useState(true);
  const [excludeSmallMatches, setExcludeSmallMatches] = useState(true);
  const [selectedSource, setSelectedSource] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"similarity" | "ai">("similarity");

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  // Filtered sections based on toggle states
  const filteredSections = useMemo(() => {
    if (!report) return [];
    return report.flagged_sections.filter((s) => {
      if (excludeSmallMatches && s.text.split(/\s+/).length < 6) return false;
      if (excludeQuotes && /^["'"']/.test(s.text.trim())) return false;
      if (excludeBibliography && /reference|bibliography|citation/i.test(s.reason)) return false;
      return true;
    });
  }, [report, excludeBibliography, excludeQuotes, excludeSmallMatches]);

  // Filtered similarity score
  const filteredScore = useMemo(() => {
    if (!report) return 0;
    if (filteredSections.length === report.flagged_sections.length) return report.similarity_score;
    const ratio = filteredSections.length / Math.max(report.flagged_sections.length, 1);
    return Math.round(report.similarity_score * ratio);
  }, [report, filteredSections]);

  const handleCheck = async () => {
    if (!text.trim() || wordCount < 5) {
      toast({ title: "Too short", description: "Please enter at least 5 words to analyze.", variant: "destructive" });
      return;
    }
    if (!session) {
      toast({ title: "Not logged in", description: "Please log in to check content.", variant: "destructive" });
      return;
    }

    setIsChecking(true);
    setReport(null);
    setSelectedSource(null);

    try {
      const { data: check, error: insertError } = await supabase
        .from("plagiarism_checks")
        .insert({
          user_id: session.user.id,
          title: text.slice(0, 50).trim() + (text.length > 50 ? "..." : ""),
          word_count: wordCount,
          status: "pending",
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-plagiarism`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ content: text, checkId: check?.id }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Analysis failed");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setReport(data.report);
      toast({ title: "Analysis complete", description: "Your plagiarism report is ready." });
    } catch (err: any) {
      console.error("Check error:", err);
      toast({ title: "Analysis failed", description: err.message || "Something went wrong", variant: "destructive" });
    } finally {
      setIsChecking(false);
    }
  };

  const handleFileLoad = useCallback(async (file: File) => {
    try {
      const extracted = await extractTextFromFile(file);
      setText(extracted);
      setUploadedFileName(file.name);
      toast({ title: "File loaded", description: `Extracted text from ${file.name}` });
    } catch (err: any) {
      toast({ title: "File error", description: err.message, variant: "destructive" });
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileLoad(file);
  }, [handleFileLoad]);

  const riskLevel = !report ? null : filteredScore < 15 ? "LOW" : filteredScore < 40 ? "MEDIUM" : "HIGH";
  const riskColor = riskLevel === "LOW" ? "text-green-500" : riskLevel === "MEDIUM" ? "text-yellow-500" : "text-red-500";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Nav */}
      <header className="h-14 border-b border-border glass flex items-center px-4 justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground text-sm hidden sm:inline">Turnitin</span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
            <Link to="/history"><History className="w-4 h-4 mr-1.5" /> History</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
            <Link to="/profile"><User className="w-4 h-4 mr-1.5" /> Profile</Link>
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={signOut}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-border bg-card/30">
        <div className="container">
          <Tabs defaultValue="web" className="w-full">
            <TabsList className="bg-transparent h-12 p-0 gap-0">
              <TabsTrigger value="web" className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-6">
                <Globe className="w-4 h-4 mr-2" /> Web Search
              </TabsTrigger>
              <TabsTrigger value="compare" className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-6">
                <FileText className="w-4 h-4 mr-2" /> Text Comparison
              </TabsTrigger>
              <TabsTrigger value="ai" className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-6">
                <Bot className="w-4 h-4 mr-2" /> AI Detection
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Filters */}
        <aside className={`${sidebarOpen ? "w-64" : "w-0"} shrink-0 border-r border-border bg-card/30 overflow-hidden transition-all duration-300 hidden lg:block`}>
          <div className="p-4 space-y-6 w-64">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-primary flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5" /> Filters & Settings
              </h3>
              <button onClick={() => setSidebarOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            {/* Filter Toggles */}
            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Exclusion Filters</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="excl-bib" className="text-xs cursor-pointer">Exclude Bibliography</Label>
                  <Switch id="excl-bib" checked={excludeBibliography} onCheckedChange={setExcludeBibliography} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="excl-quotes" className="text-xs cursor-pointer">Exclude Quotes</Label>
                  <Switch id="excl-quotes" checked={excludeQuotes} onCheckedChange={setExcludeQuotes} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="excl-small" className="text-xs cursor-pointer">Exclude Small Matches</Label>
                  <Switch id="excl-small" checked={excludeSmallMatches} onCheckedChange={setExcludeSmallMatches} />
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-4 space-y-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Search Options</h4>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox id="super" checked={superSearch} onCheckedChange={(v) => setSuperSearch(v === true)} />
                  <Label htmlFor="super" className="text-xs cursor-pointer">Super Search</Label>
                  <Info className="w-3 h-3 text-muted-foreground" />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="scholar" checked={scholarSearch} onCheckedChange={(v) => setScholarSearch(v === true)} />
                  <Label htmlFor="scholar" className="text-xs cursor-pointer">Google Scholar</Label>
                  <Info className="w-3 h-3 text-muted-foreground" />
                </div>
              </div>
            </div>

            {/* Filter status when report active */}
            {report && (
              <div className="border-t border-border pt-4 space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filter Status</h4>
                <div className="glass rounded-lg p-3 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Original Score</span>
                    <span className="font-semibold text-foreground">{report.similarity_score}%</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Filtered Score</span>
                    <span className="font-semibold text-primary">{filteredScore}%</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Sources Shown</span>
                    <span className="font-semibold text-foreground">{filteredSections.length}/{report.flagged_sections.length}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>

        {!sidebarOpen && (
          <button onClick={() => setSidebarOpen(true)} className="hidden lg:flex items-center justify-center w-8 shrink-0 border-r border-border bg-card/30 text-muted-foreground hover:text-foreground transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {/* Center - Text Input with Inline Highlighting */}
        <main className="flex-1 flex flex-col min-w-0 p-4 md:p-6 overflow-y-auto">
          <div className="flex items-center gap-3 mb-4">
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-40 h-9 bg-secondary/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Automatic</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Spanish</SelectItem>
                <SelectItem value="fr">French</SelectItem>
                <SelectItem value="de">German</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={() => { setText(""); setReport(null); setSelectedSource(null); }}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>

          {/* Show highlighted text when report is ready, otherwise show textarea */}
          {report && !isChecking ? (
            <div className="flex-1 min-h-[200px] bg-secondary/30 border border-border rounded-md p-4 overflow-y-auto">
              <HighlightedText
                text={text}
                sections={filteredSections}
                selectedSource={selectedSource}
                onSelectSource={setSelectedSource}
              />
            </div>
          ) : (
            <Textarea
              placeholder="Insert text to find plagiarism..."
              className="flex-1 min-h-[200px] bg-secondary/30 border-border resize-none text-sm leading-relaxed focus:glow-border transition-shadow"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          )}

          {/* File Upload */}
          {!report && (
            <div
              className={`mt-4 border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById("file-input")?.click()}
            >
              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Drag files here or <span className="text-primary">browse</span></p>
              <p className="text-xs text-muted-foreground/60 mt-1">Supports PDF, DOCX, TXT, RTF, CSV, MD, HTML, JSON</p>
              <input id="file-input" type="file" accept=".pdf,.doc,.docx,.txt,.rtf,.csv,.md,.html,.htm,.xml,.json" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileLoad(file);
              }} />
            </div>
          )}

          {/* Bottom bar */}
          <div className="flex items-center justify-between mt-4 gap-4 flex-wrap">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="tabular-nums">{wordCount} words</span>
              {report && <span className="text-xs">Click highlighted text to view source details</span>}
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => { setText(""); setReport(null); setSelectedSource(null); }}>Clear</Button>
              {report ? (
                <Button size="sm" onClick={() => { setReport(null); setSelectedSource(null); }} variant="outline">New Check</Button>
              ) : null}
              <Button size="sm" onClick={handleCheck} disabled={!text.trim() || isChecking} className="px-6 active:scale-[0.97] transition-transform shadow-lg shadow-primary/20">
                {isChecking ? "Analyzing..." : "Detect Plagiarism"}
              </Button>
            </div>
          </div>
        </main>

        {/* Right - Report Panel */}
        <aside className="w-80 xl:w-96 shrink-0 border-l border-border bg-card/30 overflow-y-auto hidden md:block">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Report</h3>
              {report && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => generateAIWritingReport(report, text, uploadedFileName || undefined)} className="gap-1.5 text-xs">
                    <Download className="w-3 h-3" /> AI
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => generateSimilarityReport(report, text, uploadedFileName || undefined)} className="gap-1.5 text-xs">
                    <Download className="w-3 h-3" /> Similarity
                  </Button>
                </div>
              )}
            </div>

            {/* Report tab switcher */}
            {report && !isChecking && (
              <div className="flex gap-1 mb-4 p-1 bg-secondary/50 rounded-lg">
                <button
                  className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${activeTab === "similarity" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setActiveTab("similarity")}
                >
                  Similarity
                </button>
                <button
                  className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${activeTab === "ai" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setActiveTab("ai")}
                >
                  AI Detection
                </button>
              </div>
            )}

            {isChecking && (
              <div className="flex flex-col items-center gap-4 py-12">
                <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">AI is analyzing your content...</p>
                <p className="text-xs text-muted-foreground/60">This may take 10-30 seconds</p>
              </div>
            )}

            {!report && !isChecking && (
              <div className="flex flex-col items-center gap-4 py-16 text-center">
                <Search className="w-16 h-16 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Paste your text and click "Detect Plagiarism" to get a detailed report</p>
              </div>
            )}

            {report && !isChecking && activeTab === "similarity" && (
              <div className="space-y-5 animate-fade-in">
                {/* Score donuts */}
                <div className="flex justify-center gap-6">
                  <SimilarityDonut percent={filteredScore} label="Similarity" />
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center text-xs font-bold text-white">
                      {report.paraphrase_score}%
                    </div>
                    <span className="text-xs text-muted-foreground">Paraphrase</span>
                  </div>
                </div>

                <div className="text-center">
                  <p className={`text-sm font-bold uppercase tracking-wider ${riskColor}`}>
                    {riskLevel} PLAGIARISM RISK
                  </p>
                </div>

                {/* Summary */}
                <div className="glass rounded-lg p-3">
                  <h4 className="text-xs font-medium text-foreground mb-1.5">Summary</h4>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{report.summary}</p>
                </div>

                {/* Source Panel - ranked by type */}
                {filteredSections.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Primary Sources ({filteredSections.length})</h4>
                    {filteredSections.map((s, i) => {
                      const colorIdx = i % SOURCE_COLORS.length;
                      const isSelected = selectedSource === i;
                      return (
                        <div
                          key={i}
                          className={`glass rounded-lg p-3 space-y-1 cursor-pointer transition-all border ${isSelected ? "border-primary ring-1 ring-primary/30" : "border-transparent hover:border-border"}`}
                          onClick={() => setSelectedSource(isSelected ? null : i)}
                        >
                          <div className="flex items-start gap-2">
                            <span className={`${SOURCE_COLORS[colorIdx]} text-white text-[10px] font-bold w-5 h-5 rounded flex items-center justify-center shrink-0`}>
                              {i + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              {s.source_url && (
                                <a href={s.source_url} target="_blank" rel="noopener noreferrer"
                                   className={`text-[11px] ${SOURCE_TEXT_COLORS[colorIdx]} hover:underline flex items-center gap-1 truncate`}
                                   onClick={(e) => e.stopPropagation()}>
                                  {s.source_url}
                                  <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                </a>
                              )}
                              <p className="text-[10px] text-muted-foreground">{s.source_type || "Internet Source"}</p>
                            </div>
                            <span className="text-xs font-semibold text-muted-foreground shrink-0">&lt;1%</span>
                          </div>
                          {isSelected && (
                            <div className="mt-2 pt-2 border-t border-border">
                              <p className="text-[10px] text-muted-foreground italic">"{s.text.slice(0, 200)}{s.text.length > 200 ? "..." : ""}"</p>
                              <p className="text-[10px] text-muted-foreground/70 mt-1">{s.reason}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Recommendations */}
                {report.recommendations.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Recommendations</h4>
                    <ul className="space-y-1.5">
                      {report.recommendations.map((r, i) => (
                        <li key={i} className="text-[11px] text-muted-foreground flex gap-2">
                          <span className="text-primary shrink-0">•</span>
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {report && !isChecking && activeTab === "ai" && (
              <div className="space-y-5 animate-fade-in">
                {/* AI Detection Score */}
                <div className="flex justify-center">
                  <SimilarityDonut percent={report.ai_probability} label="AI Detected" />
                </div>

                <div className="text-center">
                  <p className={`text-sm font-bold uppercase tracking-wider ${
                    report.ai_probability < 20 ? "text-green-500" : report.ai_probability < 50 ? "text-yellow-500" : "text-red-500"
                  }`}>
                    {report.ai_probability < 20 ? "LOW" : report.ai_probability < 50 ? "MODERATE" : "HIGH"} AI PROBABILITY
                  </p>
                </div>

                {/* AI Disclaimer */}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                  <p className="text-[10px] text-blue-400 font-semibold mb-1">⚠ Important Disclaimer</p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    AI detection may produce false positives. Scores below 20% have a higher likelihood of false positives.
                    Do not use this as the sole basis for academic decisions.
                  </p>
                </div>

                {/* Qualifying Text Info */}
                <div className="glass rounded-lg p-3">
                  <h4 className="text-xs font-medium text-foreground mb-1.5">Qualifying Text</h4>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    AI detection processes only long-form paragraph text. Bullet points, tables, references, and lists are excluded from analysis.
                    The AI percentage is based only on qualifying text.
                  </p>
                </div>

                {/* AI Flagged Sections */}
                {report.flagged_sections.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">AI-Detected Segments</h4>
                    {report.flagged_sections.map((s, i) => (
                      <div key={i} className="glass rounded-lg p-3 space-y-1.5 border-l-2 border-cyan-500">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                            s.risk === "high" ? "bg-red-500/20 text-red-400" :
                            s.risk === "medium" ? "bg-yellow-500/20 text-yellow-400" :
                            "bg-green-500/20 text-green-400"
                          }`}>{s.risk}</span>
                          <span className="text-[10px] text-muted-foreground">{s.reason}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground/80 italic">"{s.text.slice(0, 150)}{s.text.length > 150 ? "..." : ""}"</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

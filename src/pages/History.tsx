import { Link } from "react-router-dom";
import { Shield, ArrowLeft, FileText, Calendar, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const mockHistory = [
  { id: "1", title: "Research Paper Draft", date: "Mar 18, 2026", words: 1247, similarity: 5, status: "completed" as const },
  { id: "2", title: "Blog Post - AI Trends", date: "Mar 15, 2026", words: 843, similarity: 32, status: "completed" as const },
  { id: "3", title: "Assignment Chapter 3", date: "Mar 12, 2026", words: 2100, similarity: 12, status: "completed" as const },
  { id: "4", title: "Product Description", date: "Mar 10, 2026", words: 320, similarity: 67, status: "completed" as const },
  { id: "5", title: "Newsletter Draft", date: "Mar 8, 2026", words: 560, similarity: 2, status: "completed" as const },
];

function getRisk(s: number) {
  if (s < 15) return { label: "Low", color: "text-success bg-success/10" };
  if (s < 40) return { label: "Medium", color: "text-warning bg-warning/10" };
  return { label: "High", color: "text-danger bg-danger/10" };
}

export default function HistoryPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b border-border glass flex items-center px-4 justify-between">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground text-sm">Turnitin</span>
          </Link>
        </div>
        <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
          <Link to="/dashboard">Back to Checker</Link>
        </Button>
      </header>

      <div className="container max-w-3xl py-8 md:py-12">
        <h1 className="text-2xl font-bold text-foreground mb-1">Check History</h1>
        <p className="text-sm text-muted-foreground mb-8">All your past plagiarism checks.</p>

        <div className="space-y-3">
          {mockHistory.map((item, i) => {
            const risk = getRisk(item.similarity);
            return (
              <div key={item.id} className="glass rounded-xl p-4 hover:border-primary/20 transition-all duration-300 animate-fade-in-up" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-medium text-foreground truncate">{item.title}</h3>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {item.date}</span>
                        <span>{item.words} words</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-lg font-bold text-foreground tabular-nums">{item.similarity}%</p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${risk.color}`}>{risk.label}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="text-muted-foreground">
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

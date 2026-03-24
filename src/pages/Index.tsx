import { Link } from "react-router-dom";
import { Shield, Search, FileText, Zap, ChevronRight, BarChart3, Globe, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useRef } from "react";

const features = [
  { icon: Search, title: "Deep Web Search", desc: "Scans billions of web pages, journals, and academic databases in seconds." },
  { icon: Shield, title: "AI Detection", desc: "Identifies AI-generated content alongside traditional plagiarism." },
  { icon: BarChart3, title: "Detailed Reports", desc: "Get source-level breakdowns with similarity scores and matched passages." },
  { icon: FileText, title: "File Upload", desc: "Upload PDF, DOCX, or TXT files directly — no copy-paste needed." },
  { icon: Globe, title: "Multi-Language", desc: "Supports over 30 languages for global content verification." },
  { icon: Lock, title: "Privacy First", desc: "Your documents are encrypted and never stored after analysis." },
];

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("animate-fade-in-up");
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

function RevealSection({ children, className = "", delay = "" }: { children: React.ReactNode; className?: string; delay?: string }) {
  const ref = useScrollReveal();
  return (
    <div ref={ref} className={`opacity-0 ${className}`} style={{ animationDelay: delay }}>
      {children}
    </div>
  );
}

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 inset-x-0 z-50 glass border-b border-white/[0.06]">
        <div className="container flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold text-foreground tracking-tight">Turnitin</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">How it Works</a>
            <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Log in</Link>
            <Button asChild size="sm" className="active:scale-[0.97] transition-transform">
              <Link to="/signup">Sign Up Free</Link>
            </Button>
          </div>
          <Button variant="ghost" size="icon" className="md:hidden" asChild>
            <Link to="/login"><Zap className="w-4 h-4" /></Link>
          </Button>
        </div>
      </nav>

      <section className="pt-32 pb-24 md:pt-44 md:pb-36 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(245_58%_51%/0.15),transparent_60%)]" />
        <div className="container relative text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-sm text-primary mb-8 animate-fade-in">
            <Zap className="w-3.5 h-3.5" /> Superior Plagiarism Detection Accuracy
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.08] text-foreground mb-6 animate-fade-in-up" style={{ textWrap: "balance" as any }}>
            The Best Plagiarism Checker for the Modern Age
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto mb-10 animate-fade-in-up" style={{ animationDelay: "100ms", textWrap: "pretty" as any }}>
            Writing platforms have evolved. It's time your plagiarism checker did too. Check for originality with confidence.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up" style={{ animationDelay: "200ms" }}>
            <Button asChild size="lg" className="text-base px-8 active:scale-[0.97] transition-transform shadow-lg shadow-primary/25">
              <Link to="/signup">Sign Up Free <ChevronRight className="w-4 h-4 ml-1" /></Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-base px-8 active:scale-[0.97] transition-transform">
              <Link to="/dashboard">Try Demo</Link>
            </Button>
          </div>
        </div>
      </section>

      <section id="features" className="py-24 md:py-32">
        <div className="container">
          <RevealSection className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4" style={{ textWrap: "balance" as any }}>
              Everything you need to verify originality
            </h2>
            <p className="text-muted-foreground text-lg max-w-lg mx-auto">
              Powerful tools designed for writers, educators, and researchers.
            </p>
          </RevealSection>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <RevealSection key={f.title} delay={`${i * 80}ms`}>
                <div className="glass rounded-xl p-6 hover:border-primary/20 transition-all duration-300 group h-full">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <f.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-24 md:py-32 border-t border-border">
        <div className="container max-w-3xl mx-auto">
          <RevealSection className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">How it works</h2>
            <p className="text-muted-foreground text-lg">Three simple steps to verify your content.</p>
          </RevealSection>
          {[
            { step: "01", title: "Paste or Upload", desc: "Enter your text or upload a document file." },
            { step: "02", title: "Analyze", desc: "Our engine scans billions of sources across the web and academic databases." },
            { step: "03", title: "Review Report", desc: "Get a detailed report with similarity scores, sources, and highlighted matches." },
          ].map((s, i) => (
            <RevealSection key={s.step} delay={`${i * 120}ms`} className="flex gap-6 mb-12 last:mb-0">
              <div className="text-3xl font-bold text-primary/40 tabular-nums shrink-0 w-12">{s.step}</div>
              <div>
                <h3 className="text-xl font-semibold text-foreground mb-1">{s.title}</h3>
                <p className="text-muted-foreground">{s.desc}</p>
              </div>
            </RevealSection>
          ))}
        </div>
      </section>

      <section className="py-24">
        <div className="container">
          <RevealSection>
            <div className="glass-strong rounded-2xl p-12 md:p-16 text-center max-w-2xl mx-auto glow-border">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Ready to check your content?</h2>
              <p className="text-muted-foreground text-lg mb-8">Start with 500 free words. No credit card required.</p>
              <Button asChild size="lg" className="text-base px-10 active:scale-[0.97] transition-transform shadow-lg shadow-primary/25">
                <Link to="/signup">Create Free Account <ChevronRight className="w-4 h-4 ml-1" /></Link>
              </Button>
            </div>
          </RevealSection>
        </div>
      </section>

      <footer className="border-t border-border py-12">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
              <Shield className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="text-sm font-medium text-foreground">Turnitin</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Turnitin. Write with integrity.
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Terms</a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

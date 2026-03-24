import { Link } from "react-router-dom";
import { Shield, ArrowLeft, User, Mail, Calendar, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";

export default function Profile() {
  const { user, signOut } = useAuth();
  const quotaUsed = 89;
  const quotaTotal = 500;
  const checksThisMonth = 12;

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

      <div className="container max-w-2xl py-8 md:py-12">
        <div className="glass-strong rounded-2xl p-8 animate-fade-in-up">
          {/* Avatar */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-4">
              <User className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground">{user?.user_metadata?.full_name || "User"}</h1>
            <p className="text-sm text-muted-foreground">{user?.email || ""}</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="glass rounded-xl p-4 text-center">
              <BarChart3 className="w-5 h-5 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground tabular-nums">{checksThisMonth}</p>
              <p className="text-xs text-muted-foreground">Checks this month</p>
            </div>
            <div className="glass rounded-xl p-4 text-center">
              <Calendar className="w-5 h-5 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">Mar 2026</p>
              <p className="text-xs text-muted-foreground">Member since</p>
            </div>
          </div>

          {/* Quota */}
          <div className="glass rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-foreground">Word Quota</h3>
              <span className="text-sm text-muted-foreground tabular-nums">{quotaUsed}/{quotaTotal}</span>
            </div>
            <Progress value={(quotaUsed / quotaTotal) * 100} className="h-2 mb-2" />
            <p className="text-xs text-muted-foreground">{quotaTotal - quotaUsed} words remaining this period</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-8">
            <Button variant="outline" className="flex-1 active:scale-[0.97] transition-transform">Edit Profile</Button>
            <Button variant="outline" className="flex-1 text-destructive hover:text-destructive active:scale-[0.97] transition-transform" onClick={signOut}>Log Out</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

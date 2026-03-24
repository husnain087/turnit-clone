import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Lock, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const { updatePassword } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Check for recovery token in URL hash
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      // Supabase handles session setup from hash automatically
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return;
    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setDone(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(245_58%_51%/0.1),transparent_60%)]" />
      <div className="w-full max-w-md relative animate-fade-in-up">
        <div className="glass-strong rounded-2xl p-8 md:p-10">
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
          </div>
          {done ? (
            <div className="text-center">
              <h1 className="text-2xl font-bold text-foreground mb-2">Password updated</h1>
              <p className="text-sm text-muted-foreground mb-8">Your password has been reset successfully.</p>
              <Button asChild className="active:scale-[0.97] transition-transform">
                <Link to="/login">Go to Login</Link>
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-foreground text-center mb-2">Set new password</h1>
              <p className="text-sm text-muted-foreground text-center mb-8">Enter your new password below.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="password" type={showPassword ? "text" : "password"} placeholder="New password" className="pl-10 pr-10 h-11 bg-secondary/50" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="confirm" type="password" placeholder="Confirm password" className="pl-10 h-11 bg-secondary/50" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={6} />
                  </div>
                </div>
                {password && confirm && password !== confirm && (
                  <p className="text-sm text-destructive">Passwords do not match.</p>
                )}
                <Button type="submit" className="w-full h-11 active:scale-[0.97] transition-transform shadow-lg shadow-primary/20" disabled={loading}>
                  {loading ? "Updating..." : "Update Password"}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

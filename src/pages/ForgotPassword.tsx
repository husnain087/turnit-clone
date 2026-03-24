import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Mail, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const { resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await resetPassword(email);
    setLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setSent(true);
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
          {sent ? (
            <div className="text-center">
              <h1 className="text-2xl font-bold text-foreground mb-2">Check your email</h1>
              <p className="text-sm text-muted-foreground mb-8">We sent a password reset link to <span className="text-foreground">{email}</span></p>
              <Button asChild variant="outline" className="active:scale-[0.97] transition-transform">
                <Link to="/login"><ArrowLeft className="w-4 h-4 mr-2" /> Back to login</Link>
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-foreground text-center mb-2">Forgot password?</h1>
              <p className="text-sm text-muted-foreground text-center mb-8">Enter your email and we'll send you a reset link.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="email" type="email" placeholder="Enter your email" className="pl-10 h-11 bg-secondary/50" value={email} onChange={e => setEmail(e.target.value)} required />
                  </div>
                </div>
                <Button type="submit" className="w-full h-11 active:scale-[0.97] transition-transform shadow-lg shadow-primary/20" disabled={loading}>
                  {loading ? "Sending..." : "Send Reset Link"}
                </Button>
              </form>
              <p className="text-sm text-muted-foreground text-center mt-6">
                <Link to="/login" className="text-primary hover:underline font-medium inline-flex items-center gap-1">
                  <ArrowLeft className="w-3 h-3" /> Back to login
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

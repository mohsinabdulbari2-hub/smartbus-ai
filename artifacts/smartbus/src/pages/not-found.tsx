import { Link } from "wouter";
import { AlertCircle, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50/50 p-4">
      <div className="text-center bg-card p-10 rounded-3xl shadow-xl border border-border max-w-md w-full">
        <div className="w-20 h-20 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-10 h-10" />
        </div>
        <h1 className="text-4xl font-display font-black text-foreground mb-2">404</h1>
        <p className="text-lg text-muted-foreground mb-8">This route doesn't exist on our map.</p>
        
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-transform"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Map
        </Link>
      </div>
    </div>
  );
}

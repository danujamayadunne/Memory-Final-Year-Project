"use client";

import { useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Brain, Zap, Shield, ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

export default function Home() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (user && !loading) {
      window.location.href = "/dashboard";
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">

      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <BookOpen className="h-4 w-4" />
              </div>
              <span className="text-xl font-bold font-serif">Memory</span>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" asChild>
                <Link href="/auth/login">Sign In</Link>
              </Button>
              <Button asChild>
                <Link href="/auth/signup">Get Started</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <section className="container mx-auto px-4 py-20">
        <div className="text-center max-w-4xl mx-auto">
          <Badge variant="secondary" className="mb-4">
            <Sparkles className="h-3 w-3 mr-1" />
            AI-Powered Summarization
          </Badge>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">
            Turn any web content into
            <span className="text-primary block">intelligent summaries</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Memory uses advanced AI to extract and summarize the most important information from web pages, saving you time and helping you retain knowledge.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href="/auth/signup">
                Start Summarizing
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/auth/login">Sign In</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4 tracking-tight">Why Choose Memory?</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Powerful features designed to enhance your learning and productivity
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          <Card className="text-center">
            <CardHeader>
              <div className="flex justify-center mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Brain className="h-6 w-6" />
                </div>
              </div>
              <CardTitle>AI-Powered Analysis</CardTitle>
              <CardDescription>
                Advanced AI models extract key insights from any web content
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="text-center">
            <CardHeader>
              <div className="flex justify-center mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Zap className="h-6 w-6" />
                </div>
              </div>
              <CardTitle>Lightning Fast</CardTitle>
              <CardDescription>
                Get summaries in seconds, not minutes. Process content at scale
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="text-center">
            <CardHeader>
              <div className="flex justify-center mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Shield className="h-6 w-6" />
                </div>
              </div>
              <CardTitle>Secure & Private</CardTitle>
              <CardDescription>
                Your data is encrypted and secure. We respect your privacy
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      <section className="container mx-auto px-4 py-20">
        <Card className="max-w-4xl mx-auto text-center">
          <CardHeader>
            <CardTitle className="text-3xl font-bold tracking-tight">Ready to get started?</CardTitle>
            <CardDescription className="text-lg">
              Join thousands of users who are already saving time with Memory
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild>
                <Link href="/auth/signup">
                  Create Free Account
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/auth/login">Sign In</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <footer className="border-t bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground">
                <BookOpen className="h-3 w-3" />
              </div>
              <span className="font-semibold">Memory</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 Memory. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

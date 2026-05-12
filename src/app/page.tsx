"use client";

import { useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Instrument_Serif } from "next/font/google";
import {
  Brain,
  Search,
  FileText,
  Map,
  Image as ImageIcon,
  MessageSquare,
  ArrowRight,
  Sparkles,
  Layers,
  GraduationCap,
  FlaskConical,
  PenTool,
  Cpu,
  Lock,
  Tag,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

const features: Feature[] = [
  {
    icon: Brain,
    title: "AI-Powered Summaries",
    description:
      "Paste any URL. Papers, blogs, images. Memory extracts and summarizes the key insights instantly.",
  },
  {
    icon: Search,
    title: "Semantic Search",
    description:
      "Search by meaning, not keywords. Describe what you remember and find it across everything you've saved.",
  },
  {
    icon: FileText,
    title: "Rich Notes with AI",
    description:
      "A beautiful editor with real-time AI completions. Import from your summaries and build connected notes.",
  },
  {
    icon: Map,
    title: "Knowledge Map",
    description:
      "Visualize how your ideas connect. An interactive graph reveals relationships between topics and research.",
  },
  {
    icon: ImageIcon,
    title: "Image Memories",
    description:
      "Save visual references and search them by description. AI understands your images and makes them findable.",
  },
  {
    icon: MessageSquare,
    title: "AI Chat Assistant",
    description:
      "Discuss any saved content with AI. Ask questions, get explanations, and deepen your understanding.",
  },
];

const audiences = [
  {
    icon: GraduationCap,
    title: "Students",
    description:
      "Never lose a lecture insight again. Summarize readings, build study notes, and connect ideas across courses.",
  },
  {
    icon: FlaskConical,
    title: "Researchers",
    description:
      "Organize papers, discover connections between studies, and build your literature review effortlessly.",
  },
  {
    icon: PenTool,
    title: "Writers",
    description:
      "Collect sources, organize references, and draft with AI assistance. Your research, always at hand.",
  },
];

const font = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  style: "italic"
});

export default function Home() {

  const { user, loading } = useAuth();

  useEffect(() => {
    if (user && !loading) {
      window.location.href = "/dashboard";
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B1A0F]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8FB89A] mx-auto" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1A0F] text-[#F5F0E8]">

      <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-3xl">
        <div className="flex items-center gap-4 sm:gap-8 bg-[#132B1A]/80 backdrop-blur-xl border border-[#1E3A26]/60 rounded-full px-5 sm:px-6 py-3 shadow-2xl shadow-black/20">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <span className="text-lg font-semibold tracking-tight font-serif">
              Memory
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-6 text-sm text-[#8FB89A]/80">
            <a
              href="#features"
              className="hover:text-[#F5F0E8] transition-colors"
            >
              Features
            </a>
            <a
              href="#built-for"
              className="hover:text-[#F5F0E8] transition-colors"
            >
              Who It&apos;s For
            </a>
            <a href="#ai" className="hover:text-[#F5F0E8] transition-colors">
              AI
            </a>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 ml-auto">
            <Link
              href="/auth/login"
              className="text-sm text-[#B8B0A2] hover:text-[#F5F0E8] transition-colors px-3 py-1.5"
            >
              Log In
            </Link>
            <Link
              href="/auth/signup"
              className="text-sm bg-[#F5F0E8] text-[#0B1A0F] px-5 py-1.5 rounded-full font-medium hover:bg-white transition-colors"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative pt-40 sm:pt-48 pb-32 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,_#1a3d24,_transparent)]" />
        <div className="relative max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-[#8FB89A] mb-10 font-medium">
            <Sparkles className="h-3.5 w-3.5" />
            Your Second Brain for Everything
          </div>

          <h1 className={`text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] leading-[1] tracking-[-0.02em] mb-8 ${font.className}`}>
            Remember Everything
            <br />
            You Learn.
          </h1>

          <p className="text-lg md:text-xl text-[#B8B0A2] max-w-2xl mx-auto mb-14 leading-relaxed">
            Save a research paper, a lecture video, an article.
            <br className="hidden sm:block" />
            Memory summarizes it, understands it,
            <br className="hidden sm:block" />
            and makes it findable forever.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/signup"
              className="inline-flex items-center justify-center gap-2 bg-[#F5F0E8] text-[#0B1A0F] px-8 py-3.5 rounded-full font-medium hover:bg-white transition-all hover:shadow-lg hover:shadow-[#8FB89A]/10"
            >
              Get Started Free
            </Link>
            <a
              href="#features"
              className="inline-flex items-center justify-center gap-2 border border-[#1E3A26] text-[#B8B0A2] px-8 py-3.5 rounded-full hover:border-[#3D6A4D] hover:text-[#F5F0E8] transition-all"
            >
              See How It Works
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      <section id="features" className="py-28 px-6 scroll-mt-24">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col items-start md:flex-row md:items-end md:justify-between gap-6 mb-16">
            <div>
              <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-[#8FB89A] mb-4 font-medium">
                <Layers className="h-3.5 w-3.5" />
                Capture
              </div>
              <h2 className={`text-4xl md:text-5xl tracking-[-0.02em] leading-[1.1] ${font.className}`}>
                Capture Anything.
                <br />
                <span className="text-[#8FB89A]">Connect Everything.</span>
              </h2>
            </div>
            <p className="text-[#B8B0A2] max-w-md text-base leading-relaxed">
              Six powerful tools working together to help you save, understand,
              and retrieve knowledge effortlessly.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div
                key={f.title}
                className="group p-7 rounded-2xl border border-[#1E3A26]/60 bg-[#0F2415]/40 hover:bg-[#132B1A]/60 hover:border-[#2A5A3B]/60 transition-all duration-300"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1E3A26]/60 text-[#8FB89A] mb-5 group-hover:bg-[#2A5A3B]/40 transition-colors">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold mb-2 tracking-tight">
                  {f.title}
                </h3>
                <p className="text-sm text-[#B8B0A2] leading-relaxed">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-[#1E3A26] to-transparent" />
      </div>

      <section id="built-for" className="py-28 px-6 scroll-mt-24">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-[#8FB89A] mb-4 font-medium">
              <GraduationCap className="h-3.5 w-3.5" />
              Who Memory Is For
            </div>
            <h2 className={`text-4xl md:text-5xl tracking-[-0.02em] leading-[1.1] ${font.className}`}>
              For Students &amp; Teams Who Want
              <br />
              <span className="text-[#8FB89A]">
                All Their Research in One Place
              </span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {audiences.map((a) => (
              <div
                key={a.title}
                className="relative p-8 rounded-2xl bg-[#F5F0E8]/[0.03] border border-[#1E3A26]/40 hover:border-[#2A5A3B]/50 transition-all group"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1E3A26]/40 text-[#8FB89A] mb-6 group-hover:bg-[#2A5A3B]/30 transition-colors">
                  <a.icon className="h-6 w-6" />
                </div>
                <h3 className={`text-2xl mb-3 ${font.className}`}>
                  {a.title}
                </h3>
                <p className="text-sm text-[#B8B0A2] leading-relaxed">
                  {a.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-[#1E3A26] to-transparent" />
      </div>

      <section id="ai" className="py-28 px-6 scroll-mt-24">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-[#8FB89A] mb-4 font-medium">
            <Cpu className="h-3.5 w-3.5" />
            AI-Powered
          </div>
          <h2 className={`text-4xl md:text-5xl lg:text-6xl tracking-[-0.02em] leading-[1.05] mb-8 ${font.className}`}>
            The Research Partner That
            <br />
            <span className="text-[#8FB89A]">Understands Your Work</span>
          </h2>
          <p className="text-lg text-[#B8B0A2] max-w-2xl mx-auto mb-16 leading-relaxed">
            Memory integrates with the best AI models. OpenAI, Anthropic,
            and Google. So you get the intelligence you need, with the
            provider you trust.
          </p>

          <div className="grid sm:grid-cols-3 gap-5 max-w-3xl mx-auto">
            <div className="p-6 rounded-2xl border border-[#1E3A26]/60 bg-[#0F2415]/30">
              <Cpu className="h-5 w-5 text-[#8FB89A] mx-auto mb-3" />
              <h4 className="font-semibold mb-1 text-sm">Multi-Provider</h4>
              <p className="text-xs text-[#B8B0A2]">
                OpenAI, Anthropic, Google. Choose your AI engine
              </p>
            </div>
            <div className="p-6 rounded-2xl border border-[#1E3A26]/60 bg-[#0F2415]/30">
              <Lock className="h-5 w-5 text-[#8FB89A] mx-auto mb-3" />
              <h4 className="font-semibold mb-1 text-sm">
                Your Keys, Encrypted
              </h4>
              <p className="text-xs text-[#B8B0A2]">
                API keys are encrypted and stored securely
              </p>
            </div>
            <div className="p-6 rounded-2xl border border-[#1E3A26]/60 bg-[#0F2415]/30">
              <Tag className="h-5 w-5 text-[#8FB89A] mx-auto mb-3" />
              <h4 className="font-semibold mb-1 text-sm">Smart Tagging</h4>
              <p className="text-xs text-[#B8B0A2]">
                Auto-organizes content with intelligent tags
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-28 pb-56 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className={`text-4xl md:text-5xl lg:text-6xl tracking-[-0.02em] leading-[1.05] mb-6 ${font.className}`}>
            Experience Memory Today
          </h2>
          <p className="text-[#B8B0A2] text-lg mb-10">
            Your entire research process, in one place.
          </p>
          <Link
            href="/auth/signup"
            className="inline-flex items-center justify-center gap-2 bg-[#F5F0E8] text-[#0B1A0F] px-10 py-4 rounded-full font-medium text-base hover:bg-white transition-all hover:shadow-lg hover:shadow-[#8FB89A]/10"
          >
            Sign Up Now
          </Link>
        </div>
      </section>

      <footer className="border-t border-[#1E3A26]/40 py-9 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-semibold text-sm font-serif">Memory</span>
          <p className="text-xs text-[#B8B0A2]/60">
            &copy; {new Date().getFullYear()} Memory. Built for curious minds.
          </p>
        </div>
      </footer>
    </div>
  );
}
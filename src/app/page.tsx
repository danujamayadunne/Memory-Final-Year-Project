"use client";

import { useEffect, useRef, useState } from "react";
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
  GraduationCap,
  FlaskConical,
  PenTool,
  BookOpen,
  Link2,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

const font = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  style: "italic",
});

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

const aiHighlights = [
  {
    icon: BookOpen,
    title: "Source grounded answers",
    description:
      "Ask follow-up questions and get explanations anchored in what you saved. Papers, lecture notes, and articles. So you can trace every insight back to its origin.",
  },
  {
    icon: Link2,
    title: "Ideas that stay connected",
    description:
      "Carry a thread of reasoning across summaries, images, and side notes in one chat. Memory keeps context from fragmenting across tabs and tools.",
  },
  {
    icon: ShieldCheck,
    title: "Models you choose",
    description:
      "Switch between leading providers when a task calls for it, without reworking your library. Your API keys stay encrypted and under your control.",
  },
];

type ResultTag = "Article" | "Image" | "Video" | "Paper" | "Note";
type FilterKey = "All" | "Articles" | "Images" | "Videos" | "Notes";

const filterMap: Record<FilterKey, ResultTag[] | null> = {
  All: null,
  Articles: ["Article", "Paper"],
  Images: ["Image"],
  Videos: ["Video"],
  Notes: ["Note"],
};

const filterChips: { key: FilterKey; icon?: LucideIcon }[] = [
  { key: "All" },
  { key: "Articles", icon: FileText },
  { key: "Images", icon: ImageIcon },
  { key: "Notes", icon: MessageSquare },
  { key: "Videos" },
];

type MemoryDemoItem = {
  id: string;
  img: string;
  tag: ResultTag;
  title: string;
  snippet: string;
  meta: string;
  score: number;
};

const memoryDemoItems: MemoryDemoItem[] = [
  {
    id: "anthropic-opus",
    img: "https://www-cdn.anthropic.com/images/4zrzovbb/website/96ea2509a90e527642c822303e56296a07bcfce4-1920x1080.png",
    tag: "Article",
    title: "Introducing Claude Opus 4.7",
    snippet:
      "Anthropic’s latest flagship model focuses on long-context reasoning, stronger coding, and safer refusals for enterprise workloads.",
    meta: "anthropic.com · Article",
    score: 96,
  },
  {
    id: "taj-mahal",
    img: "https://media.architecturaldigest.com/photos/67acb9b0339bcbaaadeb91b5/16:9/w_2240,c_limit/GettyImages-873536102.jpg",
    tag: "Article",
    title: "The Taj Mahal: Everything You Need to Know",
    snippet:
      "History, architecture, and visiting tips for one of the world’s most iconic mausoleums — from materials to symbolism in Mughal design.",
    meta: "architecturaldigest.com · Article",
    score: 91,
  },
  {
    id: "women-algiers",
    img: "https://cdn.kastatic.org/ka-perseus-images/1f0341e7345e5f355b666b357679435c8b09a08c.jpg",
    tag: "Image",
    title: "Women of Algiers, c. 1832–34",
    snippet:
      "Delacroix’s Orientalist masterpiece — rich color, harem interior, and the influence this study had on later modernists including Picasso.",
    meta: "Image · Eugène Delacroix",
    score: 88,
  },
  {
    id: "f1-miami",
    img: "https://media.formula1.com/image/upload/t_16by9North/c_lfill,w_3392/q_auto/v1740000001/trackside-images/2026/F1_Grand_Prix_of_Miami/2274333270.webp",
    tag: "Article",
    title: "Antonelli Wins Thrilling Miami Grand Prix",
    snippet:
      "Race recap: key overtakes, strategy calls, and championship implications from a dramatic weekend under the Miami sun.",
    meta: "formula1.com · Article",
    score: 87,
  },
  {
    id: "guardi-garden",
    img: "/art-institute-of-chicago-dfOOsg0Qj98-unsplash.jpg",
    tag: "Image",
    title: "The Garden of Palazzo Contarini dal Zaffo",
    snippet:
      "Guardi’s Venetian veduta — airy architecture, luminous sky, and the quiet drama of everyday life along the canals.",
    meta: "Image · Francesco Guardi",
    score: 85,
  },
  {
    id: "forza-ps",
    img: "https://upload.wikimedia.org/wikipedia/en/8/86/Forza_Horizon_5_cover_art.jpg",
    tag: "Video",
    title: "Forza Horizon 5 Comes to Playstation",
    snippet:
      "Forza Horizon 5, developed by Panic Button in partnership with Turn 10 Studios and Playground Games, will have the same content as the Xbox and PC releases of the game. Previously released Car Packs, as well as the Hot Wheels and Rally Adventure expansions, will also be available for purchase.",
    meta: "YouTube · 42 min",
    score: 92,
  },
  {
    id: "constitutional-ai",
    img: "/cash-macanaya-X9Cemmq4YjM-unsplash.jpg",
    tag: "Paper",
    title: "Constitutional AI: Harmlessness from AI Feedback",
    snippet:
      "A method for training assistants to be helpful and harmless using a set of guiding principles instead of human labels.",
    meta: "arxiv.org · Anthropic",
    score: 89,
  },
];

const sidebarMemories = memoryDemoItems.slice(0, 5).map((m) => {
  const meta =
    m.tag === "Image"
      ? m.meta
      : `${m.tag} · ${m.meta.split(" · ")[0] ?? m.meta}`;
  return { img: m.img, title: m.title, meta };
});

const demoQueries = [
  "how AI models learn to reason like humans",
  "da vinci anatomical sketches and human proportion",
  "video games with emotionally resonant storytelling",
  "anthropic research on AI interpretability",
];

export default function Home() {

  const { user, loading } = useAuth();

  const [activeSidebar, setActiveSidebar] = useState(0);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("All");
  const [activeResult, setActiveResult] = useState<number | null>(0);
  const [query, setQuery] = useState("");
  const [userTyping, setUserTyping] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const ctaRef = useRef<HTMLDivElement>(null);
  const [ctaPointer, setCtaPointer] = useState<{
    x: number;
    y: number;
    nx: number;
    ny: number;
    active: boolean;
  }>({ x: 50, y: 50, nx: 0, ny: 0, active: false });

  const handleCtaMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ctaRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCtaPointer({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
      nx: (x / rect.width) * 2 - 1,
      ny: (y / rect.height) * 2 - 1,
      active: true,
    });
  };

  useEffect(() => {
    if (userTyping) return;
    let cancelled = false;
    let qIdx = 0;
    let charIdx = 0;
    let phase: "typing" | "holding" | "deleting" = "typing";

    const tick = () => {
      if (cancelled) return;
      const current = demoQueries[qIdx];

      if (phase === "typing") {
        charIdx++;
        setQuery(current.slice(0, charIdx));
        if (charIdx >= current.length) {
          phase = "holding";
          setTimeout(tick, 1800);
          return;
        }
        setTimeout(tick, 45 + Math.random() * 35);
      } else if (phase === "holding") {
        phase = "deleting";
        setTimeout(tick, 60);
      } else {
        charIdx--;
        setQuery(current.slice(0, charIdx));
        if (charIdx <= 0) {
          qIdx = (qIdx + 1) % demoQueries.length;
          phase = "typing";
          setTimeout(tick, 400);
          return;
        }
        setTimeout(tick, 22);
      }
    };

    const start = setTimeout(tick, 600);
    return () => {
      cancelled = true;
      clearTimeout(start);
    };
  }, [userTyping]);

  const filteredResults = memoryDemoItems.filter((r) => {
    const allowed = filterMap[activeFilter];
    return allowed === null || allowed.includes(r.tag);
  });

  const visibleResults =
    activeFilter === "All"
      ? (() => {
        const byScore = (a: MemoryDemoItem, b: MemoryDemoItem) =>
          b.score - a.score;
        const article = memoryDemoItems
          .filter((r) => r.tag === "Article")
          .sort(byScore)[0];
        const image = memoryDemoItems
          .filter((r) => r.tag === "Image")
          .sort(byScore)[0];
        const video = memoryDemoItems
          .filter((r) => r.tag === "Video")
          .sort(byScore)[0];
        return [article, image, video].filter(
          (r): r is MemoryDemoItem => r !== undefined
        );
      })()
      : filteredResults;

  return (
    <div className="min-h-screen bg-white text-black selection:bg-black selection:text-white">

      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />

      <nav className="fixed top-5 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-3xl">
        <div className="flex items-center gap-4 sm:gap-8 bg-white/10 backdrop-blur-2xl border rounded-full px-5 py-2.5" style={{ borderColor: "rgba(0, 0, 0, 0.1)" }}>
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <span className={`text-xl tracking-tight ${font.className}`}>
              Memory
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-7 text-sm text-black font-medium tracking-tight">
            <a href="#features" className="hover:text-black transition-colors">
              Features
            </a>
            <a href="#built-for" className="hover:text-black transition-colors">
              Who It&apos;s For
            </a>
            <a href="#ai" className="hover:text-black transition-colors">
              AI
            </a>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 ml-auto">
            {loading ? (
              <span
                className="inline-block h-9 w-28 shrink-0 rounded-full bg-black/[0.06] animate-pulse"
                aria-hidden
              />
            ) : user ? (
              <Button
                size="sm"
                asChild
                className="rounded-full border-0 bg-[#E0FF32] hover:bg-[#E0FF32]/80 text-black shadow-none tracking-tight  hover:text-black"
              >
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild className="rounded-full text-black/70 hover:text-black hover:bg-transparent">
                  <Link href="/signin">Log in</Link>
                </Button>
                <Button size="sm" asChild className="rounded-full bg-black text-white hover:bg-black/85">
                  <Link href="/signup">Sign up</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      <section
        className="relative isolate pt-40 px-6 overflow-hidden pb-20"
        style={{
          backgroundColor: "#eceae4",
          backgroundImage: [
            "url(/birmingham-museums-trust-3lNRtTJYcKg-unsplash.jpg)",
          ].join(", "),
          backgroundSize: "100% 100%, 100% 100%, cover",
          backgroundPosition: "center, center, center",
          backgroundRepeat: "no-repeat, no-repeat, no-repeat",
        }}
      >
        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <h1
            className={`text-5xl sm:text-6xl md:text-7xl lg:text-[6rem] leading-[0.95] tracking-[-0.03em] mb-8 ${font.className} text-white`}
          >
            Remember Everything,
            <br />
            You Learn.
          </h1>

          <p className="text-lg md:text-xl text-black max-w-2xl mx-auto mb-12 leading-relaxed tracking-tight">
            Save a research paper, a lecture video, a image, an article.
            <br className="hidden sm:block" />
            Memory summarizes it, understands it, and makes it findable forever.
          </p>

          <Button
            size="lg"
            asChild
            className="rounded-full bg-black text-white hover:bg-black/85 h-12 px-7 text-sm"
          >
            <Link href="/signup">
              Get Started Free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>

        </div>

        <div className="relative z-10 max-w-7xl mx-auto mt-20 px-2 sm:px-4 lg:px-0">
          <div className="absolute inset-x-8 sm:inset-x-16 -bottom-10 h-32 bg-black/10 blur-3xl rounded-full" />
          <div className="relative rounded-3xl border border-black/[0.08] bg-white/70 backdrop-blur-xl shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_30px_80px_-30px_rgba(0,0,0,0.25)] overflow-hidden">
            <div className="flex items-center gap-2 px-6 py-4 border-b border-black/[0.06] bg-white/40">
              <div className="flex gap-2">
                <span className="h-3 w-3 rounded-full border border-black/15" />
                <span className="h-3 w-3 rounded-full border border-black/15" />
                <span className="h-3 w-3 rounded-full border border-black/15" />
              </div>
              <div className="mx-auto flex items-center gap-2.5 text-xs sm:text-sm text-black/45 tracking-wide">
                <Search className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                <span>/search</span>
              </div>
              <div className="h-3 w-3 shrink-0" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-0 min-h-[640px]">
              <div className="md:col-span-2 border-b md:border-b-0 md:border-r border-black/[0.06] p-7 lg:p-8 text-left bg-white/30">
                <div className="flex items-center justify-between mb-5">
                  <span className="text-[11px] sm:text-xs uppercase tracking-[0.2em] text-black/40 font-medium">
                    Recent Memories
                  </span>
                  <span className="text-[11px] sm:text-xs text-black/30">24 saved</span>
                </div>

                <div className="space-y-3">
                  {sidebarMemories.map((m, i) => {
                    const isActive = activeSidebar === i;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setActiveSidebar(i)}
                        className={`w-full text-left flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${isActive
                          ? "border-black/15 bg-white shadow-[0_1px_0_rgba(0,0,0,0.02),0_4px_16px_-8px_rgba(0,0,0,0.08)]"
                          : "border-transparent hover:border-black/[0.06] hover:bg-white/60"
                          }`}
                      >
                        <div className="relative h-12 w-12 shrink-0 rounded-lg overflow-hidden border border-black/[0.08] bg-gradient-to-br from-black/[0.04] to-black/[0.1]">
                          <img
                            src={m.img}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = "none";
                            }}
                          />
                        </div>
                        <div className="min-w-0 flex-1 pt-1">
                          <div className="text-sm font-medium text-black/85 truncate">
                            {m.title}
                          </div>
                          <div className="text-[11px] sm:text-xs text-black/40 mt-1">
                            {m.meta}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="md:col-span-3 relative p-7 lg:p-8 bg-white/10 overflow-hidden text-left">
                <div className="flex items-center justify-between mb-5">
                  <span className="text-[11px] sm:text-xs uppercase tracking-[0.2em] text-black/40 font-medium">
                    Semantic Search
                  </span>
                  <span className="text-[11px] sm:text-xs text-black/30 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-black/60" />
                    Searching by meaning
                  </span>
                </div>

                <div className="relative mb-5">
                  <div
                    onClick={() => inputRef.current?.focus()}
                    className="group flex items-center gap-3 rounded-2xl border border-black/15 bg-white px-4 py-4 shadow-[0_1px_0_rgba(0,0,0,0.02),0_8px_24px_-12px_rgba(0,0,0,0.12)] focus-within:border-black/40 focus-within:shadow-[0_1px_0_rgba(0,0,0,0.02),0_12px_28px_-12px_rgba(0,0,0,0.18)] transition-shadow cursor-text"
                  >
                    <Search className="h-5 w-5 text-black/50 shrink-0" strokeWidth={1.75} />
                    <input
                      ref={inputRef}
                      type="text"
                      value={query}
                      onChange={(e) => {
                        setUserTyping(true);
                        setQuery(e.target.value);
                      }}
                      onFocus={() => setUserTyping(true)}
                      placeholder="Search by meaning..."
                      className="flex-1 bg-transparent outline-none border-0 text-base text-black/85 placeholder:text-black/35 min-h-[1.25rem]"
                    />
                    {!userTyping && (
                      <span className="inline-block w-px h-4 -ml-1 bg-black/70 animate-pulse" />
                    )}
                    <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[11px] font-medium text-black/45 border border-black/10 bg-white rounded-md px-2 py-1">
                      ⌘K
                    </kbd>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-4">
                    {filterChips.map((c) => {
                      const isActive = activeFilter === c.key;
                      return (
                        <button
                          key={c.key}
                          type="button"
                          onClick={() => {
                            setActiveFilter(c.key);
                            setActiveResult(0);
                          }}
                          className={`text-[11px] sm:text-xs rounded-full px-3 py-1.5 font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${isActive
                            ? "text-white bg-black border border-black"
                            : "text-black/65 bg-white border border-black/[0.08] hover:border-black/25 hover:text-black"
                            }`}
                        >
                          {c.icon && <c.icon className="h-3 w-3" strokeWidth={2} />}
                          {c.key}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] sm:text-[11px] uppercase tracking-[0.18em] text-black/35 font-medium">
                      {visibleResults.length} semantic match
                      {visibleResults.length === 1 ? "" : "es"}
                    </span>
                    {activeFilter !== "All" && (
                      <button
                        type="button"
                        onClick={() => setActiveFilter("All")}
                        className="text-xs text-black/45 hover:text-black transition-colors"
                      >
                        Clear filter
                      </button>
                    )}
                  </div>

                  {visibleResults.length === 0 && (
                    <div className="p-8 rounded-xl border border-dashed border-black/15 text-center text-sm text-black/40">
                      No memories in this category yet.
                    </div>
                  )}

                  {visibleResults.map((r, i) => {
                    const isActive = activeResult === i;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setActiveResult(i)}
                        className={`group w-full text-left flex items-center gap-4 p-3.5 rounded-xl border transition-all cursor-pointer ${isActive
                          ? "border-black/25 bg-white shadow-[0_1px_0_rgba(0,0,0,0.02),0_10px_24px_-12px_rgba(0,0,0,0.15)]"
                          : "border-black/[0.06] bg-white/60 hover:bg-white hover:border-black/15"
                          }`}
                      >
                        <div className="relative h-14 w-14 shrink-0 rounded-lg overflow-hidden border border-black/[0.08] bg-gradient-to-br from-black/[0.04] to-black/[0.1]">
                          <img
                            src={r.img}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-105"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = "none";
                            }}
                          />
                        </div>
                        <div className="min-w-0 flex-1 pt-0.5">
                          <div className="flex items-center justify-between">
                            <div className="text-sm sm:text-base font-medium text-black/85 truncate">
                              {r.title}
                            </div>
                            <span className="text-[11px] sm:text-xs text-black/40 ml-auto shrink-0 flex items-center gap-2">
                              <span className="relative inline-block w-12 h-1.5 rounded-full bg-black/10 overflow-hidden">
                                <span
                                  className="absolute inset-y-0 left-0 bg-black"
                                  style={{ width: `${r.score}%` }}
                                />
                              </span>
                              {r.score}%
                            </span>
                          </div>
                          <div className="text-xs sm:text-sm text-black/55 mt-1 line-clamp-2 leading-relaxed">
                            {r.snippet}
                          </div>
                          <div className="text-[11px] sm:text-xs text-black/35 mt-1">
                            {r.meta}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-28 px-6 scroll-mt-24 pt-25">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col items-start md:flex-row md:items-end md:justify-between gap-8 mb-16">
            <div className="max-w-xl">
              <h2
                className={`text-4xl md:text-5xl lg:text-6xl tracking-[-0.03em] leading-[1] ${font.className}`}
              >
                Capture Anything.
                <br />
                Connect Everything.
              </h2>
            </div>
            <p className="text-black/55 max-w-sm text-base leading-relaxed">
              Six powerful tools working together to help you save, understand,
              and retrieve knowledge effortlessly.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 border-t border-l border-black/10">
            {features.map((f) => (
              <div
                key={f.title}
                className="group relative p-8 border-r border-b border-black/10 hover:bg-black/[0.02] transition-colors"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-black/15 bg-white text-black mb-6">
                  <f.icon className="h-4 w-4" strokeWidth={1.75} />
                </div>
                <h3 className="text-base font-semibold mb-2 tracking-tight">
                  {f.title}
                </h3>
                <p className="text-sm text-black/55 leading-relaxed">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="built-for" className="py-28 px-6 scroll-mt-24 pt-5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2
              className={`text-4xl md:text-5xl lg:text-6xl tracking-[-0.03em] leading-[1] max-w-3xl mx-auto ${font.className}`}
            >
              For Students &amp; Teams Who Want All Their Research in One Place
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {audiences.map((a) => (
              <div
                key={a.title}
                className="relative p-8 rounded-2xl border border-black/10 bg-white hover:border-black/30 transition-all group overflow-hidden"
              >
                <span className="absolute top-3 left-3 h-2 w-2 border-t border-l border-black/20" />
                <span className="absolute top-3 right-3 h-2 w-2 border-t border-r border-black/20" />
                <span className="absolute bottom-3 left-3 h-2 w-2 border-b border-l border-black/20" />
                <span className="absolute bottom-3 right-3 h-2 w-2 border-b border-r border-black/20" />

                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-black/15 bg-white text-black mb-6 group-hover:bg-black group-hover:text-white transition-colors">
                  <a.icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <h3 className={`text-3xl mb-3 ${font.className}`}>
                  {a.title}
                </h3>
                <p className="text-sm text-black/55 leading-relaxed">
                  {a.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="ai" className="py-28 px-6 scroll-mt-24 pt-5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2
              className={`text-4xl md:text-5xl lg:text-6xl tracking-[-0.03em] leading-[1] max-w-3xl mx-auto ${font.className}`}
            >
              The Research Partner That
              <br />
              Understands Your Work
            </h2>
            <p className="text-lg text-black/55 max-w-xl mx-auto mt-8 leading-relaxed">
              Memory integrates with the best AI models, OpenAI, Anthropic, and
              Google. You get the intelligence you need, with the provider
              you trust.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {aiHighlights.map((h) => (
              <div
                key={h.title}
                className="relative p-8 rounded-2xl border border-black/10 bg-white hover:border-black/30 transition-all group overflow-hidden text-left"
              >
                <span className="absolute top-3 left-3 h-2 w-2 border-t border-l border-black/20" />
                <span className="absolute top-3 right-3 h-2 w-2 border-t border-r border-black/20" />
                <span className="absolute bottom-3 left-3 h-2 w-2 border-b border-l border-black/20" />
                <span className="absolute bottom-3 right-3 h-2 w-2 border-b border-r border-black/20" />

                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-black/15 bg-white text-black mb-6 group-hover:bg-black group-hover:text-white transition-colors">
                  <h.icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <h3 className={`text-3xl mb-3 ${font.className}`}>
                  {h.title}
                </h3>
                <p className="text-sm text-black/55 leading-relaxed">
                  {h.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-28 px-6 pt-19">
        <div className="max-w-6xl mx-auto">
          <div
            ref={ctaRef}
            onMouseMove={handleCtaMove}
            onMouseLeave={() =>
              setCtaPointer((p) => ({ ...p, active: false, nx: 0, ny: 0 }))
            }
            className="group relative rounded-3xl text-white overflow-hidden border-0"
            style={{ perspective: "1200px" }}
          >
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
              <img
                src="/art-institute-of-chicago-dfOOsg0Qj98-unsplash.jpg"
                alt=""
                className="absolute inset-0 h-full w-full min-h-full min-w-full object-cover object-right transition-transform duration-500 ease-out"
              />
            </div>

            <div
              className="pointer-events-none absolute inset-0 rounded-3xl transition-opacity duration-300"
              style={{
                opacity: ctaPointer.active ? 1 : 0,
                background: `radial-gradient(360px circle at ${ctaPointer.x}% ${ctaPointer.y}%, rgba(255,255,255,0.16), transparent 60%)`,
              }}
            />

            <div
              className="pointer-events-none absolute inset-0 rounded-3xl opacity-[0.07] mix-blend-screen"
              style={{
                backgroundImage:
                  "radial-gradient(circle, #fff 1px, transparent 1px)",
                backgroundSize: "22px 22px",
              }}
            />

            <span className="pointer-events-none absolute top-4 left-4 h-3 w-3 border-t border-l border-black/30" />
            <span className="pointer-events-none absolute top-4 right-4 h-3 w-3 border-t border-r border-black/30" />
            <span className="pointer-events-none absolute bottom-4 left-4 h-3 w-3 border-b border-l border-white/30" />
            <span className="pointer-events-none absolute bottom-4 right-4 h-3 w-3 border-b border-r border-white/30" />

            <div className="relative grid md:grid-cols-2 gap-10 px-8 sm:px-12 py-16 sm:py-20 lg:py-24">
              <div
                className="relative z-10 text-left"
                style={{
                  transform: ctaPointer.active
                    ? `translate3d(${ctaPointer.nx * 6}px, ${ctaPointer.ny * 6}px, 0)`
                    : "translate3d(0,0,0)",
                  transition: "transform 250ms ease-out",
                }}
              >
                <h2
                  className={`text-5xl md:text-6xl lg:text-7xl tracking-[-0.03em] text-black leading-[0.95] mb-6 ${font.className}`}
                >
                  Reach for what
                  <br />
                  you almost forgot.
                </h2>

                <p className="text-black text-base tracking-tight mb-10 max-w-md leading-relaxed">
                  Every article, image, and idea, held in one place,
                  remembered when you need it most.
                </p>

                <Button
                  size="lg"
                  asChild
                  className="rounded-full bg-white text-black hover:bg-white/90 h-12 px-7 text-sm group/btn"
                >
                  <Link href="/signup">
                    Start Your Memory
                    <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
                  </Link>
                </Button>
              </div>

              <div
                className="relative hidden md:flex items-end justify-end"
                style={{
                  transform: ctaPointer.active
                    ? `translate3d(${ctaPointer.nx * -10}px, ${ctaPointer.ny * -10}px, 0)`
                    : "translate3d(0,0,0)",
                  transition: "transform 250ms ease-out",
                }}
              >
                <div className="space-y-2.5 max-w-xs">
                  {[
                    { icon: Brain, label: "Summarizes anything" },
                    { icon: Search, label: "Search by meaning" },
                    { icon: Map, label: "Connects ideas across time" },
                  ].map((f) => (
                    <div
                      key={f.label}
                      className="flex items-center gap-3 rounded-full border border-white/[0.08] bg-white/[0.04] backdrop-blur-md px-4 py-2.5 text-sm text-white/85"
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/[0.04]">
                        <f.icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </span>
                      {f.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-black/10 py-5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className={`text-lg tracking-tight ${font.className}`}>
            Memory
          </span>
          <p className="text-xs text-black/45">
            &copy;{new Date().getFullYear()} Memory.
          </p>
        </div>
      </footer>
    </div>
  );
}
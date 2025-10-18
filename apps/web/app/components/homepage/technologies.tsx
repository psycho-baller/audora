import {
  Brain,
  Mic,
  Shield,
  Zap,
  Database,
  Workflow,
  Code,
  Sparkles
} from "lucide-react";

const technologies = [
  {
    icon: Mic,
    name: "Whisper-tiny",
    category: "Speech Processing",
    description: "On-device real-time speech-to-text transcription for maximum privacy and speed.",
  },
  {
    icon: Brain,
    name: "GPT-5",
    category: "AI Intelligence",
    description: "Advanced language model for intelligent feedback and context-aware suggestions (opt-in only).",
  },
  {
    icon: Zap,
    name: "React Router 7",
    category: "Web Framework",
    description: "Modern, fast, and type-safe routing for seamless user experience.",
  },
  {
    icon: Database,
    name: "Convex",
    category: "Real-time Database",
    description: "Real-time sync and serverless functions for instant updates across devices.",
  },
  {
    icon: Workflow,
    name: "Speechmatics",
    category: "Speaker Diarization",
    description: "Real-time speaker identification for multi-person conversation analysis.",
  },
  {
    icon: Shield,
    name: "Clerk",
    category: "Authentication",
    description: "Secure, privacy-focused user authentication and identity management.",
  },
  {
    icon: Code,
    name: "TypeScript",
    category: "Type Safety",
    description: "End-to-end type safety ensuring reliability and developer experience.",
  },
  {
    icon: Sparkles,
    name: "TailwindCSS",
    category: "Styling",
    description: "Modern, responsive UI with a beautiful dark mode experience.",
  },
];

export default function TechnologiesSection() {
  return (
    <section id="technologies" className="py-16 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Built with cutting-edge technology
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Audora leverages the latest AI and web technologies to deliver
            a powerful, privacy-first communication coaching experience.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {technologies.map((tech, index) => {
            const Icon = tech.icon;
            return (
              <div
                key={index}
                className="bg-background rounded-lg border p-6 hover:border-primary/50 hover:shadow-lg transition-all duration-300 group"
              >
                <div className="mb-4 w-fit rounded-lg bg-primary/10 p-3 group-hover:bg-primary/20 transition-colors">
                  <Icon className="size-6 text-primary" />
                </div>
                <div className="mb-2">
                  <h3 className="text-lg font-semibold mb-1">{tech.name}</h3>
                  <p className="text-xs text-primary/80 font-medium">{tech.category}</p>
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {tech.description}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <p className="text-muted-foreground text-sm">
            <span className="font-semibold">Privacy-First Design:</span> Most processing happens on-device.
            Cloud features are opt-in only, ensuring your conversations stay private.
          </p>
        </div>
      </div>
    </section>
  );
}

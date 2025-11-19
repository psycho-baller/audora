import { Calendar, DollarSign, Download, Star } from "lucide-react";
import Footer from "~/components/homepage/footer";
import { Navbar } from "~/components/homepage/navbar";
import { Button } from "~/components/ui/button";
import type { Route } from "./+types/download";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Download Audora - AI Communication Coach" },
    {
      name: "description",
      content: "Download Audora for macOS and start improving your communication skills today.",
    },
  ];
}

export default function DownloadPage() {
  // TODO: Once first release is published, change this to:
  // const downloadUrl = "https://github.com/psycho-baller/audora/releases/latest/download/audora.dmg";
  const downloadUrl = "https://github.com/psycho-baller/audora/releases";
  const githubUrl = "https://github.com/psycho-baller/audora";
  const macOsRepoUrl = "https://github.com/psycho-baller/audora-macos";
  const calComUrl = "https://cal.com/rami-maalouf/";
  const openAiKeysUrl = "https://platform.openai.com/api-keys";

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-6xl px-6 py-24">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
              Download Audora
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Your open-source AI communication coach. Available for macOS
            </p>
            <div className="flex gap-4 justify-center">
              <Button size="lg" asChild className="gap-2">
                <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                  <Download className="w-5 h-5" />
                  View Releases
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild className="gap-2">
                <a href={githubUrl} target="_blank" rel="noopener noreferrer">
                  <Star className="w-5 h-5" />
                  Star on GitHub
                </a>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Open-source • Privacy-first • Self-hosted
            </p>
            <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg max-w-2xl mx-auto">
              <p className="text-sm text-center">
                📦 <strong>macOS app coming soon!</strong> The first release is being prepared. Check{" "}
                <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  releases page
                </a>{" "}
                for updates or{" "}
                <a href={macOsRepoUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  build from source
                </a>
              </p>
            </div>
          </div>

          {/* Action Cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            {/* Star on GitHub Card */}
            <div className="bg-card border rounded-lg p-8 hover:border-primary/50 transition-colors">
              <div className="bg-yellow-500/10 w-14 h-14 rounded-full flex items-center justify-center mb-4">
                <Star className="w-7 h-7 text-yellow-500" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Star on GitHub</h3>
              <p className="text-muted-foreground mb-6">
                Consider starring the project to show support and help others discover it.
              </p>
              <Button asChild className="w-full bg-yellow-500 hover:bg-yellow-600 text-black gap-2">
                <a href={githubUrl} target="_blank" rel="noopener noreferrer">
                  <Star className="w-4 h-4" />
                  Star on GitHub
                </a>
              </Button>
            </div>

            {/* Book a Call Card */}
            <div className="bg-card border rounded-lg p-8 hover:border-primary/50 transition-colors">
              <div className="bg-blue-500/10 w-14 h-14 rounded-full flex items-center justify-center mb-4">
                <Calendar className="w-7 h-7 text-blue-500" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Book a Call</h3>
              <p className="text-muted-foreground mb-6">
                I would love to walk you through the setup and hear your thoughts.
              </p>
              <Button asChild className="w-full gap-2">
                <a href={calComUrl} target="_blank" rel="noopener noreferrer">
                  <Calendar className="w-4 h-4" />
                  Schedule a Call
                </a>
              </Button>
            </div>

            {/* Get API Key Card */}
            <div className="bg-card border rounded-lg p-8 hover:border-primary/50 transition-colors">
              <div className="bg-green-500/10 w-14 h-14 rounded-full flex items-center justify-center mb-4">
                <DollarSign className="w-7 h-7 text-green-500" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Get API Key</h3>
              <p className="text-muted-foreground mb-6">
                You'll need it to transcribe and generate enhanced notes. (~$0.20/hour)
              </p>
              <Button asChild variant="outline" className="w-full gap-2 border-green-500/50 hover:bg-green-500/10">
                <a href={openAiKeysUrl} target="_blank" rel="noopener noreferrer">
                  <DollarSign className="w-4 h-4" />
                  Get API Key
                </a>
              </Button>
            </div>
          </div>

          {/* Features Grid */}
          <div className="mb-16">
            <h2 className="text-3xl font-bold mb-10 text-center">What You'll Get</h2>
            <div className="grid md:grid-cols-2 gap-8">
              {/* Filler Word Detection */}
              <div className="bg-gradient-to-br from-card to-card/50 border rounded-xl p-8 hover:border-primary/50 transition-all hover:shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-red-500/10 w-12 h-12 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">🎙️</span>
                  </div>
                  <h3 className="font-semibold text-xl">Filler Word Detection</h3>
                </div>
                <p className="text-muted-foreground mb-4">
                  Track and reduce filler words like "um", "uh", "like", and 9 more
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs bg-red-500/10 text-red-500 px-2 py-1 rounded">um</span>
                  <span className="text-xs bg-red-500/10 text-red-500 px-2 py-1 rounded">uh</span>
                  <span className="text-xs bg-red-500/10 text-red-500 px-2 py-1 rounded">like</span>
                  <span className="text-xs bg-red-500/10 text-red-500 px-2 py-1 rounded">you know</span>
                  <span className="text-xs bg-red-500/10 text-red-500 px-2 py-1 rounded">basically</span>
                </div>
              </div>

              {/* Communication Scores */}
              <div className="bg-gradient-to-br from-card to-card/50 border rounded-xl p-8 hover:border-primary/50 transition-all hover:shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-blue-500/10 w-12 h-12 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">📊</span>
                  </div>
                  <h3 className="font-semibold text-xl">Communication Scores</h3>
                </div>
                <p className="text-muted-foreground mb-4">
                  Get scored on three key dimensions of effective communication
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Clarity</span>
                    <span className="text-xs text-muted-foreground">Based on filler rate</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Conciseness</span>
                    <span className="text-xs text-muted-foreground">Based on repetition</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Confidence</span>
                    <span className="text-xs text-muted-foreground">Based on weak starters</span>
                  </div>
                </div>
              </div>

              {/* Speaking Patterns */}
              <div className="bg-gradient-to-br from-card to-card/50 border rounded-xl p-8 hover:border-primary/50 transition-all hover:shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-purple-500/10 w-12 h-12 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">⚡</span>
                  </div>
                  <h3 className="font-semibold text-xl">Speaking Patterns</h3>
                </div>
                <p className="text-muted-foreground mb-4">
                  Analyze your pacing, repetitions, and sentence structure
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>✓ Words per minute tracking</li>
                  <li>✓ Repeated words & phrases detection</li>
                  <li>✓ Weak sentence starters (and, but, like, so)</li>
                  <li>✓ Weak word identification (just, really, very)</li>
                </ul>
              </div>

              {/* Transcription & Recording */}
              <div className="bg-gradient-to-br from-card to-card/50 border rounded-xl p-8 hover:border-primary/50 transition-all hover:shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-orange-500/10 w-12 h-12 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">🎧</span>
                  </div>
                  <h3 className="font-semibold text-xl">Transcription & Recording</h3>
                </div>
                <p className="text-muted-foreground mb-4">
                  Multiple transcription options for your conversations
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>✓ Real-time transcription with Speechmatics</li>
                  <li>✓ Speaker diarization (who said what)</li>
                  <li>✓ Batch transcription with OpenAI Whisper</li>
                  <li>✓ Import audio files for analysis</li>
                </ul>
              </div>

              {/* AI-Powered Insights */}
              <div className="bg-gradient-to-br from-card to-card/50 border rounded-xl p-8 hover:border-primary/50 transition-all hover:shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-green-500/10 w-12 h-12 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">🧠</span>
                  </div>
                  <h3 className="font-semibold text-xl">AI-Powered Analysis</h3>
                </div>
                <p className="text-muted-foreground mb-4">
                  Advanced AI features powered by OpenAI GPT-4o
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>✓ Conversation summaries</li>
                  <li>✓ Fact extraction per speaker</li>
                  <li>✓ Contextual improvement suggestions</li>
                  <li>✓ Knowledge graph with Zep Cloud</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Build Instructions */}
          <div className="text-center mb-16 bg-card border rounded-lg p-6 max-w-3xl mx-auto">
            <h3 className="text-lg font-semibold mb-3">Want to build from source?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              The macOS app is open-source. You can build and run it yourself!
            </p>
            <div className="bg-muted/50 rounded p-4 text-left font-mono text-sm">
              <code className="text-xs">
                git clone https://github.com/psycho-baller/audora-macos.git<br/>
                cd audora-macos<br/>
                open audora.xcodeproj
              </code>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              See the{" "}
              <a href={macOsRepoUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                README
              </a>{" "}
              for build instructions
            </p>
          </div>

          {/* Questions Section */}
          <div className="text-center bg-gradient-to-br from-card to-card/50 border rounded-xl p-12">
            <h2 className="text-3xl font-bold mb-4">Questions?</h2>
            <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
              If you run into any issues or have questions about the setup, don't hesitate to reach out.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Button asChild size="lg" className="gap-2">
                <a href={calComUrl} target="_blank" rel="noopener noreferrer">
                  <Calendar className="w-5 h-5" />
                  Schedule a Call
                </a>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href="mailto:support@getaudora.app">
                  Contact Us
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}


import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "~/components/ui/button";
import type { Route } from "./+types/speech-feedback";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Try Speech Feedback - Audora" },
    {
      name: "description",
      content: "Upload your speech and see what kind of feedback you'll receive.",
    },
  ];
}

export default function SpeechFeedback() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const navigate = useNavigate();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFile(file);
    }
  };

  const handleUpload = async () => {
    if (!audioFile) return;
    
    setIsUploading(true);
    
    // Simulate upload delay
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    // After "upload", redirect to signup
    navigate("/sign-up");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-6 py-16">
        {/* Header */}
        <div className="text-center space-y-4 mb-12">
          <h1 className="text-4xl font-bold md:text-5xl">
            Try Speech Feedback
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Upload a recording of yourself speaking and see what insights you'll get
          </p>
        </div>

        {/* Upload Section */}
        <div className="bg-card border rounded-lg p-8 mb-12">
          <div className="space-y-6">
            <div>
              <label
                htmlFor="audio-upload"
                className="block text-sm font-medium mb-2"
              >
                Upload Audio File
              </label>
              <input
                id="audio-upload"
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                className="block w-full text-sm text-muted-foreground
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-primary file:text-primary-foreground
                  hover:file:bg-primary/90
                  cursor-pointer"
              />
            </div>

            {audioFile && (
              <div className="text-sm text-muted-foreground">
                Selected: {audioFile.name}
              </div>
            )}

            <Button
              onClick={handleUpload}
              disabled={!audioFile || isUploading}
              size="lg"
              className="w-full"
            >
              {isUploading ? "Processing..." : "Get Feedback"}
            </Button>
          </div>
        </div>

        {/* Example Feedback Preview */}
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-center">
            What You'll Get
          </h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* Filler Words */}
            <div className="bg-card border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-3">Filler Word Detection</h3>
              <div className="space-y-2 text-muted-foreground">
                <div className="flex justify-between">
                  <span>"um"</span>
                  <span className="font-semibold">12 times</span>
                </div>
                <div className="flex justify-between">
                  <span>"uh"</span>
                  <span className="font-semibold">8 times</span>
                </div>
                <div className="flex justify-between">
                  <span>"like"</span>
                  <span className="font-semibold">15 times</span>
                </div>
                <div className="text-xs mt-3 text-muted-foreground/70">
                  + tracks 11 more filler words
                </div>
              </div>
            </div>

            {/* Speaking Pace */}
            <div className="bg-card border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-3">Speaking Pace</h3>
              <div className="space-y-2 text-muted-foreground">
                <div className="flex justify-between">
                  <span>Words per minute</span>
                  <span className="font-semibold">145 WPM</span>
                </div>
                <div className="flex justify-between">
                  <span>Total words</span>
                  <span className="font-semibold">732 words</span>
                </div>
                <div className="flex justify-between">
                  <span>Duration</span>
                  <span className="font-semibold">5.1 min</span>
                </div>
              </div>
            </div>

            {/* Scores */}
            <div className="bg-card border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-3">Communication Scores</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Clarity</span>
                  <span className="text-xl font-bold text-primary">75/100</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Conciseness</span>
                  <span className="text-xl font-bold text-primary">82/100</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Confidence</span>
                  <span className="text-xl font-bold text-primary">68/100</span>
                </div>
              </div>
            </div>

            {/* Detailed Analysis */}
            <div className="bg-card border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-3">Detailed Analysis</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Repeated words & phrases</li>
                <li>• Weak sentence starters</li>
                <li>• Weak word detection</li>
                <li>• AI-powered suggestions</li>
              </ul>
            </div>
          </div>

          <div className="text-center text-sm text-muted-foreground mt-8">
            <p>Sign up after upload to see your personalized feedback</p>
          </div>
        </div>
      </div>
    </div>
  );
}


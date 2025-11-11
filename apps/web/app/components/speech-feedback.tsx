import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Button } from "~/components/ui/button";
import { Navbar } from "~/components/homepage/navbar";
import Footer from "./homepage/footer";

export function SpeechFeedback() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const navigate = useNavigate();

  // Check for pending file upload after login redirect
  useEffect(() => {
    const checkPendingUpload = async () => {
      const pendingFileData = sessionStorage.getItem('pendingAudioUpload');
      if (pendingFileData) {
        try {
          const { fileName, fileType, fileData } = JSON.parse(pendingFileData);
          
          // Convert base64 back to File
          const byteString = atob(fileData.split(',')[1]);
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
          }
          const blob = new Blob([ab], { type: fileType });
          const file = new File([blob], fileName, { type: fileType });
          
          setAudioFile(file);
          sessionStorage.removeItem('pendingAudioUpload');
          
          // Automatically start processing
          setIsUploading(true);
          await new Promise((resolve) => setTimeout(resolve, 1500));
          
          // TODO: Replace with actual upload logic
          // After successful upload, navigate to results/dashboard
          navigate("/dashboard");
        } catch (error) {
          console.error('Failed to restore pending upload:', error);
          sessionStorage.removeItem('pendingAudioUpload');
        }
      }
    };
    
    checkPendingUpload();
  }, [navigate]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('audio/')) {
      setAudioFile(file);
    }
  };

  const handleUpload = async () => {
    if (!audioFile) return;

    // Store file data in sessionStorage before redirecting to login
    const reader = new FileReader();
    reader.onload = () => {
      const fileData = {
        fileName: audioFile.name,
        fileType: audioFile.type,
        fileData: reader.result as string,
      };
      sessionStorage.setItem('pendingAudioUpload', JSON.stringify(fileData));
      
      // Redirect to sign-in with return URL
      navigate(`/sign-in?redirect_url=${encodeURIComponent('/speech-feedback')}`);
    };
    reader.readAsDataURL(audioFile);
  };

  return (
    <>
      <Navbar />
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
        <div className="mb-12">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              w-full border-2 border-dashed rounded-lg p-12
              transition-colors duration-200 ease-in-out
              ${isDragging
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 bg-card hover:border-muted-foreground/40'
              }
            `}
          >
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="rounded-full bg-primary/10 p-6">
                <svg
                  className="w-12 h-12 text-primary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>

              <div className="space-y-2">
                <p className="text-lg font-medium">
                  {isDragging ? 'Drop your audio file here' : 'Drag and drop your audio file'}
                </p>
                <p className="text-sm text-muted-foreground">
                  or click the button below to browse
                </p>
              </div>

              <div className="pt-2">
                <label htmlFor="audio-upload">
                  <Button
                    type="button"
                    size="lg"
                    onClick={() => document.getElementById('audio-upload')?.click()}
                  >
                    Choose File
                  </Button>
                </label>
                <input
                  id="audio-upload"
                  type="file"
                  accept="audio/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {audioFile && (
                <div className="pt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <svg
                    className="w-5 h-5 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="font-medium">{audioFile.name}</span>
                </div>
              )}
            </div>
          </div>

          {audioFile && (
            <div className="mt-6">
              <Button
                onClick={handleUpload}
                disabled={isUploading}
                size="lg"
                className="w-full"
              >
                {isUploading ? "Processing..." : "Get Feedback"}
              </Button>
            </div>
          )}
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
    <Footer />
    </>
  );
}

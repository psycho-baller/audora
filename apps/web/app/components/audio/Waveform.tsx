import { useEffect, useRef, useState } from "react";

interface WaveformProps {
  audioUrl: string;
  currentTime: number;
  duration: number;
  onSeek?: (time: number) => void;
  className?: string;
}

export function Waveform({ audioUrl, currentTime, duration, onSeek, className = "" }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Generate waveform data from audio
  useEffect(() => {
    if (!audioUrl) return;

    const generateWaveform = async () => {
      try {
        setIsLoading(true);
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        const rawData = audioBuffer.getChannelData(0);
        const samples = 200; // Number of bars in waveform
        const blockSize = Math.floor(rawData.length / samples);
        const filteredData: number[] = [];

        for (let i = 0; i < samples; i++) {
          let blockStart = blockSize * i;
          let sum = 0;
          for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(rawData[blockStart + j]);
          }
          filteredData.push(sum / blockSize);
        }

        // Normalize the data
        const max = Math.max(...filteredData);
        const normalized = filteredData.map((n) => n / max);
        
        setWaveformData(normalized);
        setIsLoading(false);
      } catch (error) {
        console.error("Error generating waveform:", error);
        setIsLoading(false);
      }
    };

    generateWaveform();
  }, [audioUrl]);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || waveformData.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const barWidth = width / waveformData.length;
    const barGap = barWidth * 0.2;
    const actualBarWidth = barWidth - barGap;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Read theme colors once (outside loop for performance)
    const primaryColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-primary')
      .trim();
    const borderColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-border')
      .trim();

    // Draw waveform bars
    waveformData.forEach((value, index) => {
      const barHeight = value * height * 0.8;
      const x = index * barWidth;
      const y = (height - barHeight) / 2;

      // Determine color based on playback position
      const barTime = (index / waveformData.length) * duration;
      const isPlayed = barTime <= currentTime;

      ctx.globalAlpha = isPlayed ? 1 : 0.35;
      ctx.fillStyle = isPlayed ? primaryColor : borderColor;
      ctx.fillRect(x, y, actualBarWidth, barHeight);
    });
    ctx.globalAlpha = 1; // reset
  }, [waveformData, currentTime, duration]);

  // Handle click to seek
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const time = percentage * duration;

    onSeek(time);
  };

  if (isLoading) {
    return (
      <div className={`relative h-16 bg-muted/20 rounded-lg flex items-center justify-center ${className}`}>
        <div className="flex gap-1">
          {[...Array(40)].map((_, i) => (
            <div
              key={i}
              className="w-1 bg-muted/40 rounded-full animate-pulse"
              style={{
                height: `${Math.random() * 40 + 20}px`,
                animationDelay: `${i * 0.05}s`,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative h-16 cursor-pointer rounded-lg overflow-hidden ${className}`}
      onClick={handleClick}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full"
      />
    </div>
  );
}


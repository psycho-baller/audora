export default function CircleBlobs({
  isRecording,
  onClick,
}: {
  isRecording: boolean;
  onClick: () => void;
}) {
  // Define multiple gradient color sets
  const gradients = [
    ["#3B82F6", "#60A5FA", "#93C5FD"],
    ["#6366F1", "#818CF8", "#A5B4FC"],
    ["#EC4899", "#F472B6", "#F9A8D4"],
    ["#10B981", "#34D399", "#6EE7B7"],
  ];

  // Number of blobs
  const blobCount = 4;

  // Random motion generator
  const generateMotion = () => ({
    cx: 100 + Math.random() * 40 - 20,
    cy: 100 + Math.random() * 40 - 20,
    r: 30 + Math.random() * 20,
    durX: 4 + Math.random() * 3,
    durY: 5 + Math.random() * 3,
    moveX: 40 + Math.random() * 80, // X movement amplitude
    moveY: 40 + Math.random() * 80, // Y movement amplitude
  });

  const blobs = Array.from({ length: blobCount }).map(() => generateMotion());

  return (
    <div
      onClick={onClick}
      className="relative w-32 h-32 rounded-full flex items-center justify-center cursor-pointer overflow-hidden">
      {isRecording && (
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 200 200"
          xmlns="http://www.w3.org/2000/svg">
          <defs>
            {/* Gradient that animates smoothly */}
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
              {gradients[0].map((color, i) => (
                <stop
                  key={i}
                  offset={`${(i / (gradients[0].length - 1)) * 100}%`}
                  stopColor={color}>
                  <animate
                    attributeName="stop-color"
                    values={gradients.map((g) => g[i]).join(";")}
                    dur="8s"
                    repeatCount="indefinite"
                  />
                </stop>
              ))}
            </linearGradient>

            {/* Gooey filter */}
            <filter id="goo">
              <feGaussianBlur
                in="SourceGraphic"
                stdDeviation="15"
                result="blur"
              />
              <feColorMatrix
                in="blur"
                mode="matrix"
                values="
                  1 0 0 0 0
                  0 1 0 0 0
                  0 0 1 0 0
                  0 0 0 30 -10"
                result="goo"
              />
              <feBlend in="SourceGraphic" in2="goo" />
            </filter>
          </defs>

          <g filter="url(#goo)">
            {blobs.map((b, i) => (
              <circle key={i} cx={b.cx} cy={b.cy} r={b.r} fill="url(#grad)">
                <animate
                  attributeName="cx"
                  values={`${b.cx - 20};${b.cx + 20};${b.cx};${b.cx - 20}`}
                  dur={`${b.durX}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="cy"
                  values={`${b.cy - 20};${b.cy + 20};${b.cy};${b.cy - 20}`}
                  dur={`${b.durY}s`}
                  repeatCount="indefinite"
                />
              </circle>
            ))}
          </g>
        </svg>
      )}
    </div>
  );
}

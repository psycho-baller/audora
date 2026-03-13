interface MeterProps {
  key?: string;
  label: string;
  value: number;
  subtitle?: string;
}

export function Meter({ label, value, subtitle }: MeterProps) {
  const hue = Math.max(0, 120 - Math.round(value));

  return (
    <div className="meter">
      <div className="meter__labelRow">
        <span>{label}</span>
        <span>{Math.round(value)}</span>
      </div>
      <div className="meter__track">
        <div
          className="meter__fill"
          style={{
            width: `${Math.max(4, Math.min(100, value))}%`,
            background: `linear-gradient(90deg, hsla(${hue}, 72%, 56%, 0.95), hsla(${Math.max(
              0,
              hue - 18
            )}, 76%, 44%, 0.95))`
          }}
        />
      </div>
      {subtitle ? <p className="meter__subtitle">{subtitle}</p> : null}
    </div>
  );
}

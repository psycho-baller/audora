interface PanelProps {
  eyebrow?: string;
  title: string;
  right?: any;
  children?: any;
}

export function Panel({ eyebrow, title, right, children }: PanelProps) {
  return (
    <section className="panel">
      <header className="panel__header">
        <div>
          {eyebrow ? <p className="panel__eyebrow">{eyebrow}</p> : null}
          <h2 className="panel__title">{title}</h2>
        </div>
        {right ? <div className="panel__right">{right}</div> : null}
      </header>
      <div className="panel__body">{children}</div>
    </section>
  );
}

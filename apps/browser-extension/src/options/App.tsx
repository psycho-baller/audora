import { useEffect, useMemo, useState } from 'react';

import { sendBackgroundMessage } from '../shared/messages';
import type { BootstrapPayload } from '../shared/types';

export function OptionsApp() {
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  const acceptedConnections = useMemo(
    () =>
      (bootstrap?.snapshot?.connections ?? []).filter(
        (connection: NonNullable<BootstrapPayload['snapshot']>['connections'][number]) =>
          connection.status === 'accepted'
      ),
    [bootstrap]
  );

  async function refresh() {
    const payload = await sendBackgroundMessage<BootstrapPayload>({
      type: 'awareness:get-bootstrap',
    });
    setBootstrap(payload);
  }

  async function reloadSnapshot() {
    const payload = await sendBackgroundMessage<BootstrapPayload>({
      type: 'awareness:reload-seed',
    });
    setBootstrap(payload);
  }

  async function toggleSiteMute(site: string) {
    const payload = await sendBackgroundMessage<BootstrapPayload>({
      type: 'awareness:toggle-site-mute',
      site,
    });
    setBootstrap(payload);
  }

  return (
    <div className="options-shell">
      <div className="app-shell">
        <section className="panel hero">
          <div className="eyebrow">Eloq Browser Surface</div>
          <h1 className="hero-title">Read the live Eloq vocabulary graph, don&apos;t edit it here.</h1>
          <p className="hero-copy">
            The browser extension is now a read-only consumer of Eloq&apos;s exported snapshot. Add
            words and accept suggestions in the Mac app, then refresh here.
          </p>
          {bootstrap?.snapshot && (
            <div className="metric-row">
              <div className="metric">
                <span className="metric-label">Words</span>
                <span className="metric-value">{bootstrap.snapshot.summary.totalWords}</span>
              </div>
              <div className="metric">
                <span className="metric-label">Accepted links</span>
                <span className="metric-value">{bootstrap.snapshot.summary.acceptedConnections}</span>
              </div>
              <div className="metric">
                <span className="metric-label">Pending</span>
                <span className="metric-value">{bootstrap.snapshot.summary.suggestedConnections}</span>
              </div>
            </div>
          )}
        </section>

        <div className="grid two">
          <section className="panel section">
            <h2 className="section-title">Focus pack</h2>
            {bootstrap ? (
              <>
                <p className="section-copy">{bootstrap.focusPack.triggerQuestion}</p>
                <div className="chip-row" style={{ marginTop: 12 }}>
                  {bootstrap.focusPack.targetWords.map((word) => (
                    <span key={word} className="chip target">
                      {word}
                    </span>
                  ))}
                </div>
                <div className="chip-row" style={{ marginTop: 10 }}>
                  {bootstrap.focusPack.bannedTerms.map((word) => (
                    <span key={word} className="chip avoid">
                      {word}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="section-copy">Loading Eloq snapshot…</p>
            )}
          </section>

          <section className="panel section">
            <h2 className="section-title">Snapshot status</h2>
            {bootstrap?.snapshot ? (
              <>
                <p className="section-copy">
                  Version {bootstrap.snapshot.version} · generated {String(bootstrap.snapshot.generatedAt)}
                </p>
                <div className="button-row" style={{ marginTop: 16 }}>
                  <button className="button" onClick={reloadSnapshot}>
                    Refresh snapshot
                  </button>
                </div>
              </>
            ) : (
              <p className="section-copy">No Eloq snapshot detected yet.</p>
            )}
          </section>
        </div>

        <div className="grid two">
          <section className="panel section">
            <h2 className="section-title">Accepted vocabulary links</h2>
            <div className="list">
              {acceptedConnections.length ? (
                acceptedConnections.slice(0, 12).map((connection: typeof acceptedConnections[number]) => (
                  <div key={connection.id} className="list-item">
                    <div className="list-head">
                      <div>
                        <p className="list-title">
                          {connection.overusedTerm} → {connection.underusedTerm}
                        </p>
                        <p className="list-subtitle">{connection.useWhen}</p>
                      </div>
                      <span className="chip target">{Math.round(connection.confidence * 100)}%</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="section-copy">No accepted Eloq links yet.</p>
              )}
            </div>
          </section>

          <section className="panel section">
            <h2 className="section-title">Muted sites</h2>
            <div className="list">
              {bootstrap?.state.mutedSites.length ? (
                bootstrap.state.mutedSites.map((site) => (
                  <div key={site} className="list-item">
                    <div className="list-head">
                      <div>
                        <p className="list-title mono">{site}</p>
                        <p className="list-subtitle">Inline hints stay off here until you unmute it.</p>
                      </div>
                    </div>
                    <div className="button-row" style={{ marginTop: 12 }}>
                      <button className="button secondary" onClick={() => toggleSiteMute(site)}>
                        Unmute
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="section-copy">No muted sites.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

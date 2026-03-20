import { useEffect, useState } from 'react';

import type { BootstrapPayload } from '../shared/types';
import { sendBackgroundMessage } from '../shared/messages';

function emptyBootstrap(): BootstrapPayload | null {
  return null;
}

export function PopupApp() {
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(emptyBootstrap());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    const payload = await sendBackgroundMessage<BootstrapPayload>({
      type: 'awareness:get-bootstrap',
    });
    setBootstrap(payload);
    setLoading(false);
  }

  async function reloadSeed() {
    const payload = await sendBackgroundMessage<BootstrapPayload>({
      type: 'awareness:reload-seed',
    });
    setBootstrap(payload);
  }

  async function toggleCurrentSiteMute() {
    if (!bootstrap?.currentSite) {
      return;
    }
    const payload = await sendBackgroundMessage<BootstrapPayload>({
      type: 'awareness:toggle-site-mute',
      site: bootstrap.currentSite,
    });
    setBootstrap(payload);
  }

  async function openOptions() {
    await sendBackgroundMessage<{ ok: true }>({
      type: 'awareness:open-options',
    });
  }

  const currentSiteMuted = bootstrap?.currentSite
    ? bootstrap.state.mutedSites.includes(bootstrap.currentSite)
    : false;

  return (
    <div className="shell" style={{ width: 380 }}>
      <div className="app-shell">
        <section className="panel hero">
          <div className="eyebrow">Eloq Writing</div>
          <h1 className="hero-title">Inline awareness for the vocabulary graph you curate in Eloq.</h1>
          <p className="hero-copy">
            This extension reads Eloq&apos;s exported snapshot and highlights accepted connections in
            live text fields.
          </p>
          <div className="metric-row">
            <div className="metric">
              <span className="metric-label">Avoid catches</span>
              <span className="metric-value">{bootstrap?.summary.avoidCaught ?? 0}</span>
            </div>
            <div className="metric">
              <span className="metric-label">Target wins</span>
              <span className="metric-value">{bootstrap?.summary.targetWins ?? 0}</span>
            </div>
            <div className="metric">
              <span className="metric-label">Repairs</span>
              <span className="metric-value">{bootstrap?.summary.repairsCompleted ?? 0}</span>
            </div>
          </div>
        </section>

        <section className="panel section">
          <h2 className="section-title">Current focus pack</h2>
          {loading || !bootstrap ? (
            <p className="section-copy">Loading your Eloq snapshot…</p>
          ) : (
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
          )}
        </section>

        <section className="panel section">
          <h2 className="section-title">Current site</h2>
          <div className="list">
            <div className="list-item">
              <div className="list-head">
                <div>
                  <p className="list-title mono">{bootstrap?.currentSite || 'No active site'}</p>
                  <p className="list-subtitle">
                    {currentSiteMuted
                      ? 'This site is muted. Inline hints stay off until you unmute it.'
                      : 'Inline hints run only in standard textareas and contenteditable fields.'}
                  </p>
                </div>
              </div>
              <div className="button-row" style={{ marginTop: 12 }}>
                  <button className="button secondary" onClick={toggleCurrentSiteMute}>
                    {currentSiteMuted ? 'Unmute site' : 'Mute site'}
                  </button>
                  <button className="button secondary" onClick={reloadSeed}>
                  Refresh snapshot
                  </button>
                <button className="button" onClick={openOptions}>
                  Open settings
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

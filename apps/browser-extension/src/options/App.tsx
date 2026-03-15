import { useEffect, useMemo, useState } from 'react';

import type { VocabularyRule } from '@audora/writing-awareness-core';

import { sendBackgroundMessage } from '../shared/messages';
import type { BootstrapPayload } from '../shared/types';

function blankRule(): VocabularyRule {
  return {
    id: `manual:${crypto.randomUUID()}`,
    type: 'avoid',
    term: '',
    replacementOptions: [],
    contexts: [],
    source: 'manual',
    active: true,
    priority: 4,
    notes: '',
    family: 'manual',
    pinned: true,
  };
}

export function OptionsApp() {
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  const [draft, setDraft] = useState<VocabularyRule>(blankRule());

  useEffect(() => {
    void refresh();
  }, []);

  const manualRules = useMemo(() => bootstrap?.state.manualRules ?? [], [bootstrap]);

  async function refresh() {
    const payload = await sendBackgroundMessage<BootstrapPayload>({
      type: 'awareness:get-bootstrap',
    });
    setBootstrap(payload);
  }

  async function saveRule() {
    const term = draft.term.trim();
    if (!term.length) {
      return;
    }
    const replacements = draft.replacementOptions
      .map((option) => option.word.trim())
      .filter(Boolean)
      .map((word) => ({
        word,
        useWhen:
          draft.type === 'avoid'
            ? 'Use this when it makes the sentence more precise than the original term.'
            : 'Reward this when it sharpens the meaning naturally.',
        caution: 'Skip it if the sentence becomes forced.',
      }));

    const payload = await sendBackgroundMessage<BootstrapPayload>({
      type: 'awareness:save-manual-rule',
      rule: {
        ...draft,
        term,
        replacementOptions: replacements,
        contexts: draft.contexts.filter(Boolean),
      },
    });
    setBootstrap(payload);
    setDraft(blankRule());
  }

  async function deleteRule(ruleId: string) {
    const payload = await sendBackgroundMessage<BootstrapPayload>({
      type: 'awareness:delete-manual-rule',
      ruleId,
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

  async function toggleRulePinned(rule: VocabularyRule) {
    const payload = await sendBackgroundMessage<BootstrapPayload>({
      type: 'awareness:update-rule-override',
      ruleId: rule.id,
      patch: {
        pinned: !(bootstrap?.state.ruleOverrides[rule.id]?.pinned ?? rule.pinned),
      },
    });
    setBootstrap(payload);
  }

  return (
    <div className="options-shell">
      <div className="app-shell">
        <section className="panel hero">
          <div className="eyebrow">Audora Writing Settings</div>
          <h1 className="hero-title">Your rule deck should feel personal, not generic.</h1>
          <p className="hero-copy">
            Keep the live surface small: focus words, banned defaults, and the manual pairs you
            actually want to feel in your day-to-day writing.
          </p>
          {bootstrap && (
            <div className="metric-row">
              <div className="metric">
                <span className="metric-label">Seed run</span>
                <span className="metric-value" style={{ fontSize: 16 }}>
                  {bootstrap.seed.sourceRunId}
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">Manual rules</span>
                <span className="metric-value">{bootstrap.state.manualRules.length}</span>
              </div>
              <div className="metric">
                <span className="metric-label">Muted sites</span>
                <span className="metric-value">{bootstrap.state.mutedSites.length}</span>
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
              <p className="section-copy">Loading focus pack…</p>
            )}
          </section>

          <section className="panel section">
            <h2 className="section-title">Add manual rule</h2>
            <div className="form-grid">
              <label>
                <span className="field-label">Type</span>
                <select
                  className="field-input"
                  value={draft.type}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      type: event.target.value as VocabularyRule['type'],
                    }))
                  }
                >
                  <option value="avoid">Avoid</option>
                  <option value="target">Target</option>
                </select>
              </label>

              <label>
                <span className="field-label">Term</span>
                <input
                  className="field-input"
                  value={draft.term}
                  onChange={(event) => setDraft((current) => ({ ...current, term: event.target.value }))}
                  placeholder="thing"
                />
              </label>

              <label>
                <span className="field-label">Replacement options</span>
                <input
                  className="field-input"
                  value={draft.replacementOptions.map((option) => option.word).join(', ')}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      replacementOptions: event.target.value
                        .split(',')
                        .map((value) => value.trim())
                        .filter(Boolean)
                        .map((word) => ({
                          word,
                          useWhen: '',
                          caution: '',
                        })),
                    }))
                  }
                  placeholder="constraint, blocker, request"
                />
              </label>

              <label>
                <span className="field-label">Contexts</span>
                <input
                  className="field-input"
                  value={draft.contexts.join(', ')}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      contexts: event.target.value
                        .split(',')
                        .map((value) => value.trim())
                        .filter(Boolean),
                    }))
                  }
                  placeholder="productivity, communication"
                />
              </label>

              <label>
                <span className="field-label">Notes</span>
                <textarea
                  className="field-textarea"
                  value={draft.notes}
                  onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Why does this matter?"
                />
              </label>

              <div className="toggle-row">
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={draft.pinned}
                    onChange={(event) => setDraft((current) => ({ ...current, pinned: event.target.checked }))}
                  />
                  Pin this rule live
                </label>
              </div>

              <div className="button-row">
                <button className="button" onClick={saveRule}>
                  Save rule
                </button>
                <button className="button secondary" onClick={() => setDraft(blankRule())}>
                  Reset
                </button>
              </div>
            </div>
          </section>
        </div>

        <div className="grid two">
          <section className="panel section">
            <h2 className="section-title">Manual rules</h2>
            <div className="list">
              {manualRules.length ? (
                manualRules.map((rule) => (
                  <div key={rule.id} className="list-item">
                    <div className="list-head">
                      <div>
                        <p className="list-title">{rule.term}</p>
                        <p className="list-subtitle">
                          {(rule.replacementOptions.length
                            ? rule.replacementOptions.map((option) => option.word).join(', ')
                            : 'No replacements yet')}
                        </p>
                      </div>
                      <span className={`chip ${rule.type === 'avoid' ? 'avoid' : 'target'}`}>
                        {rule.type}
                      </span>
                    </div>
                    <div className="button-row" style={{ marginTop: 12 }}>
                      <button className="button secondary" onClick={() => toggleRulePinned(rule)}>
                        {(bootstrap?.state.ruleOverrides[rule.id]?.pinned ?? rule.pinned)
                          ? 'Unpin'
                          : 'Pin'}
                      </button>
                      <button className="button ghost" onClick={() => deleteRule(rule.id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="section-copy">No manual rules yet.</p>
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

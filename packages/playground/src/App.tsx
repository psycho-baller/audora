import { useEffect, useMemo, useState } from 'react';
import { archiveRun, fetchCorpus, fetchFindings, fetchNote, fetchRuns, triggerIngest, triggerRun } from './lib/api';
import type {
  CorpusPayload,
  DrillCard,
  EvidenceSpan,
  Finding,
  FindingsPayload,
  NoteAnalysis,
  NoteDetail,
  RunSummary,
  VocabularyWordBank
} from './types';
import { Panel } from './components/Panel';
import { Meter } from './components/Meter';

type ViewKey = 'Corpus' | 'Weaknesses' | 'Vocabulary' | 'Evidence' | 'Drills' | 'Experiments' | 'Archive';

const VIEWS: ViewKey[] = ['Corpus', 'Weaknesses', 'Vocabulary', 'Evidence', 'Drills', 'Experiments', 'Archive'];

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function App() {
  const [view, setView] = useState<ViewKey>('Weaknesses');
  const [busy, setBusy] = useState<'ingest' | 'run' | string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [corpus, setCorpus] = useState<CorpusPayload | null>(null);
  const [findings, setFindings] = useState<FindingsPayload | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [archive, setArchive] = useState<RunSummary[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | undefined>(undefined);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [selectedVocabularyId, setSelectedVocabularyId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<NoteDetail | null>(null);
  const [selectedNoteAnalysis, setSelectedNoteAnalysis] = useState<NoteAnalysis | null>(null);

  const loadAll = async (runId?: string) => {
    setError(null);
    try {
      const [corpusPayload, findingsPayload, runPayload] = await Promise.all([
        fetchCorpus(),
        fetchFindings(runId),
        fetchRuns()
      ]);
      setCorpus(corpusPayload);
      setFindings(findingsPayload);
      setRuns(runPayload.runs);
      setArchive(runPayload.archive);
      setSelectedRunId(findingsPayload.runId);

      const topFinding = findingsPayload.findings.find((item) => item.scope === 'corpus');
      const nextFindingId = selectedFindingId && findingsPayload.findings.some((item) => item.id === selectedFindingId)
        ? selectedFindingId
        : topFinding?.id ?? null;
      setSelectedFindingId(nextFindingId);

      const firstNoteFromFinding = topFinding?.affected_note_ids?.[0];
      const nextNoteId = selectedNoteId && findingsPayload.notes.some((item) => item.id === selectedNoteId)
        ? selectedNoteId
        : firstNoteFromFinding ?? findingsPayload.notes[0]?.id ?? null;
      setSelectedNoteId(nextNoteId);

      const nextVocabularyId =
        selectedVocabularyId && findingsPayload.vocabulary?.targets.some((item) => item.id === selectedVocabularyId)
          ? selectedVocabularyId
          : findingsPayload.vocabulary?.targets[0]?.id ?? null;
      setSelectedVocabularyId(nextVocabularyId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    if (!selectedNoteId) {
      return;
    }
    void fetchNote(selectedNoteId, selectedRunId)
      .then((payload) => {
        setSelectedNote(payload.note);
        setSelectedNoteAnalysis(payload.analysis ?? null);
      })
      .catch((caught) => {
        setError(caught instanceof Error ? caught.message : String(caught));
      });
  }, [selectedNoteId, selectedRunId]);

  const corpusFindings = useMemo(
    () => findings?.findings.filter((item) => item.scope === 'corpus') ?? [],
    [findings]
  );
  const contextFindings = useMemo(
    () => findings?.findings.filter((item) => item.scope === 'context') ?? [],
    [findings]
  );
  const selectedFinding = useMemo(
    () => findings?.findings.find((item) => item.id === selectedFindingId) ?? corpusFindings[0] ?? null,
    [corpusFindings, findings, selectedFindingId]
  );
  const vocabularyTargets = useMemo(() => findings?.vocabulary?.targets ?? [], [findings]);
  const selectedVocabulary = useMemo(
    () => vocabularyTargets.find((item) => item.id === selectedVocabularyId) ?? vocabularyTargets[0] ?? null,
    [selectedVocabularyId, vocabularyTargets]
  );
  const evidenceMap = useMemo(
    () => new Map((findings?.evidence ?? []).map((item) => [item.id, item])),
    [findings]
  );
  const selectedEvidence = useMemo(
    () =>
      selectedFinding
        ? selectedFinding.evidence_span_ids
            .map((id) => evidenceMap.get(id))
            .filter((item): item is EvidenceSpan => Boolean(item))
        : [],
    [evidenceMap, selectedFinding]
  );
  const selectedCounterexamples = useMemo(
    () =>
      selectedFinding
        ? selectedFinding.counterexample_span_ids
            .map((id) => evidenceMap.get(id))
            .filter((item): item is EvidenceSpan => Boolean(item))
        : [],
    [evidenceMap, selectedFinding]
  );
  const selectedDrills = useMemo(
    () =>
      selectedFinding
        ? (findings?.drills ?? []).filter((item) => selectedFinding.linked_drill_ids.includes(item.id))
        : [],
    [findings?.drills, selectedFinding]
  );
  const selectedVocabularyEvidence = useMemo(
    () =>
      selectedVocabulary
        ? selectedVocabulary.evidenceSpanIds
            .map((id) => evidenceMap.get(id))
            .filter((item): item is EvidenceSpan => Boolean(item))
        : [],
    [evidenceMap, selectedVocabulary]
  );
  const vocabularyBanks = useMemo(() => findings?.vocabulary?.banks ?? [], [findings]);

  const noteRows = useMemo(() => {
    if (!findings) {
      return [];
    }
    return findings.notes.map((note) => ({
      ...note,
      scores: (selectedRunId && selectedNoteAnalysis && selectedNoteAnalysis.id === note.id
        ? selectedNoteAnalysis.scores
        : undefined) ?? undefined
    }));
  }, [findings, selectedNoteAnalysis, selectedRunId]);

  const handleAction = async (kind: 'ingest' | 'run', action: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    try {
      await action();
      await loadAll(kind === 'run' ? undefined : selectedRunId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(null);
    }
  };

  const handleArchive = async (runId: string) => {
    setBusy(runId);
    setError(null);
    try {
      await archiveRun(runId, 'Archived from playground explorer');
      await loadAll(selectedRunId === runId ? undefined : selectedRunId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="shell">
      <aside className="rail">
        <div className="rail__hero">
          <p className="rail__kicker">Audora / Research Workbench</p>
          <h1>Transcript Weakness Lab</h1>
          <p className="rail__summary">
            Build evidence-backed communication diagnostics, expose recurring weaknesses, and turn them into drills.
          </p>
        </div>

        <div className="rail__nav">
          {VIEWS.map((item) => (
            <button
              key={item}
              className={`rail__navButton ${view === item ? 'rail__navButton--active' : ''}`}
              onClick={() => setView(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="rail__metrics">
          <div className="statCard">
            <span>Corpus</span>
            <strong>{corpus?.index.noteCount ?? '...'}</strong>
            <small>notes across the seeded export</small>
          </div>
          <div className="statCard">
            <span>Run</span>
            <strong>{findings?.runId ?? '...'}</strong>
            <small>latest active experiment</small>
          </div>
          <div className="statCard">
            <span>Quality</span>
            <strong>{findings ? formatPercent(findings.metrics.overallQuality) : '...'}</strong>
            <small>coverage + stability + actionability</small>
          </div>
          <div className="statCard">
            <span>OpenAI</span>
            <strong>
              {findings?.llm?.enabled
                ? findings.llm.model
                : findings?.llm?.configured
                  ? 'ready'
                  : 'off'}
            </strong>
            <small>
              {findings?.llm?.enabled
                ? 'current run uses OpenAI synthesis'
                : findings?.llm?.configured
                  ? 'configured but not used in this run'
                  : 'set OPENAI_API_KEY to enable'}
            </small>
          </div>
        </div>

        <div className="rail__actions">
          <button
            className="actionButton"
            onClick={() => void handleAction('ingest', triggerIngest)}
            disabled={busy !== null}
          >
            {busy === 'ingest' ? 'Refreshing corpus...' : 'Reingest corpus'}
          </button>
          <button
            className="actionButton actionButton--solid"
            onClick={() =>
              void handleAction('run', () =>
                triggerRun({
                  name: 'baseline-hybrid',
                  llm: { enabled: true }
                })
              )
            }
            disabled={busy !== null}
          >
            {busy === 'run' ? 'Running experiment...' : 'Run baseline + OpenAI'}
          </button>
        </div>

        {error ? <div className="errorBox">{error}</div> : null}
      </aside>

      <main className="stage">
        <header className="stage__header">
          <div>
            <p className="stage__eyebrow">Latest run</p>
            <h2>{selectedRunId ?? 'Loading run...'}</h2>
          </div>
          <div className="stage__runChooser">
            <label htmlFor="run-select">Experiment</label>
            <select
              id="run-select"
              value={selectedRunId}
              onChange={(event) => {
                void loadAll(event.target.value);
              }}
            >
              {runs.map((run) => (
                <option key={run.id} value={run.id}>
                  {run.id}
                </option>
              ))}
            </select>
          </div>
        </header>

        <section className="heroGrid">
          <Panel eyebrow="Coverage" title={`${corpus?.index.noteCount ?? 0} notes / ${findings?.corpus.wordCount ?? 0} words`}>
            <div className="badgeGrid">
              {(corpus?.index.topContexts ?? []).slice(0, 6).map(([label, count]) => (
                <div className="tagCard" key={label}>
                  <span>{label}</span>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
          </Panel>
          <Panel eyebrow="Quality model" title="Experiment signals">
            <div className="meterGrid">
              <Meter label="Coverage" value={(findings?.metrics.coverage ?? 0) * 100} />
              <Meter label="Actionability" value={(findings?.metrics.actionability ?? 0) * 100} />
              <Meter label="Novelty" value={(findings?.metrics.novelty ?? 0) * 100} />
              <Meter label="Stability" value={(findings?.metrics.stability ?? 0) * 100} />
            </div>
          </Panel>
        </section>

        {view === 'Corpus' ? (
          <section className="contentGrid contentGrid--wide">
            <Panel eyebrow="Normalized corpus" title="Notes" right={<span>{corpus?.notes.length ?? 0} loaded</span>}>
              <div className="noteList">
                {corpus?.notes.map((note) => {
                  const scoreBundle = findings?.notes.find((item) => item.id === note.id);
                  return (
                    <button
                      key={note.id}
                      className={`noteRow ${selectedNoteId === note.id ? 'noteRow--active' : ''}`}
                      onClick={() => setSelectedNoteId(note.id)}
                    >
                      <div>
                        <h3>{note.title}</h3>
                        <p>{note.context_tags.join(' · ')}</p>
                      </div>
                      <div className="noteRow__meta">
                        <span>{note.word_count} words</span>
                        <small>{scoreBundle?.contextClusterLabel ?? note.context_cluster_label}</small>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Panel>

            <Panel eyebrow="Selected note" title={selectedNote?.title ?? 'Choose a note'}>
              {selectedNote ? (
                <div className="selectedNote">
                  <div className="selectedNote__chips">
                    {selectedNote.context_tags.map((tag) => (
                      <span className="chip" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="selectedNote__meta">
                    {selectedNote.source_file} · {selectedNote.language} · {selectedNote.word_count} words
                  </p>
                  <pre className="transcriptBox">{selectedNote.raw_text}</pre>
                </div>
              ) : (
                <p className="emptyState">Choose a note from the corpus to inspect the normalized transcript.</p>
              )}
            </Panel>
          </section>
        ) : null}

        {view === 'Weaknesses' ? (
          <section className="contentGrid">
            <Panel eyebrow="Corpus findings" title="Ranked weaknesses">
              <div className="findingList">
                {corpusFindings.map((finding) => (
                  <button
                    key={finding.id}
                    className={`findingCard ${selectedFinding?.id === finding.id ? 'findingCard--active' : ''}`}
                    onClick={() => {
                      setSelectedFindingId(finding.id);
                      setSelectedNoteId(finding.affected_note_ids[0] ?? null);
                    }}
                  >
                    <div className="findingCard__header">
                      <h3>{finding.label}</h3>
                      <span>{finding.severity}</span>
                    </div>
                    <p>{finding.explanation}</p>
                    <div className="findingCard__footer">
                      <small>{Math.round(finding.confidence * 100)}% confidence</small>
                      <small>{finding.metrics.affectedNotes} notes</small>
                    </div>
                  </button>
                ))}
              </div>
            </Panel>

            <Panel eyebrow="Selected finding" title={selectedFinding?.label ?? 'Choose a weakness'}>
              {selectedFinding ? (
                <div className="detailStack">
                  <Meter
                    label="Severity"
                    value={selectedFinding.severity}
                    subtitle={`Confidence ${Math.round(selectedFinding.confidence * 100)}%`}
                  />
                  <p className="detailCopy">{selectedFinding.why_it_matters}</p>
                  {selectedFinding.hypothesis ? <p className="hypothesis">{selectedFinding.hypothesis}</p> : null}
                  <div className="metricPairGrid">
                    {Object.entries(selectedFinding.metrics).map(([key, value]) => (
                      <div className="metricPair" key={key}>
                        <span>{key}</span>
                        <strong>{String(value)}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="affectedNotes">
                    <p className="subtleLabel">Strongest notes</p>
                    {selectedFinding.affected_note_ids.map((noteId) => {
                      const note = findings?.notes.find((item) => item.id === noteId);
                      if (!note) {
                        return null;
                      }
                      return (
                        <button
                          className="subtleButton"
                          key={noteId}
                          onClick={() => {
                            setSelectedNoteId(noteId);
                            setView('Evidence');
                          }}
                        >
                          {note.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="emptyState">Choose a weakness to inspect its severity model and strongest notes.</p>
              )}
            </Panel>
          </section>
        ) : null}

        {view === 'Vocabulary' ? (
          <section className="contentGrid contentGrid--wide">
            <Panel eyebrow="Vocabulary scan" title="Crutch words and phrase habits">
              <div className="metricPairGrid">
                <div className="metricPair">
                  <span>tracked targets</span>
                  <strong>{findings?.vocabulary?.overview.trackedTargetCount ?? 0}</strong>
                </div>
                <div className="metricPair">
                  <span>generic word load</span>
                  <strong>{findings ? `${findings.vocabulary.overview.genericWordLoad}%` : '0%'}</strong>
                </div>
                <div className="metricPair">
                  <span>phrase habit load</span>
                  <strong>{findings ? `${findings.vocabulary.overview.phraseHabitLoad}%` : '0%'}</strong>
                </div>
                <div className="metricPair">
                  <span>lexical diversity</span>
                  <strong>{findings?.vocabulary?.overview.lexicalDiversity ?? 0}</strong>
                </div>
              </div>

              <div className="vocabList">
                {vocabularyTargets.map((target) => (
                  <button
                    key={target.id}
                    className={`vocabCard ${selectedVocabulary?.id === target.id ? 'vocabCard--active' : ''}`}
                    onClick={() => setSelectedVocabularyId(target.id)}
                  >
                    <div className="findingCard__header">
                      <h3>{target.label}</h3>
                      <span>{Math.round(target.overuseScore)}</span>
                    </div>
                    <p>{target.why_it_limits_you}</p>
                    <div className="findingCard__footer">
                      <small>{target.totalOccurrences} hits</small>
                      <small>{Math.round(target.noteCoverage * 100)}% of eligible notes</small>
                    </div>
                  </button>
                ))}
              </div>
            </Panel>

            <div className="stackPanel">
              <Panel eyebrow="Selected target" title={selectedVocabulary?.label ?? 'Choose a target'}>
                {selectedVocabulary ? (
                  <div className="detailStack">
                    <Meter
                      label="Overuse score"
                      value={selectedVocabulary.overuseScore}
                      subtitle={`Confidence ${Math.round(selectedVocabulary.confidence * 100)}%`}
                    />
                    <p className="detailCopy">{selectedVocabulary.why_it_limits_you}</p>

                    <div className="metricPairGrid">
                      <div className="metricPair">
                        <span>occurrences</span>
                        <strong>{selectedVocabulary.totalOccurrences}</strong>
                      </div>
                      <div className="metricPair">
                        <span>notes impacted</span>
                        <strong>{selectedVocabulary.notesImpacted}</strong>
                      </div>
                      <div className="metricPair">
                        <span>coverage</span>
                        <strong>{Math.round(selectedVocabulary.noteCoverage * 100)}%</strong>
                      </div>
                      <div className="metricPair">
                        <span>context spread</span>
                        <strong>{Math.round(selectedVocabulary.clusterSpread * 100)}%</strong>
                      </div>
                    </div>

                    <div>
                      <p className="subtleLabel">Where it shows up</p>
                      <div className="drillEvidence">
                        {selectedVocabulary.contexts.map((context) => (
                          <div className="chip chip--ghost" key={context.label}>
                            {context.label} · {context.count}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="subtleLabel">Replacement bank</p>
                      <div className="replacementGrid">
                        {selectedVocabulary.replacementOptions.map((option) => (
                          <article className="replacementCard" key={`${selectedVocabulary.id}-${option.word}`}>
                            <div className="replacementCard__header">
                              <strong>{option.word}</strong>
                              <span>{selectedVocabulary.kind}</span>
                            </div>
                            <p>{option.useWhen}</p>
                            <small>{option.caution}</small>
                          </article>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="subtleLabel">Evidence spans</p>
                      <div className="evidenceList">
                        {selectedVocabularyEvidence.map((span) => (
                          <button
                            key={span.id}
                            className="evidenceCard"
                            onClick={() => {
                              setSelectedNoteId(span.note_id);
                              setView('Evidence');
                            }}
                          >
                            <div className="evidenceCard__header">
                              <strong>{span.note_title}</strong>
                              <span>{span.metrics.suggestedReplacement as string}</span>
                            </div>
                            <p>{span.text}</p>
                            <small>{span.rationale}</small>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="emptyState">Choose a vocabulary target to inspect its replacements and evidence.</p>
                )}
              </Panel>

              <Panel eyebrow="Practice loop" title="Rewrites and learnable words">
                {selectedVocabulary ? (
                  <div className="detailStack">
                    <div>
                      <p className="subtleLabel">Sample rewrites</p>
                      {selectedVocabulary.sampleRewrites.length ? (
                        <div className="rewriteList">
                          {selectedVocabulary.sampleRewrites.map((rewrite, index) => (
                            <article className="rewriteCard" key={`${selectedVocabulary.id}-rewrite-${index}`}>
                              <div className="rewriteCard__header">
                                <strong>{rewrite.noteTitle ?? 'Rewrite draft'}</strong>
                                <span>{rewrite.replacement}</span>
                              </div>
                              <p className="rewriteCard__original">{rewrite.original}</p>
                              <p className="rewriteCard__arrow">to</p>
                              <p className="rewriteCard__rewrite">{rewrite.rewritten}</p>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <p className="emptyState">
                          Automatic rewrites only appear when the replacement is context-safe. Use the bank above to rewrite this family manually.
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="subtleLabel">Today's vocabulary loop</p>
                      <ul className="plainList">
                        {selectedVocabulary.learningSystem.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <p className="subtleLabel">Context word banks</p>
                      <div className="wordBankList">
                        {vocabularyBanks.map((bank) => (
                          <WordBankView key={bank.context} bank={bank} />
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="subtleLabel">Active experiments</p>
                      <div className="experimentList">
                        {(findings?.vocabulary?.experiments ?? []).map((experiment) => (
                          <article className="replacementCard" key={experiment.id}>
                            <div className="replacementCard__header">
                              <strong>{experiment.label}</strong>
                              <span>{experiment.status}</span>
                            </div>
                            <p>{experiment.description}</p>
                          </article>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="emptyState">The vocabulary workspace will populate once a target is selected.</p>
                )}
              </Panel>
            </div>
          </section>
        ) : null}

        {view === 'Evidence' ? (
          <section className="contentGrid">
            <Panel eyebrow="Evidence" title={selectedFinding?.label ?? 'Evidence'}>
              <div className="evidenceList">
                {selectedEvidence.map((span) => (
                  <button
                    key={span.id}
                    className="evidenceCard"
                    onClick={() => setSelectedNoteId(span.note_id)}
                  >
                    <div className="evidenceCard__header">
                      <strong>{span.note_title}</strong>
                      <span>{span.score}</span>
                    </div>
                    <p>{span.text}</p>
                    <small>{span.rationale}</small>
                  </button>
                ))}
              </div>
            </Panel>
            <Panel eyebrow="Counterexamples" title="Reusable stronger moments">
              <div className="evidenceList">
                {selectedCounterexamples.map((span) => (
                  <button
                    key={span.id}
                    className="evidenceCard evidenceCard--positive"
                    onClick={() => setSelectedNoteId(span.note_id)}
                  >
                    <div className="evidenceCard__header">
                      <strong>{span.note_title}</strong>
                      <span>{Math.round(span.score)}</span>
                    </div>
                    <p>{span.text}</p>
                    <small>{span.rationale}</small>
                  </button>
                ))}
              </div>
            </Panel>
            <Panel eyebrow="Note drill-down" title={selectedNote?.title ?? 'Select a note'}>
              {selectedNote ? (
                <div className="selectedNote">
                  <p className="selectedNote__meta">
                    {selectedNote.context_tags.join(' · ')} · {selectedNote.context_cluster_label}
                  </p>
                  <div className="meterGrid">
                    {Object.entries(selectedNoteAnalysis?.scores ?? {}).map(([label, value]) => (
                      <Meter key={label} label={label.replaceAll('_', ' ')} value={value} />
                    ))}
                  </div>
                  <pre className="transcriptBox">{selectedNote.raw_text}</pre>
                </div>
              ) : (
                <p className="emptyState">Choose an evidence span or note.</p>
              )}
            </Panel>
          </section>
        ) : null}

        {view === 'Drills' ? (
          <section className="contentGrid">
            <Panel eyebrow="Practice systems" title={selectedFinding?.label ?? 'Drills'}>
              <div className="drillGrid">
                {selectedDrills.map((drill) => (
                  <DrillView key={drill.id} drill={drill} evidenceMap={evidenceMap} />
                ))}
              </div>
            </Panel>
            <Panel eyebrow="Context clusters" title="Where it spikes">
              <div className="findingList">
                {contextFindings
                  .filter((item) => item.dimension === selectedFinding?.dimension)
                  .map((finding) => (
                    <div key={finding.id} className="findingCard findingCard--compact">
                      <div className="findingCard__header">
                        <h3>{finding.label}</h3>
                        <span>{finding.severity}</span>
                      </div>
                      <p>{finding.explanation}</p>
                    </div>
                  ))}
              </div>
            </Panel>
          </section>
        ) : null}

        {view === 'Experiments' ? (
          <section className="contentGrid contentGrid--wide">
            <Panel eyebrow="Run history" title="Active experiments">
              <div className="runList">
                {runs.map((run) => (
                  <div className="runRow" key={run.id}>
                    <button
                      className={`runRow__button ${selectedRunId === run.id ? 'runRow__button--active' : ''}`}
                      onClick={() => void loadAll(run.id)}
                    >
                      <strong>{run.id}</strong>
                      <span>{run.name ?? 'unnamed'}</span>
                    </button>
                    <div className="runRow__metrics">
                      <small>quality {formatPercent(run.metrics.overallQuality)}</small>
                      <small>stability {formatPercent(run.metrics.stability)}</small>
                    </div>
                    <button className="subtleButton" onClick={() => void handleArchive(run.id)} disabled={busy === run.id}>
                      {busy === run.id ? 'Archiving...' : 'Archive'}
                    </button>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel eyebrow="Comparison" title="Delta from previous run">
              <div className="metricPairGrid">
                {Object.entries(findings?.comparisons.severityShift ?? {}).map(([key, value]) => (
                  <div className="metricPair" key={key}>
                    <span>{key}</span>
                    <strong>{value > 0 ? `+${value}` : value}</strong>
                  </div>
                ))}
              </div>
            </Panel>
          </section>
        ) : null}

        {view === 'Archive' ? (
          <section className="contentGrid">
            <Panel eyebrow="Archived experiments" title="Soft-retired runs">
              <div className="runList">
                {archive.map((run) => (
                  <div className="runRow runRow--archived" key={run.id}>
                    <div className="runRow__button">
                      <strong>{run.id}</strong>
                      <span>{run.name ?? 'archived'}</span>
                    </div>
                    <div className="runRow__metrics">
                      <small>{run.archiveStatus?.reason ?? 'archived'}</small>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel eyebrow="Archive intent" title="What belongs here">
              <div className="detailStack">
                <p className="detailCopy">
                  Archive low-value experiments when they are unstable, shallow, or weakly actionable. The raw corpus never moves.
                </p>
                <ul className="plainList">
                  <li>Naive detectors with weak explanatory power</li>
                  <li>Experiments that reduce actionability or evidence quality</li>
                  <li>Configs that inflate novelty while collapsing stability</li>
                </ul>
              </div>
            </Panel>
          </section>
        ) : null}
      </main>
    </div>
  );
}

function DrillView({
  drill,
  evidenceMap
}: {
  key?: string;
  drill: DrillCard;
  evidenceMap: Map<string, EvidenceSpan>;
}) {
  return (
    <article className="drillCard">
      <div className="drillCard__header">
        <p className="panel__eyebrow">Simulation</p>
        <h3>{drill.title}</h3>
      </div>
      <p className="detailCopy">{drill.scenario_prompt}</p>
      <div className="drillCard__grid">
        <div>
          <p className="subtleLabel">Rubric</p>
          <ul className="plainList">
            {drill.rubric.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="subtleLabel">Success criteria</p>
          <ul className="plainList">
            {drill.success_criteria.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
      <div>
        <p className="subtleLabel">Source evidence</p>
        <div className="drillEvidence">
          {drill.source_evidence_ids.map((id) => {
            const evidence = evidenceMap.get(id);
            if (!evidence) {
              return null;
            }
            return (
              <div className="chip chip--ghost" key={id}>
                {evidence.note_title}
              </div>
            );
          })}
        </div>
      </div>
    </article>
  );
}

function WordBankView({ bank }: { key?: string; bank: VocabularyWordBank }) {
  return (
    <article className="wordBank">
      <div className="wordBank__header">
        <div>
          <p className="panel__eyebrow">{bank.context}</p>
          <h3>{bank.noteCount} notes</h3>
        </div>
      </div>
      <div className="wordBank__grid">
        {bank.words.map((entry) => (
          <div className="wordBank__entry" key={`${bank.context}-${entry.word}`}>
            <strong>{entry.word}</strong>
            <p>{entry.useWhen}</p>
            <small>{entry.example}</small>
          </div>
        ))}
      </div>
    </article>
  );
}

export default App;

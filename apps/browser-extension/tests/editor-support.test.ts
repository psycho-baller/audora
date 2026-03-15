import { describe, expect, it } from 'vitest';

import { applyQuickReplace, buildEditorSurface, isSupportedEditor } from '../src/content/editor-support';

describe('editor support', () => {
  it('detects textarea editors and applies quick replace', () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'This thing matters.';
    textarea.selectionStart = 5;
    textarea.selectionEnd = 10;
    document.body.append(textarea);

    expect(isSupportedEditor(textarea)).toBe(true);
    const surface = buildEditorSurface(textarea, 'example.com');
    expect(surface?.kind).toBe('textarea');

    const success = applyQuickReplace(surface!, {
      id: 'match',
      ruleId: 'rule',
      term: 'thing',
      family: 'thing_family',
      rangeLower: 5,
      rangeUpper: 10,
      snippet: 'This thing matters.',
      replacement: 'constraint',
    }, 'constraint');

    expect(success).toBe(true);
    expect(textarea.value).toBe('This constraint matters.');
  });

  it('detects contenteditable editors and replaces inline text', () => {
    const editor = document.createElement('div');
    editor.contentEditable = 'true';
    editor.setAttribute('contenteditable', 'true');
    editor.textContent = 'This thing matters.';
    document.body.append(editor);

    expect(isSupportedEditor(editor)).toBe(true);
    const surface = buildEditorSurface(editor, 'example.com');
    expect(surface?.kind).toBe('contenteditable');

    const success = applyQuickReplace(surface!, {
      id: 'match',
      ruleId: 'rule',
      term: 'thing',
      family: 'thing_family',
      rangeLower: 5,
      rangeUpper: 10,
      snippet: 'This thing matters.',
      replacement: 'constraint',
    }, 'constraint');

    expect(success).toBe(true);
    expect(editor.textContent).toBe('This constraint matters.');
  });
});

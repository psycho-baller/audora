import { describe, expect, it } from 'vitest';

import {
  applyQuickReplace,
  buildEditorSurface,
  isSupportedEditor,
  resolveDeepActiveEditor,
  resolveSupportedEditor,
} from '../src/content/editor-support';

describe('editor support', () => {
  it('detects text inputs and applies quick replace', () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = 'This thing matters.';
    input.selectionStart = 5;
    input.selectionEnd = 10;
    document.body.append(input);

    expect(isSupportedEditor(input)).toBe(true);
    const surface = buildEditorSurface(input, 'example.com');
    expect(surface?.kind).toBe('input');

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
    expect(input.value).toBe('This constraint matters.');
  });

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

  it('resolves the real contenteditable root when a descendant element receives the event', () => {
    const editor = document.createElement('div');
    editor.contentEditable = 'true';
    editor.setAttribute('contenteditable', 'true');
    editor.innerHTML = '<p><span>This thing matters.</span></p>';
    document.body.append(editor);

    const innerSpan = editor.querySelector('span');
    expect(innerSpan).toBeTruthy();

    const resolved = resolveSupportedEditor(innerSpan);
    expect(resolved).toBe(editor);

    const surface = buildEditorSurface(resolved!, 'example.com');
    expect(surface?.text).toBe('This thing matters.');
  });

  it('treats designMode documents as editable bodies', () => {
    const originalDesignMode = document.designMode;
    Object.defineProperty(document, 'designMode', {
      configurable: true,
      value: 'on',
    });

    document.body.textContent = 'This thing matters.';

    const resolved = resolveSupportedEditor(document.body);
    expect(resolved).toBe(document.body);

    const surface = buildEditorSurface(resolved!, 'example.com');
    expect(surface?.kind).toBe('contenteditable');
    expect(surface?.text).toBe('This thing matters.');

    Object.defineProperty(document, 'designMode', {
      configurable: true,
      value: originalDesignMode,
    });
  });

  it('follows focus into open shadow roots when resolving the active editor', () => {
    const host = document.createElement('div');
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const input = document.createElement('input');
    input.type = 'text';
    shadowRoot.append(input);
    document.body.append(host);

    Object.defineProperty(document, 'activeElement', {
      configurable: true,
      value: host,
    });
    Object.defineProperty(shadowRoot, 'activeElement', {
      configurable: true,
      value: input,
    });

    expect(resolveDeepActiveEditor(document)).toBe(input);
  });
});

import { describe, expect, it } from 'vitest';
import fullWorkflow from '../fixtures/comfy/full-api.json';
import invalidWorkflow from '../fixtures/comfy/invalid-api.json';
import minimalWorkflow from '../fixtures/comfy/minimal-api.json';
import {
  ComfyWorkflowError,
  formatPostTagsForReverse,
  parseApiWorkflowJson,
  prepareWorkflow,
  validateApiWorkflow,
} from '../../src/services/comfy/workflow';
import type { UnifiedPost } from '../../src/types/post';

describe('ComfyUI API workflow validation', () => {
  it('discovers all special nodes and OPTION types', () => {
    const parsed = validateApiWorkflow(fullWorkflow, 'Full');

    expect(parsed.inputNodeIds).toEqual(['1', '2']);
    expect(parsed.outputNodeIds).toEqual(['7', '8']);
    expect(parsed.reverseNodeIds).toEqual(['3', '9']);
    expect(parsed.options).toEqual([
      { nodeId: '4', title: 'OPTION prompt', kind: 'text', inputKey: 'text', value: 'draft' },
      { nodeId: '5', title: 'OPTION steps', kind: 'integer', inputKey: 'value', value: 20 },
    ]);
  });

  it('accepts a minimal API workflow and parses JSON text', () => {
    const parsed = parseApiWorkflowJson(JSON.stringify(minimalWorkflow), 'Minimal');
    expect(parsed.inputNodeIds).toEqual(['1']);
    expect(parsed.outputNodeIds).toEqual(['2']);
  });

  it('reports workflow and node-specific import errors together', () => {
    expect.assertions(2);
    try {
      validateApiWorkflow(invalidWorkflow, 'Broken');
    } catch (error) {
      expect(error).toBeInstanceOf(ComfyWorkflowError);
      expect((error as ComfyWorkflowError).issues).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'invalid-input-image', workflowName: 'Broken', nodeId: '1', field: 'inputs.image' }),
        expect.objectContaining({ code: 'invalid-option', nodeId: '2' }),
        expect.objectContaining({ code: 'missing-inputs', nodeId: '3' }),
      ]));
    }
  });

  it.each([
    ['not json', 'invalid-json'],
    ['[]', 'invalid-root'],
    ['{}', 'empty-workflow'],
  ])('rejects %s', (json, code) => {
    expect(() => parseApiWorkflowJson(json)).toThrowError(ComfyWorkflowError);
    try {
      parseApiWorkflowJson(json);
    } catch (error) {
      expect((error as ComfyWorkflowError).issues[0]?.code).toBe(code);
    }
  });

  it('requires at least one INPUT and treats exact OPTION as a normal title', () => {
    const noInput = {
      '1': { class_type: 'PrimitiveInt', inputs: { value: 4 }, _meta: { title: 'OPTION' } },
    };
    expect(() => validateApiWorkflow(noInput)).toThrowError(expect.objectContaining({
      issues: [expect.objectContaining({ code: 'missing-input' })],
    }));
  });

  it('accepts a REVERSE text input connected to a string-producing node', () => {
    const connected: Record<string, unknown> = structuredClone(minimalWorkflow);
    connected['3'] = { class_type: 'WD14Tagger|pysssss', inputs: { image: ['1', 0] }, _meta: { title: 'WD14 Tagger' } };
    connected['5'] = { class_type: 'JjkText', inputs: { text: ['3', 0] }, _meta: { title: 'REVERSE' } };

    const parsed = validateApiWorkflow(connected, 'Batch');
    expect(parsed.reverseNodeIds).toEqual(['5']);
    expect(parsed.workflow['5'].inputs.text).toEqual(['3', 0]);
  });

  it('still rejects malformed REVERSE connections', () => {
    const malformed: Record<string, unknown> = structuredClone(minimalWorkflow);
    malformed['5'] = { class_type: 'JjkText', inputs: { text: ['3', -1] }, _meta: { title: 'REVERSE' } };
    expect(() => validateApiWorkflow(malformed, 'Broken')).toThrowError(expect.objectContaining({
      issues: [expect.objectContaining({ code: 'invalid-reverse-text', nodeId: '5' })],
    }));
  });
});

describe('ComfyUI workflow preparation', () => {
  it('applies INPUT, REVERSE, text OPTION, and direct integer OPTION links immutably', () => {
    const parsed = validateApiWorkflow(fullWorkflow);
    const prepared = prepareWorkflow(parsed, {
      imagePath: 'uploads/current.png',
      reverseText: 'artist, character',
      optionValues: { '4': 'final prompt', '5': 28 },
    });

    expect(prepared['1'].inputs.image).toBe('uploads/current.png');
    expect(prepared['2'].inputs.image).toBe('uploads/current.png');
    expect(prepared['3'].inputs.text).toBe('artist, character');
    expect(prepared['9'].inputs.text).toBe('artist, character');
    expect(prepared['4'].inputs.text).toBe('final prompt');
    expect(prepared['5']).toBeUndefined();
    expect(prepared['6'].inputs.steps).toBe(28);
    expect(parsed.workflow['1'].inputs.image).toBe('a.png');
    expect(parsed.workflow['5']).toBeDefined();
  });

  it('rejects OPTION values of the wrong type', () => {
    const parsed = validateApiWorkflow(fullWorkflow);
    expect(() => prepareWorkflow(parsed, { imagePath: 'a.png', optionValues: { '5': '28' } })).toThrow(TypeError);
  });

  it('rejects nested references before deleting an integer OPTION node', () => {
    const nested = structuredClone(fullWorkflow);
    (nested['6'].inputs as Record<string, unknown>).nested = [['5', 0]];
    expect(() => validateApiWorkflow(nested)).toThrowError(expect.objectContaining({
      issues: [expect.objectContaining({ code: 'invalid-option-link', nodeId: '6', field: 'inputs.nested' })],
    }));
  });

  it('formats Viewer tags and uses an empty string for local files', () => {
    const post = {
      tags: [
        { name: 'alice_artist', category: 'artist' },
        { name: 'hero_(series)', category: 'character' },
        { name: 'ignored', category: 'meta' },
      ],
    } as UnifiedPost;
    const options = { categories: ['character', 'artist'] as const, useUnderscores: false, escapeParentheses: true };

    expect(formatPostTagsForReverse(post, { ...options, categories: [...options.categories] })).toBe('alice artist, hero \\(series\\)');
    expect(formatPostTagsForReverse(null, { ...options, categories: [...options.categories] })).toBe('');
  });
});

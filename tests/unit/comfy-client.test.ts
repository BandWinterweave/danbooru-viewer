import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ComfyClient,
  ComfyClientError,
  ComfyWebSocketMonitor,
  parseComfyAddress,
  parseComfySocketMessage,
  waitForPromptCompletion,
} from '../../src/services/comfy/client';

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('ComfyUI address parsing', () => {
  it.each([
    ['127.0.0.1', 'http://127.0.0.1:8188/'],
    ['127.0.0.1:9000', 'http://127.0.0.1:9000/'],
    ['https://127.0.0.1:8443', 'https://127.0.0.1:8443/'],
    ['http://127.0.0.1:80', 'http://127.0.0.1/'],
    ['https://127.0.0.1:443', 'https://127.0.0.1/'],
  ])('normalizes %s', (input, expected) => {
    expect(parseComfyAddress(input).toString()).toBe(expected);
  });

  it.each([
    'http://localhost:8188',
    'http://192.168.1.2:8188',
    'ftp://127.0.0.1:8188',
    'http://user:pass@127.0.0.1:8188',
    'http://127.0.0.1:8188/api',
    'http://127.0.0.1:8188/?token=x',
    'http://127.0.0.1:70000',
  ])('rejects unsafe address %s', (input) => {
    expect(() => parseComfyAddress(input)).toThrowError(expect.objectContaining({ code: 'address' }));
  });
});

describe('ComfyUI HTTP client', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

  it('binds the native fetch receiver for WorkerGlobalScope compatibility', async () => {
    const request = vi.fn(function (this: unknown) {
      if (this !== globalThis) throw new TypeError('Illegal invocation');
      return Promise.resolve(jsonResponse({ queue_running: [], queue_pending: [] }));
    });
    vi.stubGlobal('fetch', request);
    const client = new ComfyClient('127.0.0.1');

    await expect(client.getQueue()).resolves.toEqual({ queueRunning: [], queuePending: [] });
    expect(request).toHaveBeenCalledOnce();
  });

  it('uploads an image with ComfyUI multipart fields and validates the response', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ name: 'image.png', subfolder: '', type: 'input' }));
    const client = new ComfyClient('127.0.0.1', { fetch: request });

    await expect(client.uploadImage(new Blob(['image']), 'image.png')).resolves.toEqual({ name: 'image.png', subfolder: '', type: 'input' });
    const body = request.mock.calls[0]?.[1]?.body as FormData;
    expect(request.mock.calls[0]?.[0].toString()).toBe('http://127.0.0.1:8188/upload/image');
    expect(body.get('type')).toBe('input');
    expect(body.get('overwrite')).toBe('false');
    expect(body.get('image')).toBeInstanceOf(Blob);
  });

  it('submits a prompt with a client ID', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ prompt_id: 'prompt-1' }));
    const client = new ComfyClient('127.0.0.1', { fetch: request });

    await expect(client.queuePrompt({ '1': {} }, 'client-1')).resolves.toBe('prompt-1');
    expect(JSON.parse(request.mock.calls[0]?.[1]?.body as string)).toEqual({ prompt: { '1': {} }, client_id: 'client-1' });
  });

  it('keeps the client localhost-only even if a returned URL is mutated', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ queue_running: [], queue_pending: [] }));
    const client = new ComfyClient('127.0.0.1', { fetch: request });
    client.baseUrl.hostname = 'example.com';

    await client.getQueue();
    expect(request.mock.calls[0]?.[0].toString()).toBe('http://127.0.0.1:8188/queue');
  });

  it('does not abort a prompt after submission enters the uncertain critical section', async () => {
    const controller = new AbortController();
    let resolveRequest!: (response: Response) => void;
    const request = vi.fn<typeof fetch>().mockImplementation(() => new Promise((resolve) => { resolveRequest = resolve; }));
    const client = new ComfyClient('127.0.0.1', { fetch: request });
    const prompt = client.queuePrompt({}, 'client', controller.signal);
    controller.abort();
    resolveRequest(jsonResponse({ prompt_id: 'prompt-1' }));

    await expect(prompt).resolves.toBe('prompt-1');
    await expect(client.queuePrompt({}, 'client', controller.signal)).rejects.toMatchObject({ code: 'cancelled' });
  });

  it('classifies an unconfirmed prompt request without exposing large server bodies', async () => {
    const offline = new ComfyClient('127.0.0.1', { fetch: vi.fn<typeof fetch>().mockRejectedValue(new TypeError('offline')) });
    await expect(offline.queuePrompt({}, 'client')).rejects.toMatchObject({ code: 'submission-unknown' });

    const rejected = new ComfyClient('127.0.0.1', {
      fetch: vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ error: { type: 'prompt_outputs_failed_validation', message: 'Bad node' } }, 400)),
    });
    await expect(rejected.queuePrompt({}, 'client')).rejects.toMatchObject({ code: 'http', status: 400, message: 'prompt_outputs_failed_validation: Bad node' });
  });

  it('classifies timeout and external cancellation separately', async () => {
    vi.useFakeTimers();
    const stalled = vi.fn<typeof fetch>().mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    }));
    const client = new ComfyClient('127.0.0.1', { fetch: stalled, timeoutMs: 50 });
    const timedOut = client.getQueue();
    const timedOutExpectation = expect(timedOut).rejects.toMatchObject({ code: 'timeout' });
    await vi.advanceTimersByTimeAsync(50);
    await timedOutExpectation;

    const controller = new AbortController();
    const cancelled = client.getQueue(controller.signal);
    controller.abort();
    await expect(cancelled).rejects.toMatchObject({ code: 'cancelled' });
  });

  it('validates History and queue response shapes and builds encoded view URLs', async () => {
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ 'prompt/1': { status: { status_str: 'success', completed: true, messages: [] }, outputs: {} } }))
      .mockResolvedValueOnce(jsonResponse({ queue_running: [], queue_pending: [[0, 'x']] }));
    const client = new ComfyClient('127.0.0.1:9000', { fetch: request });

    await expect(client.getHistory('prompt/1')).resolves.toEqual({ status: { status_str: 'success', completed: true, messages: [] }, outputs: {} });
    await expect(client.getQueue()).resolves.toEqual({ queueRunning: [], queuePending: [[0, 'x']] });
    expect(client.getViewUrl({ filename: 'a b.png', subfolder: 'folder/name' }).toString()).toBe('http://127.0.0.1:9000/view?filename=a+b.png&type=output&subfolder=folder%2Fname');
  });

  it.each([
    [{ name: '', subfolder: '', type: 'input' }, 'uploadImage'],
    [{ name: 'a.png', type: 'input' }, 'uploadImage'],
    [{ queue_running: [['bad']], queue_pending: [] }, 'getQueue'],
    [{ 'prompt-1': { outputs: {} } }, 'getHistory'],
  ] as const)('rejects malformed protocol response %#', async (response, method) => {
    const client = new ComfyClient('127.0.0.1', { fetch: vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(response)) });
    const result = method === 'uploadImage'
      ? client.uploadImage(new Blob(['x']), 'a.png')
      : method === 'getQueue'
        ? client.getQueue()
        : client.getHistory('prompt-1');
    await expect(result).rejects.toMatchObject({ code: 'protocol' });
  });

  it('calls queue deletion and global interrupt endpoints with the expected methods', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }));
    const client = new ComfyClient('127.0.0.1', { fetch: request });

    await client.deletePendingPrompt('prompt-1');
    await client.interrupt();
    expect(request.mock.calls[0]?.[0].toString()).toBe('http://127.0.0.1:8188/queue');
    expect(request.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', body: '{"delete":["prompt-1"]}' });
    expect(request.mock.calls[1]?.[0].toString()).toBe('http://127.0.0.1:8188/interrupt');
    expect(request.mock.calls[1]?.[1]).toMatchObject({ method: 'POST' });
  });
});

describe('ComfyUI WebSocket and History coordination', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it('filters malformed, binary, unknown, and unrelated prompt events', () => {
    expect(parseComfySocketMessage(new ArrayBuffer(2))).toBeNull();
    expect(parseComfySocketMessage('{bad')).toBeNull();
    expect(parseComfySocketMessage(JSON.stringify({ type: 'status', data: {} }))).toBeNull();
    expect(parseComfySocketMessage(JSON.stringify({ type: 'progress', data: { prompt_id: 'other', value: 1, max: 2 } }), 'wanted')).toBeNull();
    expect(parseComfySocketMessage(JSON.stringify({ type: 'progress', data: { value: 1, max: 2 } }), 'wanted')).toBeNull();
    expect(parseComfySocketMessage(JSON.stringify({ type: 'progress', data: { prompt_id: 'wanted', value: 1, max: 2, node: '7' } }), 'wanted')).toEqual({
      type: 'progress', promptId: 'wanted', value: 1, max: 2, nodeId: '7',
    });
    expect(parseComfySocketMessage(JSON.stringify({ type: 'progress_state', data: { prompt_id: 'wanted', nodes: { '9': { value: 3, max: 4 } } } }), 'wanted')).toEqual({
      type: 'progress', promptId: 'wanted', value: 3, max: 4, nodeId: '9',
    });
  });

  it('reconnects after close and uses the ComfyUI clientId query convention', async () => {
    vi.useFakeTimers();
    const sockets: Array<Partial<WebSocket>> = [];
    const createSocket = vi.fn((url: string) => {
      const socket: Partial<WebSocket> = { url, close: vi.fn() };
      sockets.push(socket);
      return socket as WebSocket;
    });
    const monitor = new ComfyWebSocketMonitor(parseComfyAddress('https://127.0.0.1:8188'), 'client id', { createSocket, reconnectDelayMs: 20 });

    monitor.start();
    expect(createSocket).toHaveBeenCalledWith('wss://127.0.0.1:8188/ws?clientId=client+id');
    sockets[0]?.onclose?.call(sockets[0] as WebSocket, new CloseEvent('close'));
    await vi.advanceTimersByTimeAsync(20);
    expect(createSocket).toHaveBeenCalledTimes(2);
    monitor.stop();
  });

  it('uses a terminal WebSocket event to wake polling but trusts History for completion', async () => {
    vi.useFakeTimers();
    let socket!: Partial<WebSocket>;
    const monitor = new ComfyWebSocketMonitor(parseComfyAddress('127.0.0.1'), 'client', {
      createSocket: () => {
        socket = { close: vi.fn() };
        return socket as WebSocket;
      },
    });
    monitor.setPromptFilter('prompt-1');
    monitor.start();
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({ 'prompt-1': { status: { status_str: 'success', completed: true, messages: [] }, outputs: { '7': { images: [] } } } }));
    const client = new ComfyClient('127.0.0.1', { fetch: request });
    const completion = waitForPromptCompletion(client, 'prompt-1', { monitor, intervalMs: 10_000 });
    await vi.advanceTimersByTimeAsync(0);

    socket.onmessage?.call(socket as WebSocket, new MessageEvent('message', { data: JSON.stringify({ type: 'execution_success', data: { prompt_id: 'prompt-1' } }) }));
    await expect(completion).resolves.toEqual({ status: { status_str: 'success', completed: true, messages: [] }, outputs: { '7': { images: [] } } });
    expect(request).toHaveBeenCalledTimes(2);
    monitor.stop();
  });

  it('uses a WebSocket error to wake polling and lets History confirm failure', async () => {
    vi.useFakeTimers();
    let socket!: Partial<WebSocket>;
    const monitor = new ComfyWebSocketMonitor(parseComfyAddress('127.0.0.1'), 'client', {
      createSocket: () => {
        socket = { close: vi.fn() };
        return socket as WebSocket;
      },
    });
    monitor.start();
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({
        'prompt-1': {
          status: { status_str: 'error', completed: false, messages: [['execution_error', { message: 'Node failed' }]] },
          outputs: {},
        },
      }));
    const client = new ComfyClient('127.0.0.1', { fetch: request });
    const completion = waitForPromptCompletion(client, 'prompt-1', { monitor, intervalMs: 10_000 });
    await vi.advanceTimersByTimeAsync(0);
    socket.onmessage?.call(socket as WebSocket, new MessageEvent('message', { data: JSON.stringify({ type: 'execution_error', data: { prompt_id: 'prompt-1', message: 'Node failed' } }) }));

    await expect(completion).rejects.toEqual(expect.objectContaining<Partial<ComfyClientError>>({ code: 'execution', message: 'Node failed' }));
    expect(request).toHaveBeenCalledTimes(2);
    monitor.stop();
  });

  it('uses an error status in History as the final execution result', async () => {
    const client = new ComfyClient('127.0.0.1', {
      fetch: vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
        'prompt-1': {
          status: {
            status_str: 'error',
            completed: false,
            messages: [['execution_error', { exception_message: 'Model failed' }]],
          },
          outputs: {},
        },
      })),
    });

    await expect(waitForPromptCompletion(client, 'prompt-1')).rejects.toMatchObject({ code: 'execution', message: 'Model failed' });
  });
});

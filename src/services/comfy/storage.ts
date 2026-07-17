import {
  COMFY_STORAGE,
  COMFY_STORAGE_SCHEMA_VERSION,
  DEFAULT_COMFY_SETTINGS,
  type ComfyBlobRecord,
  type ComfyHistoryRecord,
  type ComfySettingsSnapshot,
  type ComfyTaskSnapshot,
  type ComfyWorkflowPreset,
} from './types';

type StoreName = (typeof COMFY_STORAGE.stores)[keyof typeof COMFY_STORAGE.stores];

const storeNames = Object.values(COMFY_STORAGE.stores);
const memoryStores = new Map<StoreName, Map<IDBValidKey, unknown>>();

function memoryStore(name: StoreName) {
  let store = memoryStores.get(name);
  if (!store) {
    store = new Map();
    memoryStores.set(name, store);
  }
  return store;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
  });
}

async function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return null;
  const request = indexedDB.open(COMFY_STORAGE.database, COMFY_STORAGE_SCHEMA_VERSION);
  request.onupgradeneeded = () => {
    const database = request.result;
    for (const name of storeNames) if (!database.objectStoreNames.contains(name)) database.createObjectStore(name);
  };
  return requestResult(request);
}

async function readValue<T>(storeName: StoreName, key: IDBValidKey): Promise<T | undefined> {
  const database = await openDatabase();
  if (!database) return memoryStore(storeName).get(key) as T | undefined;
  try {
    return await requestResult(database.transaction(storeName).objectStore(storeName).get(key)) as T | undefined;
  } finally {
    database.close();
  }
}

async function writeValue(storeName: StoreName, key: IDBValidKey, value: unknown): Promise<void> {
  const database = await openDatabase();
  if (!database) {
    memoryStore(storeName).set(key, structuredClone(value));
    return;
  }
  try {
    const transaction = database.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).put(value, key);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

async function deleteValue(storeName: StoreName, key: IDBValidKey): Promise<void> {
  const database = await openDatabase();
  if (!database) {
    memoryStore(storeName).delete(key);
    return;
  }
  try {
    const transaction = database.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).delete(key);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

async function readAll<T>(storeName: StoreName): Promise<T[]> {
  const database = await openDatabase();
  if (!database) return [...memoryStore(storeName).values()] as T[];
  try {
    return await requestResult(database.transaction(storeName).objectStore(storeName).getAll()) as T[];
  } finally {
    database.close();
  }
}

export class ComfyStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ComfyStorageError';
  }
}

export class ComfyStorage {
  async initialize(): Promise<void> {
    const version = await readValue<number>(COMFY_STORAGE.stores.metadata, COMFY_STORAGE.keys.schema);
    if (version !== undefined && version > COMFY_STORAGE_SCHEMA_VERSION) throw new ComfyStorageError('ComfyUI storage was created by a newer version');
    await writeValue(COMFY_STORAGE.stores.metadata, COMFY_STORAGE.keys.schema, COMFY_STORAGE_SCHEMA_VERSION);
    if (!await readValue(COMFY_STORAGE.stores.metadata, COMFY_STORAGE.keys.settings)) await this.saveSettings(DEFAULT_COMFY_SETTINGS);
  }

  async getSettings(): Promise<ComfySettingsSnapshot> {
    const stored = await readValue<Partial<ComfySettingsSnapshot>>(COMFY_STORAGE.stores.metadata, COMFY_STORAGE.keys.settings);
    return { ...DEFAULT_COMFY_SETTINGS, ...stored };
  }

  async saveSettings(settings: ComfySettingsSnapshot): Promise<void> {
    await writeValue(COMFY_STORAGE.stores.metadata, COMFY_STORAGE.keys.settings, settings);
  }

  async listWorkflows(): Promise<ComfyWorkflowPreset[]> {
    return (await readAll<ComfyWorkflowPreset>(COMFY_STORAGE.stores.workflows)).sort((left, right) => left.order - right.order || left.createdAt - right.createdAt);
  }

  async getWorkflow(id: string): Promise<ComfyWorkflowPreset | undefined> {
    return readValue(COMFY_STORAGE.stores.workflows, COMFY_STORAGE.keys.workflow(id));
  }

  async saveWorkflow(preset: ComfyWorkflowPreset): Promise<void> {
    await writeValue(COMFY_STORAGE.stores.workflows, COMFY_STORAGE.keys.workflow(preset.id), preset);
  }

  async deleteWorkflow(id: string): Promise<void> {
    const workflows = await this.listWorkflows();
    const target = workflows.find((workflow) => workflow.id === id);
    if (!target) return;
    if (target.active && workflows.length > 1) throw new ComfyStorageError('Activate another workflow before deleting the active workflow');
    await deleteValue(COMFY_STORAGE.stores.workflows, COMFY_STORAGE.keys.workflow(id));
  }

  async setActiveWorkflow(id: string): Promise<void> {
    const workflows = await this.listWorkflows();
    if (!workflows.some((workflow) => workflow.id === id)) throw new ComfyStorageError('Workflow not found');
    await Promise.all(workflows.map((workflow) => this.saveWorkflow({ ...workflow, active: workflow.id === id, updatedAt: Date.now() })));
  }

  async reorderWorkflow(id: string, direction: 'up' | 'down'): Promise<void> {
    const workflows = await this.listWorkflows();
    const index = workflows.findIndex((workflow) => workflow.id === id);
    const target = index + (direction === 'up' ? -1 : 1);
    if (index < 0 || target < 0 || target >= workflows.length) return;
    [workflows[index], workflows[target]] = [workflows[target], workflows[index]];
    await Promise.all(workflows.map((workflow, order) => this.saveWorkflow({ ...workflow, order, updatedAt: Date.now() })));
  }

  async listTasks(): Promise<ComfyTaskSnapshot[]> {
    return (await readAll<ComfyTaskSnapshot>(COMFY_STORAGE.stores.tasks)).sort((left, right) => left.createdAt - right.createdAt);
  }

  async getTask(id: string): Promise<ComfyTaskSnapshot | undefined> {
    return readValue(COMFY_STORAGE.stores.tasks, COMFY_STORAGE.keys.task(id));
  }

  async saveTask(task: ComfyTaskSnapshot): Promise<void> {
    await writeValue(COMFY_STORAGE.stores.tasks, COMFY_STORAGE.keys.task(task.id), task);
  }

  async deleteTask(id: string): Promise<void> {
    await deleteValue(COMFY_STORAGE.stores.tasks, COMFY_STORAGE.keys.task(id));
    const blobs = await this.listBlobRecords('input');
    await Promise.all(blobs.filter((record) => record.leaseTaskIds.includes(id)).map((record) => this.releaseBlobLease(record.key, id)));
  }

  async putInputBlob(blob: Blob, name: string, mediaType: string, limitBytes?: number): Promise<ComfyBlobRecord> {
    const key = crypto.randomUUID();
    const record: ComfyBlobRecord = { key, blob, name, mediaType, size: blob.size, createdAt: Date.now(), lastAccessedAt: Date.now(), leaseTaskIds: [], category: 'input' };
    await this.makeSpace(blob.size, limitBytes ?? (await this.getSettings()).storageLimitBytes);
    await writeValue(COMFY_STORAGE.stores.inputBlobs, COMFY_STORAGE.keys.inputBlob(key), record);
    return record;
  }

  async putOutputBlob(blob: Blob, name: string, mediaType: string, taskStatus: ComfyBlobRecord['taskStatus'], limitBytes?: number): Promise<ComfyBlobRecord> {
    const key = crypto.randomUUID();
    const record: ComfyBlobRecord = { key, blob, name, mediaType, size: blob.size, createdAt: Date.now(), lastAccessedAt: Date.now(), leaseTaskIds: [], category: 'output', taskStatus };
    await this.makeSpace(blob.size, limitBytes ?? (await this.getSettings()).storageLimitBytes);
    await writeValue(COMFY_STORAGE.stores.outputBlobs, COMFY_STORAGE.keys.outputBlob(key), record);
    return record;
  }

  async getBlob(key: string, category: 'input' | 'output'): Promise<ComfyBlobRecord | undefined> {
    const store = category === 'input' ? COMFY_STORAGE.stores.inputBlobs : COMFY_STORAGE.stores.outputBlobs;
    const storageKey = category === 'input' ? COMFY_STORAGE.keys.inputBlob(key) : COMFY_STORAGE.keys.outputBlob(key);
    const record = await readValue<ComfyBlobRecord>(store, storageKey);
    if (record) await writeValue(store, storageKey, { ...record, lastAccessedAt: Date.now() });
    return record;
  }

  async leaseBlob(key: string, taskId: string): Promise<void> {
    const record = await this.getBlob(key, 'input');
    if (!record) throw new ComfyStorageError('Input file is no longer available');
    if (!record.leaseTaskIds.includes(taskId)) await writeValue(COMFY_STORAGE.stores.inputBlobs, COMFY_STORAGE.keys.inputBlob(key), { ...record, leaseTaskIds: [...record.leaseTaskIds, taskId] });
  }

  async releaseBlobLease(key: string, taskId: string): Promise<void> {
    const record = await this.getBlob(key, 'input');
    if (record) await writeValue(COMFY_STORAGE.stores.inputBlobs, COMFY_STORAGE.keys.inputBlob(key), { ...record, leaseTaskIds: record.leaseTaskIds.filter((id) => id !== taskId) });
  }

  async listHistory(): Promise<ComfyHistoryRecord[]> {
    return (await readAll<ComfyHistoryRecord>(COMFY_STORAGE.stores.history)).sort((left, right) => right.completedAt - left.completedAt);
  }

  async saveHistory(record: ComfyHistoryRecord, limit: number): Promise<void> {
    await writeValue(COMFY_STORAGE.stores.history, COMFY_STORAGE.keys.history(record.id), record);
    const overflow = (await this.listHistory()).slice(Math.max(1, limit));
    await Promise.all(overflow.map((item) => this.deleteHistory(item.id)));
  }

  async deleteHistory(id: string): Promise<void> {
    const record = (await this.listHistory()).find((item) => item.id === id);
    await deleteValue(COMFY_STORAGE.stores.history, COMFY_STORAGE.keys.history(id));
    await Promise.all((record?.outputs ?? []).flatMap((output) => output.blobKey ? [deleteValue(COMFY_STORAGE.stores.outputBlobs, COMFY_STORAGE.keys.outputBlob(output.blobKey))] : []));
  }

  async clearHistory(): Promise<void> {
    await Promise.all((await this.listHistory()).map((record) => this.deleteHistory(record.id)));
  }

  async storageUsage(): Promise<number> {
    const blobs = [...await this.listBlobRecords('input'), ...await this.listBlobRecords('output')];
    return blobs.reduce((total, record) => total + record.size, 0);
  }

  private async listBlobRecords(category: 'input' | 'output'): Promise<ComfyBlobRecord[]> {
    return readAll(category === 'input' ? COMFY_STORAGE.stores.inputBlobs : COMFY_STORAGE.stores.outputBlobs);
  }

  private async makeSpace(requiredBytes: number, limitBytes: number): Promise<void> {
    if (requiredBytes > limitBytes) throw new ComfyStorageError('File exceeds the configured ComfyUI storage limit');
    let usage = await this.storageUsage();
    if (usage + requiredBytes <= limitBytes) return;
    const inputs = (await this.listBlobRecords('input')).filter((record) => record.leaseTaskIds.length === 0);
    const outputs = await this.listBlobRecords('output');
    const candidates = [...outputs, ...inputs.filter((record) => record.taskStatus === 'completed'), ...inputs.filter((record) => record.taskStatus !== 'completed')]
      .sort((left, right) => left.lastAccessedAt - right.lastAccessedAt);
    for (const record of candidates) {
      const store = record.category === 'input' ? COMFY_STORAGE.stores.inputBlobs : COMFY_STORAGE.stores.outputBlobs;
      const key = record.category === 'input' ? COMFY_STORAGE.keys.inputBlob(record.key) : COMFY_STORAGE.keys.outputBlob(record.key);
      await deleteValue(store, key);
      usage -= record.size;
      if (usage + requiredBytes <= limitBytes) return;
    }
    throw new ComfyStorageError('ComfyUI storage is full; active task inputs are protected');
  }
}

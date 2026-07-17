import { actionMessages } from './en-actions';
import { postMessages } from './en-posts';
import { shellMessages } from './en-shell';

export const en = {
  actions: {
    retry: 'Try again',
    reload: 'Reload viewer',
    dismiss: 'Dismiss notification',
  },
  feedback: {
    recovery: 'VIEWER / RECOVERY',
    index: 'INDEX',
    interrupted: 'INTERRUPTED',
    syncing: 'SYNCING',
    ready: 'READY',
  },
  states: {
    loadingTitle: 'Reading the index',
    loadingBody: (source: string) => `Fetching the latest ${source} posts...`,
    errorTitle: (source: string) => `${source} could not be reached`,
    emptyTitle: 'No posts match this search',
    emptyBody: 'Remove a filter or try a broader tag.',
    previewsHiddenTitle: 'All matching previews are hidden',
    previewsHiddenBody: 'Show unavailable previews or adjust the current filters.',
    end: 'End of results',
    loadingMore: 'Loading more',
    crashedTitle: 'The viewer stopped unexpectedly',
    crashedBody: 'Your settings are safe. Reload the workspace to continue browsing.',
  },
  toast: {
    searchFailed: 'Could not refresh posts',
    restored: 'Connection restored',
    restoredBody: 'The latest posts are ready.',
    rateLimited: 'Request limit reached',
    rateLimitedBody: 'The source is busy. Wait a moment, then try again.',
    networkBody: 'Check your connection or source availability.',
    downloadReady: actionMessages.download.started,
    downloadFailed: actionMessages.download.failed,
  },
  comfy: {
    name: 'ComfyUI', workbench: 'ComfyUI Workbench', checking: 'Checking', connected: 'Connected', waiting: 'Waiting for service', loading: 'Loading ComfyUI state…',
    queue: 'Queue', workflows: 'Workflows', history: 'History', localMedia: 'Local media', dropFiles: 'Drop files or folders here', files: 'Files', folder: 'Folder', import: 'Import', active: 'Active', preset: 'Preset',
    importEmpty: 'Import a ComfyUI API JSON workflow to begin.', workflowOptions: 'Workflow options', saveOptions: 'Save options', serialExecution: 'Serial execution', activeTasks: (count: number) => `${count} active`, queueEmpty: 'Queued work will appear here.',
    localRecords: 'Local records', clear: 'Clear', historyEmpty: 'Completed outputs and text will appear here.', send: 'Send to ComfyUI', sendSelection: 'Send selection to ComfyUI', sendGroup: 'Send group to ComfyUI',
    noWorkflow: 'No active ComfyUI workflow', noWorkflowBody: 'Open the ComfyUI workbench and import or activate an API workflow.', sent: 'Sent to ComfyUI', tasksAdded: (count: number) => `${count} task${count === 1 ? '' : 's'} added to the queue.`, confirmBatch: (count: number) => `Send ${count} items to ComfyUI as individual tasks?`,
    settingsDescription: 'Local workflow execution, task history, and media cache. Only 127.0.0.1 is accepted.', serverAddress: 'Server address', historyRecords: 'History records', storageLimit: 'Storage limit (MB)', replaceReverse: 'Replace REVERSE text with formatted image tags', cacheOutputs: 'Cache output images locally', saveSettings: 'Save ComfyUI settings', saved: 'Saved',
  },
  shell: shellMessages,
  posts: postMessages,
  domainActions: actionMessages,
} as const;

type WidenLocale<T> = T extends (...args: infer Args) => string
  ? (...args: Args) => string
  : T extends string
    ? string
    : T extends object
      ? { readonly [Key in keyof T]: WidenLocale<T[Key]> }
      : T;

export type LocaleMessages = WidenLocale<typeof en>;

export const messages = en;
export { actionMessages, postMessages, shellMessages };

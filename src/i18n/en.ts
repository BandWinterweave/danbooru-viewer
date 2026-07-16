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
  shell: shellMessages,
  posts: postMessages,
  domainActions: actionMessages,
} as const;

export const messages = en;
export { actionMessages, postMessages, shellMessages };

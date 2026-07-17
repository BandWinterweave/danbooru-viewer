import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPanel } from '../../src/components/settings/SettingsPanel';
import { testSourceAccess } from '../../src/services/source-credential-test';
import { useSettingsStore } from '../../src/stores/settings-store';

vi.mock('../../src/services/source-credential-test', () => ({ testSourceAccess: vi.fn() }));
const testAccess = vi.mocked(testSourceAccess);

describe('settings source access test', () => {
  beforeEach(() => {
    testAccess.mockReset();
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    useSettingsStore.setState({ activeSource: 'danbooru', language: 'en', credentials: {}, credentialRevisions: {} });
  });

  it('tests unsaved form values and presents progress and the sanitized result', async () => {
    let finish!: (value: { code: 'authentication_failed' }) => void;
    testAccess.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    render(<SettingsPanel />);
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'current-user' } });
    fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'current-key' } });
    fireEvent.click(screen.getByRole('button', { name: 'Test access' }));

    expect(testAccess).toHaveBeenCalledWith('danbooru', { username: 'current-user', apiKey: 'current-key' });
    expect(screen.getByRole('button', { name: 'Testing access' })).toBeDisabled();
    expect(useSettingsStore.getState().credentials.danbooru).toBeUndefined();

    finish({ code: 'authentication_failed' });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Authentication failed'));
    expect(screen.queryByText(/current-user|current-key/)).not.toBeInTheDocument();
  });

  it('clears a previous result when a form value changes', async () => {
    testAccess.mockResolvedValue({ code: 'source_reachable' });
    render(<SettingsPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Test access' }));
    await screen.findByText('The source is reachable and the supplied credentials are valid.');
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'changed' } });
    expect(screen.queryByText('The source is reachable and the supplied credentials are valid.')).not.toBeInTheDocument();
  });
});

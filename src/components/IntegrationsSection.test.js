// Revoking a key used to wait on the server before anything changed, so the
// key looked live for a second and the revoke read as not working.

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ session: { access_token: 't' } }) }));
jest.mock('../contexts/ConfirmContext', () => ({ useConfirm: () => async () => true }));
jest.mock('../lib/supabase', () => ({ supabase: null }));

const { IntegrationsSection } = require('./SettingsPanel');

const KEY = { id: 'k1', name: 'HubSpot', key_prefix: 'trn_abcd1234', created_at: '2026-10-12', revoked_at: null };

function setup(deleteResponse) {
  let resolveDelete;
  global.fetch = jest.fn((url, opts) => {
    if (opts?.method === 'DELETE') return new Promise((r) => { resolveDelete = () => r(deleteResponse); });
    if (String(url).includes('resource=keys')) return Promise.resolve({ json: async () => ({ keys: [KEY] }) });
    return Promise.resolve({ json: async () => ({ webhooks: [] }) });
  });
  const addToast = jest.fn();
  render(<IntegrationsSection addToast={addToast} />);
  return { addToast, finishDelete: () => act(async () => { resolveDelete(); }) };
}

test('a revoked key shows as revoked on the click, before the server answers', async () => {
  const { addToast, finishDelete } = setup({ ok: true });
  fireEvent.click(await screen.findByText('Revoke'));
  expect(await screen.findByText('Revoked')).toBeInTheDocument();
  expect(addToast).not.toHaveBeenCalled();
  await finishDelete();
  expect(addToast).toHaveBeenCalledWith('Key revoked. It no longer works.', 'success');
});

test('a failed revoke puts the key back and says it still works', async () => {
  const { addToast, finishDelete } = setup({ ok: false });
  fireEvent.click(await screen.findByText('Revoke'));
  expect(await screen.findByText('Revoked')).toBeInTheDocument();
  await finishDelete();
  await waitFor(() => expect(screen.getByText('Revoke')).toBeInTheDocument());
  expect(addToast).toHaveBeenCalledWith('Could not revoke the key. It still works. Try again.', 'error');
});

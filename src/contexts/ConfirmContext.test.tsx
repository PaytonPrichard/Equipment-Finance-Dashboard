import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ConfirmProvider, useChoice, useConfirm } from './ConfirmContext';

type Dialogs = { choose: ReturnType<typeof useChoice>; confirm: ReturnType<typeof useConfirm> };

function setup(): Dialogs {
  const captured = {} as Dialogs;
  function Probe() {
    captured.choose = useChoice();
    captured.confirm = useConfirm();
    return null;
  }
  render(
    <ConfirmProvider>
      <Probe />
    </ConfirmProvider>,
  );
  return captured;
}

const options = [
  { value: 'keep' as const, label: 'Keep my entries' },
  { value: 'new' as const, label: 'Start a new deal', primary: true },
];

test('a choice resolves the value of the button clicked', async () => {
  const { choose } = setup();
  let pending!: Promise<string | null>;
  act(() => { pending = choose({ title: 'The form holds Midwest', options }); });
  fireEvent.click(screen.getByText('Keep my entries'));
  await expect(pending).resolves.toBe('keep');
});

test('Escape resolves null, so the caller can abort', async () => {
  const { choose } = setup();
  let pending!: Promise<string | null>;
  act(() => { pending = choose({ title: 'The form holds Midwest', options }); });
  fireEvent.keyDown(window, { key: 'Escape' });
  await expect(pending).resolves.toBeNull();
});

test('Enter picks the primary option', async () => {
  const { choose } = setup();
  let pending!: Promise<string | null>;
  act(() => { pending = choose({ title: 'The form holds Midwest', options }); });
  fireEvent.keyDown(window, { key: 'Enter' });
  await expect(pending).resolves.toBe('new');
});

test('confirm still resolves true and false', async () => {
  const { confirm } = setup();
  let yes!: Promise<boolean>;
  act(() => { yes = confirm({ title: 'Clear all fields?', confirmLabel: 'Clear' }); });
  fireEvent.click(screen.getByText('Clear'));
  await expect(yes).resolves.toBe(true);

  let no!: Promise<boolean>;
  act(() => { no = confirm({ title: 'Clear all fields?', confirmLabel: 'Clear' }); });
  fireEvent.click(screen.getByText('Cancel'));
  await expect(no).resolves.toBe(false);
});

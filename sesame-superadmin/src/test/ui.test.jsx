import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmProvider, Modal, TextField, useConfirm } from '../components/ui';

describe('UI kit', () => {
  test('modal is an accessible dialog that closes on Escape and focuses its first field', async () => {
    const onClose = vi.fn();
    render(<Modal title="Titre" onClose={onClose}><TextField label="Nom" /></Modal>);
    expect(screen.getByRole('dialog', { name: 'Titre' })).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByLabelText('Nom')).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  test('fields always have a visible, associated label', () => {
    render(<TextField label="Identifiant" error="Obligatoire" />);
    const input = screen.getByLabelText('Identifiant');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Obligatoire');
  });

  test('confirm dialog resolves with the user choice', async () => {
    let answer;
    function Trigger() {
      const confirm = useConfirm();
      return <button type="button" onClick={async () => { answer = await confirm({ title: 'Supprimer ?', message: 'Sûr ?', confirmLabel: 'Supprimer' }); }}>go</button>;
    }
    render(<ConfirmProvider><Trigger /></ConfirmProvider>);
    await userEvent.click(screen.getByText('go'));
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(answer).toBe(true);
  });
});

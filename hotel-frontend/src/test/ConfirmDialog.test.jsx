import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmDialog from '../components/ConfirmDialog';

function setup(props = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const user = userEvent.setup();
  const utils = render(
    <ConfirmDialog
      isOpen
      title="Anular comprobante"
      message="Esta acción no se puede deshacer."
      confirmLabel="Anular"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />,
  );
  return { ...utils, user, onConfirm, onCancel };
}

describe('ConfirmDialog', () => {
  it('no renderiza nada cuando está cerrado', () => {
    const { container } = render(<ConfirmDialog isOpen={false} onConfirm={() => {}} onCancel={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('es un diálogo modal accesible con título y descripción', () => {
    setup();
    const dialog = screen.getByRole('dialog', { name: 'Anular comprobante' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('Esta acción no se puede deshacer.');
  });

  it('enfoca el botón Cancelar al abrir', async () => {
    setup();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus());
  });

  it('Escape llama a onCancel', async () => {
    const { user, onCancel } = setup();
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Escape no cierra mientras está procesando', async () => {
    const { user, onCancel } = setup({ busy: true });
    await user.keyboard('{Escape}');
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Procesando...' })).toBeDisabled();
  });

  it('confirmar llama a onConfirm', async () => {
    const { user, onConfirm } = setup();
    await user.click(screen.getByRole('button', { name: 'Anular' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('con requireReason enfoca el motivo y lo exige antes de confirmar', async () => {
    const { user, onConfirm } = setup({ requireReason: true, reasonLabel: 'Motivo de anulación' });
    const textarea = screen.getByLabelText('Motivo de anulación *');
    await waitFor(() => expect(textarea).toHaveFocus());

    await user.click(screen.getByRole('button', { name: 'Anular' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText('Este campo es obligatorio.')).toBeInTheDocument();
    expect(textarea).toHaveAttribute('aria-invalid', 'true');

    await user.type(textarea, '  Datos erróneos  ');
    await user.click(screen.getByRole('button', { name: 'Anular' }));
    expect(onConfirm).toHaveBeenCalledWith('Datos erróneos');
  });
});

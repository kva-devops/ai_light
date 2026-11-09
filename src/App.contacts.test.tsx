// @vitest-environment jsdom

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
});

describe('контакты консультанта', () => {
  it('открывает окно и показывает демонстрационные контакты', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Связаться с консультантом' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('+7 (495) 123-45-67')).toBeTruthy();
    expect(within(dialog).getByText('Москва, Световой проспект, 18')).toBeTruthy();
  });

  it('закрывается по Escape и возвращает фокус на кнопку', async () => {
    const user = userEvent.setup();
    render(<App />);
    const contactButton = screen.getByRole('button', { name: 'Связаться с консультантом' });

    await user.click(contactButton);
    expect(screen.getByRole('button', { name: 'Закрыть окно контактов' })).toBe(document.activeElement);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(contactButton).toBe(document.activeElement);
  });

  it('закрывается при клике по затемнённому фону', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Связаться с консультантом' }));
    const backdrop = screen.getByRole('dialog').parentElement;
    expect(backdrop).not.toBeNull();

    fireEvent.mouseDown(backdrop!);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

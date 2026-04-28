import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MultiSelectDropdown } from '@/components/ui/MultiSelectDropdown';
import { buildFkkoSearchIndex, matchesFkkoSearch } from '@/utils/fkko';

function fkkoFilter(option: string, query: string, label: string): boolean {
  return matchesFkkoSearch(buildFkkoSearchIndex(option, label), query);
}

function Harness({
  onChange,
  loading = false,
  initialInput = '',
}: {
  onChange: (next: string[]) => void;
  loading?: boolean;
  initialInput?: string;
}): JSX.Element {
  const [value, setValue] = useState(initialInput);
  return (
    <MultiSelectDropdown
      options={['47110101521', '36122203393']}
      selected={[]}
      onChange={onChange}
      inputValue={value}
      onInputValueChange={setValue}
      filterOption={({ option, query, label }) => fkkoFilter(option, query, label)}
      isLoadingOptions={loading}
      loadingOptionsText="Загружаем названия..."
      noOptionsText="Совпадений не найдено"
      formatOptionLabel={(code) =>
        code === '47110101521'
          ? '4 71 101 01 52 1 — лампы ртутные'
          : '3 61 222 03 39 3 — шлам шлифовальный'
      }
    />
  );
}

describe('MultiSelectDropdown input mode', () => {
  it('filters options by title text and selects with explicit click', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<Harness onChange={handleChange} />);

    await user.click(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), 'шлам');

    expect(screen.getByRole('option', { name: /3 61 222 03 39 3/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /4 71 101 01 52 1/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('option', { name: /3 61 222 03 39 3/i }));
    expect(handleChange).toHaveBeenCalledWith(['36122203393']);
  });

  it('shows loading text while titles are loading', async () => {
    const user = userEvent.setup();
    render(<Harness onChange={() => {}} loading initialInput="редкий запрос" />);

    await user.click(screen.getByRole('textbox'));
    expect(screen.getByText('Загружаем названия...')).toBeInTheDocument();
  });

  it('shows no matches text when loading is finished', async () => {
    const user = userEvent.setup();
    render(<Harness onChange={() => {}} initialInput="нет такого" />);

    await user.click(screen.getByRole('textbox'));
    expect(screen.getByText('Совпадений не найдено')).toBeInTheDocument();
  });

  it('keeps selected options visible while search text does not match them', async () => {
    const user = userEvent.setup();
    function HarnessWithSelection(): JSX.Element {
      const [value, setValue] = useState('шлам');
      const [selected, setSelected] = useState<string[]>(['36122203393']);
      return (
        <MultiSelectDropdown
          options={['47110101521', '36122203393']}
          selected={selected}
          onChange={setSelected}
          inputValue={value}
          onInputValueChange={setValue}
          filterOption={({ option, query, label }) => fkkoFilter(option, query, label)}
          formatOptionLabel={(code) =>
            code === '47110101521'
              ? '4 71 101 01 52 1 — лампы ртутные'
              : '3 61 222 03 39 3 — шлам шлифовальный'
          }
        />
      );
    }
    render(<HarnessWithSelection />);

    await user.click(screen.getByRole('textbox'));
    expect(screen.getByRole('option', { name: /3 61 222 03 39 3/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /4 71 101 01 52 1/i })).not.toBeInTheDocument();
  });
});


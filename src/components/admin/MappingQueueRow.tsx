'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { assignMappingQueueItem, type MappingQueueItem } from '@/lib/api/admin';
import { LoftlyAPIError } from '@/lib/api/client';
import { Input } from '@/components/ui/input';

interface Props {
  item: MappingQueueItem;
  accessToken: string;
  /**
   * Checkbox state controlled by the parent table. When omitted (e.g. future
   * standalone renders) the row falls back to its original "no-checkbox" layout.
   */
  checked?: boolean;
  onToggle?: () => void;
}

export function MappingQueueRow({
  item,
  accessToken,
  checked,
  onToggle,
}: Props) {
  const router = useRouter();
  const [cardIds, setCardIds] = React.useState(
    item.suggested_card_ids.join(', '),
  );
  const [status, setStatus] = React.useState<'idle' | 'saving' | 'done' | 'error'>(
    'idle',
  );
  const [error, setError] = React.useState<string | null>(null);

  async function handleAssign() {
    const parsed = cardIds
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (parsed.length === 0) {
      setError('Select at least one card ID');
      setStatus('error');
      return;
    }
    setStatus('saving');
    setError(null);
    try {
      await assignMappingQueueItem(item.promo_id, parsed, accessToken);
      setStatus('done');
      router.refresh();
    } catch (err) {
      setStatus('error');
      setError(err instanceof LoftlyAPIError ? err.message_en : (err as Error).message);
    }
  }

  const showCheckbox = typeof checked === 'boolean' && typeof onToggle === 'function';

  return (
    <tr data-testid={`mapping-queue-row-${item.promo_id}`}>
      {showCheckbox && (
        <td className="w-10 px-4 py-2">
          <input
            type="checkbox"
            aria-label={`Select ${item.title_th}`}
            data-testid={`mapping-queue-row-checkbox-${item.promo_id}`}
            checked={checked}
            onChange={onToggle}
          />
        </td>
      )}
      <td className="px-4 py-2 font-medium">{item.title_th}</td>
      <td className="px-4 py-2 text-slate-600">{item.bank_slug}</td>
      <td className="px-4 py-2 text-xs text-slate-600">
        {item.card_types_raw.join(', ') || '—'}
      </td>
      <td className="px-4 py-2">
        <Input
          value={cardIds}
          onChange={(e) => setCardIds(e.target.value)}
          placeholder="card-id-1, card-id-2"
          className="w-64"
        />
        {error && (
          <p className="mt-1 text-xs text-red-700" role="alert">
            {error}
          </p>
        )}
      </td>
      <td className="px-4 py-2 text-right">
        <button
          type="button"
          onClick={handleAssign}
          disabled={status === 'saving' || status === 'done'}
          className="rounded-md bg-loftly-baht px-3 py-1.5 text-xs font-medium text-white hover:bg-loftly-baht/90 disabled:opacity-50"
        >
          {status === 'saving'
            ? 'Assigning…'
            : status === 'done'
              ? 'Mapped'
              : 'Assign'}
        </button>
      </td>
    </tr>
  );
}

import { apiFetch } from './client';
import type {
  Card,
  CardList,
  ConsentState,
  ConsentUpdate,
  Valuation,
  ValuationList,
} from './types';

export interface ListCardsParams {
  issuer?: string;
  network?: string;
  tier?: string;
  earn_currency?: string;
  max_annual_fee?: number;
  cursor?: string;
  limit?: number;
}

export function listCards(
  params: ListCardsParams = {},
  opts: { revalidate?: number | false } = {},
): Promise<CardList> {
  return apiFetch<CardList>('/cards', {
    method: 'GET',
    query: params as Record<string, string | number | undefined>,
    accessToken: null,
    revalidate: opts.revalidate ?? 300,
  });
}

export function getCard(
  slug: string,
  opts: { revalidate?: number | false } = {},
): Promise<Card> {
  return apiFetch<Card>(`/cards/${encodeURIComponent(slug)}`, {
    method: 'GET',
    accessToken: null,
    revalidate: opts.revalidate ?? 300,
  });
}

export function listValuations(
  opts: { revalidate?: number | false } = {},
): Promise<ValuationList> {
  return apiFetch<ValuationList>('/valuations', {
    method: 'GET',
    accessToken: null,
    revalidate: opts.revalidate ?? 900,
  });
}

export function getValuation(
  currencyCode: string,
  opts: { revalidate?: number | false } = {},
): Promise<Valuation> {
  return apiFetch<Valuation>(
    `/valuations/${encodeURIComponent(currencyCode)}`,
    { method: 'GET', accessToken: null, revalidate: opts.revalidate ?? 900 },
  );
}

export function getConsent(accessToken: string | null): Promise<ConsentState> {
  return apiFetch<ConsentState>('/consent', {
    method: 'GET',
    accessToken,
    revalidate: false,
  });
}

export function updateConsent(
  update: ConsentUpdate,
  accessToken: string | null,
): Promise<ConsentState> {
  return apiFetch<ConsentState>('/consent', {
    method: 'POST',
    body: update,
    accessToken,
    revalidate: false,
  });
}

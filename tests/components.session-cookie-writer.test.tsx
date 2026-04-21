import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SessionCookieWriter } from '@/app/selector/results/[session_id]/SessionCookieWriter';
import {
  COOKIE_NAME,
  readSelectorSessionCookie,
} from '@/lib/selector-session-cookie';

function wipeAllCookies(): void {
  for (const pair of document.cookie.split(';')) {
    const eq = pair.indexOf('=');
    const name = (eq >= 0 ? pair.slice(0, eq) : pair).trim();
    if (name) {
      document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
    }
  }
}

describe('SessionCookieWriter', () => {
  beforeEach(wipeAllCookies);
  afterEach(wipeAllCookies);

  it('writes the recognition cookie on mount and renders no UI', () => {
    const { container } = render(
      <SessionCookieWriter sessionId="sess_mount_ok" />,
    );

    // No DOM output
    expect(container.firstChild).toBeNull();

    // Cookie was written with correct session_id
    expect(document.cookie).toContain(`${COOKIE_NAME}=`);
    const parsed = readSelectorSessionCookie();
    expect(parsed).not.toBeNull();
    expect(parsed!.session_id).toBe('sess_mount_ok');
  });
});

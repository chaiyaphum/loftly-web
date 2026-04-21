'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

/**
 * Top-most error boundary — catches errors thrown while the root layout
 * itself is rendering. Next.js mounts this BEFORE `layout.tsx`, so we must
 * ship our own `<html>` + `<body>` and cannot rely on:
 *   - Tailwind utility classes (the stylesheet is imported by layout.tsx)
 *   - next-intl (no NextIntlClientProvider in scope)
 *   - Custom fonts (layout wires the font variables)
 *
 * Copy is inlined (Thai-primary) to match BRAND.md §4. Style is inline to
 * guarantee visual sanity even if the CSS bundle failed to load.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      Sentry.captureException(error);
    }
  }, [error]);

  const supportEmail =
    process.env.NEXT_PUBLIC_FOUNDER_NOTIFY_EMAIL || 'support@loftly.co.th';

  return (
    <html lang="th">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          color: '#0f172a',
          background: '#ffffff',
        }}
      >
        <main
          id="main-content"
          style={{
            maxWidth: '560px',
            width: '100%',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              margin: 0,
              marginBottom: '12px',
              fontSize: '14px',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#64748b',
              fontWeight: 500,
            }}
          >
            500
          </p>
          <h1
            style={{
              margin: 0,
              fontSize: '32px',
              fontWeight: 600,
              lineHeight: 1.2,
            }}
          >
            มีอะไรผิดพลาด
          </h1>
          <p
            style={{
              marginTop: '12px',
              marginBottom: 0,
              fontSize: '16px',
              color: '#475569',
            }}
          >
            ลองโหลดหน้านี้ใหม่ หากยังไม่ได้ กรุณาติดต่อเรา
          </p>

          {error.digest ? (
            <p
              data-testid="error-digest"
              style={{
                marginTop: '16px',
                marginBottom: 0,
                fontFamily:
                  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
                fontSize: '12px',
                color: '#64748b',
              }}
            >
              รหัสข้อผิดพลาด: {error.digest}
            </p>
          ) : null}

          <div
            style={{
              marginTop: '32px',
              display: 'flex',
              gap: '12px',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={() => reset()}
              aria-label="ลองใหม่"
              style={{
                appearance: 'none',
                border: 'none',
                padding: '12px 24px',
                fontSize: '16px',
                fontWeight: 500,
                borderRadius: '6px',
                background: '#1d9e75',
                color: '#ffffff',
                cursor: 'pointer',
              }}
            >
              ลองใหม่
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages --
                global-error renders above the root layout; next/link's
                router context is not available here. Native <a> is correct. */}
            <a
              href="/"
              aria-label="กลับหน้าหลัก"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '12px 24px',
                fontSize: '16px',
                fontWeight: 500,
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                color: '#0f172a',
                textDecoration: 'none',
                background: 'transparent',
              }}
            >
              กลับหน้าหลัก
            </a>
          </div>

          <p
            style={{
              marginTop: '32px',
              marginBottom: 0,
              fontSize: '12px',
              color: '#64748b',
            }}
          >
            ติดต่อทีมงานที่{' '}
            <a
              href={`mailto:${supportEmail}`}
              style={{
                color: '#1d9e75',
                textDecoration: 'underline',
                textUnderlineOffset: '2px',
              }}
            >
              {supportEmail}
            </a>{' '}
            — แนบรหัสข้อผิดพลาดด้านบนถ้ามี
          </p>
        </main>
      </body>
    </html>
  );
}

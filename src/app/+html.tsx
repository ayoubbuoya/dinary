import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/** Web-only HTML shell. Dinary is a private app, so search engines are asked not to index it. */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="robots" content="noindex, nofollow" />
        <meta name="theme-color" content="#F8F6F0" />
        <title>Dinary</title>
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: 'body { background-color: #F8F6F0; }' }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

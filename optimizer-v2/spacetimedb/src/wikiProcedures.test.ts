import { describe, expect, it } from 'vitest';
import {
  assertWikiResponseSize,
  buildWikiApiUrl,
  parseMediaWikiRevisionResponse,
} from './wikiRevision';

describe('buildWikiApiUrl', () => {
  it('builds only the canonical encoded MediaWiki revision request', () => {
    expect(buildWikiApiUrl('Upper Headwear')).toBe(
      'https://swordbloxonlinerebirth.fandom.com/api.php?action=query&prop=revisions&rvprop=ids%7Ctimestamp%7Ccontent&rvslots=main&format=json&formatversion=2&titles=Upper%20Headwear',
    );
  });

  it('rejects pages outside the canonical allowlist', () => {
    expect(() => buildWikiApiUrl('Admin')).toThrow('Wiki page is not allowlisted');
  });

  it('allows the canonical Fists item page used by the verified melee starter', () => {
    expect(buildWikiApiUrl('Fists')).toContain('titles=Fists');
  });
});

describe('parseMediaWikiRevisionResponse', () => {
  it('extracts exactly one revision and main-slot body', () => {
    expect(
      parseMediaWikiRevisionResponse(
        JSON.stringify({
          query: {
            pages: [
              {
                title: 'Stats',
                revisions: [
                  {
                    revid: 23125,
                    timestamp: '2025-11-03T13:14:55Z',
                    slots: { main: { content: 'Stats fragment' } },
                  },
                ],
              },
            ],
          },
        }),
        'Stats',
      ),
    ).toEqual({
      pageTitle: 'Stats',
      revisionId: '23125',
      revisionTimestamp: '2025-11-03T13:14:55Z',
      content: 'Stats fragment',
    });
  });

  const malformedResponses = [
    {
      name: 'invalid JSON',
      body: '{"query":',
      error: 'MediaWiki response is not valid JSON',
    },
    {
      name: 'missing query data',
      body: JSON.stringify({ batchcomplete: true }),
      error: 'MediaWiki response is missing query data',
    },
    {
      name: 'zero pages',
      body: JSON.stringify({ query: { pages: [] } }),
      error: 'MediaWiki response must contain exactly one page',
    },
    {
      name: 'multiple pages',
      body: JSON.stringify({ query: { pages: [{}, {}] } }),
      error: 'MediaWiki response must contain exactly one page',
    },
    {
      name: 'a title other than the requested canonical page',
      body: JSON.stringify({
        query: {
          pages: [
            {
              title: 'Admin',
              revisions: [
                {
                  revid: 23125,
                  timestamp: '2025-11-03T13:14:55Z',
                  slots: { main: { content: 'Stats fragment' } },
                },
              ],
            },
          ],
        },
      }),
      error: 'MediaWiki page or revision is ambiguous',
    },
    {
      name: 'zero revisions',
      body: JSON.stringify({
        query: { pages: [{ title: 'Stats', revisions: [] }] },
      }),
      error: 'MediaWiki page or revision is ambiguous',
    },
    {
      name: 'multiple revisions',
      body: JSON.stringify({
        query: {
          pages: [
            {
              title: 'Stats',
              revisions: [
                {
                  revid: 23125,
                  timestamp: '2025-11-03T13:14:55Z',
                  slots: { main: { content: 'Stats fragment' } },
                },
                {
                  revid: 23124,
                  timestamp: '2025-11-02T13:14:55Z',
                  slots: { main: { content: 'Older Stats fragment' } },
                },
              ],
            },
          ],
        },
      }),
      error: 'MediaWiki page or revision is ambiguous',
    },
    {
      name: 'a revision without a main slot',
      body: JSON.stringify({
        query: {
          pages: [
            {
              title: 'Stats',
              revisions: [
                {
                  revid: 23125,
                  timestamp: '2025-11-03T13:14:55Z',
                  slots: {},
                },
              ],
            },
          ],
        },
      }),
      error: 'MediaWiki revision fields are invalid',
    },
    {
      name: 'escaped control characters in revision content',
      body: JSON.stringify({
        query: {
          pages: [
            {
              title: 'Stats',
              revisions: [
                {
                  revid: 23125,
                  timestamp: '2025-11-03T13:14:55Z',
                  slots: { main: { content: 'Stats\u0000fragment' } },
                },
              ],
            },
          ],
        },
      }),
      error: 'MediaWiki revision fields are invalid',
    },
  ] as const;

  it.each(malformedResponses)('rejects $name', ({ body, error }) => {
    expect(() => parseMediaWikiRevisionResponse(body, 'Stats')).toThrow(error);
  });

  it.each([
    { name: 'horizontal tab', whitespace: '\u0009' },
    { name: 'line feed', whitespace: '\u000a' },
    { name: 'carriage return', whitespace: '\u000d' },
  ])('preserves $name in revision content', ({ whitespace }) => {
    const content = `Stats${whitespace}fragment`;
    expect(
      parseMediaWikiRevisionResponse(
        JSON.stringify({
          query: {
            pages: [
              {
                title: 'Stats',
                revisions: [
                  {
                    revid: 23125,
                    timestamp: '2025-11-03T13:14:55Z',
                    slots: { main: { content } },
                  },
                ],
              },
            ],
          },
        }),
        'Stats',
      ).content,
    ).toBe(content);
  });
});

describe('assertWikiResponseSize', () => {
  it('rejects responses larger than 2 MB', () => {
    expect(() => assertWikiResponseSize(2_000_001)).toThrow(
      'MediaWiki response exceeds 2 MB',
    );
  });

  it('accepts responses at the 2 MB boundary', () => {
    expect(() => assertWikiResponseSize(2_000_000)).not.toThrow();
  });
});

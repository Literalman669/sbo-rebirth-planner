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

  it('rejects ambiguous multi-page responses', () => {
    expect(() =>
      parseMediaWikiRevisionResponse(
        JSON.stringify({ query: { pages: [{}, {}] } }),
        'Stats',
      ),
    ).toThrow('MediaWiki response must contain exactly one page');
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

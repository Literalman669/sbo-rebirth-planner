import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fetchAllPagesForCategory,
  requestMediaWiki,
} from './mediawiki-api.mjs';

test('retries one rate limit with the bounded first delay', async () => {
  let calls = 0;
  const waits = [];
  const result = await requestMediaWiki(
    new URLSearchParams({ action: 'query' }),
    {
      fetchImpl: async () => {
        calls += 1;
        return calls === 1
          ? new Response('rate limited', { status: 429 })
          : Response.json({ query: { pages: [] } });
      },
      waitImpl: async (milliseconds) => waits.push(milliseconds),
    },
  );

  assert.deepEqual(result, { query: { pages: [] } });
  assert.equal(calls, 2);
  assert.deepEqual(waits, [250]);
});

test('follows MediaWiki category continuation exactly once per token', async () => {
  const requests = [];
  const pages = await fetchAllPagesForCategory('Category:Weapons', async (params) => {
    requests.push(Object.fromEntries(params));
    return requests.length === 1
      ? {
          continue: { cmcontinue: 'page|next', continue: '-||' },
          query: {
            categorymembers: [{ pageid: 7, ns: 0, title: 'Steel Sword' }],
          },
        }
      : {
          query: {
            categorymembers: [{ pageid: 8, ns: 0, title: 'Iron Sword' }],
          },
        };
  });

  assert.deepEqual(pages, [
    { pageId: 7, pageTitle: 'Steel Sword', categories: ['Category:Weapons'], kind: 'equipment' },
    { pageId: 8, pageTitle: 'Iron Sword', categories: ['Category:Weapons'], kind: 'equipment' },
  ]);
  assert.equal(requests.length, 2);
  assert.equal(requests[1].cmcontinue, 'page|next');
});

test('rejects unsafe category titles before requesting', async () => {
  let called = false;
  await assert.rejects(
    () => fetchAllPagesForCategory('../Weapons', async () => {
      called = true;
      return {};
    }),
    /Unsafe wiki page title/,
  );
  assert.equal(called, false);
});

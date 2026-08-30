const endpoint =
  'https://swordbloxonlinerebirth.fandom.com/api.php';
const retryDelays = [250, 1_000];
const safeTitle = /^[\p{L}\p{N} _:'(),.!&+-]+$/u;

function assertSafeTitle(title) {
  if (
    typeof title !== 'string' ||
    title.length === 0 ||
    !safeTitle.test(title) ||
    title.includes('..') ||
    /[\\/\u0000-\u001f\u007f]/u.test(title)
  ) {
    throw new Error(`Unsafe wiki page title: ${title}`);
  }
}

const defaultWait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function requestMediaWiki(
  input,
  {
    fetchImpl = fetch,
    attempts = 3,
    waitImpl = defaultWait,
  } = {},
) {
  const params = new URLSearchParams(input);
  params.set('format', 'json');
  params.set('formatversion', '2');
  const url = new URL(endpoint);
  url.search = params.toString();

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetchImpl(url, {
      headers: {
        'User-Agent':
          'SBO-Rebirth-Optimizer/2.0 (versioned wiki catalog audit)',
      },
    });
    if (response.ok) {
      const body = await response.json();
      if (!body || typeof body !== 'object') {
        throw new Error('MediaWiki returned an invalid JSON object');
      }
      return body;
    }

    const retryable = response.status === 429 || response.status >= 500;
    const delay = retryDelays[attempt];
    if (!retryable || delay === undefined || attempt + 1 >= attempts) {
      throw new Error(`MediaWiki request failed with HTTP ${response.status}`);
    }
    await waitImpl(delay);
  }

  throw new Error('MediaWiki request exhausted its bounded attempts');
}

function kindForCategory(category) {
  if (/weapon|armor|shield|headwear|equipment/i.test(category)) {
    return 'equipment';
  }
  return 'index';
}

export async function fetchAllPagesForCategory(
  category,
  request = requestMediaWiki,
) {
  assertSafeTitle(category);
  if (!category.startsWith('Category:')) {
    throw new Error(`Wiki category must start with Category: ${category}`);
  }

  const pages = [];
  let continuation;
  do {
    const params = new URLSearchParams({
      action: 'query',
      list: 'categorymembers',
      cmtitle: category,
      cmnamespace: '0',
      cmlimit: 'max',
    });
    if (continuation?.cmcontinue) {
      params.set('cmcontinue', continuation.cmcontinue);
    }
    if (continuation?.continue) {
      params.set('continue', continuation.continue);
    }
    const body = await request(params);
    const members = body?.query?.categorymembers;
    if (!Array.isArray(members)) {
      throw new Error(`MediaWiki omitted category members for ${category}`);
    }
    for (const member of members) {
      if (
        !Number.isInteger(member?.pageid) ||
        typeof member?.title !== 'string'
      ) {
        throw new Error(`MediaWiki returned an invalid member for ${category}`);
      }
      pages.push({
        pageId: member.pageid,
        pageTitle: member.title,
        categories: [category],
        kind: kindForCategory(category),
      });
    }
    continuation = body.continue;
  } while (continuation?.cmcontinue);

  return pages.sort(
    (left, right) =>
      left.pageId - right.pageId ||
      left.pageTitle.localeCompare(right.pageTitle),
  );
}

export async function resolveExplicitPages(
  pageTitles,
  request = requestMediaWiki,
) {
  for (const title of pageTitles) assertSafeTitle(title);
  const params = new URLSearchParams({
    action: 'query',
    prop: 'info',
    titles: pageTitles.join('|'),
    redirects: '1',
  });
  const body = await request(params);
  const pages = body?.query?.pages;
  if (!Array.isArray(pages)) {
    throw new Error('MediaWiki omitted explicit page results');
  }
  return pages.map((page) => {
    if (!Number.isInteger(page?.pageid) || typeof page?.title !== 'string') {
      throw new Error('MediaWiki returned an invalid explicit page');
    }
    return {
      pageId: page.pageid,
      pageTitle: page.title,
      categories: [],
      kind:
        page.title === 'Stats'
          ? 'mechanics'
          : page.title === 'Shops'
            ? 'acquisition'
            : 'index',
    };
  });
}

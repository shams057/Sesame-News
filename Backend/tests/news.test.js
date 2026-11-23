const { app, request, createAdmin, createUser, createCategory, auth } = require('./helpers');

const day = 24 * 3600 * 1000;

async function postNews(token, fields, files = []) {
  let req = request(app).post('/api/v1/news').set(auth(token));
  Object.entries(fields).forEach(([key, value]) => { req = req.field(key, typeof value === 'string' ? value : JSON.stringify(value)); });
  files.forEach(([buffer, options]) => { req = req.attach('files', buffer, options); });
  return req;
}

describe('news & feed', () => {
  test('script-capable uploads are rejected', async () => {
    const { token } = await createAdmin();
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const asSvg = await postNews(token, { titre: 'x', description: 'y' }, [[svg, { filename: 'a.svg', contentType: 'image/svg+xml' }]]);
    expect(asSvg.status).toBe(400);
    const disguised = await postNews(token, { titre: 'x', description: 'y' }, [[svg, { filename: 'a.html', contentType: 'image/png' }]]);
    expect(disguised.status).toBe(400);
  });

  test('documents are stored as documents with a random file name', async () => {
    const { token } = await createAdmin();
    const res = await postNews(token, { titre: 'Planning', description: 'Le planning' }, [[Buffer.from('%PDF-1.4'), { filename: '../../evil.pdf', contentType: 'application/pdf' }]]);
    expect(res.status).toBe(201);
    expect(res.body.media[0].kind).toBe('document');
    expect(res.body.media[0].url).toMatch(/^\/uploads\/[0-9a-f-]{36}\.pdf$/);
    expect(res.body.media[0].originalName).toBe('evil.pdf');
    expect((await request(app).get(res.body.media[0].url)).status).toBe(200);
  });

  test('audience: category news only reach that category; drafts and scheduled news are hidden', async () => {
    const { token } = await createAdmin();
    const info = await createCategory();
    const other = await createCategory();
    const { token: infoStudent } = await createUser({ categorieId: info.id });
    const { token: otherStudent } = await createUser({ categorieId: other.id });

    const targeted = await postNews(token, { titre: 'Info only', description: 'x', audienceAll: 'false', categoryIds: [info.id] });
    expect(targeted.status).toBe(201);
    await postNews(token, { titre: 'Draft', description: 'x', status: 'draft' });
    await postNews(token, { titre: 'Later', description: 'x', publishAt: new Date(Date.now() + day).toISOString() });

    const infoFeed = (await request(app).get('/api/v1/feed?pageSize=50').set(auth(infoStudent))).body.content.map((n) => n.titre);
    const otherFeed = (await request(app).get('/api/v1/feed?pageSize=50').set(auth(otherStudent))).body.content.map((n) => n.titre);
    expect(infoFeed).toContain('Info only');
    expect(otherFeed).not.toContain('Info only');
    expect(infoFeed).not.toContain('Draft');
    expect(infoFeed).not.toContain('Later');
    expect((await request(app).get(`/api/v1/feed/${targeted.body.id}`).set(auth(otherStudent))).status).toBe(404);
  });

  test('the feed is paginated with 10 items by default', async () => {
    const { token } = await createAdmin();
    const { token: student } = await createUser();
    for (let i = 0; i < 12; i += 1) await postNews(token, { titre: `Bulk ${i}`, description: 'x' });
    const res = await request(app).get('/api/v1/feed').set(auth(student));
    expect(res.body.content).toHaveLength(10);
    expect(res.body.totalPages).toBeGreaterThan(1);
  });

  test('events only include upcoming or ongoing ones, sorted by start', async () => {
    const { token } = await createAdmin();
    const { token: student } = await createUser();
    await postNews(token, { titre: 'Past event', description: 'x', eventStart: new Date(Date.now() - 10 * day).toISOString() });
    await postNews(token, { titre: 'Ongoing event', description: 'x', eventStart: new Date(Date.now() - 2 * day).toISOString(), eventEnd: new Date(Date.now() + 2 * day).toISOString() });
    await postNews(token, { titre: 'Future event', description: 'x', eventStart: new Date(Date.now() + 5 * day).toISOString() });
    const titles = (await request(app).get('/api/v1/feed/events').set(auth(student))).body.map((n) => n.titre);
    expect(titles).not.toContain('Past event');
    expect(titles.indexOf('Ongoing event')).toBeLessThan(titles.indexOf('Future event'));
  });

  test('targeting without categories and inverted event dates are refused', async () => {
    const { token } = await createAdmin();
    expect((await postNews(token, { titre: 'x', description: 'y', audienceAll: 'false' })).status).toBe(400);
    expect((await postNews(token, {
      titre: 'x', description: 'y', eventStart: new Date(Date.now() + day).toISOString(), eventEnd: new Date().toISOString(),
    })).status).toBe(400);
  });
});

describe('engagement: expiry, seen, bookmarks, views', () => {
  test('expired news disappear; seen/bookmarked flags and view counts work', async () => {
    const { token } = await createAdmin();
    const { token: student } = await createUser();
    const expired = await postNews(token, { titre: 'Expirée', description: 'x', expiresAt: new Date(Date.now() - 1000).toISOString() });
    expect(expired.status).toBe(201);
    const live = (await postNews(token, { titre: 'Active', description: 'x' })).body;

    const feed = (await request(app).get('/api/v1/feed?pageSize=50').set(auth(student))).body.content;
    expect(feed.map((n) => n.titre)).not.toContain('Expirée');
    expect(feed.find((n) => n.id === live.id)).toMatchObject({ seen: false, bookmarked: false });

    const before = (await request(app).get('/api/v1/feed/unseen-count').set(auth(student))).body.count;
    await request(app).get(`/api/v1/feed/${live.id}`).set(auth(student));
    expect((await request(app).get('/api/v1/feed/unseen-count').set(auth(student))).body.count).toBe(before - 1);

    expect((await request(app).put(`/api/v1/feed/${live.id}/bookmark`).set(auth(student))).status).toBe(204);
    const saved = (await request(app).get('/api/v1/feed?filter=bookmarks').set(auth(student))).body.content;
    expect(saved.map((n) => n.id)).toEqual([live.id]);
    expect(saved[0]).toMatchObject({ seen: true, bookmarked: true });

    const staffList = (await request(app).get('/api/v1/news?q=Active').set(auth(token))).body.content;
    expect(staffList.find((n) => n.id === live.id).viewCount).toBe(1);
    const expiredList = (await request(app).get('/api/v1/news?status=expired').set(auth(token))).body.content;
    expect(expiredList.map((n) => n.titre)).toContain('Expirée');
  });
});

// Configure a (mocked) provider BEFORE the app modules load in this file.
process.env.LLM_MODEL = 'test-model';
process.env.LLM_API_KEY = 'test-key';
process.env.LLM_BASE_URL = 'https://llm.example.test/v1';

const { app, request, createAdmin, createUser, auth } = require('./helpers');

describe('assistant with a configured provider', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  test('sends visible news as context, persists history and returns cited sources', async () => {
    const { token: adminToken } = await createAdmin();
    const { token } = await createUser();
    await request(app).post('/api/v1/news').set(auth(adminToken))
      .field('titre', 'Calendrier des examens').field('description', 'Les examens auront lieu du 12 au 23 janvier.');

    let sentBody;
    global.fetch = jest.fn(async (url, init) => {
      if (!String(url).startsWith('https://llm.example.test')) return realFetch(url, init);
      sentBody = JSON.parse(init.body);
      expect(init.headers.Authorization).toBe('Bearer test-key');
      return new Response(JSON.stringify({ choices: [{ message: { content: 'Les examens ont lieu du 12 au 23 janvier [1].' } }] }), { status: 200 });
    });

    const res = await request(app).post('/api/v1/assistant/messages').set(auth(token)).send({ message: 'Quand sont les examens ?' });
    expect(res.status).toBe(201);
    expect(sentBody.model).toBe('test-model');
    expect(sentBody.messages[0].content).toContain('Calendrier des examens');
    expect(res.body.answer.sources[0].title).toBe('Calendrier des examens');

    const history = await request(app).get('/api/v1/assistant').set(auth(token));
    expect(history.body.available).toBe(true);
    expect(history.body.messages.map((m) => m.role)).toEqual(['user', 'assistant']);
  });

  test('provider failures become a clean 502', async () => {
    const { token } = await createUser();
    global.fetch = jest.fn(async () => new Response('boom', { status: 500 }));
    const res = await request(app).post('/api/v1/assistant/messages').set(auth(token)).send({ message: 'Bonjour' });
    expect(res.status).toBe(502);
    expect(res.body.error).not.toMatch(/boom/);
  });
});

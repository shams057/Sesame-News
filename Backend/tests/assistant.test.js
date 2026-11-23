const { app, request, createUser, auth } = require('./helpers');
const { keywords } = require('../src/services/assistantService');

describe('assistant', () => {
  test('reports itself unavailable while the model name / API key are placeholders', async () => {
    const { token } = await createUser();
    const status = await request(app).get('/api/v1/assistant').set(auth(token));
    expect(status.body.available).toBe(false);
    const res = await request(app).post('/api/v1/assistant/messages').set(auth(token)).send({ message: 'Quand sont les examens ?' });
    expect(res.status).toBe(503);
  });

  test('keyword extraction drops accents and stop words', () => {
    expect(keywords('Quand est la réunion des étudiants en informatique ?')).toEqual(['reunion', 'etudiants', 'informatique']);
  });
});

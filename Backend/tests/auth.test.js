const { app, request, models, createAdmin, createUser, auth } = require('./helpers');

describe('authentication & authorization', () => {
  test('protected routes reject anonymous calls', async () => {
    for (const [method, url] of [
      ['get', '/api/v1/users'], ['get', '/api/v1/news'], ['get', '/api/v1/tickets'],
      ['get', '/api/v1/stats/tickets'], ['get', '/api/v1/feed'], ['post', '/api/v1/users/import'],
      ['get', '/api/v1/categories'], ['get', '/api/v1/admins'],
    ]) {
      const res = await request(app)[method](url);
      expect(res.status).toBe(401);
    }
  });

  test('the old public admin registration endpoint is gone and unknown routes return 404', async () => {
    const res = await request(app).post('/registersuperAdmin').send({ login: 'x', password: 'y' });
    expect(res.status).toBe(404);
    expect((await request(app).get('/api/v1/nope')).status).toBe(404);
  });

  test('students cannot call staff routes', async () => {
    const { token } = await createUser();
    expect((await request(app).get('/api/v1/users').set(auth(token))).status).toBe(403);
    expect((await request(app).post('/api/v1/news').set(auth(token)).field('titre', 'x')).status).toBe(403);
    expect((await request(app).get('/api/v1/stats/tickets').set(auth(token))).status).toBe(403);
  });

  test('agents cannot do owner-only actions', async () => {
    const { token } = await createAdmin({ role: 'agent' });
    const res = await request(app).post('/api/v1/admins').set(auth(token))
      .send({ login: 'newadmin', displayName: 'New', password: 'Password123!' });
    expect(res.status).toBe(403);
  });

  test('login errors do not reveal whether the account exists', async () => {
    const { user } = await createUser();
    const wrongPassword = await request(app).post('/api/v1/auth/user/login').send({ login: user.login, password: 'bad-password' });
    const unknown = await request(app).post('/api/v1/auth/user/login').send({ login: 'nobody-here', password: 'bad-password' });
    expect(wrongPassword.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrongPassword.body.error).toBe(unknown.body.error);
  });

  test('tokens are verified: forged or tampered tokens are rejected', async () => {
    const { token } = await createUser();
    const tampered = `${token.slice(0, -2)}xx`;
    expect((await request(app).get('/api/v1/me').set(auth(tampered))).status).toBe(401);
    expect((await request(app).get('/api/v1/me').set(auth('not-a-token'))).status).toBe(401);
  });

  test('logout revokes the session', async () => {
    const { token } = await createUser();
    expect((await request(app).get('/api/v1/me').set(auth(token))).status).toBe(200);
    expect((await request(app).post('/api/v1/auth/logout').set(auth(token))).status).toBe(204);
    expect((await request(app).get('/api/v1/me').set(auth(token))).status).toBe(401);
  });

  test('password hashes are never returned', async () => {
    const { token } = await createAdmin();
    await createUser();
    const res = await request(app).get('/api/v1/users').set(auth(token));
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toMatch(/password|\$2[aby]\$/);
  });

  test('changing the password requires the current one and revokes other sessions', async () => {
    const { user, token, password } = await createUser();
    const second = await request(app).post('/api/v1/auth/user/login').send({ login: user.login, password });
    const wrong = await request(app).put('/api/v1/me/password').set(auth(token)).send({ currentPassword: 'nope', newPassword: 'NewPassword1!' });
    expect(wrong.status).toBe(400);
    const ok = await request(app).put('/api/v1/me/password').set(auth(token)).send({ currentPassword: password, newPassword: 'NewPassword1!' });
    expect(ok.status).toBe(204);
    expect((await request(app).get('/api/v1/me').set(auth(token))).status).toBe(200);
    expect((await request(app).get('/api/v1/me').set(auth(second.body.token))).status).toBe(401);
  });

  test('students with a temporary password must change it first', async () => {
    const { token, password } = await createUser({ mustChangePassword: true });
    expect((await request(app).get('/api/v1/feed').set(auth(token))).status).toBe(403);
    await request(app).put('/api/v1/me/password').set(auth(token)).send({ currentPassword: password, newPassword: 'Another123!' });
    expect((await request(app).get('/api/v1/feed').set(auth(token))).status).toBe(200);
  });

  test('disabled accounts lose access immediately', async () => {
    const { token: adminToken } = await createAdmin();
    const { user, token } = await createUser();
    await request(app).patch(`/api/v1/users/${user.id}`).set(auth(adminToken)).send({ isActive: false });
    expect((await request(app).get('/api/v1/me').set(auth(token))).status).toBe(401);
    expect(await models.User.count({ where: { id: user.id } })).toBe(1);
  });
});

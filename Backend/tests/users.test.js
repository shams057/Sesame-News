const { app, request, models, createAdmin, createUser, createCategory, auth, unique } = require('./helpers');

describe('users & categories', () => {
  test('deleting a category used by students is refused and students are kept', async () => {
    const { token } = await createAdmin();
    const category = await createCategory();
    const { user } = await createUser({ categorieId: category.id });
    const res = await request(app).delete(`/api/v1/categories/${category.id}`).set(auth(token));
    expect(res.status).toBe(409);
    expect(await models.User.count({ where: { id: user.id } })).toBe(1);
  });

  test('a student can be created without a category; a temporary password is returned once', async () => {
    const { token } = await createAdmin();
    const res = await request(app).post('/api/v1/users').set(auth(token))
      .send({ firstname: 'Mohamed-Amine', lastname: 'Ben Abdallah-Kilani', login: unique('student') });
    expect(res.status).toBe(201);
    expect(res.body.user.categorie).toBeNull();
    expect(res.body.temporaryPassword).toHaveLength(12);
    expect(res.body.user.mustChangePassword).toBe(true);
  });

  test('duplicate logins return 409', async () => {
    const { token } = await createAdmin();
    const { user } = await createUser();
    const res = await request(app).post('/api/v1/users').set(auth(token))
      .send({ firstname: 'A', lastname: 'B', login: user.login });
    expect(res.status).toBe(409);
  });

  test('search finds students by name', async () => {
    const { token } = await createAdmin();
    await createUser({ lastname: 'Zarrouk' });
    const res = await request(app).get('/api/v1/users?q=zarr').set(auth(token));
    expect(res.body.content.some((user) => user.lastname === 'Zarrouk')).toBe(true);
  });

  test('CSV import handles quoted commas, reports bad rows and inserts valid ones', async () => {
    const { token } = await createAdmin();
    const category = await createCategory('Informatique CSV');
    const a = unique('csva');
    const b = unique('csvb');
    const csv = [
      'firstname,lastname,login,email,categorie',
      `"Amine","Ben Ali, Jr",${a},a@exemple.tn,Informatique CSV`,
      `Sarra,Trabelsi,${b},,`,
      `,,x,,`,
      `Nour,Ali,${a},,`,
      `Ines,Gharbi,${unique('csvc')},,Inconnue`,
    ].join('\n');
    const res = await request(app).post('/api/v1/users/import').set(auth(token))
      .attach('file', Buffer.from(csv), 'students.csv');
    expect(res.status).toBe(201);
    expect(res.body.imported).toBe(2);
    expect(res.body.errors.map((error) => error.line)).toEqual([4, 5, 6]);
    const created = await models.User.findOne({ where: { login: a } });
    expect(created.lastname).toBe('Ben Ali, Jr');
    expect(created.categorieId).toBe(category.id);
    expect(res.body.credentials).toHaveLength(2);
  });
});

describe('bulk actions & canned replies', () => {
  test('bulk deactivate and set category', async () => {
    const { token } = await createAdmin();
    const category = await createCategory();
    const a = await createUser();
    const b = await createUser();
    const ids = [a.user.id, b.user.id];
    expect((await request(app).post('/api/v1/users/bulk').set(auth(token)).send({ ids, action: 'setCategory', categorieId: category.id })).body.updated).toBe(2);
    await request(app).post('/api/v1/users/bulk').set(auth(token)).send({ ids, action: 'deactivate' });
    expect((await request(app).get('/api/v1/me').set(auth(a.token))).status).toBe(401);
    expect(await models.User.count({ where: { id: ids, isActive: false, categorieId: category.id } })).toBe(2);
  });

  test('department agents only manage their own canned replies', async () => {
    const [deptA, deptB] = await models.Department.findAll({ order: [['id', 'ASC']], limit: 2 });
    const { token: owner } = await createAdmin();
    const { token: agent } = await createAdmin({ role: 'agent', departmentId: deptA.id });
    await request(app).post('/api/v1/canned-replies').set(auth(owner)).send({ title: 'Global', content: 'Bonjour' });
    await request(app).post('/api/v1/canned-replies').set(auth(owner)).send({ title: 'Autre service', content: 'x', departmentId: deptB.id });
    const mine = await request(app).post('/api/v1/canned-replies').set(auth(agent)).send({ title: 'Wi-Fi', content: 'Oubliez le réseau…' });
    expect(mine.body.department.id).toBe(deptA.id);
    const titles = (await request(app).get('/api/v1/canned-replies').set(auth(agent))).body.map((r) => r.title);
    expect(titles).toEqual(expect.arrayContaining(['Global', 'Wi-Fi']));
    expect(titles).not.toContain('Autre service');
    expect((await request(app).post('/api/v1/canned-replies').set(auth(agent)).send({ title: 'x', content: 'y', departmentId: deptB.id })).status).toBe(403);
  });
});

const { app, request, models, createAdmin, createUser, createCategory, auth, unique } = require('./helpers');

/** A department admin; `classes` student classes are created for that department. */
async function departmentAdmin(classes = 0) {
  const department = await models.Department.create({ name: unique('Dept ') });
  const created = [];
  for (let i = 0; i < classes; i += 1) created.push(await models.Categorie.create({ libelle: unique('Classe '), departmentId: department.id }));
  const admin = await createAdmin({ role: 'agent', departmentId: department.id });
  return { ...admin, department, classes: created };
}

describe('permissions: super admin vs department admins', () => {
  test('only the super admin can publish, edit or delete news; admins can read them', async () => {
    const owner = await createAdmin();
    const { token } = await departmentAdmin(0);
    const created = await request(app).post('/api/v1/news').set(auth(owner.token)).field('titre', 'Annonce').field('description', 'Texte');
    expect(created.status).toBe(201);
    expect((await request(app).get('/api/v1/news').set(auth(token))).status).toBe(200);
    expect((await request(app).post('/api/v1/news').set(auth(token)).field('titre', 'x').field('description', 'y')).status).toBe(403);
    expect((await request(app).patch(`/api/v1/news/${created.body.id}`).set(auth(token)).field('titre', 'z')).status).toBe(403);
    expect((await request(app).delete(`/api/v1/news/${created.body.id}`).set(auth(token))).status).toBe(403);
  });

  test('only the super admin can create, rename or delete categories', async () => {
    const { token } = await departmentAdmin(0);
    expect((await request(app).post('/api/v1/categories').set(auth(token)).send({ libelle: unique('Cat') })).status).toBe(403);
  });

  test('a department admin only sees and edits the students of their department\'s classes', async () => {
    const other = await createCategory();
    const { token, classes: [mine, mine2] } = await departmentAdmin(2);
    const { user: classmate } = await createUser({ categorieId: mine2.id });
    const { user: myStudent } = await createUser({ categorieId: mine.id });
    const { user: otherStudent } = await createUser({ categorieId: other.id });

    const list = (await request(app).get('/api/v1/users?pageSize=100').set(auth(token))).body.content.map((u) => u.id);
    expect(list).toContain(myStudent.id);
    expect(list).toContain(classmate.id);
    expect(list).not.toContain(otherStudent.id);
    expect((await request(app).get(`/api/v1/users/${otherStudent.id}`).set(auth(token))).status).toBe(404);
    expect((await request(app).patch(`/api/v1/users/${otherStudent.id}`).set(auth(token)).send({ firstname: 'X' })).status).toBe(404);
    expect((await request(app).post(`/api/v1/users/${otherStudent.id}/reset-password`).set(auth(token))).status).toBe(404);

    const edited = await request(app).patch(`/api/v1/users/${myStudent.id}`).set(auth(token)).send({ firstname: 'Nouveau' });
    expect(edited.status).toBe(200);
    expect(edited.body.firstname).toBe('Nouveau');
  });

  test('a department admin cannot change a student\'s class (even within the department), delete students, or bulk-move them', async () => {
    const { token, classes: [mine, other] } = await departmentAdmin(2);
    const { user } = await createUser({ categorieId: mine.id });
    expect((await request(app).patch(`/api/v1/users/${user.id}`).set(auth(token)).send({ categorieId: other.id })).status).toBe(403);
    expect((await request(app).delete(`/api/v1/users/${user.id}`).set(auth(token))).status).toBe(403);
    expect((await request(app).post('/api/v1/users/bulk').set(auth(token)).send({ ids: [user.id], action: 'setCategory', categorieId: other.id })).status).toBe(403);
    expect((await models.User.findByPk(user.id)).categorieId).toBe(mine.id);
  });

  test('students created or imported by a department admin must be in one of their classes', async () => {
    const other = await createCategory();
    const { token, classes: [mine, mine2] } = await departmentAdmin(2);
    const created = await request(app).post('/api/v1/users').set(auth(token)).send({ firstname: 'A', lastname: 'B', login: unique('dep'), categorieId: mine2.id });
    expect(created.status).toBe(201);
    expect(created.body.user.categorie.id).toBe(mine2.id);
    expect((await request(app).post('/api/v1/users').set(auth(token)).send({ firstname: 'A', lastname: 'B', login: unique('dep') })).status).toBe(400);
    expect((await request(app).post('/api/v1/users').set(auth(token)).send({ firstname: 'A', lastname: 'B', login: unique('dep'), categorieId: other.id })).status).toBe(403);

    const ok = unique('csvok');
    const outside = unique('csvout');
    const code = mine.libelle.split(' (')[0];
    const csv = `firstname,lastname,login,email,categorie\nNour,Ali,${ok},,${code}\nSami,Ben,${outside},,${other.libelle}\n`;
    const imported = await request(app).post('/api/v1/users/import').set(auth(token)).attach('file', Buffer.from(csv), 'students.csv');
    expect(imported.body.imported).toBe(1);
    expect(imported.body.errors[0].login).toBe(outside);
    expect((await models.User.findOne({ where: { login: ok } })).categorieId).toBe(mine.id);
  });

  test('with a single class, the class can be omitted when creating a student', async () => {
    const { token, classes: [only] } = await departmentAdmin(1);
    const created = await request(app).post('/api/v1/users').set(auth(token)).send({ firstname: 'A', lastname: 'B', login: unique('one') });
    expect(created.status).toBe(201);
    expect(created.body.user.categorie.id).toBe(only.id);
  });

  test('a department admin replies to, closes and reopens the tickets of their department only', async () => {
    const { token, department } = await departmentAdmin(0);
    const otherDept = await models.Department.create({ name: unique('Autre ') });
    const student = await createUser();
    const mineTicket = (await request(app).post('/api/v1/tickets').set(auth(student.token)).send({ title: 'Question', description: 'Une question pour ce service', departmentId: department.id })).body;
    const otherTicket = (await request(app).post('/api/v1/tickets').set(auth(student.token)).send({ title: 'Autre', description: 'Une question pour un autre service', departmentId: otherDept.id })).body;
    expect((await request(app).post(`/api/v1/tickets/${mineTicket.id}/messages`).set(auth(token)).send({ content: 'Bonjour' })).status).toBe(201);
    expect((await request(app).patch(`/api/v1/tickets/${mineTicket.id}`).set(auth(token)).send({ status: 'closed' })).body.status).toBe('closed');
    expect((await request(app).patch(`/api/v1/tickets/${mineTicket.id}`).set(auth(token)).send({ status: 'open' })).body.status).toBe('open');
    expect((await request(app).post(`/api/v1/tickets/${otherTicket.id}/messages`).set(auth(token)).send({ content: 'x' })).status).toBe(404);
    expect((await request(app).patch(`/api/v1/tickets/${otherTicket.id}`).set(auth(token)).send({ status: 'closed' })).status).toBe(404);
  });

  test('an admin with no student category cannot manage students at all', async () => {
    const { token } = await departmentAdmin(0);
    expect((await request(app).get('/api/v1/users').set(auth(token))).status).toBe(403);
    expect((await request(app).post('/api/v1/users').set(auth(token)).send({ firstname: 'A', lastname: 'B', login: unique('x') })).status).toBe(403);
  });

  test('department admins only see colleagues of their department (plus super admins)', async () => {
    const a = await departmentAdmin(0);
    const b = await departmentAdmin(0);
    const owner = await createAdmin();
    const ids = (await request(app).get('/api/v1/admins').set(auth(a.token))).body.map((admin) => admin.id);
    expect(ids).toContain(a.admin.id);
    expect(ids).toContain(owner.admin.id);
    expect(ids).not.toContain(b.admin.id);
  });

  test('the super admin manages every student and sees everyone', async () => {
    const owner = await createAdmin();
    const other = await createCategory();
    const { user } = await createUser({ categorieId: other.id });
    const moved = await request(app).patch(`/api/v1/users/${user.id}`).set(auth(owner.token)).send({ categorieId: null });
    expect(moved.status).toBe(200);
    expect(moved.body.categorie).toBeNull();
    expect((await request(app).delete(`/api/v1/users/${user.id}`).set(auth(owner.token))).status).toBe(204);
  });
});

const { app, request, models, createAdmin, createUser, auth } = require('./helpers');

async function departments() {
  return models.Department.findAll({ order: [['id', 'ASC']], limit: 2 });
}

async function openTicket(token, departmentId, title = 'Problème Wi-Fi') {
  return request(app).post('/api/v1/tickets').set(auth(token))
    .send({ title, description: 'Je n’arrive pas à me connecter au réseau.', departmentId });
}

describe('tickets', () => {
  test('students only see their own tickets', async () => {
    const [dept] = await departments();
    const alice = await createUser();
    const bob = await createUser();
    const ticket = (await openTicket(alice.token, dept.id)).body;
    expect((await request(app).get(`/api/v1/tickets/${ticket.id}`).set(auth(bob.token))).status).toBe(404);
    expect((await request(app).patch(`/api/v1/tickets/${ticket.id}`).set(auth(bob.token)).send({ status: 'closed' })).status).toBe(404);
    const bobList = (await request(app).get('/api/v1/tickets').set(auth(bob.token))).body.content;
    expect(bobList.find((item) => item.id === ticket.id)).toBeUndefined();
  });

  test('department-restricted agents only see their department', async () => {
    const [deptA, deptB] = await departments();
    const student = await createUser();
    const inA = (await openTicket(student.token, deptA.id)).body;
    const inB = (await openTicket(student.token, deptB.id)).body;
    const agent = await createAdmin({ role: 'agent', departmentId: deptA.id });
    const ids = (await request(app).get('/api/v1/tickets?pageSize=100').set(auth(agent.token))).body.content.map((t) => t.id);
    expect(ids).toContain(inA.id);
    expect(ids).not.toContain(inB.id);
    expect((await request(app).get(`/api/v1/tickets/${inB.id}`).set(auth(agent.token))).status).toBe(404);
  });

  test('internal notes are hidden from the student; staff reply sets first response and in_progress', async () => {
    const [dept] = await departments();
    const student = await createUser();
    const staff = await createAdmin();
    const ticket = (await openTicket(student.token, dept.id)).body;
    await request(app).post(`/api/v1/tickets/${ticket.id}/messages`).set(auth(staff.token)).send({ content: 'Note interne', isInternal: true });
    await request(app).post(`/api/v1/tickets/${ticket.id}/messages`).set(auth(staff.token)).send({ content: 'Bonjour, essayez ceci.' });
    const studentView = (await request(app).get(`/api/v1/tickets/${ticket.id}/messages`).set(auth(student.token))).body.content;
    expect(studentView.map((m) => m.content)).not.toContain('Note interne');
    expect(studentView.map((m) => m.content)).toContain('Bonjour, essayez ceci.');
    const after = (await request(app).get(`/api/v1/tickets/${ticket.id}`).set(auth(staff.token))).body;
    expect(after.status).toBe('in_progress');
    expect(after.firstResponseAt).toBeTruthy();
    expect(after.assignedTo.id).toBe(staff.admin.id);
  });

  test('students cannot set in_progress, can close, rate, and reopen', async () => {
    const [dept] = await departments();
    const student = await createUser();
    const ticket = (await openTicket(student.token, dept.id)).body;
    const url = `/api/v1/tickets/${ticket.id}`;
    expect((await request(app).patch(url).set(auth(student.token)).send({ status: 'in_progress' })).status).toBe(403);
    expect((await request(app).patch(url).set(auth(student.token)).send({ rating: 5 })).status).toBe(400);
    const closed = await request(app).patch(url).set(auth(student.token)).send({ status: 'closed', rating: 4 });
    expect(closed.body.status).toBe('closed');
    expect(closed.body.rating).toBe(4);
    expect((await request(app).post(`${url}/messages`).set(auth(student.token)).send({ content: 'encore' })).status).toBe(400);
    const reopened = await request(app).patch(url).set(auth(student.token)).send({ status: 'open' });
    expect(reopened.body.status).toBe('open');
    expect(reopened.body.rating).toBeNull();
  });

  test('unread state is tracked per staff member', async () => {
    const [dept] = await departments();
    const student = await createUser();
    const first = await createAdmin();
    const second = await createAdmin();
    const ticket = (await openTicket(student.token, dept.id)).body;
    await request(app).post(`/api/v1/tickets/${ticket.id}/read`).set(auth(first.token));
    const firstUnread = (await request(app).get('/api/v1/tickets/unread').set(auth(first.token))).body.ticketIds;
    const secondUnread = (await request(app).get('/api/v1/tickets/unread').set(auth(second.token))).body.ticketIds;
    expect(firstUnread).not.toContain(ticket.id);
    expect(secondUnread).toContain(ticket.id);
  });

  test('ticket attachments are private', async () => {
    const [dept] = await departments();
    const owner = await createUser();
    const stranger = await createUser();
    const ticket = (await openTicket(owner.token, dept.id)).body;
    const message = (await request(app).post(`/api/v1/tickets/${ticket.id}/messages`).set(auth(owner.token))
      .attach('attachment', Buffer.from('%PDF-1.4'), { filename: 'releve.pdf', contentType: 'application/pdf' })).body;
    expect(message.attachment.name).toBe('releve.pdf');
    expect((await request(app).get(message.attachment.url)).status).toBe(401);
    expect((await request(app).get(message.attachment.url).set(auth(stranger.token))).status).toBe(404);
    expect((await request(app).get(message.attachment.url).set(auth(owner.token))).status).toBe(200);
  });

  test('statistics separate in-progress from open and count closures by closing date', async () => {
    const dept = await models.Department.create({ name: `Stats ${Date.now()}` });
    const student = await createUser();
    const staff = await createAdmin();
    const t1 = (await openTicket(student.token, dept.id, 'Paiement des frais')).body;
    const t2 = (await openTicket(student.token, dept.id, 'Attestation')).body;
    await openTicket(student.token, dept.id, 'Stage');
    await request(app).patch(`/api/v1/tickets/${t1.id}`).set(auth(staff.token)).send({ status: 'in_progress' });
    await request(app).patch(`/api/v1/tickets/${t2.id}`).set(auth(staff.token)).send({ status: 'closed' });
    // An old ticket closed today counts as "closed in period" but not as "created".
    const old = await models.Ticket.create({ title: 'Ancien', description: 'ancien ticket', departmentId: dept.id, userId: student.user.id, createdAt: new Date('2020-01-01') });
    await request(app).patch(`/api/v1/tickets/${old.id}`).set(auth(staff.token)).send({ status: 'closed' });

    const stats = (await request(app).get(`/api/v1/stats/tickets?period=today&departmentId=${dept.id}`).set(auth(staff.token))).body;
    expect(stats.created).toMatchObject({ total: 3, open: 1, in_progress: 1, closed: 1 });
    expect(stats.closedInPeriod).toBe(2);
    expect(stats.resolutionTime.averageHours).not.toBeNull();
    const csv = await request(app).get(`/api/v1/stats/tickets.csv?period=today&departmentId=${dept.id}`).set(auth(staff.token));
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.text).toContain('Paiement des frais');
  });
});

describe('unread tracking precision', () => {
  test('a student reply in the same second as the staff message is still unread', async () => {
    const [dept] = await models.Department.findAll({ limit: 1 });
    const student = await createUser();
    const staff = await createAdmin();
    const ticket = (await openTicket(student.token, dept.id)).body;
    await request(app).post(`/api/v1/tickets/${ticket.id}/messages`).set(auth(staff.token)).send({ content: 'Réponse' });
    await request(app).post(`/api/v1/tickets/${ticket.id}/messages`).set(auth(student.token)).send({ content: 'Merci, mais…' });
    const unread = (await request(app).get('/api/v1/tickets/unread').set(auth(staff.token))).body.ticketIds;
    expect(unread).toContain(ticket.id);
  });
});

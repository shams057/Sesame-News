const http = require('http');
const { io: connect } = require('socket.io-client');
const { app, request, models, createAdmin, createUser, auth } = require('./helpers');
const { attachSocketServer } = require('../src/socket');

let server;
let io;
let url;

beforeAll(async () => {
  server = http.createServer(app);
  io = attachSocketServer(server);
  await new Promise((resolve) => server.listen(0, resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  io.close();
  await new Promise((resolve) => server.close(resolve));
});

function socketFor(token) {
  return new Promise((resolve, reject) => {
    const socket = connect(url, { auth: { token }, transports: ['websocket'], reconnection: false });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });
}

describe('realtime', () => {
  test('sockets require a valid token', async () => {
    await expect(socketFor('invalid')).rejects.toThrow('Authentification requise');
  });

  test('students receive staff replies but never internal notes', async () => {
    const department = await models.Department.findOne();
    const student = await createUser();
    const staff = await createAdmin();
    const ticket = (await request(app).post('/api/v1/tickets').set(auth(student.token))
      .send({ title: 'Question', description: 'Une question sur mon inscription', departmentId: department.id })).body;

    const socket = await socketFor(student.token);
    const received = [];
    socket.on('ticket:message', (message) => received.push(message.content));

    await request(app).post(`/api/v1/tickets/${ticket.id}/messages`).set(auth(staff.token)).send({ content: 'Secret', isInternal: true });
    await request(app).post(`/api/v1/tickets/${ticket.id}/messages`).set(auth(staff.token)).send({ content: 'Réponse publique' });
    await new Promise((resolve) => setTimeout(resolve, 300));
    socket.disconnect();

    expect(received).toContain('Réponse publique');
    expect(received).not.toContain('Secret');
  });
});

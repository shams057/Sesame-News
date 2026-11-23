'use strict';

/**
 * Socket.IO rooms:
 *   user:<id>          a student's devices
 *   admins             every staff member who sees all departments
 *   admins:dept:<id>   staff restricted to one department
 * Each event is emitted once per room set (no duplicated deliveries).
 */
let io = null;

function setServer(server) {
  io = server;
}

function staffRooms(departmentId) {
  return ['admins', `admins:dept:${departmentId}`];
}

function toStaff(departmentId, event, payload) {
  if (io) io.to(staffRooms(departmentId)).emit(event, payload);
}

function toUser(userId, event, payload) {
  if (io && userId) io.to(`user:${userId}`).emit(event, payload);
}

function toAllUsers(event, payload) {
  if (io) io.to('users').emit(event, payload);
}

module.exports = { setServer, toStaff, toUser, toAllUsers, staffRooms };

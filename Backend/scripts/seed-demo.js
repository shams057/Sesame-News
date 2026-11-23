#!/usr/bin/env node
'use strict';

/**
 * Demo accounts and content for local testing / project review.
 *
 *   npm run db:seed:demo
 *
 * Idempotent: existing demo accounts get their documented password back;
 * demo news and tickets are only created when those tables are empty.
 * Refuses to run in production — never use these passwords on a real server.
 */
const env = require('../src/config/env');
const { sequelize, SuperAdmin, User, Categorie, Department, News, NewsCategorie, Ticket, TicketMessage } = require('../src/models');
const { hashPassword } = require('../src/services/authService');

const PASSWORDS = { owner: 'Admin12345!', agent: 'Agent1234!', student: 'Etudiant1234!' };

// One admin per department (login → exact department name in the seeder).
// A department admin manages the students of every class of its department.
const DEPARTMENT_AGENTS = [
  ['agent.scolarite', 'Service Scolarité'],
  ['agent.stage', 'Service Stage'],
  ['agent.informatique', 'Département Informatique'],
  ['agent.management', 'Département Management'],
  ['agent.ing', 'Département ING'],
  ['agent.fta', 'Département FTA'],
  ['agent.it', 'Service IT'],
  ['agent.qualite', 'Service Qualité'],
  ['agent.cooperation', 'Service Coopération Internationale'],
  ['agent.marketing', 'Service Marketing'],
  ['agent.admission', 'Service Admission'],
  ['agent.finance', 'Service Finance'],
  ['agent.studentsuccess', 'Service Student Success'],
];

// Class names come from the classes migration (exact libellé).
const LIM = 'LIM (Licence Informatique Multimédia)';
const LGLSI = 'LGLSI (Licence Génie Logiciel et Systèmes Intelligents)';
const LBIS = 'LBIS (Licence Business Information System)';
const LSG = 'LSG (Licence Sciences de Gestion)';
const STUDENTS = [
  ['amine.benali', 'Amine', 'Ben Ali', LIM],
  ['sarra.trabelsi', 'Sarra', 'Trabelsi', LGLSI],
  ['youssef.gharbi', 'Youssef', 'Gharbi', LBIS],
  ['lina.mansour', 'Lina', 'Mansour', LSG],
  ['omar.haddad', 'Omar', 'Haddad', 'Cycle Préparatoire'],
  ['meriem.jlassi', 'Meriem', 'Jlassi', 'Cycle Ingénieurs'],
  ['karim.saidi', 'Karim', 'Saidi', 'FTA (Formation Temps Aménagé)'],
];

async function upsertAdmin(login, displayName, role, departmentId, password) {
  const hashed = await hashPassword(password);
  const values = { password: hashed, displayName, role, departmentId, isActive: true };
  const existing = await SuperAdmin.findOne({ where: { login } });
  if (existing) return existing.update(values);
  return SuperAdmin.create({ login, ...values });
}

async function main() {
  if (env.isProduction) throw new Error('Refusé : les comptes de démonstration ne doivent jamais être créés en production.');

  const departments = new Map((await Department.findAll()).map((department) => [department.name, department]));
  if (!departments.size) throw new Error('Aucun service en base : lancez d’abord `npm run db:setup`.');

  const categories = new Map((await Categorie.findAll()).map((category) => [category.libelle, category]));
  const missing = STUDENTS.map(([, , , name]) => name).find((name) => !categories.has(name));
  if (missing) throw new Error(`Classe introuvable : ${missing} (lancez \`npm run db:migrate\`)`);

  const admin = await upsertAdmin('admin', 'Super administrateur', 'owner', null, PASSWORDS.owner);
  // The former all-departments demo agent does not fit the role model any more.
  // Logins renamed or retired since earlier versions of this script.
  await SuperAdmin.destroy({ where: { login: ['agent.general', 'agent.prepa'] } });
  for (const [login, departmentName] of DEPARTMENT_AGENTS) {
    const department = departments.get(departmentName);
    if (!department) throw new Error(`Service introuvable : ${departmentName}`);
    await upsertAdmin(login, `Admin ${departmentName}`, 'agent', department.id, PASSWORDS.agent);
  }

  const studentHash = await hashPassword(PASSWORDS.student);
  const students = {};
  for (const [login, firstname, lastname, category] of STUDENTS) {
    const values = { firstname, lastname, categorieId: categories.get(category).id, password: studentHash, isActive: true, mustChangePassword: false };
    const existing = await User.findOne({ where: { login } });
    students[login] = existing ? await existing.update(values) : await User.create({ login, ...values });
  }

  if (!(await News.count())) {
    const day = 24 * 3600 * 1000;
    const now = Date.now();
    await News.create({
      titre: 'Calendrier des examens du semestre 1', pinned: true, superAdminId: admin.id,
      description: 'Les examens du premier semestre se dérouleront du **12 au 23 janvier**.\n\n- Planning par filière sur https://universitesesame.com\n- Convocations envoyées par e-mail',
    });
    await News.create({
      titre: 'Journée portes ouvertes', superAdminId: admin.id, location: 'Campus Ariana, hall principal',
      description: 'Venez découvrir nos formations et rencontrer les enseignants.',
      eventStart: new Date(now + 6 * day), eventEnd: new Date(now + 6 * day + 6 * 3600 * 1000),
    });
    const workshop = await News.create({
      titre: 'Atelier IA générative pour les L3', superAdminId: admin.id, audienceAll: false, location: 'Labo 2',
      description: 'Atelier pratique réservé aux étudiants des licences informatiques (LIM, LGLSI, LBIS).', eventStart: new Date(now + 10 * day),
    });
    for (const name of [LIM, LGLSI, LBIS]) await NewsCategorie.create({ newsId: workshop.id, categorieId: categories.get(name).id });
    const seminar = await News.create({
      titre: 'Séminaire entrepreneuriat', superAdminId: admin.id, audienceAll: false, location: 'Amphi B',
      description: 'Séminaire réservé aux étudiants en Sciences de Gestion.', eventStart: new Date(now + 8 * day),
    });
    await NewsCategorie.create({ newsId: seminar.id, categorieId: categories.get(LSG).id });
  }

  if (!(await Ticket.count())) {
    const demoTickets = [
      ['amine.benali', 'Service IT', 'Impossible de me connecter au Wi-Fi', 'Depuis lundi, le réseau SESAME-Etudiants refuse mon mot de passe sur mon ordinateur portable.'],
      ['sarra.trabelsi', 'Service Scolarité', 'Attestation de scolarité', 'J’ai besoin d’une attestation de scolarité pour ma demande de bourse.'],
      ['youssef.gharbi', 'Service Stage', 'Convention de stage PFE', 'Mon entreprise d’accueil demande la convention signée. Quelle est la procédure ?'],
      ['lina.mansour', 'Service Finance', 'Paiement des frais en deux tranches', 'Est-il possible de payer les frais de scolarité en deux fois ce semestre ?'],
    ];
    for (const [login, departmentName, title, description] of demoTickets) {
      const student = students[login];
      const ticket = await Ticket.create({ title, description, departmentId: departments.get(departmentName).id, userId: student.id });
      await TicketMessage.create({
        ticketId: ticket.id, content: description, senderRole: 'user', senderName: `${student.firstname} ${student.lastname}`, userId: student.id, userReadAt: new Date(),
      });
    }
  }

  console.log('Comptes de démonstration prêts :');
  console.log(`  admin (super administrateur) ............ ${PASSWORDS.owner}`);
  DEPARTMENT_AGENTS.forEach(([login, name]) => console.log(`  ${login.padEnd(22)} ${name.padEnd(36)} ${PASSWORDS.agent}`));
  STUDENTS.forEach(([login, , , category]) => console.log(`  ${login.padEnd(22)} étudiant · ${category.split(' (')[0].padEnd(25)} ${PASSWORDS.student}`));
  await sequelize.close();
}

main().catch(async (error) => {
  console.error(error.message);
  await sequelize.close().catch(() => {});
  process.exit(1);
});

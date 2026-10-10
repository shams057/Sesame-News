const express = require('express');
const route = express.Router();
const db = require('./../models');
const upload = require('../middleware/upload');

// ===================== CREATE =====================
route.post('/createnews', upload.single('file'), (req, res) => {
  try {
    console.log('BODY =>', req.body);
    console.log('FILE =>', req.file);

    const titre = req.body?.titre;
    const description = req.body?.description;

    if (!titre || !description) {
      return res.status(400).json({
        error: 'titre et description sont obligatoires',
        body: req.body,
      });
    }

    const filePath = req.file ? `/uploads/${req.file.filename}` : null;

    const allValue =
      req.body.all === 'true' ||
      req.body.all === true ||
      req.body.all === '1';

    // null si vide (évite erreur FK)
    const categorieId =
      req.body.categorieId && String(req.body.categorieId).trim() !== ''
        ? Number(req.body.categorieId)
        : null;

    const superAdminId =
      req.body.superAdminId && String(req.body.superAdminId).trim() !== ''
        ? Number(req.body.superAdminId)
        : null;

    const userId =
      req.body.userId && String(req.body.userId).trim() !== ''
        ? Number(req.body.userId)
        : null;

    db.news
      .create({
        titre,
        description,
        path: filePath,
        all: allValue,
        categorieId,
        superAdminId,
        userId,
      })
      .then((response) => res.status(200).send(response))
      .catch((err) => {
        console.error('CREATE NEWS ERROR =>', err);
        res.status(400).json({
          error: err.message || 'Erreur création news',
          details: err.parent?.sqlMessage || err.errors || err,
        });
      });
  } catch (e) {
    console.error('ROUTE ERROR =>', e);
    res.status(500).json({ error: e.message });
  }
});

// ===================== GET ONE =====================
route.get('/news/:id', (req, res) => {
  db.news
    .findOne({ where: { id: req.params.id } })
    .then((response) => res.status(200).send(response))
    .catch((err) => res.status(400).send(err));
});

// ===================== LIST (SuperAdmin) =====================
route.get('/newssall', async (req, res, next) => {
  const size = 20;
  try {
    let page = 0;
    const nbrPage = Number.parseInt(req.query.page);
    if (!Number.isNaN(nbrPage) && nbrPage >= 0) {
      page = nbrPage;
    }

    const newss = await db.news.findAndCountAll({
      limit: size,
      offset: page * size,
      order: [['createdAt', 'DESC']],
    });

    res.status(200).send({
      content: newss.rows,
      totalPages: Math.ceil(newss.count / size),
    });
  } catch (error) {
    next(error);
  }
});

// ===================== LIST par user =====================
route.get('/newssparuser', async (req, res, next) => {
  const size = 1;
  try {
    const userId = req.query.userId;
    let page = 0;
    const nbrPage = Number.parseInt(req.query.page);
    if (!Number.isNaN(nbrPage) && nbrPage >= 0) {
      page = nbrPage;
    }

    let whereCondition = { all: true };

    if (userId) {
      const user = await db.user.findByPk(userId);
      if (user && user.categorieId) {
        whereCondition = {
          [db.Sequelize.Op.or]: [
            { all: true },
            { categorieId: user.categorieId },
          ],
        };
      }
    }

    const newss = await db.news.findAndCountAll({
      where: whereCondition,
      limit: size,
      offset: page * size,
      order: [['createdAt', 'DESC']],
    });

    res.status(200).send({
      content: newss.rows,
      totalPages: Math.ceil(newss.count / size),
      totalElements: newss.count,
    });
  } catch (error) {
    next(error);
  }
});

// ===================== UPDATE (avec upload) =====================
route.put('/news/:id', upload.single('file'), (req, res) => {
  try {
    console.log('UPDATE BODY =>', req.body);
    console.log('UPDATE FILE =>', req.file);

    const data = {};

    if (req.body.titre !== undefined) data.titre = req.body.titre;
    if (req.body.description !== undefined) data.description = req.body.description;

    if (req.body.all !== undefined) {
      data.all =
        req.body.all === 'true' ||
        req.body.all === true ||
        req.body.all === '1';
    }

    if (req.body.categorieId !== undefined) {
      data.categorieId =
        req.body.categorieId && String(req.body.categorieId).trim() !== ''
          ? Number(req.body.categorieId)
          : null;
    }

    if (req.body.superAdminId !== undefined) {
      data.superAdminId =
        req.body.superAdminId && String(req.body.superAdminId).trim() !== ''
          ? Number(req.body.superAdminId)
          : null;
    }

    if (req.body.userId !== undefined) {
      data.userId =
        req.body.userId && String(req.body.userId).trim() !== ''
          ? Number(req.body.userId)
          : null;
    }

    // Nouveau fichier uniquement si uploadé
    if (req.file) {
      data.path = `/uploads/${req.file.filename}`;
    }

    db.news
      .update(data, { where: { id: req.params.id } })
      .then((response) => res.status(200).send(response))
      .catch((err) => {
        console.error('UPDATE NEWS ERROR =>', err);
        res.status(400).json({
          error: err.message || 'Erreur update news',
          details: err.parent?.sqlMessage || err.errors || err,
        });
      });
  } catch (e) {
    console.error('UPDATE ROUTE ERROR =>', e);
    res.status(500).json({ error: e.message });
  }
});

// ===================== DELETE =====================
route.delete('/news/:id', (req, res) => {
  db.news
    .destroy({ where: { id: req.params.id } })
    .then((response) => res.status(200).send(response))
    .catch((err) => res.status(400).send(err));
});

module.exports = route;
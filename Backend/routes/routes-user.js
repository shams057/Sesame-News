const express=require('express')
const route=express.Router() 
const db=require('./../models')
const bcrypt = require('bcrypt');
const multer = require('multer');

const { Op } = require('sequelize');

const { QueryTypes } = require('sequelize');
const config = require('./../config/config.json');
const { Sequelize } = require('sequelize');
const sequelize = new Sequelize(config.development);
const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });




route.get('/user/:id',(req,res,next)=>{ 
    db.user.findOne({where:{id:req.params.id}})
    .then((response)=>res.status(200).send(response))
    .catch((err)=>res.status(400).send(err))
})

// route.get('/usernbr',requireAuthSuperuser,/*async*/ (req,res,next)=>{ 

//     db.user.count()
//     .then((userCount) => {
//         res.status(200).send({ count: userCount });
//     })
//     .catch((err) => {
//         console.error(err);
//         res.status(500).send({ error: 'Une erreur s\'est produite lors de la récupération du nombre d\'useristrateurs.' });
//     });
// })
route.get('/users',async (req,res,next)=>{
    const size=20;
    try {
        var nbrPage = Number.parseInt(req.query.page);
        let page = 0;
        if (!Number.isNaN(nbrPage) && nbrPage > 0) {
            page = nbrPage;
        }

        const users = await db.user.findAndCountAll({
            limit: size,
            offset: page * size
        });

        res.status(200).send({
            content: users.rows,
            totalPages: Math.ceil(users.count / size)
        });
    } catch (error) {
        // Gérer les erreurs ici
        next(error);
    }
})

route.post('/users/import-csv', csvUpload.single('file'), async (req, res, next) => {
    if (!req.file) return res.status(400).json({ error: 'Fichier CSV requis' });
    try {
        const lines = req.file.buffer.toString('utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
        if (lines.length < 2) return res.status(400).json({ error: 'Le CSV ne contient aucun utilisateur' });
        const headers = lines.shift().split(',').map((value) => value.trim().toLowerCase());
        const skipped = []; let imported = 0;
        for (const line of lines) {
            const values = line.split(',').map((value) => value.trim().replace(/^"|"$/g, ''));
            const row = Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));
            if (!row.firstname || !row.lastname || !row.login || !row.password || await db.user.findOne({ where: { login: row.login } })) {
                skipped.push(row.login || line); continue;
            }
            await db.user.create({ firstname: row.firstname, lastname: row.lastname, login: row.login,
                password: await bcrypt.hash(row.password, 10), GC: ['true', '1', 'oui'].includes(row.gc?.toLowerCase()), categorieId: row.categorieid || null });
            imported += 1;
        }
        res.status(201).json({ imported, skipped });
    } catch (error) { next(error); }
});


route.put('/user/:id', async(req,res,next)=>{

    if(req.body.password)
    {
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
    
        db.user.update({
            password:hashedPassword,
            firstname:req.body.firstname, 
            lastname:req.body.lastname, 
            login:req.body.login,
            GC:req.body.GC,
            categorieId:req.body.categorieId,
            
        },{where:{id:req.params.id}})
        .then((response)=>res.status(200).send(response))
        .catch((err)=>res.status(400).send(err))
    }else{
        db.user.update({
            firstname:req.body.firstname, 
            lastname:req.body.lastname, 
            login:req.body.login,
            GC:req.body.GC,
            categorieId:req.body.categorieId,
        },{where:{id:req.params.id}})
        .then((response)=>res.status(200).send(response))
        .catch((err)=>res.status(400).send(err))
    }
    
}) 


route.delete('/user/:id',(req,res,next)=>{
    db.user.destroy({where:{id:req.params.id}})
    .then((response)=>res.status(200).send(response))
    .catch((err)=>res.status(400).send(err))
})

module.exports=route

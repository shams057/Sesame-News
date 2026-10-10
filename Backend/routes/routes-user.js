const express=require('express')
const route=express.Router() 
const db=require('./../models')
const bcrypt = require('bcrypt');

const { Op } = require('sequelize');

const { QueryTypes } = require('sequelize');
const config = require('./../config/config.json');
const { Sequelize } = require('sequelize');
const sequelize = new Sequelize(config.development);




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
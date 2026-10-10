const express=require('express')
const route=express.Router() 
const db=require('./../models')


const { Op } = require('sequelize');

const { QueryTypes } = require('sequelize');
const config = require('./../config/config.json');
const { Sequelize } = require('sequelize');
const sequelize = new Sequelize(config.development);


route.post('/createcategorie',(req,res,next)=>{
    db.categorie.create({
        libelle:req.body.libelle, 
    }).then((response)=>res.status(200).send(response))
    .catch((err)=>res.status(400).send(err))
    //create(req.body)
}) 

route.get('/categorie/:id',(req,res,next)=>{ 
    db.categorie.findOne({where:{id:req.params.id}})
    .then((response)=>res.status(200).send(response))
    .catch((err)=>res.status(400).send(err))
})


route.get('/categories',(req,res,next)=>{
    db.categorie.findAll()
    .then((response)=>res.status(200).send(response))
    .catch((err)=>res.status(400).send(err))
})



//____________________________________________________________________________________________________________________
route.put('/categorie/:id', async(req,res,next)=>{
        db.categorie.update({
            libelle:req.body.libelle, 
        },{where:{id:req.params.id}})
        .then((response)=>res.status(200).send(response))
        .catch((err)=>res.status(400).send(err))
   
    
}) 


route.delete('/categorie/:id',(req,res,next)=>{
    db.categorie.destroy({where:{id:req.params.id}})
    .then((response)=>res.status(200).send(response))
    .catch((err)=>res.status(400).send(err))
})

module.exports=route
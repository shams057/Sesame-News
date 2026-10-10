// routes/auth.js
const express = require('express');
const router = express.Router();
const db = require('../models');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
// const {requireAuthSupersuperAdmin} = require('./../middleware/authMiddleware');

// User registration
router.post('/registersuperAdmin', async (req, res) => {
//try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    await db.superAdmin.count({where:{login:req.body.login}}).then(nbr=>{
        if(nbr!=0)
        {
            res.status(500).json({ error: 'this account is already exist' });
        }
        else{ 
         db.superAdmin.create({
            
            login:req.body.login,
            password:hashedPassword, 
            
    
        }).then((response)=>res.status(200).send(response))
        .catch((err)=>res.status(400).send(err))
    }
    }) 

});
router.post('/loginsuperAdmin', async (req, res) => {
    try {
    const { login, password } = req.body;
    const user = await db.superAdmin.findOne({where :{login:login}  }); 
    if (!user) {
    return res.status(401).json({ error: 'this personne is not existe!!' });
    }
    else{
        
            const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            uspass=user.password
            uslog=user.login
           // console.log('passe '+bcrypt.hash(password, 10))
        return res.status(401).json({ error: 'Authentication failed pwd' });
       // return res.status(401).json({ password,uspass,login,uslog});
        }
        
        // const token = jwt.sign({ userId: user.id, role:"DocTor" ,password:generateRandomString},"JMA");
        const token = jwt.sign({ userId: user.id, role:"S-A" },"JMA");
        db.TokenSuperAdmin.create({
            token:token,
            superAdminId:user.id
        })
        res.status(200).json({ token });
       
    }
    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
        } 
    });


router.put('/superAdmin/:id', async(req,res,next)=>{

    if(req.body.password)
    {
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
    
        db.superAdmin.update({
            password:hashedPassword,
            
            login:req.body.login, 
            
        },{where:{id:req.params.id}})
        .then((response)=>res.status(200).send(response))
        .catch((err)=>res.status(400).send(err))
    }else{
        db.superAdmin.update({
            
            login:req.body.login, 
            
        },{where:{id:req.params.id}})
        .then((response)=>res.status(200).send(response))
        .catch((err)=>res.status(400).send(err))
    }
    
})    

// logout 
router.delete('/logoutsuperAdmin/:token', async (req, res) => {
    db.TokenSuperAdmin.destroy({where:{token:req.params.token}})
    .then((response)=>res.status(201).send(response))
    .catch((err)=>res.status(400).send(err))
    });

module.exports = router;
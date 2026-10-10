// routes/auth.js
const express = require('express');
const router = express.Router();
const db = require('../models');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// User registration
router.post('/registeruser', async (req, res) => {
//try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    await db.user.count({where:{login:req.body.login}}).then(nbr=>{
        if(nbr!=0)
        {
            res.status(500).json({ error: 'this account is already exist' });
        }
        else{ 
         db.user.create({
            password:hashedPassword,
            firstname:req.body.firstname, 
            lastname:req.body.lastname, 
            login:req.body.login,
            GC:req.body.GC,
            categorieId:req.body.categorieId,
    
        }).then((response)=>res.status(200).send(response))
        .catch((err)=>res.status(400).send(err))
    }
    }) 
/*res.status(201).json({ message: 'User registered successfully' });
} catch (error) {
res.status(500).json({ error: error });
}*/
});
router.post('/loginuser', async (req, res) => {
  try {
    const { login, password } = req.body;
    const user = await db.user.findOne({ where: { login } });

    if (!user) {
      return res.status(401).json({ error: 'this personne is not existe!!' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Authentication failed pwd' });
    }

    const token = jwt.sign({ userId: user.id, role: 'UsEr' }, 'JMA');

    await db.TokenUser.create({
      token,
      userId: user.id,
    });

    // ← on renvoie aussi l'utilisateur (sans le password)
    res.status(200).json({
      token,
      user: {
        id: user.id,
        firstname: user.firstname,
        lastname: user.lastname,
        login: user.login,
        categorieId: user.categorieId,
        GC: user.GC,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// logout 
router.delete('/logoutuser/:token', async (req, res) => {
    db.TokenUser.destroy({where:{token:req.params.token}})
    .then((response)=>res.status(201).send(response))
    .catch((err)=>res.status(400).send(err))
    });

module.exports = router;
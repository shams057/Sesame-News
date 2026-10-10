const express=require("express")
const app=express() 
const db=require('./models')
// Autoriser les requêtes Angular
var cors = require('cors');
const path = require('path');
app.use(cors());

// JSON pour les routes normales
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Fichiers uploadés accessibles
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

//---------------------------------------------------------------------------------

const authSuperAdmin=require("./Auth/authSuperAdmin")
const authUser=require("./Auth/authUser")
const categorieRoutes=require("./routes/routes-categorie")
const userRoutes=require("./routes/routes-user")
const newsRoutes=require("./routes/routes-news")
const ticketRoutes=require("./routes/routes-ticket")
const chatRoutes=require("./routes/routes-chat")


app.use('/',authSuperAdmin)
app.use('/',authUser)
app.use('/',categorieRoutes)
app.use('/',userRoutes)
app.use('/',newsRoutes)
app.use('/',ticketRoutes)
app.use('/',chatRoutes)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


app.use((req,res,next)=>{
    res.setHeader('Access-Control-Allow-Origin','*')
    res.setHeader('Access-Control-Request-Methods','*')
    res.setHeader('Access-Control-Allow-Headers','*')
    res.setHeader('Access-Control-Allow-Methods','*')
})

var port=3000;
db.sequelize
  .sync({ force: false })
  .then(() => {
    app.listen(port, () => {
      console.log(`Serveur listening on port ${port}`);
      console.log(`http://localhost:${port}/`);
    });
  })
  .catch((error) => {
    console.error("Erreur de connexion à la base de données :", error);
  });
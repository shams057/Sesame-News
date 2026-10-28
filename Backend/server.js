const express=require("express")
const app=express()
const db=require('./models')
const http = require('http');
const { Server } = require('socket.io');
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
const ticketChatRoutes=require("./routes/routes-ticket-chat")


app.use('/',authSuperAdmin)
app.use('/',authUser)
app.use('/',categorieRoutes)
app.use('/',userRoutes)
app.use('/',newsRoutes)
app.use('/',ticketRoutes)
app.use('/',chatRoutes)
app.use('/',ticketChatRoutes)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


app.use((req,res,next)=>{
    res.setHeader('Access-Control-Allow-Origin','*')
    res.setHeader('Access-Control-Request-Methods','*')
    res.setHeader('Access-Control-Allow-Headers','*')
    res.setHeader('Access-Control-Allow-Methods','*')
})

var port=3000;
const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: '*', methods: ['GET', 'POST'] } });
ticketChatRoutes.setSocketServer(io);
ticketRoutes.setSocketServer(io);

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentification requise'));
    const participant = await ticketChatRoutes.getParticipant({ headers: { authorization: `Bearer ${token}` } });
    if (!participant) return next(new Error('Session invalide'));
    socket.data.participant = participant;
    next();
  } catch (error) {
    next(new Error('Authentification requise'));
  }
});

io.on('connection', (socket) => {
  const participant = socket.data.participant;
  socket.join(participant.role === 'user' ? `user:${participant.id}` : 'superadmins');
  socket.on('ticket:join', async (ticketId) => {
    try {
      const ticket = await db.ticket.findByPk(ticketId);
      if (!ticket || (participant.role === 'user' && ticket.userId !== participant.id)) return;
      if (participant.role === 'user' || ['open', 'in_progress'].includes(ticket.status)) {
        socket.join(`ticket:${ticket.id}`);
      }
    } catch (error) {
      // Socket room access is denied if ticket lookup fails.
    }
  });
  socket.on('ticket:leave', (ticketId) => socket.leave(`ticket:${ticketId}`));
});

db.sequelize
  .sync({ force: false })
  .then(() => Promise.all([db.ticket.sync({ alter: true }), db.ticketMessage.sync({ alter: true })]))
  .then(() => {
    httpServer.listen(port, () => {
      console.log(`Serveur listening on port ${port}`);
      console.log(`http://localhost:${port}/`);
    });
  })
  .catch((error) => {
    console.error("Erreur de connexion à la base de données :", error);
  });

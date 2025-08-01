const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// Import routes
const userRoutes = require('./routes/user');
const chatRoutes = require('./routes/chats');
const authRoutes = require('./routes/auth');
const mediaRoutes = require('./routes/media');

app.use('/api/user', userRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/media', mediaRoutes);
app.use('/uploads', express.static('uploads'));

// Socket.io for real-time chat
io.on('connection', (socket) => {
  socket.on('join', ({ userId }) => {
    socket.join(userId);
  });
  socket.on('message', (data) => {
    // Broadcast to recipient
    io.to(data.to).emit('message', data);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Danh sách video ban đầu
let videoList = [
  "video1.mp4",
  "video2.mp4",
  "video3.mp4"
];

app.get('/', (req, res) => {
  res.send('Server is running');
});

io.on('connection', (socket) => {
  console.log('A user connected');

  // Gửi danh sách video hiện tại đến client
  socket.emit('videoListUpdate', videoList);

  // Lắng nghe sự kiện "addVideo" từ client và thêm video vào danh sách
  socket.on('addVideo', (newVideo) => {
    videoList.push(newVideo);
    io.emit('videoListUpdate', videoList); // Cập nhật cho tất cả client
  });

  // Ngắt kết nối
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

server.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});

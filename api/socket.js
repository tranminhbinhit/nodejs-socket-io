const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["polling"],
});

let roomUserInfo = {}; // Lưu trữ thông tin người dùng trong từng room và page

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  let currentRoom = null;
  let currentPage = null;

  socket.on('connect', () => {
    console.log('Connected to server');
  });

  // Khi client yêu cầu tham gia phòng
  socket.on("join-room", (data) => {
    const { roomId, pageId } = data;

    // Nếu client đã tham gia phòng trước đó, rời khỏi phòng cũ
    if (currentRoom) {
      socket.leave(currentRoom);
      console.log(`Client ${socket.id} left room: ${currentRoom}`);
      roomUserInfo[currentRoom][currentPage] = roomUserInfo[currentRoom][
        currentPage
      ].filter((client) => client.socketId !== socket.id);
    }

    // Tham gia phòng mới
    socket.join(roomId);
    currentRoom = roomId;
    currentPage = pageId;
    console.log(
      `Client ${socket.id} joined room: ${roomId} from page: ${currentPage}`
    );

    // Thêm thông tin người dùng vào room
    if (!roomUserInfo[roomId]) {
      roomUserInfo[roomId] = {}; // Tạo object cho room nếu chưa có
    }

    if (!roomUserInfo[roomId][pageId]) {
      roomUserInfo[roomId][pageId] = []; // Tạo danh sách người dùng cho pageId nếu chưa có
    }

    roomUserInfo[roomId][pageId].push({ socketId: socket.id });

    // Phát lại thông tin về số lượng người dùng từ từng trang
    io.to(roomId).emit("update-room-info", roomUserInfo[roomId]);

    // Phát sự kiện cho tất cả các client trong phòng về người mới tham gia
    io.to(roomId).emit("user-joined", {
      userId: socket.id,
      pageId: currentPage,
    });
  });

  // Nhận tin nhắn và phát lại cho các client khác trong cùng phòng
  socket.on("send-message", (data) => {
    const { roomId, message } = data;
    socket.to(roomId).emit("receive-message", { message, senderId: socket.id });
    console.log(`Message from ${socket.id} to room ${roomId}: ${message}`);
  });

  // Xử lý khi client ngắt kết nối
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    if (currentRoom) {
      roomUserInfo[currentRoom][currentPage] = roomUserInfo[currentRoom][
        currentPage
      ].filter((client) => client.socketId !== socket.id);

      // Phát lại số lượng người dùng trong phòng khi client ngắt kết nối
      io.to(currentRoom).emit("update-room-info", roomUserInfo[currentRoom]);
    }
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

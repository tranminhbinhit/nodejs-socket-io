const { WebcastPushConnection } = require("tiktok-live-connector");

// Quản lý kết nối TikTok theo socket
const tiktokConnections = {};

function tiktokConnection() {
  return Object.keys(tiktokConnections).map((key) => `${key}`);
}

// Hàm khởi tạo kết nối TikTok
function connectToTikTok(io, socket, roomId, username) {
  if (!username) return;
  if (tiktokConnections[username]) {
    const message = `${username} Đã kết nối. Ngắt kết nối để kết nối mới`;
    sendReceiveData(io, roomId, false, message);
    return;
  }

  // Tạo kết nối TikTok
  const configConnect = {
    processInitialData: true,
    enableWebsocketUpgrade: true,
    requestPollingIntervalMs: 2000,
    requestOptions: {
      timeout: 50000,
    },
    websocketOptions: {
      timeout: 50000,
    },
  };
  const tiktokLiveConnection = new WebcastPushConnection(username);
  //TODO nếu dùng socket
  //socket.id
  tiktokConnections[username] = tiktokLiveConnection;

  tiktokLiveConnection
    .connect()
    .then(() => {
      const message = `Đã kết nối tới TikTok: ${username}`;
      sendReceiveData(io, roomId, true, message);
    })
    .catch((err) => {
      const message = `Không thể kết nối với TikTok: ${err}`;
      delete tiktokConnections[username];
      sendReceiveData(io, roomId, false, message);
    });

  let joinedUsers = {}; // Lưu trạng thái người dùng đã join

  function tiktokDataSend(type, data, dataEx = {}) {
    const { uniqueId, nickname, profilePictureUrl, displayType } = data;
    io.to(roomId).emit("tiktok_data", {
      username: uniqueId,
      type: type,
      data: { nickname, profilePictureUrl, displayType },
      dataEx,
    });
  }

  function joinRoom(data) {
    tiktokDataSend("join_room", data);
  }

  // Bình luận
  tiktokLiveConnection.on("chat", (data) => {
    if (!joinedUsers[data.uniqueId]) {
      joinedUsers[data.uniqueId] = true;

      // Phát sự kiện join room
      joinRoom(data);
    }
    tiktokDataSend("new_comment", data, { comment: data.comment });
  });

  // Quà tặng
  tiktokLiveConnection.on("gift", (data) => {
    if (!joinedUsers[data.uniqueId]) {
      joinedUsers[data.uniqueId] = true;

      joinRoom(data);
    }

    tiktokDataSend("new_gift", data, {
      giftId: data.giftId,
      giftType: data.giftType,
      giftName: data.giftName,
      diamondCount: data.diamondCount,
      giftPictureUrl: data.giftPictureUrl,
    });

    console.log(`Quà tặng:`, `${data.uniqueId}: ${data.giftName} - ${data}`);
  });

  // Like
  tiktokLiveConnection.on("like", (data) => {
    if (!joinedUsers[data.uniqueId]) {
      joinedUsers[data.uniqueId] = true;

      joinRoom(data);
    }

    tiktokDataSend("new_like", data, {
      likeCount: data.likeCount,
      totalLikeCount: data.totalLikeCount,
    });
  });

  // Viewer mới
  tiktokLiveConnection.on("viewer", (data) => {
    tiktokDataSend("viewer", data);
  });

  // Tổng số người xem
  tiktokLiveConnection.on("roomUser", (data) => {
    //{ viewerCount: data.viewerCount }
  });

  // Livestream kết thúc
  tiktokLiveConnection.on("streamEnd", () => {
    //{ message: 'Livestream đã kết thúc.' }
  });

  // Theo dõi hoặc chia sẻ
  tiktokLiveConnection.on("social", (data) => {
    console.log(
      `Theo dõi hoặc chia sẻ:`,
      `${data.uniqueId}: ${data.displayType}`
    );
    tiktokDataSend("new_social_event", data, {
      eventType: data.eventType,
    });
  });

  // Biểu cảm
  tiktokLiveConnection.on("emote", (data) => {
    tiktokDataSend("new_emote", data, {
      emoteName: data.emoteName,
    });
  });
}

function sendReceiveData(io, roomId, status, message) {
  io.to(roomId).emit("receive-data", {
    tiktokLive: {
      status,
      message,
    },
    tiktokConnection: tiktokConnection()
  });
}

// Hàm ngắt kết nối TikTok
function disconnectTikTok(io, roomId, username) {
  let message = `Không có kết nối`;
  if (tiktokConnections[username]) {
    tiktokConnections[username].disconnect();
    delete tiktokConnections[username];
    message = `Đã ngắt kết nối TikTok của socket: ${username}`;
  }
  sendReceiveData(io, roomId, false, message);
}

module.exports = {
  connectToTikTok,
  disconnectTikTok,
  tiktokConnection,
};
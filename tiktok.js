const io = require('socket.io')(3000, {
  cors: {
      origin: "*", // Đặt domain của bạn tại đây
  }
});

const { WebcastPushConnection } = require('tiktok-live-connector');
let tiktokUsername = "vnsoi3";
let tiktokLiveConnection = new WebcastPushConnection(tiktokUsername);

tiktokLiveConnection.connect().then(() => {
  console.log(`Đã kết nối tới livestream của ${tiktokUsername}`);
}).catch(err => {
  console.error('Không thể kết nối:', err);
});

// Bình luận
tiktokLiveConnection.on('chat', data => {
  io.emit('new_comment', { username: data.uniqueId, comment: data.comment });
});

// Quà tặng
tiktokLiveConnection.on('gift', data => {
  io.emit('new_gift', {
      username: data.uniqueId,
      giftName: data.giftName,
      repeatCount: data.repeatCount,
      diamondCount: data.diamondCount
  });
});

// Like
tiktokLiveConnection.on('like', data => {
  io.emit('new_like', {
      username: data.uniqueId,
      likeCount: data.likeCount,
      totalLikeCount: data.totalLikeCount
  });
});

// Viewer mới
tiktokLiveConnection.on('viewer', data => {
  io.emit('new_viewer', {
      username: data.uniqueId,
      profilePicture: data.profilePictureUrl
  });
});

// Tổng số người xem
tiktokLiveConnection.on('roomUser', data => {
  io.emit('viewer_count', { viewerCount: data.viewerCount });
});

// Livestream kết thúc
tiktokLiveConnection.on('streamEnd', () => {
  io.emit('stream_ended', { message: 'Livestream đã kết thúc.' });
});

// Theo dõi hoặc chia sẻ
tiktokLiveConnection.on('social', data => {
  io.emit('new_social_event', {
      username: data.uniqueId,
      eventType: data.eventType // "follow" hoặc "share"
  });
});

// Biểu cảm
tiktokLiveConnection.on('emote', data => {
  io.emit('new_emote', {
      username: data.uniqueId,
      emoteName: data.emoteName
  });
});

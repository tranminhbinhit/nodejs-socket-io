const { WebcastPushConnection } = require('tiktok-live-connector');

// Quản lý kết nối TikTok theo socket
const tiktokConnections = {};

// Hàm khởi tạo kết nối TikTok
function connectToTikTok(username, socket) {
    if (!username) return;

    // Tạo kết nối TikTok
    const tiktokLiveConnection = new WebcastPushConnection(username);
    //TODO nếu dùng socket 
    // tiktokConnections[socket.id] = tiktokLiveConnection;

    tiktokLiveConnection.connect()
        .then(() => {
            console.log(`Đã kết nối tới TikTok Live của: ${username}`);
        })
        .catch(err => {
            console.error(`Không thể kết nối với TikTok: ${err}`);
            socket.emit('error', 'Kết nối thất bại. Vui lòng thử lại.');
        });

    let joinedUsers = {}; // Lưu trạng thái người dùng đã join

    function tiktokDataSend(type, data, dataEx = {}) {
        const { uniqueId, nickname, profilePictureUrl, displayType } = data;
        socket.emit('tiktok_data', {
            username: uniqueId,
            type: type,
            data: { nickname, profilePictureUrl, displayType },
            dataEx
        });
    }

    function joinRoom(data) {
        tiktokDataSend('join_room', data);
        console.log(`${data.uniqueId} đã tham gia room! =====================`);
    }

    // Bình luận
    tiktokLiveConnection.on('chat', data => {

        if (!joinedUsers[data.uniqueId]) {
            joinedUsers[data.uniqueId] = true;

            // Phát sự kiện join room
            joinRoom(data);
        }
        tiktokDataSend('new_comment', data, { comment: data.comment });

        console.log(`Bình luận:`, `${data.uniqueId}: ${data.comment}`);
    });

    // Quà tặng
    tiktokLiveConnection.on('gift', data => {
        if (!joinedUsers[data.uniqueId]) {
            joinedUsers[data.uniqueId] = true;

            joinRoom(data);
        }

        tiktokDataSend('new_gift', data, {
            giftName: data.giftName,
            repeatCount: data.repeatCount,
            diamondCount: data.diamondCount
        });

        console.log(`Quà tặng:`, `${data.uniqueId}: ${data.giftName} - ${data.diamondCount}`);
    });

    // Like
    tiktokLiveConnection.on('like', data => {
        if (!joinedUsers[data.uniqueId]) {
            joinedUsers[data.uniqueId] = true;

            joinRoom(data);
        }
        console.log(`like:`, `${data.uniqueId}: ${data.nickname}`);
        tiktokDataSend('new_like', data, {
            likeCount: data.likeCount,
            totalLikeCount: data.totalLikeCount
        });
    });

    // Viewer mới
    tiktokLiveConnection.on('viewer', data => {
        tiktokDataSend('viewer', data);
    });

    // Tổng số người xem
    tiktokLiveConnection.on('roomUser', data => {
        socket.emit('viewer_count', { viewerCount: data.viewerCount });
    });

    // Livestream kết thúc
    tiktokLiveConnection.on('streamEnd', () => {
        socket.emit('stream_ended', { message: 'Livestream đã kết thúc.' });
    });

    // Theo dõi hoặc chia sẻ
    tiktokLiveConnection.on('social', data => {
        socket.emit('new_social_event', {
            username: data.uniqueId,
            eventType: data.eventType // "follow" hoặc "share"
        });
        console.log(`Theo dõi hoặc chia sẻ:`, `${data.uniqueId}: ${data.displayType}`);
        tiktokDataSend('new_social_event', data, {
            eventType: data.eventType
        });
    });

    // Biểu cảm
    tiktokLiveConnection.on('emote', data => {
        tiktokDataSend('new_emote', data, {
            emoteName: data.emoteName
        });

        console.log(`Biểu cảm:`, `${data.uniqueId}: ${data.emoteName}`);
    });
}

// Hàm ngắt kết nối TikTok
function disconnectTikTok(socketId) {
    if (tiktokConnections[socketId]) {
        tiktokConnections[socketId].disconnect();
        delete tiktokConnections[socketId];
        console.log(`Đã ngắt kết nối TikTok của socket: ${socketId}`);
    }
}

module.exports = {
    connectToTikTok,
    disconnectTikTok
};

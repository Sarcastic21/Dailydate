const { createNotification } = require("./notificationService");

async function createStoredNotification(userId, { type, title, body, data }) {
    return await createNotification(userId, type, title, body, data);
}

module.exports = { createStoredNotification };

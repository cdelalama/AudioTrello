"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messages = void 0;
exports.messages = {
    welcome: {
        newUser: "👋 Welcome to AudioTrello Bot!\n\nThis bot helps you create tasks from voice messages. To use it, you need admin approval.",
        requestButton: "Request Approval 🔑",
        alreadyRequested: "⏳ Your registration is still pending approval. Please wait for an admin to approve your request.",
        banned: "❌ Sorry, you have been banned from using this bot.",
        approved: "✅ Welcome back! You're already registered and approved.",
        adminCreated: "👋 Welcome! You have been registered as the admin user.",
    },
    errors: {
        noUser: "❌ Error: Could not get user information",
        notAuthorized: "❌ You are not authorized to use this bot. Use /start to request access.",
        banned: "❌ You have been banned from using this bot.",
        registration: "❌ Error registering user. Please try again later.",
    },
    admin: {
        newRequest: (username, telegramId) => `🔔 New access request:\nUser: ${username}\nTelegram ID: ${telegramId}\n\nUse /approve ${telegramId} to grant access.`,
    },
};

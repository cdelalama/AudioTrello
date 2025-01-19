"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messages = void 0;
exports.messages = {
    welcome: {
        newUser: "👋 Welcome to AudioTrello!\n\nThis bot helps you manage tasks by converting voice messages into Trello cards. Tasks are automatically classified by duration and priority.\n\nTo start using the bot, please request approval from an administrator.",
        notApproved: "⌛ Your account is pending approval. Please request approval to use the bot.",
        requestButton: "Request Approval 🔑",
        alreadyRequested: "⏳ Your request is being processed by administrators. Please wait for their response.",
        banned: "❌ You have been banned from using this bot.",
        approved: "✅ Welcome back! Your account is approved.",
        adminCreated: "🎉 You have been registered as admin!",
    },
    errors: {
        noUser: "⚠️ Could not identify user.",
        banned: "❌ You are banned from using this bot.",
        notAuthorized: "⚠️ You are not authorized to use this bot.",
        registration: "⚠️ Error during registration.",
        generic: "⚠️ An error occurred. Please try again later.",
    },
    admin: {
        newRequest: (username, id) => `🆕 New user request:\nUsername: ${username}\nID: ${id}\n\nPlease choose an action:`,
    },
};

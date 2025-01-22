"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.helpMessages = void 0;
exports.helpMessages = {
    start: `🎯 *AudioTrello Bot - Turn your voice into tasks*

This bot allows you to:
• 🎤 Send voice messages that will be converted into tasks
• 📋 Automatically classify tasks by duration and priority
• 📌 Integrate tasks with your Trello boards

*Available commands:*
/start - Start the bot and register
/help - Show this help message

*Getting started:*
1. Register using /start
2. Wait for admin approval
3. Start sending voice messages!`,
    admin: `👑 *Admin Commands:*
/pending - View users pending approval
/approve <ID> - Approve a user
/ban <ID> - Ban/Unban a user`,
};

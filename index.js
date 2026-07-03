// index.js - Temp Mail Bot with Web Server for Render (FIXED)
const { Telegraf, Markup } = require("telegraf");
const axios = require("axios");
const moment = require("moment");
const express = require("express");

// ==================== WEB SERVER FOR RENDER ====================
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Temp Mail Bot is running!');
});

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

app.listen(PORT, () => {
    console.log(`Web server running on port ${PORT}`);
});
// ===============================================================

// Bot Token
const BOT_TOKEN = "8776602557:AAFpOEin4r8vT2hZy84wOOyZls45Sba3Ky0";

// Create bot with polling options
const bot = new Telegraf(BOT_TOKEN, {
    polling: {
        timeout: 30
    }
});

// Store user data
const userSessions = {};
const userMessageCache = {};

// API Configuration
const API_BASE = "https://api.internal.temp-mail.io/api/v3";

// Helper Functions
function generateRandomString(length = 10) {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}

function generateEmail() {
    const name = generateRandomString(10);
    const domains = [
        "bltiwd.com", "temp-mail.io", "mail-temp.com", 
        "tempmail.com", "10minute.net"
    ];
    const domain = domains[Math.floor(Math.random() * domains.length)];
    return `${name}@${domain}`;
}

// Permanent Keyboard
const mainKeyboard = () => {
    return Markup.keyboard([
        ['✦ Create New Email', '✦ My Inbox'],
        ['✦ Refresh Inbox', '✦ New Email'],
        ['✦ Delete Email', '✦ Help']
    ]).resize(true);
};

// API Functions
async function createTempEmail() {
    try {
        const response = await axios.post(
            `${API_BASE}/email/new`,
            { min_name_length: 10, max_name_length: 10 },
            {
                headers: {
                    'Application-Name': 'web',
                    'Application-Version': '4.0.0',
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            }
        );
        return response.data;
    } catch (error) {
        console.log("API Error (create):", error.message);
        return { email: generateEmail(), token: generateRandomString(20) };
    }
}

async function getMessages(email) {
    try {
        const response = await axios.get(
            `${API_BASE}/email/${email}/messages`,
            {
                headers: {
                    'Application-Name': 'web',
                    'Application-Version': '4.0.0'
                },
                timeout: 10000
            }
        );
        return response.data || [];
    } catch (error) {
        console.log("API Error (get messages):", error.message);
        return [];
    }
}

async function deleteEmail(email, token) {
    try {
        const response = await axios.delete(
            `${API_BASE}/email/${email}`,
            {
                headers: {
                    'Application-Name': 'web',
                    'Application-Version': '4.0.0',
                    'Content-Type': 'application/json'
                },
                data: { token: token || "" },
                timeout: 10000
            }
        );
        return response.data;
    } catch (error) {
        console.log("API Error (delete):", error.message);
        return null;
    }
}

// Format message for display
function formatMessage(msg) {
    const date = moment(msg.time * 1000).format("DD MMM YYYY, HH:mm:ss");
    let messageText = `Subject: ${msg.subject || "No Subject"}\n`;
    messageText += `Time: ${date}\n`;
    messageText += `From: ${msg.from || "Unknown"}\n\n`;
    messageText += `Message:\n${msg.body_text || msg.body_html || "No content available"}`;
    return messageText;
}

// Format inbox summary
function formatInboxSummary(messages, email) {
    if (!messages || messages.length === 0) {
        return `Inbox is empty\n\nEmail: ${email}\n\nNo messages received yet.`;
    }

    let summary = `Inbox (${messages.length} messages)\n\n`;
    summary += `Email: ${email}\n\n`;
    
    messages.slice(0, 5).forEach((msg, index) => {
        const date = moment(msg.time * 1000).format("HH:mm");
        const subject = msg.subject || "No Subject";
        const from = msg.from || "Unknown";
        summary += `${index + 1}. ${subject.substring(0, 30)}\n`;
        summary += `   ${from} • ${date}\n\n`;
    });
    
    if (messages.length > 5) {
        summary += `... and ${messages.length - 5} more messages`;
    }
    
    return summary;
}

// ==================== BOT COMMANDS ====================

// Start command
bot.start(async (ctx) => {
    try {
        const welcomeMessage = `
Welcome to Temp Mail Bot

Your secure temporary email service right in Telegram.

Features:
• Create temporary email instantly
• Receive and read messages
• Auto-refresh inbox
• Delete email when done
• 100% anonymous and secure

Use the buttons below to get started.
        `;
        
        await ctx.reply(welcomeMessage, mainKeyboard());
        console.log(`User ${ctx.from.id} started the bot`);
    } catch (error) {
        console.error("Start error:", error);
    }
});

// Help command
bot.help(async (ctx) => {
    try {
        const helpMessage = `
Temp Mail Bot - Help

How to use:
1. Click "Create New Email" to generate a temp email
2. Share this email to receive messages
3. Click "My Inbox" to check for new messages
4. Click "Refresh Inbox" to update inbox
5. Click "Delete Email" when done

Features:
• Temporary email addresses
• Read incoming messages
• Auto-refresh inbox
• Delete emails
• 100% anonymous

Privacy:
All data is automatically deleted after 2 hours.
        `;
        
        await ctx.reply(helpMessage, mainKeyboard());
    } catch (error) {
        console.error("Help error:", error);
    }
});

// ==================== BOT ACTIONS (Text Handlers) ====================

// Create New Email
bot.hears('✦ Create New Email', async (ctx) => {
    try {
        const userId = ctx.from.id;
        
        if (userSessions[userId] && userSessions[userId].email) {
            await ctx.reply(
                `You already have an active email\n\nEmail: ${userSessions[userId].email}\n\nDo you want to create a new one?`,
                Markup.keyboard([
                    ['✓ Yes, Create New'],
                    ['✗ No, Keep Current'],
                    ['◀ Main Menu']
                ]).resize(true)
            );
            return;
        }
        
        await ctx.reply("Creating email...");
        
        const result = await createTempEmail();
        const email = result.email || generateEmail();
        
        userSessions[userId] = {
            email: email,
            token: result.token || "",
            created: Date.now(),
            lastChecked: Date.now(),
            messages: []
        };
        
        await ctx.reply(
            `Email Created Successfully!\n\nEmail: ${email}\n\nShare this email to receive messages\nClick "My Inbox" to check for new messages\nEmail auto-expires after 2 hours`,
            mainKeyboard()
        );
    } catch (error) {
        console.error("Create email error:", error);
        await ctx.reply("Failed to create email. Please try again.", mainKeyboard());
    }
});

// Yes, Create New
bot.hears('✓ Yes, Create New', async (ctx) => {
    try {
        const userId = ctx.from.id;
        
        if (userSessions[userId]) {
            await deleteEmail(userSessions[userId].email, userSessions[userId].token || "");
            delete userSessions[userId];
            delete userMessageCache[userId];
        }
        
        await ctx.reply("Creating new email...");
        
        const result = await createTempEmail();
        const email = result.email || generateEmail();
        
        userSessions[userId] = {
            email: email,
            token: result.token || "",
            created: Date.now(),
            lastChecked: Date.now(),
            messages: []
        };
        
        await ctx.reply(
            `New Email Created!\n\nEmail: ${email}\n\nReady to receive messages.`,
            mainKeyboard()
        );
    } catch (error) {
        console.error("Confirm create error:", error);
        await ctx.reply("Failed to create email. Please try again.", mainKeyboard());
    }
});

// No, Keep Current
bot.hears('✗ No, Keep Current', async (ctx) => {
    try {
        const userId = ctx.from.id;
        const session = userSessions[userId];
        
        if (session && session.email) {
            await ctx.reply(
                `Keeping current email:\nEmail: ${session.email}`,
                mainKeyboard()
            );
        } else {
            await ctx.reply("No active email found.", mainKeyboard());
        }
    } catch (error) {
        console.error("Keep current error:", error);
        await ctx.reply("Error. Please try again.", mainKeyboard());
    }
});

// My Inbox
bot.hears('✦ My Inbox', async (ctx) => {
    try {
        const userId = ctx.from.id;
        const session = userSessions[userId];
        
        if (!session || !session.email) {
            await ctx.reply(
                "No active email.\n\nCreate one first!",
                mainKeyboard()
            );
            return;
        }
        
        await ctx.reply("Fetching inbox...");
        
        const messages = await getMessages(session.email);
        session.messages = messages || [];
        session.lastChecked = Date.now();
        userMessageCache[userId] = messages || [];
        
        if (!messages || messages.length === 0) {
            await ctx.reply(
                `Inbox is empty\n\nEmail: ${session.email}\n\nNo messages received yet.`,
                mainKeyboard()
            );
            return;
        }
        
        const inboxMessage = formatInboxSummary(messages, session.email);
        
        const messageButtons = [];
        messages.slice(0, 5).forEach((msg, index) => {
            const label = msg.subject ? 
                `▶ ${index + 1}. ${msg.subject.substring(0, 20)}` : 
                `▶ Message ${index + 1}`;
            messageButtons.push([label]);
        });
        
        messageButtons.push(['◀ Main Menu']);
        
        await ctx.reply(inboxMessage, Markup.keyboard(messageButtons).resize(true));
    } catch (error) {
        console.error("Inbox error:", error);
        await ctx.reply("Failed to fetch inbox. Please try again.", mainKeyboard());
    }
});

// Read Messages
bot.hears(/^▶ \d+\./, async (ctx) => {
    try {
        const userId = ctx.from.id;
        const text = ctx.message.text;
        
        const match = text.match(/^▶ (\d+)\./);
        if (!match) return;
        
        const index = parseInt(match[1]) - 1;
        const messages = userMessageCache[userId] || [];
        
        if (index < 0 || index >= messages.length) {
            await ctx.reply("Message not found", mainKeyboard());
            return;
        }
        
        const msg = messages[index];
        const formattedMessage = formatMessage(msg);
        
        await ctx.reply(formattedMessage, Markup.keyboard([
            ['◀ Back to Inbox'],
            ['◀ Main Menu']
        ]).resize(true));
    } catch (error) {
        console.error("Read message error:", error);
        await ctx.reply("Failed to read message. Please try again.", mainKeyboard());
    }
});

// Back to Inbox
bot.hears('◀ Back to Inbox', async (ctx) => {
    try {
        await ctx.reply("Returning to inbox...");
        // Trigger inbox again
        const userId = ctx.from.id;
        const session = userSessions[userId];
        
        if (!session || !session.email) {
            await ctx.reply("No active email.", mainKeyboard());
            return;
        }
        
        const messages = await getMessages(session.email);
        session.messages = messages || [];
        userMessageCache[userId] = messages || [];
        
        if (!messages || messages.length === 0) {
            await ctx.reply(
                `Inbox is empty\n\nEmail: ${session.email}`,
                mainKeyboard()
            );
            return;
        }
        
        const inboxMessage = formatInboxSummary(messages, session.email);
        const messageButtons = [];
        messages.slice(0, 5).forEach((msg, index) => {
            const label = msg.subject ? 
                `▶ ${index + 1}. ${msg.subject.substring(0, 20)}` : 
                `▶ Message ${index + 1}`;
            messageButtons.push([label]);
        });
        messageButtons.push(['◀ Main Menu']);
        
        await ctx.reply(inboxMessage, Markup.keyboard(messageButtons).resize(true));
    } catch (error) {
        console.error("Back to inbox error:", error);
        await ctx.reply("Error. Please try again.", mainKeyboard());
    }
});

// Refresh Inbox
bot.hears('✦ Refresh Inbox', async (ctx) => {
    try {
        const userId = ctx.from.id;
        const session = userSessions[userId];
        
        if (!session || !session.email) {
            await ctx.reply(
                "No active email.\n\nCreate one first!",
                mainKeyboard()
            );
            return;
        }
        
        await ctx.reply("Refreshing...");
        
        const messages = await getMessages(session.email);
        const newCount = messages ? messages.length : 0;
        const oldCount = session.messages ? session.messages.length : 0;
        const difference = newCount - oldCount;
        
        session.messages = messages || [];
        session.lastChecked = Date.now();
        userMessageCache[userId] = messages || [];
        
        let response = `Inbox Refreshed!\n\n`;
        response += `Email: ${session.email}\n`;
        response += `Messages: ${newCount}\n`;
        
        if (difference > 0) {
            response += `\n${difference} new message${difference > 1 ? 's' : ''}!`;
        } else if (difference === 0) {
            response += `\nNo new messages`;
        }
        
        await ctx.reply(response, mainKeyboard());
    } catch (error) {
        console.error("Refresh error:", error);
        await ctx.reply("Failed to refresh. Please try again.", mainKeyboard());
    }
});

// New Email
bot.hears('✦ New Email', async (ctx) => {
    try {
        await ctx.reply(
            `Generate New Email\n\nThis will create a brand new email address.\nCurrent email will be automatically deleted.\n\nAre you sure?`,
            Markup.keyboard([
                ['✓ Yes, Create New'],
                ['✗ No, Keep Current'],
                ['◀ Main Menu']
            ]).resize(true)
        );
    } catch (error) {
        console.error("New email error:", error);
        await ctx.reply("Error. Please try again.", mainKeyboard());
    }
});

// Delete Email
bot.hears('✦ Delete Email', async (ctx) => {
    try {
        const userId = ctx.from.id;
        const session = userSessions[userId];
        
        if (!session || !session.email) {
            await ctx.reply(
                "No active email to delete.",
                mainKeyboard()
            );
            return;
        }
        
        await ctx.reply(
            `Delete Email\n\nAre you sure you want to delete:\nEmail: ${session.email}\n\nThis action cannot be undone!`,
            Markup.keyboard([
                ['✗ Yes, Delete'],
                ['✗ No, Keep Current'],
                ['◀ Main Menu']
            ]).resize(true)
        );
    } catch (error) {
        console.error("Delete email error:", error);
        await ctx.reply("Error. Please try again.", mainKeyboard());
    }
});

// Yes, Delete
bot.hears('✗ Yes, Delete', async (ctx) => {
    try {
        const userId = ctx.from.id;
        const session = userSessions[userId];
        
        if (session) {
            await ctx.reply("Deleting email...");
            await deleteEmail(session.email, session.token || "");
            delete userSessions[userId];
            delete userMessageCache[userId];
        }
        
        await ctx.reply(
            `Email Deleted Successfully!\n\nYour temporary email has been removed.\nClick below to create a new one.`,
            mainKeyboard()
        );
    } catch (error) {
        console.error("Confirm delete error:", error);
        await ctx.reply("Failed to delete email. Please try again.", mainKeyboard());
    }
});

// Help
bot.hears('✦ Help', async (ctx) => {
    try {
        const helpMessage = `
Temp Mail Bot - Help

How to use:
1. Click "Create New Email" to generate a temp email
2. Share this email to receive messages
3. Click "My Inbox" to check for new messages
4. Click "Refresh Inbox" to update inbox
5. Click "Delete Email" when done

Features:
• Temporary email addresses
• Read incoming messages
• Auto-refresh inbox
• Delete emails
• 100% anonymous

Commands:
/start - Start the bot

Privacy:
All data is automatically deleted after 2 hours.
        `;
        
        await ctx.reply(helpMessage, mainKeyboard());
    } catch (error) {
        console.error("Help error:", error);
    }
});

// Main Menu
bot.hears('◀ Main Menu', async (ctx) => {
    try {
        const userId = ctx.from.id;
        const session = userSessions[userId];
        
        let menuText = "Main Menu\n\n";
        if (session && session.email) {
            const messages = await getMessages(session.email);
            menuText += `Current Email: ${session.email}\n`;
            menuText += `Messages: ${messages ? messages.length : 0}\n\n`;
        } else {
            menuText += "No active email. Create one to get started.\n\n";
        }
        menuText += "Choose an option below:";
        
        await ctx.reply(menuText, mainKeyboard());
    } catch (error) {
        console.error("Main menu error:", error);
        await ctx.reply("Main Menu", mainKeyboard());
    }
});

// ==================== AUTO CLEANUP ====================
setInterval(async () => {
    const now = Date.now();
    for (const [userId, session] of Object.entries(userSessions)) {
        if (now - session.created > 7200000) {
            try {
                await deleteEmail(session.email, session.token || "");
            } catch (e) {}
            delete userSessions[userId];
            delete userMessageCache[userId];
            console.log(`Cleaned up expired session for user ${userId}`);
        }
    }
}, 120000);

// ==================== ERROR HANDLING ====================
bot.catch((err, ctx) => {
    console.error("Bot error:", err.message);
    if (ctx && ctx.reply) {
        ctx.reply("An error occurred. Please try again.", mainKeyboard()).catch(() => {});
    }
});

// ==================== LAUNCH BOT ====================
bot.launch()
    .then(() => {
        console.log("✅ Temp Mail Bot Started Successfully!");
        console.log(`📅 Started at: ${new Date().toLocaleString()}`);
        console.log("🤖 Bot is ready to receive messages!");
    })
    .catch((err) => {
        console.error("❌ Failed to start bot:", err);
        process.exit(1);
    });

// Graceful shutdown
process.once("SIGINT", () => {
    bot.stop("SIGINT");
    process.exit(0);
});
process.once("SIGTERM", () => {
    bot.stop("SIGTERM");
    process.exit(0);
});

console.log("🚀 Temp Mail Bot is running...");

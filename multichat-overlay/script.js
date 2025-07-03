/* eslint-disable no-undef */
document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration Variables (These will eventually be set by URL parameters) ---
    let config = {
        address: '127.0.0.1',
        port: 8080,
        showPlatform: true,
        showAvatar: true,
        showUsername: true,
        showMessage: true,
        showTimestamps: true,
        showBadges: true,
        showPronouns: false,
        font: "'Roboto Condensed', sans-serif",
        fontSize: 30, // px
        lineSpacing: 1.7, // em
        background: '#000000', // for the body background or chat area
        opacity: 0.85, // for the body background or chat area
        hideAfter: 0, // seconds, 0 for never
        excludeCommands: true,
        ignoreChatters: [], // array of usernames
        scrollDirection: 1, // 0 for top-to-bottom, 1 for bottom-to-top
        groupConsecutiveMessages: false,
        inlineChat: false, // Experimental, not fully implemented for all messages
        imageEmbedPermissionLevel: 20, // Min permission level for image embeds in chat
        // Twitch Filters
        showTwitchMessages: true,
        showTwitchAnnouncements: true,
        showTwitchSubs: true,
        showTwitchChannelPointRedemptions: true,
        showTwitchRaids: true,
        showTwitchSharedChat: 2, // 0: None, 1: Chat Message Only, 2: Chat Message + Alert
        // YouTube Filters
        showYouTubeMessages: true,
        showYouTubeSuperChats: true,
        showYouTubeSuperStickers: true,
        showYouTubeMemberships: true,
        // Donation Filters
        showStreamlabsDonations: true,
        showStreamElementsTips: true,
        showPatreonMemberships: true,
        showKofiDonations: true,
        showTipeeeStreamDonations: true,
        showFourthwallAlerts: true,
        // Miscellaneous
        furryMode: false // Replaces 's' with 'f'
    };

    // --- DOM Elements ---
    const messageList = document.getElementById('messageList');
    const statusContainer = document.getElementById('statusContainer');
    const unmuteLabel = document.getElementById('unmute-label');

    // --- Audio Context for Unmute (if needed) ---
    let audioContext;
    let isMuted = true;

    if (unmuteLabel) {
        unmuteLabel.addEventListener('click', () => {
            if (audioContext && audioContext.state === 'suspended') {
                audioContext.resume();
            } else if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            isMuted = false;
            unmuteLabel.style.display = 'none';
        });
    }

    // --- Streamer.bot Client ---
    let client; // Declared here to be accessible globally within this script

    function initializeStreamerbotClient() {
        if (client) {
            // If already initialized, disconnect and reconnect to apply new settings
            client.ws.close();
        }
        client = new StreamerbotClient(config.address, config.port, true); // true for debug mode
        client.onConnect(() => {
            console.log("Connected to Streamer.bot!");
            if (statusContainer) {
                statusContainer.textContent = 'Connected!';
                statusContainer.style.opacity = '1';
                setTimeout(() => statusContainer.style.opacity = '0', 2000);
            }
            // Subscribe to relevant events
            client.subscribe(
                ["Twitch", "YouTube", "Streamlabs", "StreamElements", "Patreon", "Kofi", "TipeeeStream", "Fourthwall"],
                [
                    "ChatMessage", "Subscribe", "Resub", "GiftSub", "GiftBomb", "Raid", "Cheer", "ChannelPointReward", "Announcement",
                    "SuperChat", "SuperSticker", "Membership", "Donation", "Tip", "Pledge", "Coffee", "Alert"
                ]
            );
        });

        client.onDisconnect(() => {
            console.warn("Disconnected from Streamer.bot. Attempting to reconnect...");
            if (statusContainer) {
                statusContainer.textContent = 'Disconnected. Reconnecting...';
                statusContainer.style.opacity = '1';
            }
        });

        client.onEvent("Twitch", (eventType, data) => handleTwitchEvent(eventType, data));
        client.onEvent("YouTube", (eventType, data) => handleYouTubeEvent(eventType, data));
        client.onEvent("Streamlabs", (eventType, data) => handleDonationEvent("Streamlabs", eventType, data));
        client.onEvent("StreamElements", (eventType, data) => handleDonationEvent("StreamElements", eventType, data));
        client.onEvent("Patreon", (eventType, data) => handleDonationEvent("Patreon", eventType, data));
        client.onEvent("Kofi", (eventType, data) => handleDonationEvent("Kofi", eventType, data));
        client.onEvent("TipeeeStream", (eventType, data) => handleDonationEvent("TipeeeStream", eventType, data));
        client.onEvent("Fourthwall", (eventType, data) => handleDonationEvent("Fourthwall", eventType, data));
    }

    // --- Apply URL Parameters and Initialize ---
    function applyUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        let updatedConfig = {};

        // Iterate over existing config to know types and apply URL params
        for (const key in config) {
            if (urlParams.has(key)) {
                const paramValue = urlParams.get(key);
                // Type conversion
                if (typeof config[key] === 'boolean') {
                    updatedConfig[key] = paramValue === 'true';
                } else if (typeof config[key] === 'number') {
                    updatedConfig[key] = parseFloat(paramValue);
                } else if (Array.isArray(config[key])) {
                    updatedConfig[key] = paramValue.split(',').map(item => item.trim());
                } else {
                    updatedConfig[key] = paramValue;
                }
            } else {
                // Use default if not in URL
                updatedConfig[key] = config[key];
            }
        }
        config = updatedConfig; // Update global config

        // Apply styles based on config
        document.body.style.fontSize = `${config.fontSize}px`;
        document.body.style.background = `rgba(${parseInt(config.background.substring(1, 3), 16)}, ${parseInt(config.background.substring(3, 5), 16)}, ${parseInt(config.background.substring(5, 7), 16)}, ${config.opacity})`;
        document.body.style.fontFamily = config.font;

        if (messageList) {
            messageList.classList.remove('scroll-direction-0', 'scroll-direction-1');
            messageList.classList.add(`scroll-direction-${config.scrollDirection}`);
            messageList.style.lineHeight = `${config.lineSpacing}em`;
        }

        initializeStreamerbotClient();
    }

    // --- Message Processing & Display ---
    let lastMessageTimestamp = 0;
    let lastMessageSender = '';
    let lastMessageElement = null;

    function addMessageToChat(messageData) {
        if (!messageList) return;

        // Filtering based on config
        if (config.excludeCommands && messageData.message && messageData.message.startsWith('!')) {
            return; // Skip commands
        }
        if (config.ignoreChatters.includes(messageData.username.toLowerCase())) {
            return; // Skip ignored chatters
        }

        let messageElement = document.createElement('div');
        messageElement.classList.add('chat-message');

        // Group consecutive messages logic
        const currentTime = Date.now();
        const isConsecutive = config.groupConsecutiveMessages &&
                              (currentTime - lastMessageTimestamp < 5000) && // Within 5 seconds
                              (messageData.username === lastMessageSender);

        if (isConsecutive && lastMessageElement) {
            // Append to last message
            const messageContentDiv = lastMessageElement.querySelector('.message-content');
            if (messageContentDiv) {
                const newMessageSpan = document.createElement('span');
                newMessageSpan.textContent = ` ${messageData.message}`;
                messageContentDiv.appendChild(newMessageSpan);
            }
            lastMessageTimestamp = currentTime;
            return; // Don't create a new message element
        }

        // Create new message element
        lastMessageElement = messageElement;
        lastMessageSender = messageData.username;
        lastMessageTimestamp = currentTime;

        // Platform Icon
        if (config.showPlatform && messageData.platformIcon) {
            const platformIcon = document.createElement('img');
            platformIcon.classList.add('platform-icon');
            platformIcon.src = messageData.platformIcon;
            platformIcon.alt = messageData.platform;
            messageElement.appendChild(platformIcon);
        }

        // Avatar
        if (config.showAvatar && messageData.avatar) {
            const avatar = document.createElement('img');
            avatar.classList.add('avatar');
            avatar.src = messageData.avatar;
            avatar.alt = 'User Avatar';
            messageElement.appendChild(avatar);
        }

        // Message Content Div
        const contentDiv = document.createElement('div');
        contentDiv.classList.add('message-content');

        // Username
        if (config.showUsername && messageData.username) {
            const usernameSpan = document.createElement('span');
            usernameSpan.classList.add('username');
            usernameSpan.textContent = messageData.username;
            if (messageData.color) {
                usernameSpan.style.color = messageData.color;
            }
            contentDiv.appendChild(usernameSpan);
        }

        // Pronouns
        if (config.showPronouns && messageData.pronouns) {
            const pronounsSpan = document.createElement('span');
            pronounsSpan.classList.add('pronouns');
            pronounsSpan.textContent = ` (${messageData.pronouns})`;
            contentDiv.appendChild(pronounsSpan);
        }

        // Badges (for Twitch)
        if (config.showBadges && messageData.badges && messageData.platform === 'Twitch') {
            messageData.badges.forEach(badge => {
                const badgeImg = document.createElement('img');
                badgeImg.classList.add('badge-icon');
                badgeImg.src = badge.url;
                badgeImg.alt = badge.name;
                contentDiv.appendChild(badgeImg);
            });
        }

        // Timestamp
        if (config.showTimestamps && messageData.timestamp) {
            const timestampSpan = document.createElement('span');
            timestampSpan.classList.add('timestamp');
            timestampSpan.textContent = ` [${new Date(messageData.timestamp).toLocaleTimeString()}]`;
            contentDiv.appendChild(timestampSpan);
        }
        
        // Message Text
        if (config.showMessage && messageData.message) {
            let messageText = messageData.message;
            if (config.furryMode) {
                messageText = messageText.replace(/s/g, 'f').replace(/S/g, 'F');
            }

            const messageTextSpan = document.createElement('span');
            messageTextSpan.classList.add('text');
            messageTextSpan.innerHTML = processMessageForEmojisAndUrls(messageText, messageData.emotes);
            contentDiv.appendChild(messageTextSpan);
        }

        messageElement.appendChild(contentDiv);
        messageList.appendChild(messageElement);

        // Auto-hide messages
        if (config.hideAfter > 0) {
            setTimeout(() => {
                messageElement.style.opacity = '0';
                messageElement.style.transform = 'translateY(-20px)'; // Optional: slight upward fade
                messageElement.addEventListener('transitionend', () => messageElement.remove());
            }, config.hideAfter * 1000);
        }

        // Keep chat scrolled to bottom or top
        if (config.scrollDirection === 1) { // Bottom to Top
            messageList.scrollTop = messageList.scrollHeight;
        } else { // Top to Bottom
            messageList.scrollTop = 0;
        }
    }

    function processMessageForEmojisAndUrls(text, emotes) {
        let processedText = text;

        // Process emotes first to replace actual emote strings with image tags
        if (emotes && emotes.length > 0) {
            // Sort emotes by position to avoid issues when replacing substrings
            emotes.sort((a, b) => a.start - b.start);
            let offset = 0; // Adjust offset as string length changes

            for (const emote of emotes) {
                const { name, imageUrl, start, end } = emote;
                const actualStart = start + offset;
                const actualEnd = end + offset + 1; // end is inclusive

                const before = processedText.substring(0, actualStart);
                const after = processedText.substring(actualEnd);
                const emoteHtml = `<img src="${imageUrl}" alt="${name}" class="chat-emote">`;

                processedText = before + emoteHtml + after;
                offset += (emoteHtml.length - (end - start + 1)); // Adjust offset for next emote
            }
        }

        // Process URLs after emotes
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        processedText = processedText.replace(urlRegex, (url) => {
            return `<a href="${url}" target="_blank" class="chat-link">${url}</a>`;
        });

        // Image Embeds (basic check for image URLs) - requires permission level
        if (config.imageEmbedPermissionLevel > 0 && typeof isViewerAtLeastPermissionLevel === 'function') { // Check if permission level func exists
            // This part might need the actual user's permission level, which is not available here.
            // This is a placeholder and usually requires a server-side check or a more complex client-side setup.
            // For simplicity, we'll assume the URL itself is the trigger, but in reality, you'd check messageData.permission
            const imageRegex = /(https?:\/\/[^\s]+\.(?:png|jpe?g|gif|webp)(\?.*)?)$/i;
            if (processedText.match(imageRegex)) {
                // In a real scenario, you'd have the user's permission level (e.g., from `data.user.permission` in Streamer.bot)
                // For now, if the config is set, it means we want to show them.
                // The actual check for `isViewerAtLeastPermissionLevel` would need `data.user` from the message.
                // Since this `script.js` processes already received data, we'd need to pass permission info.
                // Let's simplify this part for now.
                const imageUrlMatch = processedText.match(imageRegex);
                if (imageUrlMatch && imageUrlMatch[0]) {
                    const imageUrl = imageUrlMatch[0];
                    return `<img src="${imageUrl}" class="chat-image-embed" alt="Embedded Image" onerror="this.style.display='none'">`;
                }
            }
        }
        
        return processedText;
    }


    // --- Event Handlers for Streamer.bot ---

    function handleTwitchEvent(eventType, data) {
        let messageData = { platform: 'Twitch' };
        messageData.platformIcon = './icons/twitch.png'; // Assuming icons are in this path

        switch (eventType) {
            case 'ChatMessage':
                if (!config.showTwitchMessages) return;
                messageData.username = data.user.displayName;
                messageData.message = data.message;
                messageData.avatar = data.user.avatar;
                messageData.color = data.user.color;
                messageData.emotes = data.messageEmotes ? data.messageEmotes.map(e => ({ name: e.name, imageUrl: e.imageUrl, start: e.startIndex, end: e.endIndex })) : [];
                messageData.badges = data.user.badges ? data.user.badges.map(b => ({ name: b.name, url: b.imageUrl })) : [];
                messageData.pronouns = data.user.pronouns;
                messageData.timestamp = Date.now();
                addMessageToChat(messageData);
                break;
            case 'Announcement':
                 if (!config.showTwitchAnnouncements) return;
                 messageData.username = data.user.displayName;
                 messageData.message = `[ANNOUNCEMENT] ${data.message}`; // Prefix for clarity
                 messageData.avatar = data.user.avatar;
                 messageData.color = data.user.color;
                 messageData.timestamp = Date.now();
                 addMessageToChat(messageData);
                 break;
            case 'Subscribe':
            case 'Resub':
            case 'GiftSub':
            case 'GiftBomb':
                if (!config.showTwitchSubs) return;
                const subTier = data.subTier ? `Tier ${data.subTier.replace(/(\d+)/, '$1 ')} ` : ''; // e.g., Tier 1, Tier 2
                let subMessage = '';
                if (eventType === 'Subscribe') {
                    subMessage = `${data.user.displayName} just subscribed!`;
                } else if (eventType === 'Resub') {
                    subMessage = `${data.user.displayName} resubscribed for ${data.months} months!`;
                    if (data.message) subMessage += ` Message: "${data.message}"`;
                } else if (eventType === 'GiftSub') {
                    subMessage = `${data.gifter.displayName} gifted a ${subTier}sub to ${data.recipient.displayName}!`;
                } else if (eventType === 'GiftBomb') {
                    subMessage = `${data.gifter.displayName} gifted ${data.totalSubs} subs!`;
                }
                messageData.username = data.user ? data.user.displayName : (data.gifter ? data.gifter.displayName : 'Twitch');
                messageData.message = `[SUB] ${subMessage}`;
                messageData.avatar = data.user ? data.user.avatar : (data.gifter ? data.gifter.avatar : './icons/twitch.png');
                messageData.color = data.user ? data.user.color : (data.gifter ? data.gifter.color : '');
                messageData.timestamp = Date.now();
                addMessageToChat(messageData);
                break;
            case 'ChannelPointReward':
                if (!config.showTwitchChannelPointRedemptions) return;
                messageData.username = data.user.displayName;
                messageData.message = `[REDEMPTION] ${data.reward.name}: ${data.message || ''}`;
                messageData.avatar = data.user.avatar;
                messageData.color = data.user.color;
                messageData.timestamp = Date.now();
                addMessageToChat(messageData);
                break;
            case 'Raid':
                if (!config.showTwitchRaids) return;
                messageData.username = data.raider.displayName;
                messageData.message = `[RAID] ${data.raider.displayName} raided with ${data.viewers} viewers!`;
                messageData.avatar = data.raider.avatar;
                messageData.color = data.raider.color;
                messageData.timestamp = Date.now();
                addMessageToChat(messageData);
                break;
            // Add other Twitch events as needed
            default:
                // console.log(`Unhandled Twitch event: ${eventType}`, data);
                break;
        }
    }

    function handleYouTubeEvent(eventType, data) {
        let messageData = { platform: 'YouTube' };
        messageData.platformIcon = './icons/youtube.png'; // Assuming icons are in this path

        switch (eventType) {
            case 'ChatMessage':
                if (!config.showYouTubeMessages) return;
                messageData.username = data.user.displayName;
                messageData.message = data.message;
                messageData.avatar = data.user.avatar;
                messageData.color = data.user.color;
                messageData.timestamp = Date.now();
                addMessageToChat(messageData);
                break;
            case 'SuperChat':
                if (!config.showYouTubeSuperChats) return;
                messageData.username = data.user.displayName;
                messageData.message = `[SUPER CHAT] ${data.amount} ${data.currency}: ${data.message || ''}`;
                messageData.avatar = data.user.avatar;
                messageData.color = data.user.color; // Super Chats often have specific colors
                messageData.timestamp = Date.now();
                addMessageToChat(messageData);
                break;
            case 'SuperSticker':
                if (!config.showYouTubeSuperStickers) return;
                messageData.username = data.user.displayName;
                messageData.message = `[SUPER STICKER] ${data.amount} ${data.currency} - ${data.stickerName}`;
                if (data.stickerUrl) {
                    messageData.message += ` <img src="${data.stickerUrl}" class="chat-sticker" alt="Super Sticker">`;
                }
                messageData.avatar = data.user.avatar;
                messageData.color = data.user.color;
                messageData.timestamp = Date.now();
                addMessageToChat(messageData);
                break;
            case 'Membership':
                if (!config.showYouTubeMemberships) return;
                messageData.username = data.user.displayName;
                messageData.message = `[MEMBERSHIP] ${data.user.displayName} became a member!`;
                messageData.avatar = data.user.avatar;
                messageData.color = data.user.color;
                messageData.timestamp = Date.now();
                addMessageToChat(messageData);
                break;
            default:
                // console.log(`Unhandled YouTube event: ${eventType}`, data);
                break;
        }
    }

    function handleDonationEvent(platform, eventType, data) {
        let messageData = { platform: platform };
        messageData.platformIcon = `./icons/${platform.toLowerCase()}.png`; // e.g., streamlabs.png

        let showDonation = false;
        switch (platform) {
            case 'Streamlabs': showDonation = config.showStreamlabsDonations; break;
            case 'StreamElements': showDonation = config.showStreamElementsTips; break;
            case 'Patreon': showDonation = config.showPatreonMemberships; break;
            case 'Kofi': showDonation = config.showKofiDonations; break;
            case 'TipeeeStream': showDonation = config.showTipeeeStreamDonations; break;
            case 'Fourthwall': showDonation = config.showFourthwallAlerts; break;
        }
        if (!showDonation) return;

        let amount = data.amount || data.totalAmount || ''; // Streamlabs/Elements vs Ko-fi/Patreon
        let currency = data.currency || '';
        let displayAmount = amount ? `${amount} ${currency}`.trim() : '';

        let donationMessage = '';
        switch (eventType) {
            case 'Donation': // Streamlabs
            case 'Tip': // StreamElements
            case 'Coffee': // Ko-fi
            case 'Alert': // Fourthwall
                donationMessage = `[DONATION] ${data.name} donated ${displayAmount}!`;
                if (data.message) donationMessage += ` Message: "${data.message}"`;
                break;
            case 'Pledge': // Patreon
                donationMessage = `[PATREON] ${data.user.name} pledged ${displayAmount}!`;
                break;
            default:
                console.log(`Unhandled ${platform} event: ${eventType}`, data);
                return;
        }

        messageData.username = data.name || (data.user ? data.user.name : platform);
        messageData.message = donationMessage;
        // Donations typically don't have avatars directly from SB, might need custom logic
        messageData.avatar = ''; // Default or a placeholder icon
        messageData.timestamp = Date.now();
        addMessageToChat(messageData);
    }


    // --- Initial setup when DOM is loaded ---
    applyUrlParameters(); // This will also initialize the StreamerbotClient
});
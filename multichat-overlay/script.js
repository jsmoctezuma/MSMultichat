////////////////
// PARAMETERS //
////////////////

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);

const sbServerAddress = urlParams.get("address") || "127.0.0.1";
const sbServerPort = urlParams.get("port") || "8080";
const avatarMap = new Map();
const pronounMap = new Map();

/////////////
// OPTIONS //
/////////////

const showPlatform = GetBooleanParam("showPlatform", true);
const showAvatar = GetBooleanParam("showAvatar", true);
const showTimestamps = GetBooleanParam("showTimestamps", true);
const showBadges = GetBooleanParam("showBadges", true);
const showPronouns = GetBooleanParam("showPronouns", false);
const showUsername = GetBooleanParam("showUsername", true);
const showMessage = GetBooleanParam("showMessage", true);
const font = urlParams.get("font") || "";
const fontSize = urlParams.get("fontSize") || "30";
const lineSpacing = urlParams.get("lineSpacing") || "1.7";
const background = urlParams.get("background") || "#000000";
const opacity = urlParams.get("opacity") || "0.85";

const hideAfter = GetIntParam("hideAfter", 0);
const excludeCommands = GetBooleanParam("excludeCommands", true);
const ignoreChatters = urlParams.get("ignoreChatters") || "";
const scrollDirection = GetIntParam("scrollDirection", 1);
const groupConsecutiveMessages = GetBooleanParam("groupConsecutiveMessages", false);
const inlineChat = GetBooleanParam("inlineChat", false);
const imageEmbedPermissionLevel = GetIntParam("imageEmbedPermissionLevel", 20);

// Twitch
const showTwitchMessages = GetBooleanParam("showTwitchMessages", true);
const showTwitchAnnouncements = GetBooleanParam("showTwitchAnnouncements", true);
const showTwitchSubs = GetBooleanParam("showTwitchSubs", true);
const showTwitchChannelPointRedemptions = GetBooleanParam("showTwitchChannelPointRedemptions", true);
const showTwitchRaids = GetBooleanParam("showTwitchRaids", true);
const showTwitchSharedChat = GetIntParam("showTwitchSharedChat", 2);

// YouTube
const showYouTubeMessages = GetBooleanParam("showYouTubeMessages", true);
const showYouTubeSuperChats = GetBooleanParam("showYouTubeSuperChats", true);
const showYouTubeSuperStickers = GetBooleanParam("showYouTubeSuperStickers", true);
const showYouTubeMemberships = GetBooleanParam("showYouTubeMemberships", true);

// Donations
const showStreamlabsDonations = GetBooleanParam("showStreamlabsDonations", true);
const showStreamElementsTips = GetBooleanParam("showStreamElementsTips", true);
const showPatreonMemberships = GetBooleanParam("showPatreonMemberships", true);
const showKofiDonations = GetBooleanParam("showKofiDonations", true);
const showTipeeeStreamDonations = GetBooleanParam("showTipeeeStreamDonations", true);
const showFourthwallAlerts = GetBooleanParam("showFourthwallAlerts", true);

// Misc
const furryMode = GetBooleanParam("furryMode", false);

/////////////
// GLOBALS //
/////////////

const messageList = document.getElementById("messageList");
const statusContainer = document.getElementById("statusContainer");
let currentMessages = 0;

//////////////////////
// HELPER FUNCTIONS //
//////////////////////

function GetBooleanParam(paramName, defaultValue) {
	const urlParams = new URLSearchParams(window.location.search);
	const paramValue = urlParams.get(paramName);

	if (paramValue === null) {
		return defaultValue; // Parameter not found
	}

	const lowercaseValue = paramValue.toLowerCase(); // Handle case-insensitivity

	if (lowercaseValue === 'true') {
		return true;
	} else if (lowercaseValue === 'false') {
		return false;
	} else {
		// If the parameter is present but not 'true' or 'false',
		// return the default value or handle as an error
		console.warn(`Invalid boolean value for parameter '${paramName}': '${paramValue}'. Using default: ${defaultValue}`);
		return defaultValue;
	}
}

function GetIntParam(paramName, defaultValue) {
	const urlParams = new URLSearchParams(window.location.search);
	const paramValue = urlParams.get(paramName);

	if (paramValue === null) {
		return defaultValue; // Parameter not found
	}

	const intValue = parseInt(paramValue, 10); // Parse as base 10 integer

	if (isNaN(intValue)) {
		console.warn(`Invalid integer value for parameter '${paramName}': '${paramValue}'. Using default: ${defaultValue}`);
		return defaultValue; // Or handle the error in another way
	}

	return intValue;
}

function GetColorParam(paramName, defaultValue) {
	const urlParams = new URLSearchParams(window.location.search);
	const paramValue = urlParams.get(paramName);
	if (paramValue === null) {
		return defaultValue;
	}
	return `#${paramValue.replace(/%23/g, '')}`; // Decode %23 back to #
}

function GetStringParam(paramName, defaultValue) {
	const urlParams = new URLSearchParams(window.location.search);
	const paramValue = urlParams.get(paramName);
	if (paramValue === null) {
		return defaultValue;
	}
	return paramValue;
}

//////////////////////////
// MESSAGE MANIPULATION //
//////////////////////////

function AddMessageItem(instance, msgId, platformName, username) {
	const messageItem = instance.querySelector("#messageItem");
	if (hideAfter > 0) {
		setTimeout(() => {
			messageItem.style.opacity = 0; // Fade out
			messageItem.addEventListener("transitionend", () => {
				if (messageItem.parentNode) {
					messageItem.parentNode.removeChild(messageItem);
					currentMessages--;
				}
			}, {
				once: true
			});
		}, hideAfter * 1000); // Convert seconds to milliseconds
	}
	messageItem.setAttribute("data-msg-id", msgId);
	messageItem.setAttribute("data-platform", platformName);
	messageItem.setAttribute("data-username", username);
	messageList.appendChild(instance);
	currentMessages++;
}

// Function to find an existing message by its ID
function FindMessageItemById(msgId) {
	return document.querySelector(`[data-msg-id="${msgId}"]`);
}

function GetOrCreateAvatar(url) {
	if (avatarMap.has(url)) {
		return avatarMap.get(url).cloneNode(true); // Return a clone
	}
	const img = new Image();
	img.src = url;
	avatarMap.set(url, img);
	return img.cloneNode(true);
}

function GetOrCreatePronouns(pronouns) {
	if (pronounMap.has(pronouns)) {
		return pronounMap.get(pronouns).cloneNode(true); // Return a clone
	}
	const span = document.createElement("span");
	span.textContent = `(${pronouns})`;
	pronounMap.set(pronouns, span);
	return span.cloneNode(true);
}

///////////////////
// MESSAGE TYPES //
///////////////////

function ChatMessage(data) {
	// Skip if empty message
	if (!data.message) {
		return;
	}

	// Filter out commands if enabled
	if (excludeCommands && data.message.startsWith('!')) {
		return;
	}

	// Filter out ignored chatters
	const ignored = ignoreChatters.split(',').map(name => name.trim().toLowerCase());
	if (ignored.includes(data.username.toLowerCase())) {
		return;
	}

	// Get a reference to the template
	const template = document.getElementById('messageTemplate');

	// Create a new instance of the template
	const instance = template.content.cloneNode(true);

	// Get divs
	const cardDiv = instance.querySelector("#card");
	const platformDiv = instance.querySelector("#platform");
	const avatarDiv = instance.querySelector("#avatar");
	const badgesDiv = instance.querySelector("#badges");
	const usernameDiv = instance.querySelector("#username");
	const pronounsDiv = instance.querySelector("#pronouns");
	const timestampsDiv = instance.querySelector("#timestamps");
	const contentDiv = instance.querySelector("#content");

	// Apply custom font if set
	if (font) {
		document.body.style.fontFamily = font;
	}

	// Set the card background color based on platform
	cardDiv.classList.add(data.platform.name.toLowerCase());
	cardDiv.style.background = `rgba(0, 0, 0, ${opacity})`;


	// Render platform
	if (showPlatform) {
		const platformImg = new Image();
		platformImg.src = data.platform.icon;
		platformImg.classList.add("platform");
		platformDiv.appendChild(platformImg);
	} else {
		platformDiv.style.display = `none`;
	}

	// Render avatars
	if (showAvatar && data.avatar) {
		const avatarImg = GetOrCreateAvatar(data.avatar);
		avatarDiv.appendChild(avatarImg);
	} else {
		avatarDiv.style.display = `none`;
	}

	// Render badges
	if (showBadges && data.badges && data.badges.length > 0) {
		data.badges.forEach(badgeUrl => {
			const badgeImg = new Image();
			badgeImg.src = badgeUrl;
			badgeImg.classList.add("badge");
			badgesDiv.appendChild(badgeImg);
		});
	} else {
		badgesDiv.style.display = `none`;
	}

	// Render username
	if (showUsername) {
		usernameDiv.textContent = data.displayName;
		if (furryMode) {
			usernameDiv.innerHTML = usernameDiv.innerHTML.replace(/s/g, "f");
		}
	} else {
		usernameDiv.style.display = `none`;
	}

	// Render pronouns
	if (showPronouns && data.pronouns) {
		const pronounsSpan = GetOrCreatePronouns(data.pronouns);
		pronounsDiv.appendChild(pronounsSpan);
	} else {
		pronounsDiv.style.display = `none`;
	}

	// Render timestamps
	if (showTimestamps) {
		timestampsDiv.textContent = data.time;
	} else {
		timestampsDiv.style.display = `none`;
	}

	// Render message content
	if (showMessage) {
		contentDiv.innerHTML = data.message;
		if (furryMode) {
			contentDiv.innerHTML = contentDiv.innerHTML.replace(/s/g, "f");
		}
	} else {
		contentDiv.style.display = `none`;
	}

	// Handle inline chat
	if (inlineChat) {
		const header = instance.querySelector("#header");
		const content = instance.querySelector("#content");
		header.style.display = "inline"; // Or 'inline-flex' if you use flexbox for header
		content.style.display = "inline";
		// You might need to adjust margin/padding to make them truly inline
		content.style.paddingTop = "0"; // Remove top padding
		header.style.verticalAlign = "top"; // Align header to top if inline
		content.style.verticalAlign = "top"; // Align content to top if inline
	}


	// Group consecutive messages
	if (groupConsecutiveMessages) {
		const lastMessage = messageList.firstElementChild; // Get the last added message
		if (lastMessage) {
			const lastUsername = lastMessage.getAttribute("data-username");
			const lastPlatform = lastMessage.getAttribute("data-platform");

			if (lastUsername === data.username && lastPlatform === data.platform.name) {
				// If the same user from the same platform sent the last message,
				// append the new message to the existing message's content
				const lastMessageContent = lastMessage.querySelector("#content");
				lastMessageContent.innerHTML += `<br>${data.message}`;
				if (hideAfter > 0) {
					// Reset the hide timer for the grouped message
					clearTimeout(lastMessage.hideTimer);
					lastMessage.hideTimer = setTimeout(() => {
						lastMessage.style.opacity = 0;
						lastMessage.addEventListener("transitionend", () => {
							if (lastMessage.parentNode) {
								lastMessage.parentNode.removeChild(lastMessage);
								currentMessages--;
							}
						}, {
							once: true
						});
					}, hideAfter * 1000);
				}
				return; // Don't add a new message item
			}
		}
	}

	AddMessageItem(instance, data.msgId, data.platform.name, data.username);
}

function ImageMessage(data) {
	// Skip if user's permission level is too low
	if (data.permission < imageEmbedPermissionLevel) {
		return;
	}

	// Get a reference to the template
	const template = document.getElementById('imageTemplate');

	// Create a new instance of the template
	const instance = template.content.cloneNode(true);

	// Get divs
	const cardDiv = instance.querySelector("#card");
	const platformDiv = instance.querySelector("#platform");
	const avatarDiv = instance.querySelector("#avatar");
	const badgesDiv = instance.querySelector("#badges");
	const usernameDiv = instance.querySelector("#username");
	const pronounsDiv = instance.querySelector("#pronouns");
	const timestampsDiv = instance.querySelector("#timestamps");
	const imageDiv = instance.querySelector("#image");

	// Apply custom font if set
	if (font) {
		document.body.style.fontFamily = font;
	}

	// Set the card background color based on platform
	cardDiv.classList.add(data.platform.name.toLowerCase());
	cardDiv.style.background = `rgba(0, 0, 0, ${opacity})`;


	// Render platform
	if (showPlatform) {
		const platformImg = new Image();
		platformImg.src = data.platform.icon;
		platformImg.classList.add("platform");
		platformDiv.appendChild(platformImg);
	} else {
		platformDiv.style.display = `none`;
	}

	// Render avatars
	if (showAvatar && data.avatar) {
		const avatarImg = GetOrCreateAvatar(data.avatar);
		avatarDiv.appendChild(avatarImg);
	} else {
		avatarDiv.style.display = `none`;
	}

	// Render badges
	if (showBadges && data.badges && data.badges.length > 0) {
		data.badges.forEach(badgeUrl => {
			const badgeImg = new Image();
			badgeImg.src = badgeUrl;
			badgeImg.classList.add("badge");
			badgesDiv.appendChild(badgeImg);
		});
	} else {
		badgesDiv.style.display = `none`;
	}

	// Render username
	if (showUsername) {
		usernameDiv.textContent = data.displayName;
		if (furryMode) {
			usernameDiv.innerHTML = usernameDiv.innerHTML.replace(/s/g, "f");
		}
	} else {
		usernameDiv.style.display = `none`;
	}

	// Render pronouns
	if (showPronouns && data.pronouns) {
		const pronounsSpan = GetOrCreatePronouns(data.pronouns);
		pronounsDiv.appendChild(pronounsSpan);
	} else {
		pronounsDiv.style.display = `none`;
	}

	// Render timestamps
	if (showTimestamps) {
		timestampsDiv.textContent = data.time;
	} else {
		timestampsDiv.style.display = `none`;
	}

	// Render image
	imageDiv.src = data.message;


	AddMessageItem(instance, data.msgId, data.platform.name, data.username);
}

function CustomAlert(data) {
	// Get a reference to the template
	const template = document.getElementById('alertTemplate');

	// Create a new instance of the template
	const instance = template.content.cloneNode(true);

	// Get divs
	const cardDiv = instance.querySelector("#card");
	const iconDiv = instance.querySelector("#icon");
	const titleDiv = instance.querySelector("#title");
	const contentDiv = instance.querySelector("#content");


	// Set the card background colors
	cardDiv.classList.add(data.type.toLowerCase());
	cardDiv.style.background = `rgba(0, 0, 0, ${opacity})`;


	// Set the card header
	const icon = new Image();
	icon.src = data.icon;
	icon.classList.add("badge");
	iconDiv.appendChild(icon);

	// Set the title
	titleDiv.textContent = data.title;

	// Set the text
	contentDiv.innerHTML = data.content;


	AddMessageItem(instance, data.msgId, data.type, "Alert");
}


///////////////
// STREAMBOT //
///////////////

const ws = new Streamerbot.Client({
	host: sbServerAddress,
	port: sbServerPort,
	endpoint: "/",
	autoConnect: true,
	onConnect: () => {
		console.log("Connected to Streamer.bot");
		statusContainer.textContent = "Connected!";
		statusContainer.style.background = "rgb(47, 183, 116)";
		statusContainer.style.opacity = 0;
	},
	onDisconnect: () => {
		console.log("Disconnected from Streamer.bot");
		statusContainer.textContent = "Disconnected!";
		statusContainer.style.background = "rgb(209, 32, 37)";
		statusContainer.style.opacity = 1;
	},
	onEvent: (event) => {
		console.log("Event:", event.data);
		let data = event.data;

		// Convert platform to name if it's an object
		if (typeof data.platform === 'object' && data.platform !== null) {
			data.platform.name = Object.keys(data.platform)[0]; // Get the first key as platform name
			// Use a simple icon for now, real icons would need a map
			data.platform.icon = `./icons/${data.platform.name.toLowerCase()}.png`; // Placeholder for icon path
		}


		// Chat Messages
		if (data.type === "ChatMessage") {
			// Platform filters
			if (data.platform.name === "Twitch" && !showTwitchMessages) return;
			if (data.platform.name === "YouTube" && !showYouTubeMessages) return;

			ChatMessage(data);
		}

		// Image Messages
		if (data.type === "ImageMessage") {
			ImageMessage(data);
		}

		// Twitch Announcements
		if (data.type === "TwitchAnnounce" && showTwitchAnnouncements) {
			CustomAlert({
				msgId: data.msgId,
				type: data.type,
				title: "Twitch Announcement",
				content: `Announced: ${data.message}`,
				icon: "./icons/twitch.png",
				background: data.color || "linear-gradient(#6d5ca1BF, #9146ffBF)"
			});
		}

		// Twitch Subscriptions
		if (data.type === "TwitchSub" && showTwitchSubs) {
			CustomAlert({
				msgId: data.msgId,
				type: data.type,
				title: "Twitch Subscription",
				content: `${data.displayName} just subscribed!`,
				icon: "./icons/twitch.png",
				background: "linear-gradient(#6d5ca1BF, #9146ffBF)"
			});
		}

		// Twitch Channel Point Redemptions
		if (data.type === "TwitchReward" && showTwitchChannelPointRedemptions) {
			CustomAlert({
				msgId: data.msgId,
				type: data.type,
				title: "Channel Point Redemption",
				content: `${data.displayName} redeemed "${data.rewardTitle}"`,
				icon: "./icons/twitch.png",
				background: "linear-gradient(#6d5ca1BF, #9146ffBF)"
			});
		}

		// Twitch Raids
		if (data.type === "TwitchRaid" && showTwitchRaids) {
			CustomAlert({
				msgId: data.msgId,
				type: data.type,
				title: "Twitch Raid",
				content: `${data.displayName} is raiding with ${data.viewers} viewers!`,
				icon: "./icons/twitch.png",
				background: "linear-gradient(#6d5ca1BF, #9146ffBF)"
			});
		}

		// Twitch Shared Chat
		if (data.type === "TwitchSharedChat") {
			if (showTwitchSharedChat === 1) { // Only chat messages
				ChatMessage(data);
			} else if (showTwitchSharedChat === 2) { // Chat message and alert
				ChatMessage(data);
				CustomAlert({
					msgId: data.msgId + "_alert", // Unique ID for the alert
					type: data.type,
					title: "Shared Chat",
					content: `Message shared from ${data.displayName}'s chat!`,
					icon: "./icons/twitch.png",
					background: "linear-gradient(#6d5ca1BF, #9146ffBF)"
				});
			}
		}

		// YouTube Super Chats
		if (data.type === "YouTubeSuperChat" && showYouTubeSuperChats) {
			CustomAlert({
				msgId: data.msgId,
				type: data.type,
				title: "YouTube Super Chat",
				content: `${data.displayName} sent a Super Chat of ${data.amount} ${data.currency}`,
				icon: "./icons/youtube.png",
				background: "linear-gradient(#FF6C60BF, #FF0707BF)"
			});
		}

		// YouTube Super Stickers
		if (data.type === "YouTubeSuperSticker" && showYouTubeSuperStickers) {
			CustomAlert({
				msgId: data.msgId,
				type: data.type,
				title: "YouTube Super Sticker",
				content: `${data.displayName} sent a Super Sticker!`,
				icon: "./icons/youtube.png",
				background: "linear-gradient(#FF6C60BF, #FF0707BF)"
			});
		}

		// YouTube Memberships
		if (data.type === "YouTubeMember" && showYouTubeMemberships) {
			CustomAlert({
				msgId: data.msgId,
				type: data.type,
				title: "YouTube Membership",
				content: `${data.displayName} became a member!`,
				icon: "./icons/youtube.png",
				background: "linear-gradient(#FF6C60BF, #FF0707BF)"
			});
		}


		// Streamlabs Donations
		if (data.type === "StreamlabsDonation" && showStreamlabsDonations) {
			CustomAlert({
				msgId: data.msgId,
				type: data.type,
				title: "Streamlabs Donation",
				content: `${data.name} donated ${data.amount} ${data.currency}`,
				icon: "./icons/streamlabs.png",
				background: "linear-gradient(#73dabbbf, #397765bf)"
			});
		}

		// StreamElements Tips
		if (data.type === "StreamElementsTip" && showStreamElementsTips) {
			CustomAlert({
				msgId: data.msgId,
				type: data.type,
				title: "StreamElements Tip",
				content: `${data.name} tipped ${data.amount} ${data.currency}`,
				icon: "./icons/streamelements.png",
				background: "linear-gradient(#263b8abf, #0a112abf)"
			});
		}

		// Patreon Memberships
		if (data.type === "PatreonMember" && showPatreonMemberships) {
			CustomAlert({
				msgId: data.msgId,
				type: data.type,
				title: "Patreon Membership",
				content: `${data.name} became a patron!`,
				icon: "./icons/patreon.png",
				background: "linear-gradient(#c76633bf, #fd5e0abf)"
			});
		}

		// Kofi Donations
		if (data.type === "KoFiDonation" && showKofiDonations) {
			CustomAlert({
				msgId: data.msgId,
				type: data.type,
				title: "Ko-fi Donation",
				content: `${data.from_name} donated ${data.amount} ${data.currency}!`,
				icon: "./icons/kofi.png",
				background: "linear-gradient(#54c7eebf, #08c2ffbf)"
			});
		}

		// TipeeeStream Donations
		if (data.type === "TipeeeStreamDonation" && showTipeeeStreamDonations) {
			CustomAlert({
				msgId: data.msgId,
				type: data.type,
				title: "TipeeeStream Donation",
				content: `${data.username} donated ${data.amount} ${data.currency}!`,
				icon: "./icons/tipeeestream.png",
				background: "linear-gradient(#120e23bf, #5d192abf)"
			});
		}

		// Fourthwall Alerts
		if (data.type === "FourthwallAlert" && showFourthwallAlerts) {
			CustomAlert({
				msgId: data.msgId,
				type: data.type,
				title: "Fourthwall Alert",
				content: `${data.message}`,
				icon: "./icons/fourthwall.png",
				background: "linear-gradient(#466edbbf, #1c56f5bf)"
			});
		}
	}
});

////////////////////
// INITIALIZATION //
////////////////////

// Set scroll direction
if (scrollDirection === 0) {
	messageList.classList.remove("scroll-direction-1");
	messageList.classList.add("scroll-direction-0");
} else {
	messageList.classList.remove("scroll-direction-0");
	messageList.classList.add("scroll-direction-1");
}

// Set font size
document.body.style.fontSize = `${fontSize}px`;

// Set line spacing
document.documentElement.style.setProperty("--line-spacing", `${lineSpacing}em`);

// Set background color and opacity
document.body.style.background = `${GetColorParam("background", "#000000")}cc`;
document.body.style.backgroundColor = `rgba(${parseInt(background.slice(1, 3), 16)}, ${parseInt(background.slice(3, 5), 16)}, ${parseInt(background.slice(5, 7), 16)}, ${opacity})`;
/* eslint-disable no-undef */
class StreamerbotClient {
    /**
     * Initializes a new StreamerbotClient instance.
     * @param {string} address The IP address or hostname of the Streamer.bot WebSocket server.
     * @param {number} port The port of the Streamer.bot WebSocket server.
     * @param {boolean} debug If true, enables console logging for debugging.
     */
    constructor(address, port, debug = false) {
        this.address = address;
        this.port = port;
        this.debug = debug;
        this.ws = null;
        this.isConnected = false;
        this.reconnectInterval = 5000; // 5 seconds
        this.messageListeners = new Map(); // Stores listeners for specific message types
        this.eventListeners = new Map(); // Stores listeners for specific event types (e.g., "Twitch", "YouTube")
        this.rawMessageListeners = []; // Stores listeners for all raw incoming messages
        this.onConnectCallbacks = []; // Callbacks for successful connection
        this.onDisconnectCallbacks = []; // Callbacks for disconnection
        this.connect();
    }

    /**
     * Connects to the Streamer.bot WebSocket server.
     */
    connect() {
        if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
            if (this.debug) console.log('[StreamerbotClient] Already connecting or connected.');
            return;
        }

        const wsUrl = `ws://${this.address}:${this.port}/`;
        if (this.debug) console.log(`[StreamerbotClient] Attempting to connect to ${wsUrl}`);

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = (event) => {
            this.isConnected = true;
            if (this.debug) console.log('[StreamerbotClient] Connected to Streamer.bot WebSocket.', event);
            this.onConnectCallbacks.forEach(callback => callback());
        };

        this.ws.onmessage = (event) => {
            if (this.debug) console.log('[StreamerbotClient] Raw Message:', event.data);
            this.rawMessageListeners.forEach(callback => callback(event.data));

            try {
                const data = JSON.parse(event.data);
                if (this.debug) console.log('[StreamerbotClient] Parsed Message:', data);

                // Notify specific message type listeners (e.g., "GetActionsResponse")
                if (data.type && this.messageListeners.has(data.type)) {
                    this.messageListeners.get(data.type).forEach(callback => callback(data));
                }

                // Notify event listeners (e.g., "Twitch", "YouTube")
                if (data.event && data.event.source && this.eventListeners.has(data.event.source)) {
                    this.eventListeners.get(data.event.source).forEach(callback => callback(data.event.type, data.data));
                }

            } catch (e) {
                console.error('[StreamerbotClient] Failed to parse message data:', e, event.data);
            }
        };

        this.ws.onclose = (event) => {
            if (this.isConnected) {
                this.isConnected = false;
                if (this.debug) console.warn('[StreamerbotClient] Disconnected from Streamer.bot WebSocket.', event);
                this.onDisconnectCallbacks.forEach(callback => callback());
            } else {
                if (this.debug) console.log('[StreamerbotClient] WebSocket connection failed. Retrying...', event);
            }
            setTimeout(() => this.connect(), this.reconnectInterval);
        };

        this.ws.onerror = (event) => {
            console.error('[StreamerbotClient] WebSocket Error:', event);
            this.ws.close(); // Force close to trigger onclose and reconnect logic
        };
    }

    /**
     * Sends a message to the Streamer.bot WebSocket server.
     * @param {object} message The message object to send.
     */
    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
            if (this.debug) console.log('[StreamerbotClient] Sent:', message);
        } else {
            console.warn('[StreamerbotClient] WebSocket not open. Message not sent:', message);
        }
    }

    /**
     * Registers a callback function to be executed when the WebSocket connects.
     * @param {function} callback The function to call on connect.
     */
    onConnect(callback) {
        this.onConnectCallbacks.push(callback);
        if (this.isConnected) {
            callback(); // Call immediately if already connected
        }
    }

    /**
     * Registers a callback function to be executed when the WebSocket disconnects.
     * @param {function} callback The function to call on disconnect.
     */
    onDisconnect(callback) {
        this.onDisconnectCallbacks.push(callback);
    }

    /**
     * Registers a callback for messages of a specific type (e.g., "GetActionsResponse").
     * @param {string} messageType The type of message to listen for.
     * @param {function} callback The function to call when a message of this type is received.
     */
    onMessage(messageType, callback) {
        if (!this.messageListeners.has(messageType)) {
            this.messageListeners.set(messageType, []);
        }
        this.messageListeners.get(messageType).push(callback);
    }

    /**
     * Registers a callback for events from a specific source (e.g., "Twitch", "YouTube").
     * The callback will receive (eventType, eventData).
     * @param {string} eventSource The source of the event (e.g., "Twitch", "YouTube").
     * @param {function} callback The function to call when an event from this source is received.
     */
    onEvent(eventSource, callback) {
        if (!this.eventListeners.has(eventSource)) {
            this.eventListeners.set(eventSource, []);
        }
        this.eventListeners.get(eventSource).push(callback);
    }

    /**
     * Registers a callback for all raw incoming WebSocket messages.
     * @param {function} callback The function to call with the raw message string.
     */
    onRawMessage(callback) {
        this.rawMessageListeners.push(callback);
    }

    /**
     * Unregisters a specific callback from a message type.
     * @param {string} messageType The type of message.
     * @param {function} callback The function to remove.
     */
    offMessage(messageType, callback) {
        if (this.messageListeners.has(messageType)) {
            const listeners = this.messageListeners.get(messageType);
            this.messageListeners.set(messageType, listeners.filter(cb => cb !== callback));
        }
    }

    /**
     * Unregisters a specific callback from an event source.
     * @param {string} eventSource The source of the event.
     * @param {function} callback The function to remove.
     */
    offEvent(eventSource, callback) {
        if (this.eventListeners.has(eventSource)) {
            const listeners = this.eventListeners.get(eventSource);
            this.eventListeners.set(eventSource, listeners.filter(cb => cb !== callback));
        }
    }

    /**
     * Unregisters a specific callback from raw messages.
     * @param {function} callback The function to remove.
     */
    offRawMessage(callback) {
        this.rawMessageListeners = this.rawMessageListeners.filter(cb => cb !== callback);
    }

    /**
     * Sends a message to execute a Streamer.bot action.
     * @param {string} actionName The name of the action to execute.
     * @param {object} args Optional arguments to pass to the action.
     */
    executeAction(actionName, args = {}) {
        this.send({
            "type": "DoAction",
            "action": {
                "name": actionName
            },
            "args": args
        });
    }

    /**
     * Requests a list of actions from Streamer.bot.
     */
    getActions() {
        this.send({
            "type": "GetActions"
        });
    }

    /**
     * Requests subscription to events.
     * @param {Array<string>} sources Array of event sources (e.g., ["Twitch", "YouTube"]).
     * @param {Array<string>} types Array of event types (e.g., ["ChatMessage", "Sub"]).
     */
    subscribe(sources, types) {
        this.send({
            "type": "Subscribe",
            "events": {
                "general": [],
                "twitch": sources.includes("Twitch") ? types : [],
                "youtube": sources.includes("YouTube") ? types : [],
                "streamlabs": sources.includes("Streamlabs") ? types : [],
                "streamelements": sources.includes("StreamElements") ? types : [],
                "patreon": sources.includes("Patreon") ? types : [],
                "kofi": sources.includes("Kofi") ? types : [],
                "tipeeestream": sources.includes("TipeeeStream") ? types : [],
                "fourthwall": sources.includes("Fourthwall") ? types : []
            },
            "id": "OverlayClient" // Unique ID for your client subscription
        });
    }

    /**
     * Unsubscribes from events.
     * @param {Array<string>} sources Array of event sources.
     * @param {Array<string>} types Array of event types.
     */
    unsubscribe(sources, types) {
        this.send({
            "type": "Unsubscribe",
            "events": {
                "twitch": sources.includes("Twitch") ? types : [],
                "youtube": sources.includes("YouTube") ? types : [],
                "streamlabs": sources.includes("Streamlabs") ? types : [],
                "streamelements": sources.includes("StreamElements") ? types : [],
                "patreon": sources.includes("Patreon") ? types : [],
                "kofi": sources.includes("Kofi") ? types : [],
                "tipeeestream": sources.includes("TipeeeStream") ? types : [],
                "fourthwall": sources.includes("Fourthwall") ? types : []
            },
            "id": "OverlayClient"
        });
    }
}
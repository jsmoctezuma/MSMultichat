"use strict";
var Streamerbot = (() => {
    var W = Object.create;
    var p = Object.defineProperty;
    var L = Object.getOwnPropertyDescriptor;
    var H = Object.getOwnPropertyNames;
    var U = Object.getPrototypeOf,
        D = Object.prototype.hasOwnProperty;
    var q = (n, e) => () => (e || n((e = {
        exports: {}
    }).exports, e), e.exports),
        M = (n, e) => {
            for (var t in e) p(n, t, {
                get: e[t],
                enumerable: !0
            })
        },
        w = (n, e, t, o) => {
            if (e && typeof e == "object" || typeof e == "function")
                for (let r of H(e)) !D.call(n, r) && r !== t && p(n, r, {
                    get: () => e[r],
                    enumerable: !(o = L(e, r)) || o.enumerable
                });
            return n
        };
    var O = (n, e, t) => (t = n != null ? W(U(n)) : {}, w(e || !n || !n.__esModule ? p(t, "default", {
        value: n,
        enumerable: !0
    }) : t, n)),
        B = n => w(p({}, "__esModule", {
            value: !0
        }), n);
    var G = q((Q, P) => {
        "use strict";
        P.exports = function() {
            throw new Error("ws does not work in the browser. Browser clients must use the native WebSocket object")
        }
    });
    var I = {};
    M(I, {
        Client: () => h
    });
    var g = class {
        constructor(e = {}) {
            this.logLevels = {
                verbose: 0,
                debug: 1,
                info: 2,
                warn: 3,
                error: 4,
                none: 5
            };
            this.level = e.level || "info", this.customLogger = e.customLogger
        }
        _log(e, t, ...o) {
            this.logLevels[this.level] <= this.logLevels[e] && (this.customLogger ? this.customLogger(e, t, ...o) : console[e](`[Streamer.bot Client] ${t}`, ...o))
        }
        verbose(e, ...t) {
            this._log("verbose", e, ...t)
        }
        debug(e, ...t) {
            this._log("debug", e, ...t)
        }
        info(e, ...t) {
            this._log("info", e, ...t)
        }
        warn(e, ...t) {
            this._log("warn", e, ...t)
        }
        error(e, ...t) {
            this._log("error", e, ...t)
        }
    };
    var h = class {
        constructor(e) {
            var s, a;
            if (this.defaultOptions = {
                    host: "127.0.0.1",
                    port: 8080,
                    endpoint: "/",
                    autoConnect: !0,
                    autoConnectInterval: 500,
                    maxRetries: -1,
                    onConnect: () => {},
                    onDisconnect: () => {},
                    onRetry: () => {},
                    onMessage: () => {},
                    onError: () => {},
                    onInfo: () => {},
                    onWarn: () => {},
                    onClose: () => {},
                    onAuth: () => {},
                    onAction: () => {},
                    onEvent: () => {},
                    events: {
                        general: ["Custom", "Discord", "OBS", "Twitch", "YouTube", "Streamlabs", "StreamElements", "Patreon", "KoFi", "TipeeeStream", "Fourthwall", "Twillio"],
                        raw: []
                    },
                    request: {
                        uuid: !1,
                        execute: !1
                    },
                    logger: {
                        level: "info"
                    }
                }, this._ws = null, this._retries = 0, this._authenticated = !1, this._events = new Map, this.uuidMap = new Map, this._options = { ...this.defaultOptions,
                    ...e
                }, typeof WebSocket == "undefined" && (this._options.ws = (s = this._options.ws) != null ? s : G()), this._logger = new g(this._options.logger), !this._options.host || !this._options.port) throw new Error("Host and port are required.");
            this._url = `ws://${this._options.host}:${this._options.port}${this._options.endpoint}`;
            for (let t of (a = this._options.events.general) != null ? a : []) this.on(t, o => {
                var r, i;
                (i = (r = this._options).onEvent) == null || i.call(r, t, o)
            });
            for (let t of this._options.events.raw) this.on(t, o => {
                var r, i;
                (i = (r = this._options).onEvent) == null || i.call(r, t, o)
            });
            this._options.autoConnect && this.connect()
        }
        _close(e) {
            var t, o;
            this._ws && (this._logger.debug("Closing connection.", e), (o = (t = this._options).onClose) == null || o.call(t, e), this._ws.close())
        }
        _getEventName(e) {
            if (e.event && e.event.group && e.event.type) return `${e.event.group}${e.event.type}`;
            if (e.event && e.event.type) return e.event.type;
            if (e.request && e.request.type) return e.request.type;
            if (e.id && this.uuidMap.has(e.id)) return this.uuidMap.get(e.id)
        }
        _message(e) {
            var t, o;
            let s = JSON.parse(e.data);
            (o = (t = this._options).onMessage) == null || o.call(t, s);
            let a = this._getEventName(s);
            if (a && this._events.has(a))
                for (let r of this._events.get(a)) r(s);
            s.id && this.uuidMap.delete(s.id), s.event && this._logger.debug("Event:", s)
        }
        _error(e) {
            var t, o;
            this._logger.error("WebSocket Error:", e), (o = (t = this._options).onError) == null || o.call(t, e)
        }
        _retry(e) {
            var t, o;
            this._retries++, this._logger.info(`Connection failed. Retrying in ${this._options.autoConnectInterval/1e3} seconds (attempt ${this._retries}/${this._options.maxRetries === -1 ? "unlimited" : this._options.maxRetries}).`, e), (o = (t = this._options).onRetry) == null || o.call(t, e)
        }
        _disconnect(e) {
            var t, o;
            this._authenticated = !1, (o = (t = this._options).onDisconnect) == null || o.call(t, e), e.code === 1000 ? this._logger.info("Connection closed.", e) : this._options.maxRetries === -1 || this._retries < this._options.maxRetries ? setTimeout(() => this.connect(), this._options.autoConnectInterval) : this._logger.error("Max retries reached. Connection closed.", e)
        }
        _connect() {
            var e, t;
            this._logger.info(`Connecting to Streamer.bot at ${this._url}`), this._ws = new WebSocket(this._url), this._ws.onopen = o => {
                var s, a;
                this._logger.info("Connection successful.", o), (a = (s = this._options).onConnect) == null || a.call(s, o), this._retries = 0
            }, this._ws.onmessage = o => this._message(o), this._ws.onerror = o => this._error(o), this._ws.onclose = o => this._disconnect(o), (t = (e = this._options).onAuth) == null || t.call(e)
        }
        connect() {
            !this._ws || this._ws.readyState === WebSocket.CLOSED ? this._connect() : this._logger.warn("WebSocket is already connecting or connected.")
        }
        disconnect() {
            this._close(1e3)
        }
        on(e, t) {
            return this._events.has(e) || this._events.set(e, []), this._events.get(e).push(t), this
        }
        once(e, t) {
            const o = s => {
                this.off(e, o), t(s)
            };
            return this.on(e, o), this
        }
        off(e, t) {
            if (!this._events.has(e)) return this;
            let o = this._events.get(e).indexOf(t);
            return o !== -1 && this._events.get(e).splice(o, 1), this
        }
        async call(e) {
            return this._authenticated ? new Promise((t, o) => {
                const s = setTimeout(() => {
                    this.uuidMap.delete(e.id), o(new Error("Request timed out"))
                }, 1e4);
                this.once(e.id, r => {
                    clearTimeout(s), t(r)
                }), this._ws.send(JSON.stringify(e))
            }) : (this._logger.warn("Authentication required for API calls."), {
                status: "error",
                error: "Authentication required"
            })
        }
        async send(e) {
            return this._authenticated ? (this._ws.send(JSON.stringify(e)), !0) : (this._logger.warn("Authentication required for sending data."), !1)
        }
        async request(e) {
            return e.id = crypto.randomUUID(), await this.call(e)
        }
        async doAction(e, t = null, o = null) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            let s = {
                request: "DoAction",
                action: {
                    name: e
                }
            };
            return t && (s.args = t), o && (s.cbs = o), await this.request(s)
        }
        async getActions() {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            let e = await this.request({
                request: "GetActions"
            });
            return e.status === "ok" ? e.actions : {
                status: "error",
                error: "Could not retrieve actions"
            }
        }
        async getAction(e) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            let t = await this.request({
                request: "GetAction",
                actionId: e
            });
            return t.status === "ok" ? t.action : {
                status: "error",
                error: "Could not retrieve action"
            }
        }
        async getSettings(e = !0) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "GetSettings",
                schema: e
            })
        }
        async getGlobals(e = !0) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "GetGlobals",
                persisted: e
            })
        }
        async getGlobal(e, t = !0) {
            let o = await this.request({
                request: "GetGlobal",
                variable: e,
                persisted: t
            });
            return o.status === "ok" ? o.variables[e] ? {
                id: o.id,
                status: o.status,
                variable: o.variables[e]
            } : {
                status: "error",
                error: "Variable not found"
            } : o
        }
        async getUserGlobals(e, t = null, o = !0) {
            let s = {
                twitch: "TwitchGetUserGlobals",
                youtube: "YouTubeGetUserGlobals",
                trovo: "TrovoGetUserGlobals"
            }[e];
            if (!s) throw new Error("Invalid platform");
            return await this.request({
                request: s,
                variable: t,
                persisted: o
            })
        }
        async getUserGlobal(e, t, o = null, r = !0) {
            let a = {
                twitch: "TwitchGetUserGlobal",
                youtube: "YouTubeGetUserGlobal",
                trovo: "TrovoGetUserGlobal"
            }[e];
            if (!a) throw new Error("Invalid platform");
            let i = await this.request({
                request: a,
                userId: t,
                variable: o || null,
                persisted: r
            });
            if (i.status === "ok" && t && o) {
                let d = i.variables.find(c => c.name === o);
                return d ? {
                    id: i.id,
                    status: i.status,
                    variable: d
                } : {
                    status: "error",
                    error: "Variable not found"
                }
            }
            return i
        }
        async sendMessage(e, t, {
            bot: o = !1,
            internal: r = !0,
            ...s
        } = {}) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            let a = {
                platform: e,
                message: t,
                bot: o,
                internal: r
            };
            return e === "twitch" && s.reply && (a.reply = s.reply), await this.request({
                request: "SendMessage",
                ...a
            })
        }
        async setActionState(e, t) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "SetActionState",
                actionId: e,
                state: t
            })
        }
        async setCountdown(e, t, o, s) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "SetCountdown",
                countdownId: e,
                countdownTime: t,
                countdownMessage: o,
                countdownEndMessage: s
            })
        }
        async setProfile(e) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "SetProfile",
                profileId: e
            })
        }
        async setScene(e, t, o = !0) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "SetScene",
                obsConnectionId: e,
                sceneName: t,
                makeActive: o
            })
        }
        async setSourceVisibility(e, t, o, s = !0) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "SetSourceVisibility",
                obsConnectionId: e,
                sceneName: t,
                sourceName: o,
                visible: s
            })
        }
        async toggleSourceVisibility(e, t, o) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "ToggleSourceVisibility",
                obsConnectionId: e,
                sceneName: t,
                sourceName: o
            })
        }
        async doCooldown(e) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "DoCooldown",
                cooldown: e
            })
        }
        async setGlobal(e, t, o = !0) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "SetGlobal",
                variable: e,
                value: t,
                persisted: o
            })
        }
        async setUserGlobal(e, t, o, s, r = !0) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            let a = {
                twitch: "TwitchSetUserGlobal",
                youtube: "YouTubeSetUserGlobal",
                trovo: "TrovoSetUserGlobal"
            }[e];
            if (!a) throw new Error("Invalid platform");
            return await this.request({
                request: a,
                userId: t,
                variable: o,
                value: s,
                persisted: r
            })
        }
        async sendMedia(e, t, o, s, r, a) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "SendMedia",
                mediaType: e,
                path: t,
                volume: o,
                synchronous: s,
                loop: r,
                target: a
            })
        }
        async stopMedia(e) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "StopMedia",
                target: e
            })
        }
        async setMute(e, t) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "SetMute",
                source: e,
                mute: t
            })
        }
        async setVolume(e, t) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "SetVolume",
                source: e,
                volume: t
            })
        }
        async setSourceVolume(e, t, o, s) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "SetSourceVolume",
                obsConnectionId: e,
                sceneName: t,
                sourceName: o,
                volume: s
            })
        }
        async setSourceMute(e, t, o, s) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "SetSourceMute",
                obsConnectionId: e,
                sceneName: t,
                sourceName: o,
                mute: s
            })
        }
        async startStream(e = null) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "StartStream",
                service: e
            })
        }
        async stopStream(e = null) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "StopStream",
                service: e
            })
        }
        async startRecording(e = null) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "StartRecording",
                service: e
            })
        }
        async stopRecording(e = null) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "StopRecording",
                service: e
            })
        }
        async sendHotkeyPressed(e) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "SendHotkeyPressed",
                hotkeyId: e
            })
        }
        async sendKey(e, t, o) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "SendKey",
                key: e,
                keyModifier: t,
                keyboardLayout: o
            })
        }
        async setGame(e, t, o) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "SetGame",
                twitchChannelId: e,
                gameId: t,
                gameName: o
            })
        }
        async setTitle(e, t) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "SetTitle",
                twitchChannelId: e,
                title: t
            })
        }
        async setCategory(e, t) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "SetCategory",
                twitchChannelId: e,
                categoryId: t
            })
        }
        async setTags(e, t) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "SetTags",
                twitchChannelId: e,
                tags: t
            })
        }
        async setStreamMarkers(e, t) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "SetStreamMarkers",
                twitchChannelId: e,
                marker: t
            })
        }
        async createClip(e) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "CreateClip",
                twitchChannelId: e
            })
        }
        async runAd(e, t) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "RunAd",
                twitchChannelId: e,
                duration: t
            })
        }
        async sendChatMessage(e, t) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "SendChatMessage",
                platform: "Twitch",
                message: t,
                channelId: e
            })
        }
        async createPrediction(e, t, o, s, r) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "CreatePrediction",
                twitchChannelId: e,
                title: t,
                outcomes: o,
                predictionWindow: s,
                autoLock: r
            })
        }
        async resolvePrediction(e, t, o) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "ResolvePrediction",
                twitchChannelId: e,
                predictionId: t,
                outcomeId: o
            })
        }
        async cancelPrediction(e, t) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "CancelPrediction",
                twitchChannelId: e,
                predictionId: t
            })
        }
        async createPoll(e, t, o, s) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "CreatePoll",
                twitchChannelId: e,
                title: t,
                choices: o,
                duration: s
            })
        }
        async endPoll(e, t) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "EndPoll",
                twitchChannelId: e,
                pollId: t
            })
        }
        async startRaid(e, t) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "StartRaid",
                twitchChannelId: e,
                raidChannelId: t
            })
        }
        async endRaid(e) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "EndRaid",
                twitchChannelId: e
            })
        }
        async createVip(e, t) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "CreateVip",
                twitchChannelId: e,
                userId: t
            })
        }
        async removeVip(e, t) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "RemoveVip",
                twitchChannelId: e,
                userId: t
            })
        }
        async addMod(e, t) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "AddMod",
                twitchChannelId: e,
                userId: t
            })
        }
        async removeMod(e, t) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "RemoveMod",
                twitchChannelId: e,
                userId: t
            })
        }
        async addRedemption(e, t) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "AddRedemption",
                twitchChannelId: e,
                redemptionId: t
            })
        }
        async removeRedemption(e, t) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "RemoveRedemption",
                twitchChannelId: e,
                redemptionId: t
            })
        }
        async banUser(e, t, o, s) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "BanUser",
                twitchChannelId: e,
                userId: t,
                reason: o,
                permanent: s
            })
        }
        async unbanUser(e, t) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "UnbanUser",
                twitchChannelId: e,
                userId: t
            })
        }
        async timeoutUser(e, t, o, s) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "TimeoutUser",
                twitchChannelId: e,
                userId: t,
                duration: o,
                reason: s
            })
        }
        async unTimeoutUser(e, t) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "UnTimeoutUser",
                twitchChannelId: e,
                userId: t
            })
        }
        async clearChat(e) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "ClearChat",
                twitchChannelId: e
            })
        }
        async enableEmoteOnly(e) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "EnableEmoteOnly",
                twitchChannelId: e
            })
        }
        async disableEmoteOnly(e) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "DisableEmoteOnly",
                twitchChannelId: e
            })
        }
        async enableFollowerOnly(e, t) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "EnableFollowerOnly",
                twitchChannelId: e,
                minFollowTime: t
            })
        }
        async disableFollowerOnly(e) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "DisableFollowerOnly",
                twitchChannelId: e
            })
        }
        async enableSubOnly(e) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "EnableSubOnly",
                twitchChannelId: e
            })
        }
        async disableSubOnly(e) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "DisableSubOnly",
                twitchChannelId: e
            })
        }
        async enableUniqueChat(e) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "EnableUniqueChat",
                twitchChannelId: e
            })
        }
        async disableUniqueChat(e) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "DisableUniqueChat",
                twitchChannelId: e
            })
        }
        async enableSlowChat(e, t) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "EnableSlowChat",
                twitchChannelId: e,
                delay: t
            })
        }
        async disableSlowChat(e) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "DisableSlowChat",
                twitchChannelId: e
            })
        }
        async getCheermotes(e) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "GetCheermotes",
                twitchChannelId: e
            })
        }
        async getChannelInfo(e) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "GetChannelInfo",
                twitchChannelId: e
            })
        }
        async getChannelUpTime(e) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "GetChannelUpTime",
                twitchChannelId: e
            })
        }
        async getReward(e, t) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "GetReward",
                twitchChannelId: e,
                rewardId: t
            })
        }
        async getRewards(e) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "GetRewards",
                twitchChannelId: e
            })
        }
        async getPolls(e) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "GetPolls",
                twitchChannelId: e
            })
        }
        async getPredictions(e) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "GetPredictions",
                twitchChannelId: e
            })
        }
        async sendRaw(e) {
            if (!this._authenticated) return {
                status: "error",
                error: "Authentication required"
            };
            return await this.request({
                request: "SendRaw",
                raw: e
            })
        }
    };
    return B(I);
})();
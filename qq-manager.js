import { getContext, extension_settings, saveMetadataDebounced } from '../../../extensions.js';
import { SettingsManager, EXTENSION_NAME } from './settings-manager.js';
import { PromptManager } from './prompt-manager.js';
import { ApiService } from './api-service.js';
import { PhoneLogService } from './phone-log-service.js';
import { OperationLogService } from './operation-log-service.js';

/**
 * QQ 数据管理与消息调度核心类
 * 
 * 核心设计准则：
 * 1. 角色卡完全隔离：好友列表、私聊会话均与当前角色卡绑定（基于当前角色的 avatar / name 隔离）。
 * 2. 世界书自动绑定：直接读取当前角色卡关联的世界书条目，无需手动在界面选书。
 * 3. 杜绝浏览器本地存储：所有数据写入酒馆后端 JSON (settings.json)，跨端、清理缓存不丢失。
 */
export class QQManager {
    static STORAGE_KEY = 'qqDataByCharacter';

    /**
     * 获取当前处于激活状态的角色卡信息
     * 具备超强多级容错：覆盖 context.characterId, context.this_chid, window, DOM 以及群聊
     * @returns {{ id: number|string|null, key: string, name: string, avatar: string, charData: object|null, isGroup?: boolean }}
     */
    static getCurrentCharacter() {
        const context = (typeof Luker !== 'undefined' && Luker.getContext)
            ? Luker.getContext()
            : getContext();

        const characters = context?.characters ?? window.characters ?? [];

        // 1. 从 context.characterId 获取 (酒馆标准 Getter)
        let thisChid = context?.characterId;

        // 2. 从 context.this_chid 或 window.this_chid 获取
        if (thisChid === undefined || thisChid === null) {
            thisChid = context?.this_chid ?? window.this_chid ?? window.characterId ?? window.active_character_id;
        }

        // 3. 从 DOM 节点保底获取 (如果酒馆页面正在打开某个角色)
        if (thisChid === undefined || thisChid === null || !characters[thisChid]) {
            // 尝试从 #set_character_world 的 data-chid 读取
            const setWorldChid = $('#set_character_world').data('chid');
            if (setWorldChid !== undefined && setWorldChid !== null && setWorldChid !== -1 && characters[setWorldChid]) {
                thisChid = setWorldChid;
            }
        }

        if (thisChid === undefined || thisChid === null || !characters[thisChid]) {
            // 尝试从当前选中角色卡 DOM 节点读取
            const selectedEl = $('.character_select.selected, .character_select.character_selected, #character_list .character_select[selected]');
            if (selectedEl.length > 0) {
                const chidAttr = selectedEl.attr('chid') || selectedEl.data('chid');
                if (chidAttr !== undefined && characters[chidAttr]) {
                    thisChid = parseInt(chidAttr, 10);
                }
            }
        }

        // 4. 从当前聊天的名字逆向匹配角色 (通过顶栏名字或聊天设置)
        if (thisChid === undefined || thisChid === null || !characters[thisChid]) {
            const topCharName = $('#rm_button_selected_ch h2, #character_popup-button-h3').text().trim();
            if (topCharName && Array.isArray(characters)) {
                const matchedIdx = characters.findIndex(c => c && (c.name === topCharName || c.data?.name === topCharName));
                if (matchedIdx !== -1) {
                    thisChid = matchedIdx;
                }
            }
        }

        // 5. 命中单聊有效角色
        if (thisChid !== undefined && thisChid !== null && characters && characters[thisChid]) {
            const char = characters[thisChid];
            // 优先使用稳定唯一的 avatar 文件名作为主键，其次用 name
            const key = char.avatar || char.name || `char_${thisChid}`;
            return {
                id: thisChid,
                key: String(key).trim(),
                name: String(char.name || char.data?.name || '未知角色').trim(),
                avatar: char.avatar || '',
                charData: char,
            };
        }

        // 6. 如果是群聊 (Group Chat)
        const groupId = context?.groupId ?? window.selected_group;
        if (groupId) {
            const groups = context?.groups ?? window.groups ?? [];
            const currentGroup = groups.find(g => String(g.id) === String(groupId));
            return {
                id: `group_${groupId}`,
                key: `group_${groupId}`,
                name: currentGroup?.name || '群聊',
                avatar: currentGroup?.avatar || '',
                charData: null,
                isGroup: true,
                groupData: currentGroup,
            };
        }

        return {
            id: null,
            key: '__default__',
            name: '未选择角色',
            avatar: '',
            charData: null,
        };
    }

    /**
     * 获取当前角色卡专属的 QQ 持久化数据
     */
    static getData() {
        const settings = SettingsManager.getSettings();
        if (!settings[this.STORAGE_KEY]) {
            settings[this.STORAGE_KEY] = {};
        }

        const currentChar = this.getCurrentCharacter();
        const charKey = currentChar.key;

        // 向后兼容：平滑迁移旧版未隔离的 qqData 数据到当前角色下
        if (settings.qqData && !settings[this.STORAGE_KEY][charKey]) {
            settings[this.STORAGE_KEY][charKey] = {
                friends: settings.qqData.friends || [],
                sessions: settings.qqData.sessions || {},
                userProfile: settings.qqData.userProfile || {
                    qqNumber: '888888',
                    name: '我',
                    avatar: '',
                },
            };
            delete settings.qqData;
            SettingsManager._save();
        }

        // 初始化当前角色数据结构（联系人与个人资料归属角色卡，聊天记录归属各个聊天元文件）
        if (!settings[this.STORAGE_KEY][charKey]) {
            settings[this.STORAGE_KEY][charKey] = {
                friends: [],
                userProfile: {
                    qqNumber: '888888',
                    name: '我',
                    avatar: '',
                },
            };
            SettingsManager._save();
        }

        // 彻底清理角色卡数据中残留的旧 sessions（聊天记录严格归属每个聊天元文件）
        const currentData = settings[this.STORAGE_KEY][charKey];
        if (currentData.sessions) {
            delete currentData.sessions;
            SettingsManager._save();
        }
        if (Array.isArray(currentData.friends)) {
            let needClean = false;
            for (const f of currentData.friends) {
                if (f.signature && (f.signature.includes('基本信息') || f.signature.trim().startsWith('{') || f.signature.includes('姓名'))) {
                    f.signature = '';
                    needClean = true;
                }
            }
            if (needClean) {
                SettingsManager._save();
            }
        }
        if (!Array.isArray(currentData.groups)) {
            currentData.groups = [];
            SettingsManager._save();
        }

        return currentData;
    }

    /**
     * 保存当前角色卡专属的 QQ 数据到后端 JSON
     */
    static saveData(data) {
        if (!extension_settings[EXTENSION_NAME]) {
            extension_settings[EXTENSION_NAME] = {};
        }
        if (!extension_settings[EXTENSION_NAME][this.STORAGE_KEY]) {
            extension_settings[EXTENSION_NAME][this.STORAGE_KEY] = {};
        }
        const charKey = this.getCurrentCharacter().key;
        extension_settings[EXTENSION_NAME][this.STORAGE_KEY][charKey] = data;
        SettingsManager._save();
    }

    /**
     * 获取当前用户的 QQ 个人资料（昵称默认为 '我'，可在 QQ 设置修改）
     * @returns {{ name: string, qqNumber: string, avatar: string }}
     */
    static getUserProfile() {
        const data = this.getData();
        if (!data.userProfile) {
            data.userProfile = {
                name: '我',
                qqNumber: '888888',
                avatar: '',
            };
        }
        if (!data.userProfile.name) {
            data.userProfile.name = '我';
        }
        return data.userProfile;
    }

    /**
     * 更新当前用户的 QQ 个人资料（如在 QQ 设置里修改 user_name / 我的昵称）
     * @param {{ name?: string, qqNumber?: string, avatar?: string }} profile
     */
    static updateUserProfile(profile = {}) {
        const data = this.getData();
        if (!data.userProfile) data.userProfile = {};
        if (profile.name !== undefined) {
            data.userProfile.name = String(profile.name || '').trim() || '我';
        }
        if (profile.qqNumber !== undefined) {
            data.userProfile.qqNumber = String(profile.qqNumber || '').trim() || '888888';
        }
        if (profile.avatar !== undefined) {
            data.userProfile.avatar = String(profile.avatar || '').trim();
        }
        this.saveData(data);
        return data.userProfile;
    }

    /**
     * 获取当前角色卡的所有好友列表
     */
    static getFriends() {
        const data = this.getData();
        return data.friends || [];
    }

    /**
     * 获取单个好友详情
     */
    static getFriend(friendId) {
        const friends = this.getFriends();
        return friends.find(f => f.id === friendId) || null;
    }

    /**
     * 新建好友（手动输入 QQ 号与人名）
     */
    static addFriend({ name, qqNumber, remark = '', signature = '', keys = [], personaPrompt = '', sourceWorld = '' }) {
        const data = this.getData();
        const finalQq = String(qqNumber || '').trim() || this._generateRandomQQ();
        const finalName = String(name || '').trim() || '新好友';
        
        // 自动提取关键词：若未提供 keys，自动将名字和备注作为触发词
        const finalKeys = Array.isArray(keys) && keys.length > 0 
            ? keys 
            : [finalName, remark].filter(Boolean);

        const newFriend = {
            id: `friend_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            qqNumber: finalQq,
            name: finalName,
            remark: String(remark || '').trim(),
            signature: String(signature || '').trim(),
            avatarColor: this._getAvatarColor(finalName),
            keys: finalKeys,
            personaPrompt: String(personaPrompt || '').trim(),
            sourceWorld: String(sourceWorld || '').trim(),
            createdAt: Date.now(),
        };

        data.friends.unshift(newFriend);
        this.saveData(data);

        try {
            OperationLogService.log({
                module: 'QQ通讯录',
                action: '添加好友',
                status: 'success',
                detail: `好友: ${finalName} (${finalQq})`,
            });
        } catch (_) {}

        return newFriend;
    }

    /**
     * 获取当前酒馆聊天的元数据对象 (chat_metadata)
     */
    static getChatMetadata() {
        const context = (typeof Luker !== 'undefined' && Luker.getContext)
            ? Luker.getContext()
            : (typeof getContext === 'function' ? getContext() : null);

        let meta = context?.chatMetadata || (typeof chat_metadata !== 'undefined' ? chat_metadata : null) || window.chat_metadata;
        if (!meta) {
            if (!window.__small_phone_fallback_metadata) {
                window.__small_phone_fallback_metadata = {};
            }
            meta = window.__small_phone_fallback_metadata;
        }
        return meta;
    }

    /**
     * 触发酒馆聊天元文件的防抖保存 (写入当前聊天的元数据)
     */
    static saveChatMetadata() {
        const context = (typeof Luker !== 'undefined' && Luker.getContext)
            ? Luker.getContext()
            : (typeof getContext === 'function' ? getContext() : null);

        try {
            if (typeof context?.saveMetadataDebounced === 'function') {
                context.saveMetadataDebounced();
            } else if (typeof saveMetadataDebounced === 'function') {
                saveMetadataDebounced();
            } else if (typeof context?.saveMetadata === 'function') {
                context.saveMetadata();
            }
        } catch (e) {
            console.warn('[QQManager] saveChatMetadata 异常:', e);
        }
    }

    /**
     * 获取当前聊天的全部 QQ 会话字典
     * 聊天记录完全且仅保存在当前聊天元文件 (chat_metadata.small_phone.sessions)
     * 每个会话严格隔离，开新会话记录即为空白
     */
    static getSessions() {
        const meta = this.getChatMetadata();
        if (!meta.small_phone) {
            meta.small_phone = {};
        }
        if (!meta.small_phone.sessions || typeof meta.small_phone.sessions !== 'object') {
            meta.small_phone.sessions = {};
        }
        return meta.small_phone.sessions;
    }

    /**
     * 获取某个好友或群聊在当前聊天元文件中的专属聊天历史记录
     */
    static getSession(sessionId) {
        if (!sessionId) return [];
        const sessions = this.getSessions();
        if (!Array.isArray(sessions[sessionId])) {
            sessions[sessionId] = [];
        }

        // 若为群聊，尝试执行静默自愈以修复历史数据
        const group = this.getGroup(sessionId);
        if (group) {
            this.healGroupSessionFromTavernChat(sessionId, group);
        }

        return sessions[sessionId];
    }

    /**
     * 兼容别名：获取某个好友的聊天历史消息列表
     */
    static getFriendMessages(friendId) {
        return this.getSession(friendId);
    }

    /**
     * 智能自愈群历史消息：若历史数据因旧版本缺陷丢失了 senderName 或误存为群名，
     * 自动从酒馆楼层互动记录 (narrative-phone-log) 中提取真实角色名并精准补全与持久化
     */
    static healGroupSessionFromTavernChat(groupId, group) {
        if (!groupId) return;
        const currentGroup = group || this.getGroup(groupId);
        if (!currentGroup) return;

        const sessions = this.getSessions();
        const session = sessions[groupId];
        if (!Array.isArray(session) || session.length === 0) return;

        // 检查是否有需要修复的群消息
        const needHeal = session.some(msg => msg.sender === 'friend' && (!msg.senderName || msg.senderName === currentGroup.name || !msg.senderId));
        if (!needHeal) return;

        const friends = this.getFriends();
        const memberFriends = (currentGroup.memberIds || [])
            .map(id => friends.find(f => f.id === id))
            .filter(Boolean);

        // 建立正文内容与群成员的映射表
        const contentToMemberMap = new Map();

        try {
            const context = (typeof Luker !== 'undefined' && Luker.getContext)
                ? Luker.getContext()
                : (typeof getContext === 'function' ? getContext() : null);

            if (context && Array.isArray(context.chat) && context.chat.length > 0) {
                const detailsRegex = /<details\s+class="narrative-phone-log"[^>]*>([\s\S]*?)<\/details>/gi;

                for (let i = context.chat.length - 1; i >= 0; i--) {
                    const chatMes = String(context.chat[i]?.mes || '');
                    if (!chatMes.includes('narrative-phone-log')) continue;

                    let match;
                    while ((match = detailsRegex.exec(chatMes)) !== null) {
                        const body = match[1];
                        const lines = body.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                        for (const line of lines) {
                            const m = line.match(/^\[[^\]]+\]\s*([^:：]+)[:：]\s*([\s\S]+)$/);
                            if (m) {
                                const sName = m[1].trim();
                                const content = m[2].trim();
                                if (sName !== '我' && sName !== currentGroup.name) {
                                    let found = memberFriends.find(f => f.name === sName);
                                    if (!found) {
                                        found = friends.find(f => f.name === sName);
                                    }
                                    if (!found) {
                                        found = memberFriends.find(f => sName.includes(f.name) || f.name.includes(sName));
                                    }
                                    if (found && content) {
                                        contentToMemberMap.set(content, found);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } catch (ctxErr) {
            console.warn('[QQManager] 扫描酒馆楼层自愈群记录出现异常:', ctxErr);
        }

        let healedCount = 0;
        for (const msg of session) {
            if (msg.sender === 'friend' && (!msg.senderName || msg.senderName === currentGroup.name || !msg.senderId)) {
                const cleanContent = String(msg.content || '').trim();
                let matchedFriend = contentToMemberMap.get(cleanContent);
                if (!matchedFriend) {
                    for (const [cText, f] of contentToMemberMap.entries()) {
                        if (cText.includes(cleanContent) || cleanContent.includes(cText)) {
                            matchedFriend = f;
                            break;
                        }
                    }
                }

                // 次级后备匹配：根据正文中的人名线索
                if (!matchedFriend && memberFriends.length > 0) {
                    for (const f of memberFriends) {
                        const shortName = f.name.length >= 3 ? f.name.slice(-2) : f.name;
                        if (cleanContent.includes(f.name) || cleanContent.includes(shortName)) {
                            matchedFriend = f;
                            break;
                        }
                    }
                }

                if (matchedFriend) {
                    msg.senderName = matchedFriend.name;
                    msg.senderId = matchedFriend.id;
                    msg.avatarColor = matchedFriend.avatarColor;
                    healedCount++;
                }
            }
        }

        if (healedCount > 0) {
            console.log(`[QQManager] 成功自愈 ${healedCount} 条群聊历史消息的发言人信息，群: ${currentGroup.name}`);
            this.saveChatMetadata();
        }
    }

    /**
     * 向某个好友或群聊的会话中追加消息并持久化到当前聊天元文件
     */
    static appendMessage(sessionId, { sender = 'user', content = '', type = 'text', senderName, senderId, avatarColor, ...extra } = {}) {
        const sessions = this.getSessions();
        if (!Array.isArray(sessions[sessionId])) {
            sessions[sessionId] = [];
        }

        const msgObj = {
            id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            sender: sender, // 'user' | 'friend'
            content: content,
            type: type,
            timestamp: Date.now(),
        };

        if (senderName) msgObj.senderName = senderName;
        if (senderId) msgObj.senderId = senderId;
        if (avatarColor) msgObj.avatarColor = avatarColor;
        Object.assign(msgObj, extra);

        sessions[sessionId].push(msgObj);
        this.saveChatMetadata();
        return msgObj;
    }

    /**
     * 清空某个好友或群聊的聊天记录：
     * 1. 清空当前聊天元文件 (chat_metadata) 中的会话记录
     * 2. 同步彻底删除酒馆正文中所有该会话的手机互动记录并保存正文
     */
    static async clearSession(sessionId) {
        const friend = this.getFriend(sessionId);
        const group = this.getGroup(sessionId);
        const name = friend ? friend.name : (group ? group.name : sessionId);
        const isGroup = Boolean(group);

        const sessions = this.getSessions();
        if (sessions[sessionId]) {
            sessions[sessionId] = [];
            this.saveChatMetadata();
        }

        // 联动删除正文中的互动记录
        try {
            await PhoneLogService.removeFriendLogsFromTavernChat({
                friendId: sessionId,
                charName: name,
                appName: isGroup ? 'QQ群聊' : 'QQ',
            });
        } catch (err) {
            console.warn('[QQManager] 清除正文手机互动记录失败:', err);
        }

        try {
            OperationLogService.log({
                module: isGroup ? 'QQ群聊' : 'QQ单聊',
                action: '清空会话',
                status: 'info',
                detail: `会话: ${name}`,
            });
        } catch (_) {}
    }

    /**
     * 批量删除某个好友或群聊会话中的部分指定消息：
     * 1. 从当前聊天元文件 (chat_metadata.small_phone.sessions) 中过滤删除对应消息
     * 2. 同步从酒馆正文楼层 (<details class="narrative-phone-log">) 中剔除对应的消息行并保存正文
     * @param {string} sessionId 会话 ID（好友 ID 或群 ID）
     * @param {Array<{ id?: string, content: string, senderName?: string, sender?: string }>} itemsToRemove
     * @returns {Promise<{ success: boolean, removedCount: number }>}
     */
    static async deleteSessionMessages(sessionId, itemsToRemove = []) {
        if (!sessionId || !Array.isArray(itemsToRemove) || itemsToRemove.length === 0) {
            return { success: true, removedCount: 0 };
        }

        const friend = this.getFriend(sessionId);
        const group = this.getGroup(sessionId);
        const name = friend ? friend.name : (group ? group.name : sessionId);
        const isGroup = Boolean(group);

        const sessions = this.getSessions();
        const session = sessions[sessionId];
        if (!Array.isArray(session) || session.length === 0) {
            return { success: true, removedCount: 0 };
        }

        // 建立待删除集合与计数器
        let removedCount = 0;
        const remainingTargets = itemsToRemove.map(it => ({
            id: it.id,
            content: String(it.content || '').trim(),
            senderName: String(it.senderName || '').trim(),
            matched: false,
        }));

        const newSession = [];
        for (const msg of session) {
            // 检查是否有针对 msg.id 的直接匹配
            const idTargetIdx = remainingTargets.findIndex(t => !t.matched && t.id && t.id === msg.id);
            if (idTargetIdx !== -1) {
                remainingTargets[idTargetIdx].matched = true;
                removedCount++;
                continue; // 剔除本条消息
            }

            // 若无 id 匹配，按 content 匹配（考虑可能有单条消息拆行展示的情况）
            const msgContent = String(msg.content || '').trim();
            const contentTargetIdx = remainingTargets.findIndex(t => !t.matched && (
                t.content === msgContent ||
                msgContent.includes(t.content)
            ));

            if (contentTargetIdx !== -1) {
                // 如果是包含关系（例如旧数据把多句存成了换行多行）
                if (msgContent !== remainingTargets[contentTargetIdx].content && msgContent.includes('\n')) {
                    const lines = msgContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                    const remLines = [];
                    for (const l of lines) {
                        const lIdx = remainingTargets.findIndex(t => !t.matched && (t.content === l || l.includes(t.content)));
                        if (lIdx !== -1) {
                            remainingTargets[lIdx].matched = true;
                            removedCount++;
                        } else {
                            remLines.push(l);
                        }
                    }
                    if (remLines.length > 0) {
                        msg.content = remLines.join('\n');
                        newSession.push(msg);
                    }
                    continue;
                } else {
                    remainingTargets[contentTargetIdx].matched = true;
                    removedCount++;
                    continue;
                }
            }

            newSession.push(msg);
        }

        sessions[sessionId] = newSession;
        this.saveChatMetadata();

        // 联动从正文中同步剔除对应的消息行
        try {
            await PhoneLogService.removeMessagesFromTavernChat({
                friendId: sessionId,
                charName: name,
                appName: isGroup ? 'QQ群聊' : 'QQ',
                itemsToRemove: itemsToRemove,
            });
        } catch (err) {
            console.warn('[QQManager] 同步剔除正文消息记录失败:', err);
        }

        try {
            OperationLogService.log({
                module: isGroup ? 'QQ群聊' : 'QQ单聊',
                action: '删除消息',
                status: 'info',
                detail: `会话: ${name} | 删除条数: ${removedCount}`,
            });
        } catch (_) {}

        return { success: true, removedCount };
    }

    /**
     * 清空当前聊天中全部好友的 QQ 聊天记录：
     * 1. 清空当前聊天元文件 (chat_metadata.small_phone.sessions = {})
     * 2. 同步彻底删除酒馆正文中所有 QQ 手机互动记录并保存正文
     */
    static async clearAllSessions() {
        const meta = this.getChatMetadata();
        if (meta && meta.small_phone) {
            meta.small_phone.sessions = {};
            this.saveChatMetadata();
        }

        // 联动删除正文中 QQ 的全部手机互动记录
        try {
            await PhoneLogService.removeAllLogsFromTavernChat({ appName: 'QQ' });
        } catch (err) {
            console.warn('[QQManager] 清除正文全部手机互动记录失败:', err);
        }

        // 状态埋点（0 提示词，仅记录操作状态）
        try {
            OperationLogService.log({
                module: 'QQ单聊',
                action: '清空全部记录',
                status: 'info',
                detail: '已清空当前会话全部记录',
            });
        } catch (_) {}
    }

    /**
     * 删除好友及对应聊天会话：
     * 1. 从当前角色卡联系人列表中移除该好友（联系人本身与角色卡保存）
     * 2. 从当前聊天元文件中清理会话（聊天记录保存在聊天元文件）
     * 3. 同步彻底删除酒馆正文中所有该好友的手机互动记录并保存正文
     */
    static async deleteFriend(friendId) {
        const friend = this.getFriend(friendId);
        const charName = friend ? friend.name : '';

        // 1. 删除联系人（与角色卡绑定）
        const data = this.getData();
        data.friends = data.friends.filter(f => f.id !== friendId);
        this.saveData(data);

        // 2. 清理当前聊天元文件的会话
        const sessions = this.getSessions();
        if (sessions[friendId]) {
            delete sessions[friendId];
            this.saveChatMetadata();
        }

        // 3. 联动删除正文中的互动记录
        try {
            await PhoneLogService.removeFriendLogsFromTavernChat({
                friendId: friendId,
                charName: charName,
                appName: 'QQ',
            });
        } catch (err) {
            console.warn('[QQManager] 删除好友时清除正文手机互动记录失败:', err);
        }

        try {
            OperationLogService.log({
                module: 'QQ通讯录',
                action: '删除好友',
                status: 'info',
                detail: `好友: ${charName || friendId}`,
            });
        } catch (_) {}
    }

    /**
     * 获取最近消息列表（用于 QQ 消息首页排序与摘要显示）
     * 规则：只统计当前聊天元文件中产生过实际记录的好友或群聊
     */
    static getRecentChats() {
        const friends = this.getFriends();
        const groups = this.getGroups();
        const sessions = this.getSessions();

        const list = [];

        // 1. 好友单聊会话
        for (const friend of friends) {
            const history = sessions[friend.id] || [];
            if (history.length > 0) {
                const lastMsg = history[history.length - 1];
                list.push({
                    id: friend.id,
                    isGroup: false,
                    friend,
                    name: friend.name,
                    lastMessage: lastMsg ? lastMsg.content : '',
                    lastTime: lastMsg ? lastMsg.timestamp : friend.createdAt,
                    hasHistory: true,
                });
            }
        }

        // 2. 群聊会话
        for (const group of groups) {
            const history = sessions[group.id] || [];
            if (history.length > 0) {
                const lastMsg = history[history.length - 1];
                let displaySnippet = lastMsg ? lastMsg.content : '';
                if (lastMsg && lastMsg.senderName && lastMsg.sender !== 'user') {
                    displaySnippet = `${lastMsg.senderName}：${displaySnippet}`;
                }
                list.push({
                    id: group.id,
                    isGroup: true,
                    group,
                    friend: group, // 兼容视图取头像与名字
                    name: group.name,
                    lastMessage: displaySnippet,
                    lastTime: lastMsg ? lastMsg.timestamp : group.createdAt,
                    hasHistory: true,
                });
            }
        }

        // 按最后消息时间倒序排序
        list.sort((a, b) => b.lastTime - a.lastTime);
        return list;
    }

    /**
     * 获取当前角色卡的所有群聊列表
     */
    static getGroups() {
        const data = this.getData();
        return Array.isArray(data.groups) ? data.groups : [];
    }

    /**
     * 获取单个群聊详情
     */
    static getGroup(groupId) {
        const groups = this.getGroups();
        return groups.find(g => g.id === groupId) || null;
    }

    /**
     * 创建一个新群聊
     * @param {Object} params
     * @param {string} [params.name] 群名称（选填，留空自动生成）
     * @param {string[]} params.memberIds 包含的群成员好友 ID 列表
     * @returns {Object} 群聊对象
     */
    static createGroup({ name = '', memberIds = [] }) {
        const data = this.getData();
        if (!Array.isArray(data.groups)) data.groups = [];

        const friends = this.getFriends();
        const validIds = [...new Set(memberIds)].filter(id => friends.some(f => f.id === id));
        const memberFriends = validIds.map(id => friends.find(f => f.id === id)).filter(Boolean);

        let finalName = String(name || '').trim();
        if (!finalName) {
            if (memberFriends.length > 0) {
                const sampleNames = memberFriends.slice(0, 3).map(f => f.name).join('、');
                finalName = memberFriends.length > 3 ? `${sampleNames}等${memberFriends.length}人` : `${sampleNames}的群聊`;
            } else {
                finalName = '新建群聊';
            }
        }

        const newGroup = {
            id: `group_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            groupNumber: String(Math.floor(100000000 + Math.random() * 900000000)),
            name: finalName,
            memberIds: validIds,
            avatarColor: this._getAvatarColor(finalName),
            createdAt: Date.now(),
        };

        data.groups.unshift(newGroup);
        this.saveData(data);

        try {
            OperationLogService.log({
                module: 'QQ群聊',
                action: '创建群聊',
                status: 'success',
                detail: `群名: ${finalName} (成员: ${validIds.length}人)`,
            });
        } catch (_) {}

        return newGroup;
    }

    /**
     * 解散/删除群聊
     */
    static async deleteGroup(groupId) {
        const group = this.getGroup(groupId);
        const groupName = group ? group.name : groupId;

        const data = this.getData();
        if (Array.isArray(data.groups)) {
            data.groups = data.groups.filter(g => g.id !== groupId);
            this.saveData(data);
        }

        // 清理当前聊天元文件中的会话记录
        const sessions = this.getSessions();
        if (sessions[groupId]) {
            delete sessions[groupId];
            this.saveChatMetadata();
        }

        // 联动删除正文中的群聊记录
        try {
            await PhoneLogService.removeFriendLogsFromTavernChat({
                friendId: groupId,
                charName: groupName,
                appName: 'QQ群聊',
            });
        } catch (err) {
            console.warn('[QQManager] 删除群聊正文互动记录失败:', err);
        }

        try {
            OperationLogService.log({
                module: 'QQ群聊',
                action: '解散群聊',
                status: 'info',
                detail: `群名: ${groupName}`,
            });
        } catch (_) {}
    }

    /**
     * 核心：向群聊发送消息并调用 AI 多角色响应
     */
    static async sendGroupMessage(groupId, userText, { skipAppendUser = false } = {}) {
        const group = this.getGroup(groupId);
        if (!group) throw new Error('群聊不存在或已被解散');

        const startTime = Date.now();
        const userProfile = this.getUserProfile();
        const userName = userProfile.name || '我';

        // 1. 记录用户发送的消息（重新生成时跳过重复记录）
        if (!skipAppendUser) {
            this.appendMessage(groupId, {
                sender: 'user',
                senderName: userName,
                content: userText,
                type: 'text',
            });
        }

        const friends = this.getFriends();
        const memberFriends = (group.memberIds || [])
            .map(id => friends.find(f => f.id === id))
            .filter(Boolean);

        // 2. 组装群成员人设列表 (group_members)
        const groupMembersPrompt = memberFriends.map(f => {
            const roleDesc = f.personaPrompt ? `；设定：${f.personaPrompt}` : '';
            return `- 【${f.name}】(QQ: ${f.qqNumber})${roleDesc}`;
        }).join('\n');

        // 3. 动态触发群内所有成员的世界书
        const wiPromises = memberFriends.map(f => this.resolveDynamicWorldInfoPrompt({
            friend: f,
            userText,
            userName,
        }));
        const wiResults = await Promise.all(wiPromises);
        const dynamicWorldInfo = [...new Set(wiResults.filter(Boolean))].join('\n\n');

        const promptConfig = SettingsManager.getPromptConfig();
        const useTavernPreset = promptConfig.useTavernPreset !== false;

        const messages = PromptManager.buildMessagesPayload({
            appId: 'qq',
            userMessage: userText,
            variables: {
                phase: '群聊',
                chat_type: '群聊',
                is_group: true,
                group_name: group.name,
                char_name: group.name,
                user_name: userName,
                sender_name: userName,
                content: userText,
                message: userText,
                group_members: groupMembersPrompt,
                lorebook: dynamicWorldInfo,
                qq_number: group.groupNumber || '',
            },
            useTavernPreset: useTavernPreset,
        });

        let replyText = '';
        let replyItems = [];

        try {
            const result = await ApiService.sendChatCompletion(messages);
            replyText = result.reply || '(群内暂无回复)';

            // 解析群内每位成员的多角色回复
            replyItems = this.parseGroupReplyMessages(replyText, memberFriends);

            for (const item of replyItems) {
                this.appendMessage(groupId, {
                    sender: 'friend',
                    senderName: item.senderName,
                    senderId: item.senderId,
                    avatarColor: item.avatarColor,
                    content: item.content,
                    type: 'text',
                });
            }

            const duration = Date.now() - startTime;
            OperationLogService.log({
                module: 'QQ群聊',
                action: '收到群回复',
                status: 'success',
                detail: `群名: ${group.name} | 耗时: ${duration}ms`,
            });
        } catch (err) {
            const errMsg = (err?.message || String(err)).slice(0, 35);
            OperationLogService.log({
                module: 'QQ群聊',
                action: '发送群消息',
                status: 'error',
                detail: `群名: ${group.name} | 错误: ${errMsg}`,
            });
            throw err;
        }

        // 联动追加到正文最新一楼
        try {
            await PhoneLogService.appendInteractionToTavernChat({
                appName: 'QQ群聊',
                friendId: groupId,
                charName: group.name,
                userName: userName,
                userText: userText,
                replyText: replyText,
                timestamp: Date.now(),
            });
        } catch (logErr) {
            console.warn('[QQManager] 追加群聊记录至正文出错:', logErr);
        }

        return replyItems;
    }

    /**
     * 将 AI 生成的群聊多角色回复文本拆解为结构化消息列表
     * 格式如：
     * [12:00] 墨燃：师尊说得对！
     * 楚晚宁：不知羞。
     */
    static parseGroupReplyMessages(replyText = '', memberFriends = []) {
        if (!replyText || typeof replyText !== 'string') return [];

        // 1. 先剥离 markdown 代码块标记与多余空行
        const cleanText = replyText
            .replace(/```[\s\S]*?```/g, '')
            .replace(/[\r\n]+/g, '\n')
            .trim();

        const lines = cleanText.split('\n').map(l => l.trim()).filter(Boolean);
        const results = [];

        // 群成员姓名列表，按长度降序排列（避免短名优先匹配长名前缀）
        const sortedMembers = Array.isArray(memberFriends) 
            ? [...memberFriends].sort((a, b) => (b.name || '').length - (a.name || '').length)
            : [];

        for (const rawLine of lines) {
            // 过滤系统动作与旁白括号行
            if (/^[\*\（\(].*[\*\）\)]$/.test(rawLine)) continue;

            let workingLine = rawLine;

            // 步骤 A：彻底剥离整行开头可能存在的任何时间戳前缀（覆盖 [09-29 20:31]、[2026-09-29 20:31]、[20:31]、(20:31) 等）
            workingLine = workingLine
                .replace(/^\[?\d{2,4}[-\/\.]\d{1,2}[-\/\.]\d{1,2}\s+\d{1,2}:\d{2}(?::\d{2})?\]?\s*/, '')
                .replace(/^\[?\d{1,2}[-\/\.]\d{1,2}\s+\d{1,2}:\d{2}(?::\d{2})?\]?\s*/, '')
                .replace(/^\[?\d{1,2}:\d{2}(?::\d{2})?\]?\s*/, '')
                .replace(/^\(?\d{1,2}:\d{2}(?::\d{2})?\)?\s*/, '')
                .replace(/^\d{1,2}\]\s*/, '') // 容错残存的截断时间
                .trim();

            // 步骤 B：优先在已知群成员中进行高精度名字匹配
            let matchedFriend = null;
            let senderName = '';
            let content = '';

            for (const f of sortedMembers) {
                if (!f.name) continue;
                const friendNameEscaped = f.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const memberPrefixRegex = new RegExp(`^(?:【${friendNameEscaped}】|\\[${friendNameEscaped}\\]|${friendNameEscaped})\\s*[:：]?\\s*(.*)$`);
                const memberMatch = workingLine.match(memberPrefixRegex);
                if (memberMatch) {
                    matchedFriend = f;
                    senderName = f.name;
                    content = memberMatch[1].trim();
                    break;
                }
            }

            // 步骤 C：若没有在已知群成员中前缀命中，走通用正则抽取姓名与正文
            if (!matchedFriend) {
                const genericMatch = workingLine.match(/^([^:：\n]{1,20})[:：]\s*(.+)$/);
                if (genericMatch) {
                    const rawName = genericMatch[1].replace(/^[【\[(（]+|[】\])）]+$/g, '').trim();
                    content = genericMatch[2].trim();
                    matchedFriend = sortedMembers.find(f => f.name === rawName || rawName.includes(f.name) || f.name.includes(rawName));
                    senderName = matchedFriend ? matchedFriend.name : rawName;
                }
            }

            // 步骤 D：如果提取到了有效内容
            if (senderName && content) {
                content = content.replace(/^[:：]\s*/, '').trim();
                const avatarColor = matchedFriend ? matchedFriend.avatarColor : this._getAvatarColor(senderName);
                const senderId = matchedFriend ? matchedFriend.id : null;

                results.push({
                    senderName: senderName,
                    senderId: senderId,
                    avatarColor: avatarColor,
                    content: content,
                });
            } else if (results.length > 0 && workingLine) {
                results[results.length - 1].content += `\n${workingLine}`;
            } else if (sortedMembers.length > 0 && workingLine) {
                const defaultFriend = sortedMembers[0];
                results.push({
                    senderName: defaultFriend.name,
                    senderId: defaultFriend.id,
                    avatarColor: defaultFriend.avatarColor,
                    content: workingLine,
                });
            }
        }

        return results;
    }

    /**
     * 核心：向好友发送私聊消息并调用 AI 响应
     * 1. 彻底移除底层的历史硬编码注入（不再从 sessionHistory 隐式硬塞 messages）
     * 2. 调用 AI 接口获取符合时间+人名格式的回复
     * 3. 自动将本轮互动记录封装为带 summary 和 details 的日志附到酒馆正文最新一楼末尾
     */
    static async sendMessageToFriend(friendId, userText, { skipAppendUser = false } = {}) {
        const friend = this.getFriend(friendId);
        if (!friend) throw new Error('好友不存在或已被删除');

        const startTime = Date.now();
        const userProfile = this.getUserProfile();
        const userName = userProfile.name || '我';
        const charName = friend.name;

        // 1. 记录用户发送的消息（重新生成时跳过重复记录）
        if (!skipAppendUser) {
            this.appendMessage(friendId, {
                sender: 'user',
                content: userText,
                type: 'text',
            });
        }

        // 2. 准备业务变量：根据当前单聊上下文动态触发世界书（World Info / Lorebook）
        let replyText = '';
        let replyItems = [];

        try {
            // 像正文聊天一样，根据当前单聊上下文（最新输入+历史会话+角色）动态激活世界书条目
            const dynamicWorldInfo = await this.resolveDynamicWorldInfoPrompt({
                friend,
                userText,
                userName,
            });

            const promptConfig = SettingsManager.getPromptConfig();
            const useTavernPreset = promptConfig.useTavernPreset !== false;

            // 业务端 0 提示词！单聊中仅有 user_name 与 char_name，彻底告别底层黑盒历史注入
            const messages = PromptManager.buildMessagesPayload({
                appId: 'qq',
                userMessage: userText,
                variables: {
                    phase: '单聊',          // 核心场景状态变量：当前为单聊
                    chat_type: '单聊',      // 别名
                    is_group: false,
                    user_name: userName,   // 默认为“我”，可在 QQ 设置修改
                    sender_name: userName,
                    char_name: charName,   // 会话中对方
                    friend_name: charName,
                    content: userText,
                    message: userText,
                    lorebook: dynamicWorldInfo,
                    qq_number: friend.qqNumber || '',
                },
                useTavernPreset: useTavernPreset,
            });

            // 3. 调用 AI 接口
            const result = await ApiService.sendChatCompletion(messages);
            replyText = result.reply || '(对方未回复)';

            // 4. 将 AI 回复拆分为单条独立消息分别推入该好友的专属会话历史（保证每条消息都是独立气泡与独立条目，绝不黏在一起）
            replyItems = PhoneLogService.extractIndividualReplyMessages(replyText);
            for (const item of replyItems) {
                this.appendMessage(friendId, {
                    sender: 'friend',
                    content: item,
                    type: 'text',
                });
            }

            const duration = Date.now() - startTime;
            OperationLogService.log({
                module: 'QQ单聊',
                action: '收到回复',
                status: 'success',
                detail: `对方: ${charName} | 耗时: ${duration}ms`,
            });
        } catch (err) {
            const errMsg = (err?.message || String(err)).slice(0, 35);
            OperationLogService.log({
                module: 'QQ单聊',
                action: '发送消息',
                status: 'error',
                detail: `对方: ${charName} | 错误: ${errMsg}`,
            });
            throw err;
        }

        // 5. 核心：将每一次的消息直接附到酒馆最新一楼末尾，包裹带 summary 与 details 标签并持久化保存
        try {
            await PhoneLogService.appendInteractionToTavernChat({
                appName: 'QQ',
                friendId: friendId,
                charName: charName,
                userName: userName,
                userText: userText,
                replyText: replyText,
                timestamp: Date.now(),
            });
        } catch (logErr) {
            console.warn('[QQManager] 追加手机记录至酒馆正文出错:', logErr);
        }

        return replyItems;
    }

    /**
     * 像正文聊天一样，根据当前单聊上下文（最新输入 + 历史对话 + 角色信息）动态扫描并触发世界书
     * @param {object} params
     * @param {object} params.friend 好友对象
     * @param {string} params.userText 用户最新发送的文本
     * @param {string} [params.userName='我'] 用户名称
     * @param {number} [params.maxDepth=10] 上下文扫描消息条数深度
     * @returns {Promise<string>} 组装好的触发世界书内容（作为 {{lorebook}} 变量注入）
     */
    static async resolveDynamicWorldInfoPrompt({ friend, userText, userName = '我', maxDepth = 10 }) {
        if (!friend) return '';

        const charName = friend.name || '';
        const friendId = friend.id || friend.qqNumber;
        const history = this.getSession(friendId) || [];
        const recentMsgs = history.slice(-Math.max(1, maxDepth));

        // 1. 构建用于世界书解析的消息结构（单聊最近上下文 + 当前用户输入）
        const resolverMessages = [];
        for (const msg of recentMsgs) {
            resolverMessages.push({
                name: msg.sender === 'user' ? userName : charName,
                is_user: msg.sender === 'user',
                is_system: false,
                mes: String(msg.content || '').trim(),
            });
        }

        // 确保包含用户当前发送的内容
        const cleanUserText = String(userText || '').trim();
        if (cleanUserText && (resolverMessages.length === 0 || resolverMessages[resolverMessages.length - 1].mes !== cleanUserText)) {
            resolverMessages.push({
                name: userName,
                is_user: true,
                is_system: false,
                mes: cleanUserText,
            });
        }

        const collectedEntries = [];

        // 2. 通道 1：优先尝试酒馆原生 resolveWorldInfoForMessages（享受与正文完全一致的递归与深度匹配）
        try {
            const context = (typeof Luker !== 'undefined' && Luker.getContext)
                ? Luker.getContext()
                : (typeof getContext === 'function' ? getContext() : null);

            const resolveFn = context?.resolveWorldInfoForMessages
                || (typeof resolveWorldInfoForMessages === 'function' ? resolveWorldInfoForMessages : null);

            if (typeof resolveFn === 'function') {
                const resolution = await resolveFn(resolverMessages, {
                    type: 'quiet',
                    fallbackToCurrentChat: false,
                });

                if (resolution) {
                    if (Array.isArray(resolution.worldInfoBeforeEntries)) {
                        for (const item of resolution.worldInfoBeforeEntries) {
                            if (item && typeof item === 'string') collectedEntries.push(item);
                        }
                    }
                    if (Array.isArray(resolution.worldInfoAfterEntries)) {
                        for (const item of resolution.worldInfoAfterEntries) {
                            if (item && typeof item === 'string') collectedEntries.push(item);
                        }
                    }
                    if (Array.isArray(resolution.worldInfoDepth)) {
                        for (const depthItem of resolution.worldInfoDepth) {
                            if (Array.isArray(depthItem?.entries)) {
                                for (const item of depthItem.entries) {
                                    if (item && typeof item === 'string') collectedEntries.push(item);
                                }
                            }
                        }
                    }
                    if (Array.isArray(resolution.anBefore)) {
                        for (const item of resolution.anBefore) {
                            if (item && typeof item === 'string') collectedEntries.push(item);
                        }
                    }
                    if (Array.isArray(resolution.anAfter)) {
                        for (const item of resolution.anAfter) {
                            if (item && typeof item === 'string') collectedEntries.push(item);
                        }
                    }
                    if (Array.isArray(resolution.activatedEntries)) {
                        for (const act of resolution.activatedEntries) {
                            if (act?.content && typeof act.content === 'string') {
                                collectedEntries.push(act.content);
                            }
                        }
                    }
                }
            }
        } catch (nativeErr) {
            console.warn('[QQManager] 调用原生 resolveWorldInfoForMessages 异常，将使用内建扫描器补充:', nativeErr);
        }

        // 3. 通道 2：高穿透内建关键词匹配引擎（穿透角色卡绑定的全部主世界书、额外世界书、会话世界书、内嵌世界书）
        try {
            const worldData = await this.scanCurrentCharacterWorldEntries();
            const entries = worldData?.entries || [];

            if (entries.length > 0) {
                // 汇总单聊上下文的所有文本用于关键词扫描
                const friendKeys = Array.isArray(friend.keys)
                    ? friend.keys
                    : (typeof friend.keys === 'string' ? friend.keys.split(',') : []);

                const scanCorpusParts = [
                    userName,
                    charName,
                    friend.remark || '',
                    ...friendKeys,
                    ...resolverMessages.map(m => m.mes),
                ];
                const scanCorpus = scanCorpusParts.filter(Boolean).join('\n').toLowerCase();

                for (const entry of entries) {
                    if (entry.enabled === false || !entry.content || !entry.content.trim()) continue;

                    // 常驻条目直接激活
                    if (entry.constant) {
                        collectedEntries.push(entry.content);
                        continue;
                    }

                    // 检查关键词 (keys) 命中
                    const keys = Array.isArray(entry.keys) ? entry.keys : [];
                    let isMatched = false;
                    for (const k of keys) {
                        const cleanKey = String(k || '').trim().toLowerCase();
                        if (cleanKey && scanCorpus.includes(cleanKey)) {
                            isMatched = true;
                            break;
                        }
                    }

                    // 检查条目名称命中（若名称>=2字符且出现在对话中）
                    if (!isMatched && entry.name) {
                        const cleanName = String(entry.name).trim().toLowerCase();
                        if (cleanName.length >= 2 && scanCorpus.includes(cleanName)) {
                            isMatched = true;
                        }
                    }

                    if (isMatched) {
                        collectedEntries.push(entry.content);
                    }
                }
            }
        } catch (scanErr) {
            console.warn('[QQManager] 内建世界书扫描匹配异常:', scanErr);
        }

        // 4. 通道 3：好友专属角色人设（守护好友基本性格，去重融合）
        const friendPersona = String(friend.personaPrompt || '').trim();
        const finalEntries = [];
        const seenTexts = new Set();

        // 如果好友有独立基础人设设定，优先将其作为核心人设保留
        if (friendPersona) {
            finalEntries.push(friendPersona);
            seenTexts.add(friendPersona);
        }

        // 逐一去重添加上下文动态触发的世界书条目
        for (const rawItem of collectedEntries) {
            const trimmed = String(rawItem || '').trim();
            if (!trimmed || seenTexts.has(trimmed)) continue;

            // 如果该条目已经完全被 friendPersona 包含，或者包含 friendPersona，做合理去重
            if (friendPersona && friendPersona.includes(trimmed)) {
                continue;
            }

            seenTexts.add(trimmed);
            finalEntries.push(trimmed);
        }

        const resultPrompt = finalEntries.join('\n\n').trim();
        console.debug(`[QQManager] 单聊世界书动态触发完毕: 共激活 ${finalEntries.length} 条设定 (包含好友人设 + 上下文触发条目)`);
        return resultPrompt;
    }

    /**
     * 自动扫描当前角色卡关联的所有世界书及条目
     * 具备超强穿透性：
     * 1. 角色主世界书（char.data.extensions.world, char.world, DOM 选中的世界书）
     * 2. 角色辅助世界书（world_info.charLore, getCharaAuxWorlds）
     * 3. 角色内嵌打包世界书（char.data.character_book）
     * 4. 当前会话绑定的世界书（chat_metadata.world_info）
     * 5. 若上述均未指定：自动无缝回退读取酒馆当前全局激活的世界书或已载入的所有世界书！
     * 绝不让用户扑空！
     * @returns {Promise<{ characterName: string, characterKey: string, boundBooks: string[], entries: Array<{ uid, worldName, name, keys, content, snippet }> }>}
     */
    static async scanCurrentCharacterWorldEntries() {
        const currentChar = this.getCurrentCharacter();
        const char = currentChar.charData;
        const boundBooks = [];

        const context = (typeof Luker !== 'undefined' && Luker.getContext)
            ? Luker.getContext()
            : getContext();

        if (char) {
            // 1. 角色主世界书
            // 1.1 char.data.extensions.world
            if (char.data?.extensions?.world) {
                boundBooks.push(char.data.extensions.world);
            }
            // 1.2 char.world (旧格式/直传字段)
            if (char.world) {
                boundBooks.push(char.world);
            }
            // 1.3 char.data.world
            if (char.data?.world) {
                boundBooks.push(char.data.world);
            }
            // 1.4 DOM 当前正在展示选中的世界书
            const domWorld = $('#character_world').val();
            if (domWorld) {
                boundBooks.push(domWorld);
            }

            // 2. 辅助世界书 (Auxiliary World Books)
            const fileNamesToTry = [
                char.avatar,
                char.avatar ? char.avatar.replace(/\.[^/.]+$/, '') : null,
                char.name,
            ].filter(Boolean);

            for (const fname of fileNamesToTry) {
                try {
                    if (typeof world_info !== 'undefined' && Array.isArray(world_info?.charLore)) {
                        const loreEntry = world_info.charLore.find(e => e.name === fname);
                        if (loreEntry && Array.isArray(loreEntry.extraBooks)) {
                            boundBooks.push(...loreEntry.extraBooks);
                        }
                    }
                } catch (_) {}

                try {
                    const getAuxFn = context?.getCharaAuxWorlds || (typeof getCharaAuxWorlds === 'function' ? getCharaAuxWorlds : null);
                    if (getAuxFn) {
                        const aux = getAuxFn(fname);
                        if (Array.isArray(aux)) boundBooks.push(...aux);
                    }
                } catch (_) {}
            }
        }

        // 3. 如果是群聊，收集群内成员角色的世界书
        if (currentChar.isGroup && currentChar.groupData?.members) {
            const characters = context?.characters ?? window.characters ?? [];
            for (const memberId of currentChar.groupData.members) {
                const memberChar = characters[memberId] || (Array.isArray(characters) ? characters.find(c => c && (c.avatar === memberId || c.name === memberId)) : null);
                if (memberChar) {
                    if (memberChar.data?.extensions?.world) boundBooks.push(memberChar.data.extensions.world);
                    if (memberChar.world) boundBooks.push(memberChar.world);
                }
            }
        }

        // 4. 当前会话 (Chat) 绑定的世界书
        try {
            const getChatNamesFn = context?.chatWorldInfo?.getNames || (typeof getChatWorldInfoNames === 'function' ? getChatWorldInfoNames : null);
            if (getChatNamesFn) {
                const chatWorlds = getChatNamesFn();
                if (Array.isArray(chatWorlds)) boundBooks.push(...chatWorlds);
            }
        } catch (_) {}

        try {
            const rawChatWi = context?.chatMetadata?.world_info || (typeof chat_metadata !== 'undefined' ? chat_metadata?.world_info : null);
            if (rawChatWi) {
                if (Array.isArray(rawChatWi)) boundBooks.push(...rawChatWi);
                else if (typeof rawChatWi === 'string') boundBooks.push(rawChatWi);
            }
        } catch (_) {}

        // 5. 若角色卡本身未显式写死世界书：读取酒馆当前全局激活的世界书 (Global World Info)
        if (boundBooks.length === 0) {
            const globalSelection = context?.chatWorldInfo?.globalSelection;
            if (Array.isArray(globalSelection) && globalSelection.length > 0) {
                boundBooks.push(...globalSelection);
            } else if (typeof selected_world_info !== 'undefined' && Array.isArray(selected_world_info) && selected_world_info.length > 0) {
                boundBooks.push(...selected_world_info);
            } else if (context?.worldInfo?.globalSelect && Array.isArray(context.worldInfo.globalSelect) && context.worldInfo.globalSelect.length > 0) {
                boundBooks.push(...context.worldInfo.globalSelect);
            }
        }

        // 6. 极端兜底：如果角色卡、聊天、全局激活全都没配置，但酒馆已载入了世界书：
        // 自动提取酒馆已存在的世界书作为备选，绝对不让用户处于“无条目可用”的死胡同
        if (boundBooks.length === 0) {
            const allKnownBooks = [];
            try {
                if (typeof world_names !== 'undefined' && Array.isArray(world_names)) {
                    allKnownBooks.push(...world_names);
                } else if (typeof context?.getWorldInfoNames === 'function') {
                    allKnownBooks.push(...context.getWorldInfoNames());
                }
            } catch (_) {}

            $('#world_editor_select option, #world_info option').each((_, el) => {
                const val = $(el).text().trim();
                if (val && !val.includes('---')) allKnownBooks.push(val);
            });

            if (allKnownBooks.length > 0) {
                boundBooks.push(...allKnownBooks);
            }
        }

        // 去重并过滤空白
        const uniqueBooks = [...new Set(boundBooks.map(b => String(b || '').trim()).filter(Boolean))];

        // 7. 提取角色卡卡内嵌入的世界书 (data.character_book)
        const embeddedEntries = [];
        const charBook = char?.data?.character_book || char?.character_book;
        if (charBook?.entries && Array.isArray(charBook.entries)) {
            charBook.entries.forEach((entry, idx) => {
                if (!entry) return;
                const keys = Array.isArray(entry.keys)
                    ? entry.keys
                    : (typeof entry.keys === 'string' ? entry.keys.split(',').map(s => s.trim()).filter(Boolean) : []);
                const name = entry.comment
                    || (keys.length > 0 ? keys[0] : '')
                    || `卡内设定条目 #${idx + 1}`;
                const content = entry.content || '';
                embeddedEntries.push({
                    uid: entry.id ?? (idx + 10000),
                    worldName: charBook.name || `${currentChar.name}卡内内置世界书`,
                    name: name,
                    keys: keys,
                    content: content,
                    snippet: content.replace(/[\r\n\t]+/g, ' ').slice(0, 90),
                    enabled: entry.enabled !== false,
                    constant: Boolean(entry.constant),
                });
            });
        }

        // 8. 并发抓取所有外部世界书条目
        const externalPromises = uniqueBooks.map(bName => this._fetchWorldInfoEntries(bName));
        const externalResults = await Promise.all(externalPromises);

        const mergedEntries = [...embeddedEntries];
        for (const entries of externalResults) {
            mergedEntries.push(...entries);
        }

        // 按名字去重，避免重复条目干扰
        const dedupedEntries = [];
        const seenNames = new Set();
        for (const item of mergedEntries) {
            const cleanName = item.name.trim();
            if (!cleanName || seenNames.has(cleanName)) continue;
            seenNames.add(cleanName);
            dedupedEntries.push(item);
        }

        return {
            characterName: currentChar.name,
            characterKey: currentChar.key,
            boundBooks: uniqueBooks,
            entries: dedupedEntries,
        };
    }

    /**
     * 读取指定世界书的全部条目（双通道：优先 context.loadWorldInfo 内存读取，备选 /api/worldinfo/get 接口）
     */
    static async _fetchWorldInfoEntries(bookName) {
        if (!bookName) return [];
        try {
            const context = (typeof Luker !== 'undefined' && Luker.getContext)
                ? Luker.getContext()
                : getContext();

            let rawEntries = null;

            // 通道 1：优先使用酒馆官方 context.loadWorldInfo(bookName) 毫秒级内存缓存
            if (context && typeof context.loadWorldInfo === 'function') {
                try {
                    const bookData = await context.loadWorldInfo(bookName);
                    if (bookData && bookData.entries) {
                        rawEntries = bookData.entries;
                    }
                } catch (err) {
                    console.debug(`[QQManager] loadWorldInfo 内存读取未命中，转入 HTTP 接口:`, err);
                }
            }

            // 通道 2：HTTP POST /api/worldinfo/get
            if (!rawEntries) {
                const headers = (context && typeof context.getRequestHeaders === 'function')
                    ? context.getRequestHeaders()
                    : { 'Content-Type': 'application/json' };

                const resp = await fetch('/api/worldinfo/get', {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({ name: bookName }),
                });

                if (resp.ok) {
                    const data = await resp.json();
                    rawEntries = data?.entries || {};
                }
            }

            if (!rawEntries) return [];

            const entriesArray = Array.isArray(rawEntries) ? rawEntries : Object.values(rawEntries);

            return entriesArray.map((entry, idx) => {
                const keys = Array.isArray(entry.key)
                    ? entry.key
                    : (Array.isArray(entry.keys)
                        ? entry.keys
                        : (typeof entry.key === 'string' ? entry.key.split(',').map(s => s.trim()).filter(Boolean) : []));

                const name = entry.comment
                    || (keys.length > 0 ? keys[0] : '')
                    || `条目 #${entry.uid ?? (idx + 1)}`;

                const content = entry.content || '';
                const snippet = content.replace(/[\r\n\t]+/g, ' ').slice(0, 90);

                return {
                    uid: entry.uid ?? (idx + 1),
                    worldName: bookName,
                    name: name,
                    keys: keys,
                    content: content,
                    snippet: snippet,
                    enabled: entry.enabled !== false,
                    constant: Boolean(entry.constant),
                };
            });
        } catch (e) {
            console.error(`[QQManager] 解析世界书 [${bookName}] 出错:`, e);
            return [];
        }
    }

    /**
     * 批量导入选中的世界书条目为当前角色卡的 QQ 好友
     * @param {Array<{ uid: number, worldName: string, name: string, keys: string[], content: string }>} selectedEntries
     */
    static importFriendsFromWorldInfo(selectedEntries) {
        if (!Array.isArray(selectedEntries) || selectedEntries.length === 0) return [];

        const added = [];
        for (const entry of selectedEntries) {
            // 检查当前角色下是否已有同名好友
            const existing = this.getFriends().find(f => f.name === entry.name);
            if (existing) {
                // 如果已存在，更新其关键词与人设
                existing.keys = [...new Set([...existing.keys, ...entry.keys])];
                if (entry.content) existing.personaPrompt = entry.content;
                added.push(existing);
                continue;
            }

            const newFriend = this.addFriend({
                name: entry.name,
                qqNumber: this._generateRandomQQ(),
                remark: '',
                signature: '',
                keys: entry.keys,
                personaPrompt: entry.content,
                sourceWorld: entry.worldName,
            });
            added.push(newFriend);
        }

        try {
            OperationLogService.log({
                module: 'QQ通讯录',
                action: '导入好友',
                status: 'success',
                detail: `成功导入/更新 ${added.length} 位好友`,
            });
        } catch (_) {}

        return added;
    }

    /**
     * 生成随机 8 位 QQ 靓号
     */
    static _generateRandomQQ() {
        return String(Math.floor(10000000 + Math.random() * 90000000));
    }

    /**
     * 根据名字哈希生成高饱和度莫兰迪色头像背景
     */
    static _getAvatarColor(name = '') {
        const colors = [
            '#2563eb', '#3b82f6', '#0284c7', '#0d9488',
            '#16a34a', '#d97706', '#ea580c', '#e11d48',
            '#9333ea', '#7c3aed', '#4f46e5', '#db2777'
        ];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    }
}

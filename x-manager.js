import { getContext, saveMetadataDebounced } from '../../../extensions.js';
import { ApiService } from './api-service.js';
import { PromptManager } from './prompt-manager.js';
import { SettingsManager } from './settings-manager.js';
import { QQManager } from './qq-manager.js';
import { OperationLogService } from './operation-log-service.js';

/**
 * XManager
 * 社交平台 X (推特) 核心业务与数据管理层
 * 
 * 核心升级与机制：
 * 1. 动态生成并深度嵌入酒馆正文（带规范折叠标签与当前轮次 ID）
 * 2. 轮次记录管理：每轮动态独立保存于【记录】页签，包含生成时间、推文与互动全量快照
 * 3. 历史自由切换：点击记录条目即可切换至对应轮次的动态页面进行查阅与互动
 * 4. 用户发布动态或回复评论后，自动调用 AI 模拟世界观内角色进行跟评回响，并原地同步更新该轮正文与记录
 * 5. 刷新动态时：开启全新轮次，历史轮次正文天然保留，新一轮动态追加写入正文并记入【记录】
 * 6. 独立清除机制：在任何历史轮次中点击清空，或在记录列表中点击删除，将该轮消息和正文彻底清除
 * 7. 热搜榜单保持独立生成与浏览，无需嵌正文
 */
export class XManager {
    /**
     * 获取当前会话元数据根对象
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
     * 持久化保存元数据
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
            console.warn('[XManager] saveChatMetadata 异常:', e);
        }
    }

    /**
     * 获取当前聊天中 X 的完整数据集（带多轮记录兼容迁移）
     */
    static getXData() {
        const meta = this.getChatMetadata();
        if (!meta.small_phone) {
            meta.small_phone = {};
        }
        if (!meta.small_phone.x || typeof meta.small_phone.x !== 'object') {
            meta.small_phone.x = {
                currentRoundId: `round_${Date.now()}`,
                activeRoundId: `round_${Date.now()}`,
                rounds: [],
                feeds: [],
                hotTrends: [],
                lastGuidance: '',
            };
        }

        const x = meta.small_phone.x;
        if (!Array.isArray(x.hotTrends)) x.hotTrends = [];
        if (!Array.isArray(x.feeds)) x.feeds = [];

        // 迁移与兼容：若 rounds 尚未初始化，将存量 feeds 打包为首个轮次
        if (!Array.isArray(x.rounds)) {
            x.rounds = [];
            if (x.feeds.length > 0) {
                const legacyRoundId = x.currentRoundId || `round_${Date.now()}`;
                x.rounds.push({
                    id: legacyRoundId,
                    createdAt: Date.now(),
                    guidance: x.lastGuidance || '',
                    feeds: JSON.parse(JSON.stringify(x.feeds)),
                });
            }
        }

        // 确定活跃轮次 ID
        if (!x.activeRoundId) {
            x.activeRoundId = x.rounds[0]?.id || x.currentRoundId || `round_${Date.now()}`;
        }
        if (!x.currentRoundId) {
            x.currentRoundId = x.activeRoundId;
        }

        // 保证 feeds 总是与当前活跃轮次的数据保持一致
        const activeRound = x.rounds.find(r => r.id === x.activeRoundId);
        if (activeRound && Array.isArray(activeRound.feeds)) {
            x.feeds = activeRound.feeds;
        }

        return x;
    }

    /**
     * 保存 X 数据集
     */
    static saveXData(xData) {
        const meta = this.getChatMetadata();
        if (!meta.small_phone) meta.small_phone = {};
        meta.small_phone.x = xData;
        this.saveChatMetadata();
    }

    /**
     * 获取所有轮次记录列表（时间倒序）
     * @returns {Array<Object>}
     */
    static getRounds() {
        const xData = this.getXData();
        return Array.isArray(xData.rounds) ? xData.rounds : [];
    }

    /**
     * 获取当前活跃（正在查看/互动）的轮次对象
     * @returns {Object|null}
     */
    static getActiveRound() {
        const xData = this.getXData();
        if (!Array.isArray(xData.rounds)) xData.rounds = [];

        let round = xData.rounds.find(r => r.id === xData.activeRoundId);
        if (!round && xData.rounds.length > 0) {
            round = xData.rounds[0];
            xData.activeRoundId = round.id;
            xData.feeds = round.feeds || [];
        }
        return round || null;
    }

    /**
     * 切换当前活跃轮次
     * @param {string} roundId 
     * @returns {Object|null}
     */
    static setActiveRound(roundId) {
        if (!roundId) return null;
        const xData = this.getXData();
        if (!Array.isArray(xData.rounds)) return null;

        const round = xData.rounds.find(r => r.id === roundId);
        if (!round) return null;

        xData.activeRoundId = round.id;
        xData.currentRoundId = round.id;
        xData.feeds = round.feeds || [];
        this.saveXData(xData);
        return round;
    }

    /**
     * 获取当前轮次的动态列表（画面展示用）
     */
    static getFeeds() {
        const activeRound = this.getActiveRound();
        if (activeRound && Array.isArray(activeRound.feeds)) {
            return activeRound.feeds;
        }
        const xData = this.getXData();
        return xData.feeds || [];
    }

    /**
     * 辅助：将当前活跃轮次的 feeds 与全局 feeds 同步写回保存
     */
    static _syncActiveRoundAndSave(xData) {
        const activeRound = this.getActiveRound();
        if (activeRound) {
            activeRound.feeds = xData.feeds;
        }
        this.saveXData(xData);
    }

    /**
     * 获取热搜榜单列表
     */
    static getHotTrends() {
        const xData = this.getXData();
        return xData.hotTrends || [];
    }

    /**
     * 格式化当前轮次动态为嵌入酒馆正文的 Markdown Details 文本
     * @param {string} roundId 
     * @param {Array<Object>} feeds 
     * @returns {string}
     */
    static formatRoundToMarkdownDetails(roundId, feeds = []) {
        if (!Array.isArray(feeds) || feeds.length === 0) {
            return '';
        }

        const lines = [];
        let totalCommentsCount = 0;

        for (const feed of feeds) {
            const author = feed.author_name || '网友';
            const handle = feed.author_handle ? `@${feed.author_handle}` : '';
            const isAnon = feed.is_anonymous ? '【匿名】' : '';
            const feedText = (feed.content || '').replace(/\r?\n/g, ' ');
            
            lines.push(`- ${author} (${handle})${isAnon}：${feedText}`);

            if (Array.isArray(feed.comments) && feed.comments.length > 0) {
                totalCommentsCount += feed.comments.length;
                for (const c of feed.comments) {
                    const cAuthor = c.author_name || '网友';
                    const cHandle = c.author_handle ? `@${c.author_handle}` : '';
                    const cText = (c.content || '').replace(/\r?\n/g, ' ');
                    lines.push(`  └─ ${cAuthor} (${cHandle})：${cText}`);
                }
            }
        }

        const detailsHeader = `<details class="narrative-phone-log" data-app="X" data-x-round="${roundId}">\n<summary>📱 社交动态 X（共 ${feeds.length} 条动态 · ${totalCommentsCount} 条互动）</summary>\n\n【社交平台 X · 动态流】\n${lines.join('\n')}\n\n</details>`;
        return detailsHeader;
    }

    /**
     * 同步指定轮次或当前活跃轮次的全部动态与互动至酒馆正文最新一楼
     * @param {string} [targetRoundId] 指定轮次 ID（默认当前活跃轮次）
     * @param {Array<Object>} [targetFeeds] 指定动态列表（默认当前活跃轮次推文）
     */
    static async syncCurrentRoundToTavernChat(targetRoundId = null, targetFeeds = null) {
        try {
            const xData = this.getXData();
            const activeRound = this.getActiveRound();
            const roundId = targetRoundId || activeRound?.id || xData.activeRoundId || xData.currentRoundId;
            const feeds = targetFeeds || activeRound?.feeds || xData.feeds || [];

            const context = (typeof Luker !== 'undefined' && Luker.getContext)
                ? Luker.getContext()
                : (typeof getContext === 'function' ? getContext() : null);

            if (!context || !Array.isArray(context.chat) || context.chat.length === 0) {
                return { success: false, reason: '未在有效聊天中' };
            }

            const lastIndex = context.chat.length - 1;
            const lastMessage = context.chat[lastIndex];
            if (!lastMessage) return { success: false };

            const currentMes = String(lastMessage.mes || '');
            const newBlock = this.formatRoundToMarkdownDetails(roundId, feeds);

            // 匹配正文最新一楼是否已经存在当前 roundId 的日志块
            const roundRegex = new RegExp(`(<details\\s+[^>]*class=["']narrative-phone-log["'][^>]*data-x-round=["']${roundId}["'][^>]*>)[\\s\\S]*?<\\/details>`, 'i');

            let updatedMes = currentMes;

            if (roundRegex.test(currentMes)) {
                if (newBlock) {
                    // 原地替换更新该轮次
                    updatedMes = currentMes.replace(roundRegex, newBlock);
                } else {
                    // 若内容已空，切除该日志块
                    updatedMes = currentMes.replace(roundRegex, '').replace(/\n{3,}/g, '\n\n').trimEnd();
                }
            } else if (newBlock) {
                // 原地追加在末尾
                updatedMes = currentMes.trimEnd() ? `${currentMes.trimEnd()}\n\n${newBlock}` : newBlock;
            }

            if (updatedMes !== currentMes) {
                lastMessage.mes = updatedMes;

                // 更新 DOM
                const updateFn = context.updateMessageBlock || (typeof updateMessageBlock === 'function' ? updateMessageBlock : null);
                if (typeof updateFn === 'function') {
                    updateFn(lastIndex, lastMessage);
                }

                // 持久化保存
                const saveFn = context.saveChat || context.saveChatConditional || (typeof saveChatConditional === 'function' ? saveChatConditional : null);
                if (typeof saveFn === 'function') {
                    await saveFn();
                } else if (typeof context.saveChatDebounced === 'function') {
                    context.saveChatDebounced();
                }

                // 广播事件
                if (context.eventSource && context.event_types?.MESSAGE_UPDATED) {
                    context.eventSource.emit(context.event_types.MESSAGE_UPDATED, lastIndex);
                }
            }

            return { success: true };
        } catch (err) {
            console.error('[XManager] 同步当前轮次动态至正文失败:', err);
            return { success: false, error: err.message };
        }
    }

    /**
     * 从酒馆正文中移除指定的 X 轮次嵌入记录（或彻底清理所有 X 动态记录）
     * @param {string} [roundId] 轮次 ID
     * @param {boolean} [cleanAll=false] 是否清理正文中所有历史 X 动态记录
     * @returns {Promise<boolean>} 是否有正文内容被修改并保存
     */
    static async removeRoundFromTavernChat(roundId, cleanAll = false) {
        try {
            const context = (typeof Luker !== 'undefined' && Luker.getContext)
                ? Luker.getContext()
                : (typeof getContext === 'function' ? getContext() : null);

            if (!context || !Array.isArray(context.chat) || context.chat.length === 0) {
                return false;
            }

            let roundRegex;
            if (cleanAll || !roundId) {
                roundRegex = /\s*<details\s+[^>]*class=["']narrative-phone-log["'][^>]*data-app=["']X["'][^>]*>[\s\S]*?<\/details>/gi;
            } else {
                roundRegex = new RegExp(`\\s*<details\\s+[^>]*class=["']narrative-phone-log["'][^>]*data-x-round=["']${roundId}["'][^>]*>[\\s\\S]*?<\\/details>`, 'gi');
            }

            let modified = false;

            for (let i = 0; i < context.chat.length; i++) {
                const msg = context.chat[i];
                if (msg && typeof msg.mes === 'string' && roundRegex.test(msg.mes)) {
                    msg.mes = msg.mes.replace(roundRegex, '').replace(/\n{3,}/g, '\n\n').trimEnd();
                    modified = true;

                    const updateFn = context.updateMessageBlock || (typeof updateMessageBlock === 'function' ? updateMessageBlock : null);
                    if (typeof updateFn === 'function') updateFn(i, msg);
                }
            }

            if (modified) {
                const saveFn = context.saveChat || context.saveChatConditional || (typeof saveChatConditional === 'function' ? saveChatConditional : null);
                if (typeof saveFn === 'function') {
                    await saveFn();
                } else if (typeof context.saveChatDebounced === 'function') {
                    context.saveChatDebounced();
                }

                if (context.eventSource && context.event_types?.MESSAGE_UPDATED) {
                    context.eventSource.emit(context.event_types.MESSAGE_UPDATED, context.chat.length - 1);
                }
            }

            return modified;
        } catch (err) {
            console.error('[XManager] 移除正文 X 动态嵌入记录异常:', err);
            return false;
        }
    }

    /**
     * 清除指定轮次（默认清除当前活跃轮次）
     * 连带将嵌入正文的对应轮次记录彻底切除
     * @param {string} [roundId] 目标轮次 ID
     */
    static async clearRound(roundId = null) {
        const xData = this.getXData();
        const targetRoundId = roundId || xData.activeRoundId || xData.currentRoundId;

        try {
            // 1. 从正文中精准切除该轮次
            if (targetRoundId) {
                await this.removeRoundFromTavernChat(targetRoundId, false);
            }

            // 2. 从 rounds 列表中移除该轮
            if (Array.isArray(xData.rounds)) {
                xData.rounds = xData.rounds.filter(r => r.id !== targetRoundId);
            }

            // 3. 处理活跃轮次自动切换
            if (xData.rounds && xData.rounds.length > 0) {
                const nextActive = xData.rounds[0];
                xData.activeRoundId = nextActive.id;
                xData.currentRoundId = nextActive.id;
                xData.feeds = nextActive.feeds || [];
            } else {
                const emptyRoundId = `round_${Date.now()}`;
                xData.activeRoundId = emptyRoundId;
                xData.currentRoundId = emptyRoundId;
                xData.feeds = [];
            }

            this.saveXData(xData);

            try {
                OperationLogService.log({
                    module: 'X社交',
                    action: '清除轮次记录',
                    status: 'success',
                    detail: `已清除轮次与对应正文 (${targetRoundId})`,
                });
            } catch (_) {}

            return { success: true };
        } catch (err) {
            console.error('[XManager] 清除轮次失败:', err);
            return { success: false, error: err.message };
        }
    }


    /**
     * 点赞/取消点赞动态
     * @param {string} feedId
     * @returns {{ success: boolean, isLiked: boolean, likes: number }}
     */
    static toggleLike(feedId) {
        if (!feedId) return { success: false, isLiked: false, likes: 0 };
        const xData = this.getXData();
        const feed = xData.feeds.find(f => f.id === feedId);
        if (!feed) return { success: false, isLiked: false, likes: 0 };

        feed.isLiked = !feed.isLiked;
        feed.likes = Math.max(0, (feed.likes || 0) + (feed.isLiked ? 1 : -1));
        this._syncActiveRoundAndSave(xData);

        return {
            success: true,
            isLiked: feed.isLiked,
            likes: feed.likes,
        };
    }

    /**
     * 用户发推（支持实名与匿名），发布后立即同步正文，并触发角色跟评互动
     * @param {Object} params
     * @param {string} params.content 推文正文
     * @param {boolean} [params.isAnonymous=false] 是否匿名发布
     * @returns {Promise<{ tweet: Object, reactionsPromise: Promise<Array<Object>> }>}
     */
    static async postUserTweet({ content, isAnonymous = false }) {
        const cleanContent = String(content || '').trim();
        if (!cleanContent) {
            throw new Error('推文内容不能为空');
        }

        const xData = this.getXData();
        const userProfile = QQManager.getUserProfile ? QQManager.getUserProfile() : { name: '我' };
        const realName = userProfile.name || '我';

        const tweetId = `user_tweet_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

        let authorName = realName;
        let authorHandle = `user_${Math.floor(Math.random() * 8999 + 1000)}`;
        if (isAnonymous) {
            const randSuffix = Math.floor(Math.random() * 8999 + 1000);
            authorName = `匿名用户_${randSuffix}`;
            authorHandle = `anon_${randSuffix}`;
        }

        const newTweet = {
            id: tweetId,
            author_name: authorName,
            author_handle: authorHandle,
            is_anonymous: Boolean(isAnonymous),
            is_user: true,
            time_ago: '刚刚',
            timestamp: Date.now(),
            content: cleanContent,
            likes: 0,
            isLiked: false,
            comments: [],
        };

        // 用户推文置于当前轮次列表最顶部
        xData.feeds.unshift(newTweet);
        this._syncActiveRoundAndSave(xData);

        // 1. 立即同步当前正文
        await this.syncCurrentRoundToTavernChat();

        try {
            OperationLogService.log({
                module: 'X社交',
                action: '发布推文',
                status: 'success',
                detail: `身份: ${isAnonymous ? '匿名' : '实名'} | 长度: ${cleanContent.length}字`,
            });
        } catch (_) {}

        // 2. 异步生成角色/网友对用户推文的跟评回复
        const reactionsPromise = this._generateTweetReactions(newTweet);

        return {
            tweet: newTweet,
            reactionsPromise,
        };
    }

    /**
     * 用户回复某条推文或某条评论，回复后立即同步正文，并触发对方角色的后续回响
     * @param {Object} params
     * @param {string} params.tweetId 被回复的目标推文 ID
     * @param {string} [params.replyToAuthor=''] 被回复的人名（楼中楼回复时传入）
     * @param {string} params.content 回复内容
     * @param {boolean} [params.isAnonymous=false]
     * @returns {Promise<{ comment: Object, reactionsPromise: Promise<Array<Object>> }>}
     */
    static async replyToTweet({ tweetId, replyToAuthor = '', content, isAnonymous = false }) {
        const cleanContent = String(content || '').trim();
        if (!cleanContent) {
            throw new Error('回复内容不能为空');
        }

        const xData = this.getXData();
        const tweet = xData.feeds.find(f => f.id === tweetId);
        if (!tweet) {
            throw new Error('目标推文不存在或已被删除');
        }

        if (!Array.isArray(tweet.comments)) tweet.comments = [];

        const userProfile = QQManager.getUserProfile ? QQManager.getUserProfile() : { name: '我' };
        const realName = userProfile.name || '我';

        let authorName = realName;
        let authorHandle = `user_${Math.floor(Math.random() * 8999 + 1000)}`;
        if (isAnonymous) {
            const randSuffix = Math.floor(Math.random() * 8999 + 1000);
            authorName = `匿名用户_${randSuffix}`;
            authorHandle = `anon_${randSuffix}`;
        }

        const commentText = replyToAuthor
            ? `回复 @${replyToAuthor}：${cleanContent}`
            : cleanContent;

        const userComment = {
            id: `comment_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            author_name: authorName,
            author_handle: authorHandle,
            content: commentText,
            is_user: true,
            is_anonymous: Boolean(isAnonymous),
            timestamp: Date.now(),
        };

        tweet.comments.push(userComment);
        this._syncActiveRoundAndSave(xData);

        // 1. 立即同步当前正文
        await this.syncCurrentRoundToTavernChat();

        try {
            OperationLogService.log({
                module: 'X社交',
                action: '回复推文',
                status: 'success',
                detail: `目标作者: ${tweet.author_name} | 回复内容: ${cleanContent.slice(0, 20)}...`,
            });
        } catch (_) {}

        // 2. 异步生成角色后续回响
        const reactionsPromise = this._generateReplyReactions({ tweet, userComment });

        return {
            comment: userComment,
            reactionsPromise,
        };
    }

    /**
     * 辅助内部：针对用户发推生成角色互动跟评
     */
    static async _generateTweetReactions(tweet) {
        try {
            // 获取常驻世界书条目
            let dynamicLorebook = '';
            try {
                const worldData = await QQManager.scanCurrentCharacterWorldEntries();
                const entries = worldData?.entries || [];
                const constantEntries = entries
                    .filter(e => e.enabled !== false && (typeof QQManager.isWorldInfoEntryEnabled !== 'function' || QQManager.isWorldInfoEntryEnabled(e)) && e.constant && e.content && e.content.trim())
                    .map(e => e.content.trim());
                dynamicLorebook = constantEntries.join('\n\n').trim();
            } catch (_) {}

            const promptConfig = SettingsManager.getPromptConfig();
            const useTavernPreset = promptConfig.useTavernPreset !== false;

            const userProfile = QQManager.getUserProfile ? QQManager.getUserProfile() : { name: '我' };
            const userName = userProfile.name || '我';

            const messages = PromptManager.buildMessagesPayload({
                appId: 'x',
                userMessage: `${userName} 在 X 上发布了一条新动态：“${tweet.content}”。请生成其他角色的互动评论。`,
                variables: {
                    phase: 'x_post_react',
                    chat_type: '动态',
                    tweet_content: tweet.content,
                    tweet_author: tweet.author_name,
                    lorebook: dynamicLorebook,
                },
                useTavernPreset: useTavernPreset,
            });

            const result = await ApiService.sendChatCompletion(messages);
            const rawList = this.parseJsonArray(result.reply || '');

            if (!Array.isArray(rawList) || rawList.length === 0) {
                return [];
            }

            const xData = this.getXData();
            const targetTweet = xData.feeds.find(f => f.id === tweet.id);
            if (!targetTweet) return [];

            const addedComments = [];
            for (const item of rawList) {
                if (!item.content || !String(item.content).trim()) continue;
                const c = {
                    id: `comment_${Date.now()}_${Math.floor(Math.random() * 8999 + 1000)}`,
                    author_name: String(item.author_name || '推特网友').trim(),
                    author_handle: String(item.author_handle || 'user').replace(/^@/, '').trim(),
                    content: String(item.content).trim(),
                    is_user: false,
                    timestamp: Date.now(),
                };
                targetTweet.comments.push(c);
                addedComments.push(c);
            }

            // 保存并同步正文与轮次
            this._syncActiveRoundAndSave(xData);
            await this.syncCurrentRoundToTavernChat();

            return addedComments;
        } catch (err) {
            console.warn('[XManager] 生成用户发推角色跟评失败:', err);
            return [];
        }
    }

    /**
     * 辅助内部：针对用户在推文/评论下的回复生成角色后续回响
     */
    static async _generateReplyReactions({ tweet, userComment }) {
        try {
            let dynamicLorebook = '';
            try {
                const worldData = await QQManager.scanCurrentCharacterWorldEntries();
                const entries = worldData?.entries || [];
                const constantEntries = entries
                    .filter(e => e.enabled !== false && (typeof QQManager.isWorldInfoEntryEnabled !== 'function' || QQManager.isWorldInfoEntryEnabled(e)) && e.constant && e.content && e.content.trim())
                    .map(e => e.content.trim());
                dynamicLorebook = constantEntries.join('\n\n').trim();
            } catch (_) {}

            const promptConfig = SettingsManager.getPromptConfig();
            const useTavernPreset = promptConfig.useTavernPreset !== false;

            const userProfile = QQManager.getUserProfile ? QQManager.getUserProfile() : { name: '我' };
            const userName = userProfile.name || '我';

            const messages = PromptManager.buildMessagesPayload({
                appId: 'x',
                userMessage: `${userName} 在推文（作者：${tweet.author_name}：“${tweet.content}”）下发表了评论：“${userComment.content}”。请生成角色后续回应。`,
                variables: {
                    phase: 'x_reply_react',
                    chat_type: '动态',
                    tweet_content: tweet.content,
                    tweet_author: tweet.author_name,
                    reply_content: userComment.content,
                    lorebook: dynamicLorebook,
                },
                useTavernPreset: useTavernPreset,
            });

            const result = await ApiService.sendChatCompletion(messages);
            const rawList = this.parseJsonArray(result.reply || '');

            if (!Array.isArray(rawList) || rawList.length === 0) {
                return [];
            }

            const xData = this.getXData();
            const targetTweet = xData.feeds.find(f => f.id === tweet.id);
            if (!targetTweet) return [];

            const addedReplies = [];
            for (const item of rawList) {
                if (!item.content || !String(item.content).trim()) continue;
                const c = {
                    id: `comment_${Date.now()}_${Math.floor(Math.random() * 8999 + 1000)}`,
                    author_name: String(item.author_name || tweet.author_name || '推特网友').trim(),
                    author_handle: String(item.author_handle || tweet.author_handle || 'user').replace(/^@/, '').trim(),
                    content: String(item.content).trim(),
                    is_user: false,
                    timestamp: Date.now(),
                };
                targetTweet.comments.push(c);
                addedReplies.push(c);
            }

            // 保存并同步正文与轮次
            this._syncActiveRoundAndSave(xData);
            await this.syncCurrentRoundToTavernChat();

            return addedReplies;
        } catch (err) {
            console.warn('[XManager] 生成角色回复回响失败:', err);
            return [];
        }
    }

    /**
     * 删除指定动态
     */
    static async deleteFeed(feedId) {
        if (!feedId) return false;
        const xData = this.getXData();
        const initialLen = xData.feeds.length;
        xData.feeds = xData.feeds.filter(f => f.id !== feedId);
        if (xData.feeds.length !== initialLen) {
            this._syncActiveRoundAndSave(xData);
            await this.syncCurrentRoundToTavernChat();
            return true;
        }
        return false;
    }

    /**
     * 辅助：解析模型返回的 JSON 数组（带容错提取）
     */
    static parseJsonArray(replyText) {
        if (!replyText || typeof replyText !== 'string') return [];
        let clean = replyText.trim();

        // 尝试剥离 ```json ... ``` 代码块
        const codeBlockMatch = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (codeBlockMatch && codeBlockMatch[1]) {
            clean = codeBlockMatch[1].trim();
        }

        // 提取最外层中括号
        const startIdx = clean.indexOf('[');
        const endIdx = clean.lastIndexOf(']');
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
            clean = clean.slice(startIdx, endIdx + 1);
        }

        try {
            const parsed = JSON.parse(clean);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            // 容错：通过正则逐一提取独立对象
            const objectMatches = clean.match(/\{[\s\S]*?\}/g);
            if (objectMatches && objectMatches.length > 0) {
                const recovered = [];
                for (const m of objectMatches) {
                    try {
                        recovered.push(JSON.parse(m));
                    } catch (_) {}
                }
                return recovered;
            }
            return [];
        }
    }

    /**
     * 核心：刷新并生成动态流 (Feed)
     * 点击刷新时：画面上旧的帖子和刚刚刷出的帖子消失，开启全新轮次；
     * 正文内历史轮次保留，新一轮动态追加嵌入正文！
     * @param {Object} options
     * @param {string} [options.guidance=''] 用户想看的内容题材方向
     * @returns {Promise<Array<Object>>} 新轮次的动态列表
     */
    static async generateFeeds({ guidance = '' } = {}) {
        const cleanGuidance = String(guidance || '').trim();
        const startTime = Date.now();

        // 1. 动态解析当前世界书常驻条目与世界观
        let dynamicLorebook = '';
        try {
            const worldData = await QQManager.scanCurrentCharacterWorldEntries();
            const entries = worldData?.entries || [];
            const constantEntries = entries
                .filter(e => e.enabled !== false && (typeof QQManager.isWorldInfoEntryEnabled !== 'function' || QQManager.isWorldInfoEntryEnabled(e)) && e.constant && e.content && e.content.trim())
                .map(e => e.content.trim());
            dynamicLorebook = constantEntries.join('\n\n').trim();
        } catch (wiErr) {
            console.warn('[XManager] 获取常驻世界书条目失败:', wiErr);
        }

        const promptConfig = SettingsManager.getPromptConfig();
        const useTavernPreset = promptConfig.useTavernPreset !== false;

        const userMsg = cleanGuidance
            ? `正在刷新 X 动态流。当前关注倾向：【${cleanGuidance}】`
            : `正在刷新 X 动态流，浏览全网最新推文。`;

        // 2. 组装提示词
        const messages = PromptManager.buildMessagesPayload({
            appId: 'x',
            userMessage: userMsg,
            variables: {
                phase: 'x_feed',
                chat_type: '动态',
                guidance: cleanGuidance,
                lorebook: dynamicLorebook,
            },
            useTavernPreset: useTavernPreset,
        });

        // 3. 调用 AI 补全接口
        const result = await ApiService.sendChatCompletion(messages);
        const replyText = result.reply || '';

        // 4. 解析结构化推文数据
        const rawList = this.parseJsonArray(replyText);
        if (!rawList || rawList.length === 0) {
            throw new Error('模型未返回合规的动态推文列表，请重试');
        }

        const validNewFeeds = [];

        for (const item of rawList) {
            if (!item.content || !String(item.content).trim()) continue;
            const id = `feed_${Date.now()}_${Math.floor(Math.random() * 8999 + 1000)}`;
            const isAnon = Boolean(item.is_anonymous);
            const aName = String(item.author_name || (isAnon ? '匿名网友' : '推特网友')).trim();
            const aHandle = String(item.author_handle || (isAnon ? 'anon' : 'user')).replace(/^@/, '').trim();

            const comments = Array.isArray(item.comments) ? item.comments.map((c, cIdx) => ({
                id: `${id}_c_${cIdx}`,
                author_name: String(c.author_name || '网友').trim(),
                author_handle: String(c.author_handle || 'user').replace(/^@/, '').trim(),
                content: String(c.content || '').trim(),
            })).filter(c => c.content) : [];

            validNewFeeds.push({
                id,
                author_name: aName,
                author_handle: aHandle,
                is_anonymous: isAnon,
                is_user: false,
                time_ago: String(item.time_ago || '刚刚').trim(),
                timestamp: Date.now(),
                content: String(item.content).trim(),
                likes: parseInt(item.likes, 10) || Math.floor(Math.random() * 35 + 2),
                isLiked: false,
                comments: comments,
            });
        }

        // 5. 开启全新轮次 ID：
        // 刷新不会删正文！历史轮次正文天然保留，新一轮动态追加写入正文并同步记入【记录】列表
        const newRoundId = `round_${Date.now()}`;
        const xData = this.getXData();

        const newRound = {
            id: newRoundId,
            createdAt: Date.now(),
            guidance: cleanGuidance,
            feeds: validNewFeeds,
        };

        if (!Array.isArray(xData.rounds)) {
            xData.rounds = [];
        }
        xData.rounds.unshift(newRound);

        xData.currentRoundId = newRoundId;
        xData.activeRoundId = newRoundId;
        xData.feeds = validNewFeeds;
        xData.lastGuidance = cleanGuidance;
        this.saveXData(xData);

        // 6. 追加同步写入酒馆正文最新一楼
        await this.syncCurrentRoundToTavernChat(newRoundId, validNewFeeds);

        const duration = Date.now() - startTime;
        try {
            OperationLogService.log({
                module: 'X社交',
                action: '刷新动态',
                status: 'success',
                detail: `生成第 ${xData.rounds.length} 轮动态 (${validNewFeeds.length} 条) 并记入记录与正文 | 题材: ${cleanGuidance || '自然演进'} | 耗时: ${duration}ms`,
            });
        } catch (_) {}

        return validNewFeeds;
    }

    /**
     * 核心：刷新并生成热搜榜单 (Trending) - 保持独立，无需嵌入正文
     */
    static async generateHotTrends({ guidance = '' } = {}) {
        const cleanGuidance = String(guidance || '').trim();
        const startTime = Date.now();

        // 1. 获取常驻世界书条目
        let dynamicLorebook = '';
        try {
            const worldData = await QQManager.scanCurrentCharacterWorldEntries();
            const entries = worldData?.entries || [];
            const constantEntries = entries
                .filter(e => e.enabled !== false && (typeof QQManager.isWorldInfoEntryEnabled !== 'function' || QQManager.isWorldInfoEntryEnabled(e)) && e.constant && e.content && e.content.trim())
                .map(e => e.content.trim());
            dynamicLorebook = constantEntries.join('\n\n').trim();
        } catch (wiErr) {
            console.warn('[XManager] 获取常驻世界书条目失败:', wiErr);
        }

        const promptConfig = SettingsManager.getPromptConfig();
        const useTavernPreset = promptConfig.useTavernPreset !== false;

        const userMsg = cleanGuidance
            ? `正在浏览 X 实时热搜榜单。当前关注倾向：【${cleanGuidance}】`
            : `正在浏览 X 实时热搜榜单。`;

        // 2. 组装提示词
        const messages = PromptManager.buildMessagesPayload({
            appId: 'x',
            userMessage: userMsg,
            variables: {
                phase: 'x_trending',
                chat_type: '热搜',
                guidance: cleanGuidance,
                lorebook: dynamicLorebook,
            },
            useTavernPreset: useTavernPreset,
        });

        // 3. 调用 AI 补全
        const result = await ApiService.sendChatCompletion(messages);
        const replyText = result.reply || '';

        // 4. 解析结构化热搜榜单
        const rawList = this.parseJsonArray(replyText);
        if (!rawList || rawList.length === 0) {
            throw new Error('模型未返回合规的热搜榜单列表，请重试');
        }

        const validTrends = [];
        let rankCounter = 1;

        for (const item of rawList) {
            if (!item.tag || !String(item.tag).trim()) continue;
            let tagStr = String(item.tag).trim();
            if (!tagStr.startsWith('#')) tagStr = `#${tagStr}#`;

            const sampleTweets = Array.isArray(item.sample_tweets) ? item.sample_tweets.map(t => ({
                author_name: String(t.author_name || '网友').trim(),
                content: String(t.content || '').trim(),
            })).filter(t => t.content) : [];

            validTrends.push({
                rank: rankCounter++,
                tag: tagStr,
                tag_type: String(item.tag_type || (rankCounter <= 3 ? '热' : '')).trim(),
                heat: String(item.heat || `${Math.floor(Math.random() * 120 + 10)}.${Math.floor(Math.random() * 9)}万`).trim(),
                summary: String(item.summary || '全网热议话题，正在持续发酵中。').trim(),
                sample_tweets: sampleTweets,
            });

            if (validTrends.length >= 10) break;
        }

        const xData = this.getXData();
        xData.hotTrends = validTrends;
        this.saveXData(xData);

        const duration = Date.now() - startTime;
        try {
            OperationLogService.log({
                module: 'X社交',
                action: '刷新热搜',
                status: 'success',
                detail: `生成 ${validTrends.length} 条热搜 | 题材: ${cleanGuidance || '自然风向'} | 耗时: ${duration}ms`,
            });
        } catch (_) {}

        return validTrends;
    }
}

if (typeof window !== 'undefined') {
    window.XManager = XManager;
}

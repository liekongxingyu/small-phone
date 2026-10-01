/**
 * PhoneLogService
 * 手机互动记录与酒馆正文联动服务
 * 
 * 核心功能：
 * 1. 彻底杜绝底层隐式注入黑盒
 * 2. 将用户在小手机（QQ、微信等）中与角色的即时互动，格式化为带时间戳与人名的规范记录：
 *    [MM-DD HH:mm] 用户名：消息内容
 *    [MM-DD HH:mm] 角色名：回复内容
 * 3. 自动将记录附到酒馆当前聊天最新一楼（context.chat[lastIndex]）的末尾，并使用带 summary 和 details 的折叠标签包裹：
 *    <details class="narrative-phone-log" data-batch="...">
 *    <summary>📱 手机互动记录（X 条）</summary>
 *    ...
 *    </details>
 * 4. 同步更新酒馆 DOM 渲染，并调用酒馆原生 saveChatConditional 实现永久保存。
 *    后续正文历史（包括提示词中的正文历史记录插槽）读取正文时，即可透明、自然地携带手机互动上下文。
 */

export class PhoneLogService {
    /**
     * 格式化手机互动时间戳：[MM-DD HH:mm]
     * @param {Date|number} [date=new Date()]
     * @returns {string} 如 "09-28 19:25"
     */
    static formatPhoneLogTime(date = new Date()) {
        const d = (date instanceof Date) ? date : new Date(date);
        const pad = (n) => String(n).padStart(2, '0');
        const month = pad(d.getMonth() + 1);
        const day = pad(d.getDate());
        const hours = pad(d.getHours());
        const minutes = pad(d.getMinutes());
        return `${month}-${day} ${hours}:${minutes}`;
    }

    /**
     * 生成规范的批次识别 ID：batch:chat-YYYY-MM-DD_HHhMMmSSsMSms:UUID
     * @param {string} [chatId='chat']
     * @returns {string}
     */
    static generateBatchId(chatId = 'chat') {
        const d = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const datePart = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}h${pad(d.getMinutes())}m${pad(d.getSeconds())}s${String(d.getMilliseconds()).padStart(3, '0')}ms`;
        
        let uuidPart = '';
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            uuidPart = crypto.randomUUID();
        } else {
            const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
            uuidPart = `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
        }

        const safeChat = String(chatId || 'chat').replace(/[^a-zA-Z0-9_\u4e00-\u9fa5-]/g, '_');
        return `batch:${safeChat}-${datePart}:${uuidPart}`;
    }

    /**
     * 提取并标准化一次互动的全部消息行（纯净无时间戳，严格去掉日期和时间）
     * 格式：
     * 用户名：消息内容
     * 角色名：回复内容
     * @param {Object} params
     * @param {string} params.userName
     * @param {string} params.charName
     * @param {string} params.userText
     * @param {string} params.replyText
     * @returns {string[]} 如 ["我：你好", "角色：你好呀"]
     */
    static formatInteractionLines({
        userName = '我',
        charName = '角色',
        userText = '',
        replyText = '',
    }) {
        const lines = [];

        // 1. 用户输入行（剥离任何前缀时间戳）
        let uLine = String(userText || '').trim();
        if (uLine) {
            uLine = uLine.replace(/^\[[^\]]+\]\s*/, '').trim();
            if (/^[^:：\r\n]{1,25}[:：]/.test(uLine)) {
                lines.push(uLine);
            } else {
                lines.push(`${userName}：${uLine}`);
            }
        }

        // 2. AI 回复行（支持多行回复，剥离任何时间戳）
        const rawAiLines = String(replyText || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (rawAiLines.length === 0) {
            lines.push(`${charName}：(无回复)`);
        } else {
            for (const rLine of rawAiLines) {
                let cleanLine = rLine.replace(/^\[[^\]]+\]\s*/, '').trim();
                if (!cleanLine) continue;
                if (/^[^:：\r\n]{1,25}[:：]/.test(cleanLine)) {
                    lines.push(cleanLine);
                } else {
                    lines.push(`${charName}：${cleanLine}`);
                }
            }
        }

        return lines;
    }

    /**
     * 将 AI 回复的内容拆分为单条独立消息数组（剥离时间戳和人名前缀，每行一条独立气泡）
     * 保证聊天界面中每句话都有独立的气泡，彻底拒绝挤在同一个气泡里
     * @param {string} rawText
     * @returns {string[]} 如 ["哈？", "装傻问“你谁啊”就算了，还发这种奇奇怪怪的假定位。"]
     */
    static extractIndividualReplyMessages(rawText = '') {
        if (!rawText || typeof rawText !== 'string') return [];
        const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const cleaned = [];
        for (const line of lines) {
            // 1. 优先剥离标准带时间戳的前缀，如 [09-28 19:30] 角色名：内容
            let stripped = line.replace(/^\[\d{2}-\d{2}\s+\d{2}:\d{2}\]\s*[^:：\r\n]+[:：]\s*/, '').trim();
            // 2. 若依然以 "角色名：" 开头（比如模型漏掉了时间戳），剥离人名前缀
            stripped = stripped.replace(/^[\u4e00-\u9fa5a-zA-Z0-9_\s-]{1,15}[:：]\s*/, '').trim();
            if (stripped) {
                cleaned.push(stripped);
            }
        }
        return cleaned.length > 0 ? cleaned : (rawText.trim() ? [rawText.trim()] : []);
    }

    /**
     * 将 AI 回复的内容清洗为适合在小手机气泡中展示的纯文本（剥离时间戳和人名前缀）
     * @param {string} rawText
     * @returns {string}
     */
    static cleanReplyForBubble(rawText = '') {
        const items = this.extractIndividualReplyMessages(rawText);
        return items.join('\n');
    }

    /**
     * 核心：将每一次的互动消息直接附到酒馆最新一楼末尾
     * @param {Object} options
     * @param {string} [options.appName='QQ'] 当前通讯应用名，如 'QQ'、'微信' 等
     * @param {string} options.charName 对方角色名
     * @param {string} options.userName 用户在手机上的昵称
     * @param {string} options.userText 用户发送的消息内容
     * @param {string} options.replyText AI 回复的内容
     * @param {number} [options.timestamp=Date.now()]
     * @returns {Promise<{ success: boolean, updatedCount?: number, lastIndex?: number, error?: string }>}
     */
    static async appendInteractionToTavernChat({
        appName = 'QQ',
        friendId = '',
        charName,
        userName,
        userText,
        replyText,
        timestamp = Date.now(),
    }) {
        try {
            const context = (typeof Luker !== 'undefined' && Luker.getContext)
                ? Luker.getContext()
                : (typeof getContext === 'function' ? getContext() : null);

            if (!context || !Array.isArray(context.chat) || context.chat.length === 0) {
                console.warn('[PhoneLogService] 当前未在酒馆有效会话中，暂不追加正文日志');
                return { success: false, error: '当前无正在进行的聊天楼层' };
            }

            const lastIndex = context.chat.length - 1;
            const lastMessage = context.chat[lastIndex];
            if (!lastMessage) {
                return { success: false, error: '未找到最新一楼消息' };
            }

            // 1. 生成本次互动的新记录行
            const newLines = this.formatInteractionLines({
                userName: userName || '我',
                charName: charName || '角色',
                userText,
                replyText,
                timestamp,
            });

            if (newLines.length === 0) {
                return { success: false, error: '无有效消息可追加' };
            }

            const headerTag = `【${appName} · ${charName}】`;
            let currentMes = String(lastMessage.mes || '');

            // 2. 检测最新一楼末尾是否已有同应用、同角色的 <details class="narrative-phone-log"> 块
            const tailDetailsRegex = /(<details\s+class="narrative-phone-log"([^>]*)>)([\s\S]*?)<\/details>\s*$/i;
            const match = currentMes.match(tailDetailsRegex);

            let updatedTotalCount = newLines.length;

            if (match && match[0].includes(headerTag)) {
                // 2.1 末尾存在匹配的手机日志块：执行平滑合并与条数累加
                const fullTagStart = match[1];
                const insideBody = match[3];

                // 提取已存在的消息记录行（兼容带时间戳的旧格式并清洗掉日期时间）
                const existingLines = insideBody
                    .split(/\r?\n/)
                    .map(l => l.trim())
                    .filter(l => l && !l.startsWith('<summary') && !l.startsWith('</summary') && !l.startsWith('【') && !l.startsWith('📱'))
                    .map(l => l.replace(/^\[[^\]]+\]\s*/, '').trim())
                    .filter(Boolean);

                const allCombinedLines = [...existingLines, ...newLines];
                updatedTotalCount = allCombinedLines.length;

                // 确保包含 data-friend-id 属性
                let tagStartWithFriend = fullTagStart;
                if (friendId && !tagStartWithFriend.includes('data-friend-id=')) {
                    tagStartWithFriend = tagStartWithFriend.replace('class="narrative-phone-log"', `class="narrative-phone-log" data-friend-id="${friendId}" data-app="${appName}"`);
                }

                const updatedDetailsBlock = `${tagStartWithFriend}\n<summary>📱 手机互动记录（${updatedTotalCount} 条）</summary>\n\n${headerTag}\n${allCombinedLines.join('\n')}\n\n</details>`;
                currentMes = currentMes.slice(0, match.index) + updatedDetailsBlock;
            } else {
                // 2.2 末尾无匹配的手机日志块：生成全新的 <details> 块并附在末尾
                const currentChatId = context.chatId || (context.characters && context.this_chid !== undefined ? context.characters[context.this_chid]?.name : 'chat');
                const batchId = this.generateBatchId(currentChatId);

                const newDetailsBlock = `<details class="narrative-phone-log" data-batch="${batchId}" data-friend-id="${friendId || ''}" data-app="${appName}">\n<summary>📱 手机互动记录（${updatedTotalCount} 条）</summary>\n\n${headerTag}\n${newLines.join('\n')}\n\n</details>`;

                currentMes = currentMes.trimEnd() ? `${currentMes.trimEnd()}\n\n${newDetailsBlock}` : newDetailsBlock;
            }

            // 3. 将修改后的正文写回最新一楼
            lastMessage.mes = currentMes;

            // 4. 更新酒馆 DOM 渲染
            const updateFn = context.updateMessageBlock || (typeof updateMessageBlock === 'function' ? updateMessageBlock : null);
            if (typeof updateFn === 'function') {
                updateFn(lastIndex, lastMessage);
            }

            // 5. 触发酒馆原生持久化保存
            const saveFn = context.saveChat || context.saveChatConditional || (typeof saveChatConditional === 'function' ? saveChatConditional : null);
            if (typeof saveFn === 'function') {
                await saveFn();
            } else if (typeof context.saveChatDebounced === 'function') {
                context.saveChatDebounced();
            }

            // 6. 触发消息变更事件广播
            if (context.eventSource && context.event_types?.MESSAGE_UPDATED) {
                context.eventSource.emit(context.event_types.MESSAGE_UPDATED, lastIndex);
            }

            console.log(`[PhoneLogService] 手机互动记录已成功追加至酒馆最新一楼 (第 ${lastIndex + 1} 楼)，共 ${updatedTotalCount} 条`);
            return {
                success: true,
                updatedCount: updatedTotalCount,
                lastIndex,
            };
        } catch (err) {
            console.error('[PhoneLogService] 追加手机互动记录至正文最新一楼失败:', err);
            return { success: false, error: err.message || String(err) };
        }
    }

    /**
     * 从酒馆正文中彻底清除指定好友（或指定应用会话）的所有手机互动记录
     * 当用户在手机插件中清空聊天记录或删除好友时调用，实现双向完全同步
     * @param {Object} options
     * @param {string} options.friendId 好友 ID
     * @param {string} options.charName 好友角色名
     * @param {string} [options.appName='QQ'] 应用名称
     * @returns {Promise<{ success: boolean, removedBlocks: number, modifiedFloors: number }>}
     */
    static async removeFriendLogsFromTavernChat({
        friendId,
        charName,
        appName = 'QQ',
    }) {
        try {
            const context = (typeof Luker !== 'undefined' && Luker.getContext)
                ? Luker.getContext()
                : (typeof getContext === 'function' ? getContext() : null);

            if (!context || !Array.isArray(context.chat) || context.chat.length === 0) {
                return { success: true, removedBlocks: 0, modifiedFloors: 0 };
            }

            const headerTag = `【${appName} · ${charName}】`;
            let totalRemovedBlocks = 0;
            let modifiedFloors = 0;

            // 匹配所有 <details class="narrative-phone-log" ...> ... </details>
            const logBlockRegex = /<details\s+[^>]*class="narrative-phone-log"[^>]*>[\s\S]*?<\/details>/gi;

            for (let i = 0; i < context.chat.length; i++) {
                const message = context.chat[i];
                if (!message || typeof message.mes !== 'string') continue;

                const originalText = message.mes;
                let floorModified = false;

                // 替换所有匹配当前 friendId 或当前好友 headerTag 的日志块
                const newText = originalText.replace(logBlockRegex, (block) => {
                    const matchFriendId = Boolean(friendId && block.includes(`data-friend-id="${friendId}"`));
                    const matchHeader = Boolean(charName && block.includes(headerTag));

                    if (matchFriendId || matchHeader) {
                        totalRemovedBlocks++;
                        floorModified = true;
                        return ''; // 从正文中切除该日志块
                    }
                    return block;
                });

                if (floorModified) {
                    // 清理可能遗留的多余换行空洞，保持正文整洁
                    const cleanedMes = newText
                        .replace(/\n{3,}/g, '\n\n')
                        .trimEnd();

                    message.mes = cleanedMes;
                    modifiedFloors++;

                    // 刷新该楼层酒馆 DOM 渲染
                    const updateFn = context.updateMessageBlock || (typeof updateMessageBlock === 'function' ? updateMessageBlock : null);
                    if (typeof updateFn === 'function') {
                        updateFn(i, message);
                    }

                    // 发送楼层更新广播事件
                    if (context.eventSource && context.event_types?.MESSAGE_UPDATED) {
                        context.eventSource.emit(context.event_types.MESSAGE_UPDATED, i);
                    }
                }
            }

            if (modifiedFloors > 0) {
                // 持久化保存正文修改
                const saveFn = context.saveChat || context.saveChatConditional || (typeof saveChatConditional === 'function' ? saveChatConditional : null);
                if (typeof saveFn === 'function') {
                    await saveFn();
                } else if (typeof context.saveChatDebounced === 'function') {
                    context.saveChatDebounced();
                }
                console.log(`[PhoneLogService] 已成功从正文 ${modifiedFloors} 个楼层中删除了 ${totalRemovedBlocks} 处手机互动记录`);
            }

            return {
                success: true,
                removedBlocks: totalRemovedBlocks,
                modifiedFloors,
            };
        } catch (err) {
            console.error('[PhoneLogService] 从正文中删除手机互动记录失败:', err);
            return { success: false, error: err.message || String(err) };
        }
    }

    /**
     * 从酒馆正文中精确同步删除指定好友/群聊的若干条消息
     * 支持多选删除与重新生成时的正文精准剔除
     * @param {Object} options
     * @param {string} options.friendId 好友或群聊 ID
     * @param {string} options.charName 角色名或群名
     * @param {string} [options.appName='QQ'] 'QQ' 或 'QQ群聊'
     * @param {Array<{ content: string, senderName?: string }>} options.itemsToRemove 待删除的消息列表
     * @returns {Promise<{ success: boolean, removedLines: number, modifiedFloors: number }>}
     */
    static async removeMessagesFromTavernChat({
        friendId,
        charName,
        appName = 'QQ',
        itemsToRemove = [],
    }) {
        if (!itemsToRemove || itemsToRemove.length === 0) {
            return { success: true, removedLines: 0, modifiedFloors: 0 };
        }

        try {
            const context = (typeof Luker !== 'undefined' && Luker.getContext)
                ? Luker.getContext()
                : (typeof getContext === 'function' ? getContext() : null);

            if (!context || !Array.isArray(context.chat) || context.chat.length === 0) {
                return { success: true, removedLines: 0, modifiedFloors: 0 };
            }

            const headerTag = `【${appName} · ${charName}】`;
            let totalRemovedLines = 0;
            let modifiedFloors = 0;

            const remainingTargets = itemsToRemove.map(item => ({
                content: String(item.content || '').trim(),
                senderName: String(item.senderName || '').trim(),
                matched: false,
            }));

            // 匹配所有 <details ...class="narrative-phone-log"...> ... </details>
            const detailsRegex = /(<details\s+[^>]*class="narrative-phone-log"[^>]*>)([\s\S]*?)<\/details>/gi;

            for (let i = 0; i < context.chat.length; i++) {
                const message = context.chat[i];
                if (!message || typeof message.mes !== 'string') continue;
                if (!message.mes.includes('narrative-phone-log')) continue;

                let floorModified = false;
                const newMes = message.mes.replace(detailsRegex, (fullBlock, openTag, bodyPart) => {
                    const matchFriendId = Boolean(friendId && openTag.includes(`data-friend-id="${friendId}"`));
                    const matchHeader = Boolean(charName && bodyPart.includes(headerTag));

                    if (!matchFriendId && !matchHeader) {
                        return fullBlock;
                    }

                    const lines = bodyPart.split(/\r?\n/);
                    const retainedLines = [];
                    let blockChanged = false;

                    for (const line of lines) {
                        const trimmed = line.trim();
                        // 匹配手机消息行（兼容无时间戳或有时间戳格式）：发送人：内容 或 [时间] 发送人：内容
                        const matchMsg = trimmed.match(/^(?:\[[^\]]+\]\s*)?([^:：]+)[:：]\s*([\s\S]+)$/);
                        if (matchMsg) {
                            const sName = matchMsg[1].trim();
                            const content = matchMsg[2].trim();

                            const targetIdx = remainingTargets.findIndex(t => !t.matched && (
                                t.content === content ||
                                content.includes(t.content) ||
                                t.content.includes(content)
                            ));

                            if (targetIdx !== -1) {
                                remainingTargets[targetIdx].matched = true;
                                blockChanged = true;
                                floorModified = true;
                                totalRemovedLines++;
                                continue;
                            }
                        }

                        retainedLines.push(line);
                    }

                    if (!blockChanged) return fullBlock;

                    // 统计该 details 块内剩余有效消息行数量
                    const remainingMsgLines = retainedLines
                        .map(l => l.trim())
                        .filter(l => l && !l.startsWith('<summary') && !l.startsWith('</summary') && !l.startsWith('【') && !l.startsWith('📱') && /^[^:：\r\n]{1,25}[:：]/.test(l));

                    if (remainingMsgLines.length === 0) {
                        // 消息全部被清空，整个 details 块直接移除
                        return '';
                    }

                    // 还有剩余消息，更新 summary 条数
                    const summaryRegex = /<summary>📱 手机互动记录（\d+ 条）<\/summary>/;
                    const newSummary = `<summary>📱 手机互动记录（${remainingMsgLines.length} 条）</summary>`;

                    let newBody = retainedLines.join('\n');
                    if (summaryRegex.test(newBody)) {
                        newBody = newBody.replace(summaryRegex, newSummary);
                    } else {
                        newBody = `${newSummary}\n\n${headerTag}\n${remainingMsgLines.join('\n')}`;
                    }

                    return `${openTag}${newBody}</details>`;
                });

                if (floorModified) {
                    const cleanedMes = newMes
                        .replace(/\n{3,}/g, '\n\n')
                        .trimEnd();

                    message.mes = cleanedMes;
                    modifiedFloors++;

                    const updateFn = context.updateMessageBlock || (typeof updateMessageBlock === 'function' ? updateMessageBlock : null);
                    if (typeof updateFn === 'function') {
                        updateFn(i, message);
                    }

                    if (context.eventSource && context.event_types?.MESSAGE_UPDATED) {
                        context.eventSource.emit(context.event_types.MESSAGE_UPDATED, i);
                    }
                }
            }

            if (modifiedFloors > 0) {
                const saveFn = context.saveChat || context.saveChatConditional || (typeof saveChatConditional === 'function' ? saveChatConditional : null);
                if (typeof saveFn === 'function') {
                    await saveFn();
                } else if (typeof context.saveChatDebounced === 'function') {
                    context.saveChatDebounced();
                }
                console.log(`[PhoneLogService] 已从正文 ${modifiedFloors} 个楼层中同步剔除了 ${totalRemovedLines} 条消息记录`);
            }

            return {
                success: true,
                removedLines: totalRemovedLines,
                modifiedFloors,
            };
        } catch (err) {
            console.error('[PhoneLogService] 同步从正文中删除指定消息失败:', err);
            return { success: false, error: err.message || String(err) };
        }
    }

    /**
     * 从酒馆正文中批量彻底清除指定应用（如 QQ）的所有手机互动记录
     * @param {Object} options
     * @param {string} [options.appName='QQ'] 应用名称
     * @returns {Promise<{ success: boolean, removedBlocks: number, modifiedFloors: number }>}
     */
    static async removeAllLogsFromTavernChat({ appName = 'QQ' } = {}) {
        try {
            const context = (typeof Luker !== 'undefined' && Luker.getContext)
                ? Luker.getContext()
                : (typeof getContext === 'function' ? getContext() : null);

            if (!context || !Array.isArray(context.chat) || context.chat.length === 0) {
                return { success: true, removedBlocks: 0, modifiedFloors: 0 };
            }

            let totalRemovedBlocks = 0;
            let modifiedFloors = 0;
            const logBlockRegex = /<details\s+[^>]*class="narrative-phone-log"[^>]*>[\s\S]*?<\/details>/gi;

            for (let i = 0; i < context.chat.length; i++) {
                const message = context.chat[i];
                if (!message || typeof message.mes !== 'string') continue;

                const originalText = message.mes;
                let floorModified = false;

                const newText = originalText.replace(logBlockRegex, (block) => {
                    const matchApp = block.includes(`data-app="${appName}"`) || block.includes(`【${appName} ·`);
                    if (matchApp) {
                        totalRemovedBlocks++;
                        floorModified = true;
                        return '';
                    }
                    return block;
                });

                if (floorModified) {
                    const cleanedMes = newText
                        .replace(/\n{3,}/g, '\n\n')
                        .trimEnd();

                    message.mes = cleanedMes;
                    modifiedFloors++;

                    const updateFn = context.updateMessageBlock || (typeof updateMessageBlock === 'function' ? updateMessageBlock : null);
                    if (typeof updateFn === 'function') {
                        updateFn(i, message);
                    }

                    if (context.eventSource && context.event_types?.MESSAGE_UPDATED) {
                        context.eventSource.emit(context.event_types.MESSAGE_UPDATED, i);
                    }
                }
            }

            if (modifiedFloors > 0) {
                const saveFn = context.saveChat || context.saveChatConditional || (typeof saveChatConditional === 'function' ? saveChatConditional : null);
                if (typeof saveFn === 'function') {
                    await saveFn();
                } else if (typeof context.saveChatDebounced === 'function') {
                    context.saveChatDebounced();
                }
                console.log(`[PhoneLogService] 已从正文 ${modifiedFloors} 个楼层中批量清除了 ${totalRemovedBlocks} 处 ${appName} 互动记录`);
            }

            return {
                success: true,
                removedBlocks: totalRemovedBlocks,
                modifiedFloors,
            };
        } catch (err) {
            console.error('[PhoneLogService] 批量清除应用手机记录失败:', err);
            return { success: false, error: err.message || String(err) };
        }
    }
}

if (typeof window !== 'undefined') {
    window.PhoneLogService = PhoneLogService;
}

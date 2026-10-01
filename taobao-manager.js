import { SettingsManager } from './settings-manager.js';
import { ApiService } from './api-service.js';
import { PromptManager } from './prompt-manager.js';
import { OperationLogService } from './operation-log-service.js';
import { QQManager } from './qq-manager.js';

/**
 * TaobaoProduct 商品类型定义
 * @typedef {Object} TaobaoProduct
 * @property {string} id 商品唯一标识
 * @property {string} name 商品名称
 * @property {string} price 商品价格（如 ¥29.90）
 * @property {string} description 简短描述
 * @property {boolean} [isFavorite] 是否已收藏
 * @property {number} [timestamp] 创建/生成时间戳
 */

/**
 * TaobaoManager 类：管理淘宝应用的核心数据、AI好物刷新、当前聊天收藏夹持久化与聊天框填充
 */
export class TaobaoManager {
    /** @type {TaobaoProduct[]} 内存中当前批次刷新的商品列表 */
    static _currentProducts = [];

    /**
     * 获取当前酒馆聊天的元数据对象 (chat_metadata)
     */
    static getChatMetadata() {
        try {
            const context = (typeof Luker !== 'undefined' && Luker.getContext)
                ? Luker.getContext()
                : (typeof getContext === 'function' ? getContext() : null);

            let meta = context?.chatMetadata || (typeof chat_metadata !== 'undefined' ? chat_metadata : null) || window.chat_metadata;
            if (!meta && context) {
                context.chatMetadata = context.chatMetadata || {};
                meta = context.chatMetadata;
            }
            return meta || null;
        } catch (e) {
            console.warn('[TaobaoManager] 获取 chat_metadata 异常:', e);
            return null;
        }
    }

    /**
     * 保存当前酒馆聊天的元数据 (触发酒馆原生 saveChatConditional 或 saveMetadata)
     */
    static saveChatMetadata() {
        try {
            const context = (typeof Luker !== 'undefined' && Luker.getContext)
                ? Luker.getContext()
                : (typeof getContext === 'function' ? getContext() : null);

            if (context) {
                if (typeof context.saveChatConditional === 'function') {
                    context.saveChatConditional();
                } else if (typeof context.saveChatDebounced === 'function') {
                    context.saveChatDebounced();
                } else if (typeof saveChatConditional === 'function') {
                    saveChatConditional();
                }
            }
        } catch (e) {
            console.warn('[TaobaoManager] 保存聊天元数据异常:', e);
        }
    }

    /**
     * 判断当前是否处于有效酒馆聊天会话中（是否选择了角色卡或进入了聊天）
     * @returns {boolean}
     */
    static hasActiveChatSession() {
        try {
            const context = (typeof Luker !== 'undefined' && Luker.getContext)
                ? Luker.getContext()
                : (typeof getContext === 'function' ? getContext() : null);

            if (!context) return false;

            // 1. 检查是否有当前激活的角色卡或群组
            const hasChar = (context.characters && context.this_chid !== undefined && context.characters[context.this_chid])
                || (typeof context.characterId !== 'undefined' && context.characterId !== null && context.characterId !== '')
                || (typeof context.groupId !== 'undefined' && context.groupId !== null && context.groupId !== '');

            // 2. 检查是否有有效 chatId 或有效聊天上下文
            const hasChat = Boolean(context.chatId) || (Array.isArray(context.chat) && context.chat.length > 0);

            return Boolean(hasChar || hasChat);
        } catch (_) {
            return false;
        }
    }

    /**
     * 获取小手机在当前酒馆聊天中的元数据专属命名空间
     */
    static getSmallPhoneMeta() {
        const meta = this.getChatMetadata();
        if (!meta) return null;
        if (!meta.small_phone || typeof meta.small_phone !== 'object') {
            meta.small_phone = {};
        }
        return meta.small_phone;
    }

    /**
     * 获取最大收藏数量限制（优先读取淘宝设置，默认 100）
     * @returns {number}
     */
    static getMaxFavorites() {
        const cfg = SettingsManager.getTaobaoConfig();
        const max = parseInt(cfg.maxFavorites, 10);
        return (!isNaN(max) && max > 0) ? max : 100;
    }

    /**
     * 设置最大收藏数量限制并保存
     * @param {number} max
     */
    static setMaxFavorites(max) {
        const num = Math.max(1, parseInt(max, 10) || 100);
        SettingsManager.saveTaobaoConfig({ maxFavorites: num });
        return num;
    }

    /**
     * 获取当前聊天中已收藏的商品列表（附在当前聊天记录里）
     * @returns {TaobaoProduct[]}
     */
    static getFavorites() {
        const spMeta = this.getSmallPhoneMeta();
        if (!spMeta) return [];
        if (!Array.isArray(spMeta.taobao_favorites)) {
            spMeta.taobao_favorites = [];
        }
        return spMeta.taobao_favorites;
    }

    /**
     * 保存收藏列表到当前聊天记录
     * @param {TaobaoProduct[]} list
     */
    static _saveFavorites(list) {
        const spMeta = this.getSmallPhoneMeta();
        if (!spMeta) return;
        spMeta.taobao_favorites = list;
        this.saveChatMetadata();
    }

    /**
     * 判断某个商品是否已被当前聊天收藏
     * @param {string} productId
     * @returns {boolean}
     */
    static isFavorite(productId) {
        if (!productId) return false;
        const favs = this.getFavorites();
        return favs.some(item => item.id === productId || item.name === productId);
    }

    /**
     * 添加商品到收藏夹
     * @param {TaobaoProduct} product
     * @returns {{ success: boolean, reason?: string }}
     */
    static addFavorite(product) {
        if (!product || !product.name) {
            return { success: false, reason: '商品无效' };
        }

        const favs = this.getFavorites();
        const maxLimit = this.getMaxFavorites();

        if (favs.length >= maxLimit) {
            return {
                success: false,
                reason: `已达收藏上限（最大 ${maxLimit} 件），请先清理或前往设置调大上限`,
            };
        }

        // 避免重复收藏同一商品
        if (favs.some(item => item.id === product.id || item.name === product.name)) {
            return { success: true, reason: '已在收藏夹中' };
        }

        const favItem = {
            id: product.id || `tb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            name: product.name,
            price: product.price || '¥--',
            description: product.description || '',
            timestamp: Date.now(),
        };

        favs.unshift(favItem);
        this._saveFavorites(favs);

        OperationLogService.log({
            module: '淘宝好物',
            action: '收藏商品',
            status: 'success',
            detail: `商品: ${favItem.name} | 价格: ${favItem.price} | 收藏总数: ${favs.length}/${maxLimit}`,
        });

        return { success: true };
    }

    /**
     * 从收藏夹移除商品
     * @param {string} productIdOrName
     */
    static removeFavorite(productIdOrName) {
        const favs = this.getFavorites();
        const filtered = favs.filter(item => item.id !== productIdOrName && item.name !== productIdOrName);
        if (filtered.length !== favs.length) {
            this._saveFavorites(filtered);
            OperationLogService.log({
                module: '淘宝好物',
                action: '取消收藏',
                status: 'info',
                detail: `已移除商品，当前剩余收藏: ${filtered.length} 件`,
            });
            return true;
        }
        return false;
    }

    /**
     * 清空当前聊天的全部收藏
     */
    static clearFavorites() {
        const favs = this.getFavorites();
        const count = favs.length;
        this._saveFavorites([]);
        OperationLogService.log({
            module: '淘宝好物',
            action: '清空收藏夹',
            status: 'warning',
            detail: `已清空当前聊天全部 ${count} 件收藏`,
        });
        return count;
    }

    /**
     * 获取当前内存中展示的商品列表
     * @returns {TaobaoProduct[]}
     */
    static getCurrentProducts() {
        return this._currentProducts;
    }

    /**
     * 设置当前商品列表
     * @param {TaobaoProduct[]} list
     */
    static setCurrentProducts(list) {
        this._currentProducts = Array.isArray(list) ? list : [];
    }

    /**
     * 动态解析当前酒馆聊天活跃的世界书条目与设定（组装为 {{lorebook}} 变量）
     * 采用立体式三通道穿透引擎：
     * 1. 通道 1：原生 resolveWorldInfoForMessages（正确解析 activatedEntries / before / after）
     * 2. 通道 2：高穿透内建世界书扫描器（穿透角色主世界书、辅助世界书、内嵌世界书、会话世界书、全局世界书）
     *    - 优先激活常驻条目 (constant)
     *    - 激活额外要求与会话关键词命中的条目
     *    - 关键保底：若无条目命中，自动提取该角色绑定的前 10~15 条有效世界书条目作为背景设定
     * 3. 通道 3：角色卡基础人设与世界观兜底（char.description / personality / scenario）
     * 确保 {{lorebook}} 绝不为空！
     * @param {string} [extraRequirement=''] 用户在淘宝界面输入的额外要求
     * @returns {Promise<string>}
     */
    static async resolveDynamicWorldInfoPrompt(extraRequirement = '') {
        const collectedEntries = [];
        const seenTexts = new Set();

        const addEntry = (text) => {
            if (!text || typeof text !== 'string') return;
            const clean = text.trim();
            if (!clean || seenTexts.has(clean)) return;
            seenTexts.add(clean);
            collectedEntries.push(clean);
        };

        try {
            const context = (typeof Luker !== 'undefined' && Luker.getContext)
                ? Luker.getContext()
                : (typeof getContext === 'function' ? getContext() : null);

            const userName = context?.name1 || '我';
            let charName = '';
            let currentChar = null;

            if (context?.characters && context?.this_chid !== undefined) {
                currentChar = context.characters[context.this_chid];
                charName = currentChar?.name || '';
            }

            // 构造语料消息用于触发匹配
            const resolverMessages = [];
            if (Array.isArray(context?.chat) && context.chat.length > 0) {
                const recent = context.chat.slice(-6);
                for (const m of recent) {
                    resolverMessages.push({
                        name: m.name || (m.is_user ? userName : (charName || '角色')),
                        is_user: Boolean(m.is_user),
                        is_system: false,
                        mes: String(m.mes || '').trim(),
                    });
                }
            }

            // 如果有用户输入的额外要求，作为最新消息加入匹配语料
            if (extraRequirement && extraRequirement.trim()) {
                resolverMessages.push({
                    name: userName,
                    is_user: true,
                    is_system: false,
                    mes: extraRequirement.trim(),
                });
            }

            // 1. 通道 1：优先尝试原生 resolveWorldInfoForMessages
            try {
                const resolveFn = context?.resolveWorldInfoForMessages
                    || (typeof resolveWorldInfoForMessages === 'function' ? resolveWorldInfoForMessages : null);

                if (typeof resolveFn === 'function' && resolverMessages.length > 0) {
                    const resolution = await resolveFn(resolverMessages, {
                        type: 'quiet',
                        fallbackToCurrentChat: true,
                    });

                    if (resolution) {
                        // 1.1 activatedEntries (对象数组，属性 content)
                        if (Array.isArray(resolution.activatedEntries)) {
                            for (const act of resolution.activatedEntries) {
                                const c = act?.content || (typeof act === 'string' ? act : '');
                                addEntry(c);
                            }
                        }
                        // 1.2 worldInfoBeforeEntries & worldInfoAfterEntries (字符串数组)
                        if (Array.isArray(resolution.worldInfoBeforeEntries)) {
                            for (const item of resolution.worldInfoBeforeEntries) addEntry(item);
                        }
                        if (Array.isArray(resolution.worldInfoAfterEntries)) {
                            for (const item of resolution.worldInfoAfterEntries) addEntry(item);
                        }
                        // 1.3 worldInfoDepth
                        if (Array.isArray(resolution.worldInfoDepth)) {
                            for (const item of resolution.worldInfoDepth) {
                                const c = item?.content || (typeof item === 'string' ? item : '');
                                addEntry(c);
                            }
                        }
                    }
                }
            } catch (nativeErr) {
                console.warn('[TaobaoManager] 调用原生 resolveWorldInfoForMessages 异常:', nativeErr);
            }

            // 2. 通道 2：高穿透内建世界书扫描器（穿透主世界书、辅助世界书、会话世界书、内嵌世界书）
            try {
                if (typeof QQManager !== 'undefined' && typeof QQManager.scanCurrentCharacterWorldEntries === 'function') {
                    const worldData = await QQManager.scanCurrentCharacterWorldEntries();
                    const allEntries = worldData?.entries || [];

                    if (allEntries.length > 0) {
                        // 组装扫描语料库
                        const scanCorpusParts = [
                            userName,
                            charName,
                            extraRequirement || '',
                            ...resolverMessages.map(m => m.mes),
                        ];
                        const scanCorpus = scanCorpusParts.filter(Boolean).join('\n').toLowerCase();

                        // 2.1 优先激活常驻条目 (constant)
                        for (const entry of allEntries) {
                            if (entry.enabled === false || (typeof QQManager !== 'undefined' && typeof QQManager.isWorldInfoEntryEnabled === 'function' && !QQManager.isWorldInfoEntryEnabled(entry)) || !entry.content || !entry.content.trim()) continue;
                            if (entry.constant) {
                                addEntry(entry.content);
                            }
                        }

                        // 2.2 关键词与条目名命中
                        for (const entry of allEntries) {
                            if (entry.enabled === false || (typeof QQManager !== 'undefined' && typeof QQManager.isWorldInfoEntryEnabled === 'function' && !QQManager.isWorldInfoEntryEnabled(entry)) || !entry.content || !entry.content.trim()) continue;
                            if (entry.constant) continue;

                            const keys = Array.isArray(entry.keys) ? entry.keys : [];
                            let isMatched = false;
                            for (const k of keys) {
                                const cleanKey = String(k || '').trim().toLowerCase();
                                if (cleanKey && scanCorpus.includes(cleanKey)) {
                                    isMatched = true;
                                    break;
                                }
                            }

                            if (!isMatched && entry.name) {
                                const cleanName = String(entry.name).trim().toLowerCase();
                                if (cleanName.length >= 2 && scanCorpus.includes(cleanName)) {
                                    isMatched = true;
                                }
                            }

                            if (isMatched) {
                                addEntry(entry.content);
                            }
                        }

                        // 2.3 关键兜底：如果此时收集到的条目依然较少（比如未在对话中碰巧命中关键词），
                        // 直接选取该角色所绑定世界书的前 10~15 条有效条目，确保 AI 拥有充足的世界观与设定输入！
                        if (collectedEntries.length < 3) {
                            for (const entry of allEntries) {
                                if (entry.enabled === false || !entry.content || !entry.content.trim()) continue;
                                addEntry(entry.content);
                                if (collectedEntries.length >= 12) break;
                            }
                        }
                    }
                }
            } catch (scanErr) {
                console.warn('[TaobaoManager] 扫描角色世界书异常:', scanErr);
            }

            // 3. 通道 3：如果依然没有任何世界书条目，读取角色卡本体的人设、场景与世界观作为保底设定
            if (collectedEntries.length === 0 && currentChar) {
                const charData = currentChar.data || currentChar;
                const personaParts = [
                    charData.description ? `【角色背景】：${charData.description}` : '',
                    charData.personality ? `【性格喜好】：${charData.personality}` : '',
                    charData.scenario ? `【所处场景与世界观】：${charData.scenario}` : '',
                ].filter(Boolean);

                if (personaParts.length > 0) {
                    addEntry(personaParts.join('\n'));
                }
            }
        } catch (err) {
            console.warn('[TaobaoManager] 动态解析世界书失败:', err);
        }

        if (collectedEntries.length > 0) {
            return collectedEntries.slice(0, 15).join('\n\n');
        }
        return '';
    }

    /**
     * 点击“刷新”：向 AI 索取新一批推荐商品，替换原有商品列表
     * @param {string} [extraRequirement=''] 用户在淘宝界面输入的额外要求（如“来几个吃的”、“喝的啥的”）
     * @returns {Promise<TaobaoProduct[]>}
     */
    static async refreshProducts(extraRequirement = '') {
        if (!this.hasActiveChatSession()) {
            throw new Error('未进入有效聊天会话，请先在酒馆选择角色进入会话后再刷新');
        }
        const startTime = Date.now();
        const context = (typeof Luker !== 'undefined' && Luker.getContext)
            ? Luker.getContext()
            : (typeof getContext === 'function' ? getContext() : null);

        const userName = context?.name1 || '我';
        const charName = (context?.characters && context?.this_chid !== undefined ? context.characters[context.this_chid]?.name : '') || '当前角色';

        const reqText = (typeof extraRequirement === 'string' ? extraRequirement : '').trim();
        const userMsg = reqText ? `刷新淘宝好物（用户额外偏好/要求：${reqText}）` : '刷新淘宝好物';

        // 1. 动态获取世界书条目（传入额外偏好要求，协助关键词匹配与兜底）
        const dynamicWorldInfo = await this.resolveDynamicWorldInfoPrompt(reqText);

        // 2. 组装当前已收藏商品概要（供 AI 启发或联动）
        const favs = this.getFavorites();
        const favsHint = favs.length > 0
            ? favs.slice(0, 8).map(f => `- ${f.name} (${f.price})`).join('\n')
            : '暂无已收藏商品';

        // 3. 构建提示词请求 payload
        const promptConfig = SettingsManager.getPromptConfig();
        const useTavernPreset = promptConfig.useTavernPreset !== false;

        const messages = PromptManager.buildMessagesPayload({
            appId: 'taobao',
            userMessage: userMsg,
            variables: {
                phase: '淘宝刷新',
                app_id: 'taobao',
                user_name: userName,
                char_name: charName,
                sender_name: userName,
                content: userMsg,
                message: userMsg,
                extra_requirement: reqText,
                extra_requirements: reqText,
                user_requirement: reqText,
                lorebook: dynamicWorldInfo,
                taobao_favorites: favsHint,
            },
            useTavernPreset: useTavernPreset,
        });

        // 4. 调用 AI 获取回复
        let replyText = '';
        try {
            const result = await ApiService.sendChatCompletion(messages, { appId: 'taobao' });
            replyText = result.reply || '';
        } catch (err) {
            OperationLogService.log({
                module: '淘宝',
                action: '刷新商品失败',
                status: 'error',
                detail: `原因: ${err?.message || err}${reqText ? ` | 要求: ${reqText}` : ''}`,
            });
            throw err;
        }

        // 5. 解析单行格式商品列表：商品名称 | 价格 | 简短描述
        const parsedProducts = this.parseProductsFromText(replyText);

        // 如果 AI 解析失败，提供保底商品列表
        const finalProducts = parsedProducts.length > 0
            ? parsedProducts
            : this.getFallbackProducts();

        // 6. 替换当前商品，原商品自动消失
        this.setCurrentProducts(finalProducts);

        const duration = Date.now() - startTime;
        OperationLogService.log({
            module: '淘宝',
            action: '刷新商品成功',
            status: 'success',
            detail: `获取 ${finalProducts.length} 件好物 | ${reqText ? `要求: ${reqText} | ` : ''}耗时: ${duration}ms`,
        });

        return finalProducts;
    }

    /**
     * 将 AI 生成的单行文本解析为结构化商品对象列表
     * @param {string} rawText
     * @returns {TaobaoProduct[]}
     */
    static parseProductsFromText(rawText = '') {
        if (!rawText || typeof rawText !== 'string') return [];

        const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const products = [];

        for (const line of lines) {
            // 剥离行首序号（如 "1." 或 "1、" 或 "- "）
            const cleanLine = line.replace(/^\s*(?:\d+[\.、\s\-]+|[-*•]\s+)/, '').trim();
            if (!cleanLine) continue;

            // 按 "|" 或 "｜" 拆分（三段式：名称 | 价格 | 描述）
            const parts = cleanLine.split(/\s*[|｜]\s*/);
            if (parts.length >= 2) {
                const name = parts[0].replace(/^[\[【]/, '').replace(/[\]】]$/, '').trim();
                let price = parts[1].trim();
                if (!price.startsWith('¥') && !price.startsWith('$') && !price.startsWith('￥')) {
                    price = `¥${price}`;
                }
                const description = parts.slice(2).join('，').trim() || '高品质精选好物';

                if (name) {
                    const id = `tb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                    products.push({
                        id,
                        name,
                        price,
                        description,
                        isFavorite: this.isFavorite(name),
                        timestamp: Date.now(),
                    });
                }
            }
        }

        return products;
    }

    /**
     * 获取离线或解析异常时的保底商品
     * @returns {TaobaoProduct[]}
     */
    static getFallbackProducts() {
        const fallbacks = [
            { name: '草莓波波奶茶', price: '¥18.00', description: '满杯新鲜果肉与浓郁芝士奶盖，微糖去冰口感最佳' },
            { name: '猫耳毛绒发箍', price: '¥29.90', description: '超柔短毛绒材质，佩戴舒适软萌减龄，拍照聚会必备' },
            { name: '纯棉日系条纹睡衣', price: '¥128.00', description: '亲肤透气，宽松舒适无拘束，居家生活优选' },
            { name: '定制角色等身抱枕', price: '¥89.00', description: '细腻双向弹力面料，高清双面印花，陪伴每一夜好眠' },
            { name: '星空星轨微型投影灯', price: '¥68.00', description: '360度动态旋转星云，打造静谧梦幻的卧室氛围' },
            { name: '手作烘焙抹茶曲奇礼盒', price: '¥45.00', description: '精选宇治抹茶粉与法国发酵黄油，酥香微苦回甘' },
        ];

        return fallbacks.map(item => ({
            id: `tb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            name: item.name,
            price: item.price,
            description: item.description,
            isFavorite: this.isFavorite(item.name),
            timestamp: Date.now(),
        }));
    }

    /**
     * 点击“发送”：在用户的聊天框中出现“选择了商品【XXX】”
     * @param {TaobaoProduct} product
     * @returns {boolean} 是否成功填入
     */
    static sendProductToChat(product) {
        if (!product || !product.name) return false;

        const sendText = `选择了商品【${product.name}】`;
        let filledCount = 0;

        // 1. 尝试填入酒馆主聊天框 (#send_textarea)
        const $tavernTextarea = $('#send_textarea');
        if ($tavernTextarea.length > 0) {
            $tavernTextarea.val(sendText);
            // 触发原生 input 与 change 事件让酒馆 UI 识别字数与输入状态
            $tavernTextarea.trigger('input').trigger('change');
            $tavernTextarea.focus();
            filledCount++;
        }

        // 2. 尝试填入小手机内部 QQ 聊天框 (#sp-qq-chat-input)
        const $qqInput = $('#sp-qq-chat-input');
        if ($qqInput.length > 0) {
            $qqInput.val(sendText);
            $qqInput.trigger('input').trigger('change');
            filledCount++;
        }

        OperationLogService.log({
            module: '淘宝好物',
            action: '发送商品至聊天框',
            status: 'success',
            detail: `商品: ${product.name} | 内容: ${sendText}`,
        });

        if (typeof toastr !== 'undefined') {
            toastr.success(`已填入聊天框：“${sendText}”`, '淘宝');
        }

        return filledCount > 0;
    }

    /**
     * 获取当前所有可用联系人（群聊 + 好友 + 当前酒馆角色卡）
     * @returns {Array<{ id: string, type: 'friend'|'group', name: string, subText: string, avatarText: string, avatarColor: string }>}
     */
    static getAvailableContacts() {
        const list = [];
        try {
            // 1. 群聊列表
            const groups = (typeof QQManager !== 'undefined' && typeof QQManager.getGroups === 'function')
                ? QQManager.getGroups()
                : [];
            for (const g of groups) {
                const memberCount = (g.memberIds || []).length;
                list.push({
                    id: g.id,
                    type: 'group',
                    name: g.name || '未命名群聊',
                    subText: `群聊 · ${memberCount}位成员`,
                    avatarText: (g.name || '群').slice(0, 1),
                    avatarColor: g.avatarColor || '#10b981',
                });
            }

            // 2. 好友列表
            const friends = (typeof QQManager !== 'undefined' && typeof QQManager.getFriends === 'function')
                ? QQManager.getFriends()
                : [];
            for (const f of friends) {
                const displayName = f.remark || f.name || '好友';
                list.push({
                    id: f.id,
                    type: 'friend',
                    name: displayName,
                    subText: f.remark ? `原名: ${f.name}` : (f.qqNumber ? `QQ: ${f.qqNumber}` : '单聊好友'),
                    avatarText: displayName.slice(0, 1),
                    avatarColor: f.avatarColor || '#3b82f6',
                });
            }
        } catch (err) {
            console.warn('[TaobaoManager] 获取联系人列表异常:', err);
        }
        return list;
    }
}

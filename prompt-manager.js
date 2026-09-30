import { SettingsManager } from './settings-manager.js';
import { ApiService } from './api-service.js';
import { getContext } from '../../../extensions.js';

/**
 * PromptFeature 定义：具体内置功能（如 qq, x, taobao, default 等）的输入规则与回复规则
 * @typedef {Object} PromptFeature
 * @property {string} id 功能唯一标识 (如 'qq', 'x', 'taobao', 'wechat')
 * @property {string} name 显示名称 (如 'QQ 聊天', '微信', 'X (推特)')
 * @property {string} [icon] 图标类名
 * @property {string} inputRule 输入规则模板 (如 '{{sender_name}}向{{user_name}}发送了QQ消息：“{{content}}”')
 * @property {string} replyRule 回复规则与角色规范 (如以角色口吻回复、格式规范等)
 * @property {boolean} [isCustom] 是否为用户自定义新增的功能
 */

/**
 * PromptItem 条目定义：
 * @typedef {Object} PromptItem
 * @property {string} id 唯一标识符
 * @property {string} name 显示名称
 * @property {('system'|'user'|'assistant')} role 角色属性
 * @property {string} content 提示词内容 (普通条目直接使用此字段)
 * @property {boolean} enabled 是否开启
 * @property {boolean} [isAppFeaturesSlot] 是否为特殊的“内置功能规范 (输入规则 & 回复规则)”条目
 * @property {boolean} [isChatHistorySlot] 是否为特殊的只读“正文历史记录”条目
 * @property {Record<string, PromptFeature>} [features] 内置功能套件映射表
 * @property {string} [activeFeatureKey] 当前正在编辑/选中的内置功能键
 * @property {('all'|'qq'|'x'|'taobao')} [appScope] 适用应用范围
 * @property {('tavern'|'custom'|'system')} source 来源标记
 */

export class PromptManager {
    /** 核心特殊条目 ID 常量 */
    static APP_FEATURES_SLOT_ID = '__app_features__';
    static CHAT_HISTORY_SLOT_ID = '__chat_history__';

    /** 向后兼容常量 */
    static USER_INPUT_SLOT_ID = '__user_input__';
    static APP_RULES_SLOT_ID = '__app_rules__';

    /**
     * 系统默认内置功能预设
     * @returns {Record<string, PromptFeature>}
     */
    static getDefaultFeatures() {
        return {
            qq: {
                id: 'qq',
                name: 'QQ 聊天',
                icon: 'fa-qq',
                inputRule: '{% if phase == "群聊" %}\n{{user_name}} 在群聊【{{group_name}}】中发送了QQ消息：“{{message}}”\n{% else %}\n{{user_name}} 对 {{char_name}} 发送了QQ消息：“{{message}}”\n{% endif %}',
                replyRule: '{% if phase == "群聊" %}\n【当前角色设定】\n当前处于QQ群聊【{{group_name}}】。\n当前在群聊中向大家发送消息的用户是：{{user_name}}。\n群内各位成员名单与人设：\n{{group_members}}\n可能用到的信息：\n{{lorebook}}\n\n【QQ即时通讯规范】\n当前处于QQ群聊【{{group_name}}】场景。\n【群聊回复与人称格式严格要求】：\n1. 人称与互动规范：\n   - 正在与群成员交流的用户是【{{user_name}}】。群成员与【{{user_name}}】交流时按人设称呼；群成员之间交流互动时直呼彼此名字。\n   - 展现多人群聊的真实讨论氛围：群成员之间要相互接话、回应或吐槽，严禁所有成员机械脱节地各说各话。\n2. 回复格式规范：\n   - 每条消息单独占一行，格式必须严格为：\n     [{{current_time}}] 成员名：回复内容\n     （注意：冒号前必须是群内具体的成员姓名，绝不要在冒号后重复名字，也不要在正文中残留方括号）\n3. 必须回复2-6条群消息，每条消息6-80个字。\n4. 语言简练生活化，符合即时打字聊天语气。不要输出任何动作描写、长篇小说旁白或系统废话。回复中禁止切换场景。\n{% else %}\n【当前角色设定】\n你当前的身份是：{{char_name}}。\n可能用到的信息：\n{{lorebook}}\n\n【QQ即时通讯规范】\n当前处于与好友{{user_name}}的QQ单聊。请以{{char_name}}本人的口吻直接回复对方。\n【回复格式严格要求】：\n1. 每条消息单独占一行，格式必须严格为：\n   [{{current_time}}] {{char_name}}：回复内容\n2. 必须回复3-6条消息，每条消息6-80个字。（每条消息单独一行，都以 [{{current_time}}] {{char_name}}：开头）。\n3. 语言简练生活化，符合即时打字聊天语气。不要输出任何动作描写、长篇小说旁白或系统废话。回复中禁止切换场景\n{% endif %}',
                isCustom: false,
            },
            x: {
                id: 'x',
                name: 'X (推特)',
                icon: 'fa-x-twitter',
                inputRule: '{{sender_name}}在X上发布了推文并艾特了你：“{{content}}”',
                replyRule: '你正在使用X (Twitter)。请以推特推文/回复的格式输出：短小精悍、风格鲜明、字数在280字以内，符合推特社交互动习惯。',
                isCustom: false,
            },
            taobao: {
                id: 'taobao',
                name: '淘宝',
                icon: 'fa-bag-shopping',
                inputRule: `{{user_name}} 打开了淘宝，点击刷新，正在挑选商品。
{% if extra_requirement %}
【用户特定额外要求/偏好】：{{extra_requirement}}
{% endif %}
可能用到的世界书与设定信息：
{{lorebook}}`,
                replyRule: `【淘宝商品推荐规范】：
请结合当前角色的世界观、人设背景、喜好或当前语境{% if extra_requirement %}，并重点满足用户的额外偏好/要求【{{extra_requirement}}】{% endif %}，推荐 4 到 8 件独具特色的淘宝商品。
【回复格式严格要求】：
1. 每件商品单独占一行，格式必须严格为：
   商品名称 | 价格 | 简短描述
   （注意：三段内容用半角竖线“|”分隔，价格必须带货币符号如 ¥ 或设定货币，描述简明精炼在 10-35 字内，例如：
   草莓波波奶茶 | ¥18.00 | 满杯新鲜果肉与浓郁芝士奶盖，微糖去冰口感最佳
   猫耳毛绒发箍 | ¥29.90 | 超柔短毛绒材质，佩戴舒适软萌减龄
   灵兽防护符佩 | ¥88.00 | 刻有微型避尘聚灵阵法，可抵挡练气期三次攻击）
2. 总共输出 4 到 8 行商品，严禁输出任何问候语、开场白、序号、方括号、总结或额外解释。`,
                isCustom: false,
            },
            default: {
                id: 'default',
                name: '默认功能',
                icon: 'fa-vial',
                inputRule: '{{content}}',
                replyRule: '请简短、自然、富有感情地回复用户。',
                isCustom: false,
            },
        };
    }

    /**
     * 获取当前保存的所有提示词条目
     * 具备自动平滑升级与数据迁移机制：
     * 1. 自动将旧版的【用户输入插槽】与【应用规则插槽】合并为全新的【内置功能规范 (输入规则 & 回复规则)】条目
     * 2. 保证【正文历史记录插槽】与【内置功能规范】条目完备
     * @returns {PromptItem[]}
     */
    static getPromptItems() {
        const config = SettingsManager.getPromptConfig();
        if (Array.isArray(config.items) && config.items.length > 0) {
            let updated = false;

            // 1. 检查是否存在旧版的输入插槽或规则插槽，如果存在则自动执行数据平滑合并
            const oldUserSlotIdx = config.items.findIndex(it => it.isUserInputSlot || it.id === this.USER_INPUT_SLOT_ID);
            const oldRulesSlotIdx = config.items.findIndex(it => it.isAppRulesSlot || it.id === this.APP_RULES_SLOT_ID);
            let featuresSlot = config.items.find(it => it.isAppFeaturesSlot || it.id === this.APP_FEATURES_SLOT_ID);

            if (oldUserSlotIdx !== -1 || oldRulesSlotIdx !== -1 || !featuresSlot) {
                const oldUserSlot = oldUserSlotIdx !== -1 ? config.items[oldUserSlotIdx] : null;
                const oldRulesSlot = oldRulesSlotIdx !== -1 ? config.items[oldRulesSlotIdx] : null;

                const defaultFeats = this.getDefaultFeatures();

                // 继承用户在旧版本中可能修改过的输入模板和回复规则
                if (oldUserSlot?.appVariants) {
                    if (oldUserSlot.appVariants.qq && defaultFeats.qq) defaultFeats.qq.inputRule = oldUserSlot.appVariants.qq;
                    if (oldUserSlot.appVariants.x && defaultFeats.x) defaultFeats.x.inputRule = oldUserSlot.appVariants.x;
                    if (oldUserSlot.appVariants.taobao && defaultFeats.taobao) defaultFeats.taobao.inputRule = oldUserSlot.appVariants.taobao;
                    if (oldUserSlot.appVariants.default && defaultFeats.default) defaultFeats.default.inputRule = oldUserSlot.appVariants.default;
                }
                if (oldRulesSlot?.appVariants) {
                    if (oldRulesSlot.appVariants.qq && defaultFeats.qq) defaultFeats.qq.replyRule = oldRulesSlot.appVariants.qq;
                    if (oldRulesSlot.appVariants.x && defaultFeats.x) defaultFeats.x.replyRule = oldRulesSlot.appVariants.x;
                    if (oldRulesSlot.appVariants.taobao && defaultFeats.taobao) defaultFeats.taobao.replyRule = oldRulesSlot.appVariants.taobao;
                    if (oldRulesSlot.appVariants.default && defaultFeats.default) defaultFeats.default.replyRule = oldRulesSlot.appVariants.default;
                }

                if (!featuresSlot) {
                    featuresSlot = {
                        id: this.APP_FEATURES_SLOT_ID,
                        name: '内置功能规范 (输入规则 & 回复规则)',
                        role: 'system',
                        content: '',
                        enabled: true,
                        isAppFeaturesSlot: true,
                        isUserInputSlot: false,
                        isAppRulesSlot: false,
                        isChatHistorySlot: false,
                        appScope: 'all',
                        source: 'system',
                        activeFeatureKey: 'qq',
                        features: defaultFeats,
                    };
                } else if (!featuresSlot.features) {
                    featuresSlot.features = defaultFeats;
                }

                // 移除旧条目
                config.items = config.items.filter(it => !it.isUserInputSlot && !it.isAppRulesSlot && it.id !== this.USER_INPUT_SLOT_ID && it.id !== this.APP_RULES_SLOT_ID && it.id !== this.APP_FEATURES_SLOT_ID);

                // 插入合并后的新条目
                config.items.push(featuresSlot);
                updated = true;
            } else if (featuresSlot && !featuresSlot.features) {
                featuresSlot.features = this.getDefaultFeatures();
                updated = true;
            } else if (featuresSlot?.features) {
                // 1.1 QQ 功能平滑升级
                if (featuresSlot.features.qq) {
                    if (featuresSlot.features.qq.inputRule === '{{sender_name}}向{{user_name}}发送了QQ消息：“{{content}}”' || !featuresSlot.features.qq.inputRule.includes('phase')) {
                        featuresSlot.features.qq.inputRule = this.getDefaultFeatures().qq.inputRule;
                        featuresSlot.features.qq.replyRule = this.getDefaultFeatures().qq.replyRule;
                        updated = true;
                    } else if (featuresSlot.features.qq.replyRule && featuresSlot.features.qq.replyRule.includes('friend_name')) {
                        featuresSlot.features.qq.replyRule = featuresSlot.features.qq.replyRule.replace(/\{\{\s*friend_name\s*\}\}/g, '{{char_name}}');
                        updated = true;
                    } else if (!featuresSlot.features.qq.replyRule || !featuresSlot.features.qq.replyRule.includes('group_members')) {
                        featuresSlot.features.qq.inputRule = this.getDefaultFeatures().qq.inputRule;
                        featuresSlot.features.qq.replyRule = this.getDefaultFeatures().qq.replyRule;
                        updated = true;
                    }
                }

                // 1.2 淘宝功能平滑升级：名称统一为“淘宝”，提示词升级并支持 extra_requirement 与 lorebook
                if (featuresSlot.features.taobao) {
                    const tb = featuresSlot.features.taobao;
                    const defTb = this.getDefaultFeatures().taobao;
                    if (tb.name !== '淘宝') {
                        tb.name = '淘宝';
                        updated = true;
                    }
                    if (!tb.replyRule || tb.replyRule.includes('客服') || !tb.replyRule.includes('商品名称 | 价格 | 简短描述') || !tb.inputRule.includes('extra_requirement')) {
                        tb.inputRule = defTb.inputRule;
                        tb.replyRule = defTb.replyRule;
                        tb.icon = 'fa-bag-shopping';
                        updated = true;
                    }
                } else {
                    featuresSlot.features.taobao = this.getDefaultFeatures().taobao;
                    updated = true;
                }
            }

            // 2. 检查是否缺失【正文历史记录插槽】，缺失则自动平滑补齐
            const hasHistorySlot = config.items.some(item => item.isChatHistorySlot || item.id === this.CHAT_HISTORY_SLOT_ID);
            if (!hasHistorySlot) {
                const historySlot = {
                    id: this.CHAT_HISTORY_SLOT_ID,
                    name: '正文历史记录插槽 (只读上下文)',
                    role: 'system',
                    content: '',
                    enabled: true,
                    isAppFeaturesSlot: false,
                    isUserInputSlot: false,
                    isAppRulesSlot: false,
                    isChatHistorySlot: true,
                    appScope: 'all',
                    source: 'system',
                };
                // 默认插在内置功能规范之前
                const targetIdx = config.items.findIndex(it => it.isAppFeaturesSlot || it.id === this.APP_FEATURES_SLOT_ID);
                if (targetIdx !== -1) {
                    config.items.splice(targetIdx, 0, historySlot);
                } else {
                    config.items.push(historySlot);
                }
                updated = true;
            }

            if (updated) {
                this.savePromptItems(config.items);
            }
            return config.items;
        }

        // 如果尚未初始化条目列表，则基于当前酒馆生成一套默认条目
        const defaultItems = this.generateDefaultItemsFromTavern();
        this.savePromptItems(defaultItems);
        return defaultItems;
    }

    /**
     * 保存提示词条目列表
     * @param {PromptItem[]} items
     */
    static savePromptItems(items) {
        SettingsManager.savePromptConfig({
            items: items,
        });
    }

    /**
     * 从当前酒馆读取正文历史记录
     * @param {number} [limit=6] 读取最近的记录条数（含用户输入）
     * @returns {{ inChat: boolean, totalCount: number, messages: Array<{ index: number, isUser: boolean, role: 'user'|'assistant', name: string, content: string, sendDate: string }> }}
     */
    static getChatHistoryMessages(limit = 6) {
        const context = (typeof Luker !== 'undefined' && Luker.getContext)
            ? Luker.getContext()
            : getContext();

        const rawChat = context?.chat;
        const inChat = Boolean(Array.isArray(rawChat) && (context?.characters || context?.name2 || rawChat.length > 0));

        if (!inChat || !Array.isArray(rawChat) || rawChat.length === 0) {
            return {
                inChat: false,
                totalCount: 0,
                messages: [],
            };
        }

        const validMessages = rawChat.filter(m => !m.is_system && m.mes !== undefined);
        const count = Math.max(0, parseInt(limit, 10) || 0);

        if (count === 0) {
            return {
                inChat: true,
                totalCount: validMessages.length,
                messages: [],
            };
        }

        const sliced = validMessages.slice(-count);
        const mapped = sliced.map((m, idx) => ({
            index: validMessages.length - sliced.length + idx + 1,
            isUser: Boolean(m.is_user),
            role: m.is_user ? 'user' : 'assistant',
            name: m.name || (m.is_user ? (context?.name1 || '用户') : (context?.name2 || '角色')),
            content: m.mes || '',
            sendDate: m.send_date || '',
        }));

        return {
            inChat: true,
            totalCount: validMessages.length,
            messages: mapped,
        };
    }

    /**
     * 从酒馆当前状态同步并生成默认提示词条目列表
     * 架构：酒馆激活的预设条目 + 正文历史记录插槽 (只读) + 内置功能规范 (输入规则 & 回复规则)
     * @returns {PromptItem[]}
     */
    static generateDefaultItemsFromTavern() {
        const items = [];
        const tavernPresets = ApiService.getTavernPresetPrompts();

        // 1. 酒馆现存的自带预设条目
        if (tavernPresets.length > 0) {
            for (let i = 0; i < tavernPresets.length; i++) {
                const p = tavernPresets[i];
                items.push({
                    id: `tavern_${p.name}_${i}`,
                    name: this._formatPresetName(p.name),
                    role: p.role || 'system',
                    content: p.content,
                    enabled: true,
                    isAppFeaturesSlot: false,
                    isUserInputSlot: false,
                    isAppRulesSlot: false,
                    isChatHistorySlot: false,
                    appScope: 'all',
                    source: 'tavern',
                });
            }
        } else {
            items.push({
                id: 'default_sys_prompt',
                name: '系统总提示词',
                role: 'system',
                content: '你是一个智能而风趣的手机AI助手，回复自然流畅。',
                enabled: true,
                isAppFeaturesSlot: false,
                isUserInputSlot: false,
                isAppRulesSlot: false,
                isChatHistorySlot: false,
                appScope: 'all',
                source: 'custom',
            });
        }

        // 2. 特殊只读条目：【正文历史记录插槽】
        items.push({
            id: this.CHAT_HISTORY_SLOT_ID,
            name: '正文历史记录插槽 (只读上下文)',
            role: 'system',
            content: '',
            enabled: true,
            isAppFeaturesSlot: false,
            isUserInputSlot: false,
            isAppRulesSlot: false,
            isChatHistorySlot: true,
            appScope: 'all',
            source: 'system',
        });

        // 3. 特殊核心合并条目：【内置功能规范 (输入规则 & 回复规则)】
        items.push({
            id: this.APP_FEATURES_SLOT_ID,
            name: '内置功能规范 (输入规则 & 回复规则)',
            role: 'system',
            content: '',
            enabled: true,
            isAppFeaturesSlot: true,
            isUserInputSlot: false,
            isAppRulesSlot: false,
            isChatHistorySlot: false,
            appScope: 'all',
            source: 'system',
            activeFeatureKey: 'qq',
            features: this.getDefaultFeatures(),
        });

        return items;
    }

    /**
     * 友好格式化条目名称
     */
    static _formatPresetName(rawName) {
        const nameMap = {
            main: '主系统提示词 (Main Prompt)',
            jailbreak: '越狱/解除限制 (Jailbreak)',
            nsfw: 'NSFW 引导条目',
            dialogue_examples: '示例对话条目',
            character_system_prompt: '当前角色专属 System Prompt',
            character_description: '当前角色设定 (Description)',
            character_personality: '当前角色人设 (Personality)',
        };
        return nameMap[rawName] || rawName || '预设条目';
    }

    /**
     * 重新从酒馆同步自带条目（保留用户修改过的核心特殊插槽与自定义条目）
     * @returns {PromptItem[]}
     */
    static syncFromTavern() {
        const currentItems = this.getPromptItems();
        const customItems = currentItems.filter(item => item.source === 'custom');

        // 保留现有的功能规范合并插槽
        let featuresSlot = currentItems.find(item => item.isAppFeaturesSlot || item.id === this.APP_FEATURES_SLOT_ID);
        if (!featuresSlot) {
            featuresSlot = {
                id: this.APP_FEATURES_SLOT_ID,
                name: '内置功能规范 (输入规则 & 回复规则)',
                role: 'system',
                content: '',
                enabled: true,
                isAppFeaturesSlot: true,
                isUserInputSlot: false,
                isAppRulesSlot: false,
                isChatHistorySlot: false,
                appScope: 'all',
                source: 'system',
                activeFeatureKey: 'qq',
                features: this.getDefaultFeatures(),
            };
        }

        // 保留现有的历史记录插槽
        let chatHistorySlot = currentItems.find(item => item.isChatHistorySlot || item.id === this.CHAT_HISTORY_SLOT_ID);
        if (!chatHistorySlot) {
            chatHistorySlot = {
                id: this.CHAT_HISTORY_SLOT_ID,
                name: '正文历史记录插槽 (只读上下文)',
                role: 'system',
                content: '',
                enabled: true,
                isAppFeaturesSlot: false,
                isUserInputSlot: false,
                isAppRulesSlot: false,
                isChatHistorySlot: true,
                appScope: 'all',
                source: 'system',
            };
        }

        const newTavernPresets = ApiService.getTavernPresetPrompts();
        const freshTavernItems = newTavernPresets.map((p, idx) => ({
            id: `tavern_${p.name}_${idx}_${Date.now()}`,
            name: this._formatPresetName(p.name),
            role: p.role || 'system',
            content: p.content,
            enabled: true,
            isAppFeaturesSlot: false,
            isUserInputSlot: false,
            isAppRulesSlot: false,
            isChatHistorySlot: false,
            appScope: 'all',
            source: 'tavern',
        }));

        const merged = [...freshTavernItems, ...customItems, chatHistorySlot, featuresSlot];
        this.savePromptItems(merged);
        return merged;
    }

    /**
     * 获取内置功能规范特殊条目
     * @returns {PromptItem|null}
     */
    static getAppFeaturesSlot() {
        const items = this.getPromptItems();
        return items.find(it => it.isAppFeaturesSlot || it.id === this.APP_FEATURES_SLOT_ID) || null;
    }

    /**
     * 获取所有内置功能列表（键值映射表）
     * @returns {Record<string, PromptFeature>}
     */
    static getAppFeatures() {
        const slot = this.getAppFeaturesSlot();
        if (slot && slot.features && Object.keys(slot.features).length > 0) {
            return slot.features;
        }
        return this.getDefaultFeatures();
    }

    /**
     * 新增一个内置功能（如用户添加 'wechat' / 'group_chat' 等）
     * @param {string} featureKey 功能英文标识，如 'qq', 'wechat', 'sms'
     * @param {string} featureName 功能中文显示名，如 '微信聊天'
     * @param {string} [inputRule=''] 输入规则
     * @param {string} [replyRule=''] 回复规则
     * @returns {PromptItem[]}
     */
    static addAppFeature(featureKey, featureName, inputRule = '', replyRule = '') {
        const key = String(featureKey || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
        if (!key) throw new Error('功能标识不能为空，且只能包含英文字母、数字或下划线');

        const items = this.getPromptItems();
        const slot = items.find(it => it.isAppFeaturesSlot || it.id === this.APP_FEATURES_SLOT_ID);
        if (!slot) throw new Error('内置功能规范插槽不存在');

        if (!slot.features) slot.features = this.getDefaultFeatures();

        slot.features[key] = {
            id: key,
            name: String(featureName || key).trim(),
            icon: 'fa-cubes',
            inputRule: inputRule || '{{user_name}} 对 {{char_name}} 发送了消息：“{{message}}”',
            replyRule: replyRule || '请以{{char_name}}本人的口吻直接回复{{user_name}}，语言自然简练，符合即时交流习惯。',
            isCustom: true,
        };
        slot.activeFeatureKey = key;

        this.savePromptItems(items);
        return items;
    }

    /**
     * 更新某个内置功能的输入规则或回复规则
     * @param {string} featureKey
     * @param {Partial<PromptFeature>} changes
     * @returns {PromptItem[]}
     */
    static updateAppFeature(featureKey, changes = {}) {
        const items = this.getPromptItems();
        const slot = items.find(it => it.isAppFeaturesSlot || it.id === this.APP_FEATURES_SLOT_ID);
        if (!slot) return items;

        if (!slot.features) slot.features = this.getDefaultFeatures();
        if (slot.features[featureKey]) {
            Object.assign(slot.features[featureKey], changes);
            this.savePromptItems(items);
        }
        return items;
    }

    /**
     * 删除用户自定义的内置功能
     * @param {string} featureKey
     * @returns {PromptItem[]}
     */
    static deleteAppFeature(featureKey) {
        if (['qq', 'default'].includes(featureKey)) {
            throw new Error(`系统核心功能【${featureKey}】不允许删除`);
        }
        const items = this.getPromptItems();
        const slot = items.find(it => it.isAppFeaturesSlot || it.id === this.APP_FEATURES_SLOT_ID);
        if (slot && slot.features && slot.features[featureKey]) {
            delete slot.features[featureKey];
            if (slot.activeFeatureKey === featureKey) {
                slot.activeFeatureKey = 'qq';
            }
            this.savePromptItems(items);
        }
        return items;
    }

    /**
     * 设置当前选中的内置功能 tab
     */
    static setActiveFeatureKey(featureKey) {
        const items = this.getPromptItems();
        const slot = items.find(it => it.isAppFeaturesSlot || it.id === this.APP_FEATURES_SLOT_ID);
        if (slot) {
            slot.activeFeatureKey = featureKey;
            this.savePromptItems(items);
        }
    }

    /**
     * 创建一个新普通自定义条目
     * @param {Partial<PromptItem>} itemData
     * @returns {PromptItem[]}
     */
    static addItem(itemData = {}) {
        const items = this.getPromptItems();
        const newItem = {
            id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            name: itemData.name || '新提示词条目',
            role: itemData.role || 'system',
            content: itemData.content || '',
            enabled: itemData.enabled !== false,
            isAppFeaturesSlot: false,
            isUserInputSlot: false,
            isAppRulesSlot: false,
            isChatHistorySlot: false,
            appScope: itemData.appScope || 'all',
            source: 'custom',
        };

        // 默认插入到“内置功能规范插槽”前面
        const featSlotIdx = items.findIndex(it => it.isAppFeaturesSlot || it.id === this.APP_FEATURES_SLOT_ID);
        if (featSlotIdx !== -1) {
            items.splice(featSlotIdx, 0, newItem);
        } else {
            items.push(newItem);
        }

        this.savePromptItems(items);
        return items;
    }

    /**
     * 更新单个条目
     * @param {string} id
     * @param {Partial<PromptItem>} changes
     * @returns {PromptItem[]}
     */
    static updateItem(id, changes) {
        const items = this.getPromptItems();
        const target = items.find(it => it.id === id);
        if (target) {
            Object.assign(target, changes);
            this.savePromptItems(items);
        }
        return items;
    }

    /**
     * 删除单个条目（核心插槽锁定不允许删除）
     * @param {string} id
     * @returns {PromptItem[]}
     */
    static deleteItem(id) {
        let items = this.getPromptItems();
        items = items.filter(it => it.id !== id || (it.isAppFeaturesSlot || it.isChatHistorySlot));
        this.savePromptItems(items);
        return items;
    }

    /**
     * 移动条目位置（拖拽排序支持）
     * @param {number} fromIndex
     * @param {number} toIndex
     * @returns {PromptItem[]}
     */
    static moveItem(fromIndex, toIndex) {
        const items = this.getPromptItems();
        if (fromIndex < 0 || fromIndex >= items.length || toIndex < 0 || toIndex >= items.length) {
            return items;
        }
        const [moved] = items.splice(fromIndex, 1);
        items.splice(toIndex, 0, moved);
        this.savePromptItems(items);
        return items;
    }

    /**
     * 提取当前角色名与用户名（用于模板占位符替换）
     */
    static getContextVariables() {
        const context = (typeof Luker !== 'undefined' && Luker.getContext)
            ? Luker.getContext()
            : getContext();

        const userName = context?.name1 || window.name1 || '用户';
        let charName = context?.name2 || window.name2 || 'AI';

        const thisChid = context?.this_chid ?? window.this_chid;
        const characters = context?.characters ?? window.characters ?? [];
        if (thisChid !== undefined && characters[thisChid]?.name) {
            charName = characters[thisChid].name;
        }

        return { userName, charName };
    }

    /**
     * 评估条件表达式（支持 ==, ===, !=, !==, !var, 以及真假值检测）
     * @param {string} expr 如 'phase == "单聊"'
     * @param {Record<string, any>} vars 变量表
     * @returns {boolean}
     */
    static evaluateCondition(expr, vars = {}) {
        if (!expr) return false;
        let clean = String(expr).trim();
        // 允许变量带有 {{}} 或不带，例如 {{phase}} == "单聊" 自动剥离
        clean = clean.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, '$1');

        // 匹配比较运算符 ==, ===, !=, !==
        const eqMatch = clean.match(/^([a-zA-Z0-9_]+)\s*(===|==|!==|!=)\s*(['"]?)(.*?)\3$/);
        if (eqMatch) {
            const [, varName, op, , targetVal] = eqMatch;
            const actualVal = String(vars[varName] ?? vars[varName.toLowerCase()] ?? '').trim();
            const compVal = String(targetVal).trim();
            return (op === '==' || op === '===') ? (actualVal === compVal) : (actualVal !== compVal);
        }

        // 匹配取反 !varName
        if (clean.startsWith('!')) {
            const varName = clean.slice(1).trim();
            const val = vars[varName] ?? vars[varName.toLowerCase()];
            return !val || val === 'false' || val === '0';
        }

        // 匹配布尔/存在性检查
        const val = vars[clean] ?? vars[clean.toLowerCase()];
        return !(val === undefined || val === null || val === '' || val === false || val === 'false' || val === '0');
    }

    /**
     * 统一的模板渲染引擎
     * 1. 深度支持条件分支逻辑（同时兼容 Jinja2、Handlebars、方括号标签）：
     *    - {% if phase == "单聊" %}...{% elif phase == "群聊" %}...{% else %}...{% endif %}
     *    - {{#if phase == "单聊"}}...{{#elif ...}}...{{#else}}...{{/if}}
     *    - [if phase == "单聊"]...[else]...[/if]
     * 2. 全面支持变量占位符插值（忽略大小写，别名互通）
     * @param {string} template 待渲染模板
     * @param {Record<string, any>} vars 变量字典
     * @returns {string}
     */
    static renderTemplate(template = '', vars = {}) {
        if (!template || typeof template !== 'string') return '';
        let text = template;

        // 互通别名补充
        const normalizedVars = { ...vars };
        if (normalizedVars.message && !normalizedVars.content) normalizedVars.content = normalizedVars.message;
        if (normalizedVars.content && !normalizedVars.message) normalizedVars.message = normalizedVars.content;
        if (normalizedVars.char_name && !normalizedVars.friend_name) normalizedVars.friend_name = normalizedVars.char_name;
        if (normalizedVars.friend_name && !normalizedVars.char_name) normalizedVars.char_name = normalizedVars.friend_name;
        if (normalizedVars.user_name && !normalizedVars.sender_name) normalizedVars.sender_name = normalizedVars.user_name;
        if (normalizedVars.sender_name && !normalizedVars.user_name) normalizedVars.user_name = normalizedVars.sender_name;

        // 规范唯一的动态世界书变量：lorebook（收敛清理其他杂乱关键词）
        if (!normalizedVars.lorebook && (normalizedVars.persona || normalizedVars.personel || normalizedVars.personality || normalizedVars.world_info)) {
            normalizedVars.lorebook = normalizedVars.persona || normalizedVars.personel || normalizedVars.personality || normalizedVars.world_info;
        }

        // 1. 解析条件分支块
        const blockRegex = /(?:\{%\s*if\s+([^%]+?)\s*%\}|{{#if\s+([^}]+?)}}|\[if\s+([^\]]+?)\])([\s\S]*?)(?:\{%\s*endif\s*%\}|{{\/if}}|\[\/if\])/gi;

        text = text.replace(blockRegex, (match, expr1, expr2, expr3, body) => {
            const initialExpr = expr1 || expr2 || expr3;
            const subParts = [];
            const splitRegex = /(?:\{%\s*(?:elif\s+([^%]+?)|else)\s*%\}|{{#(?:elif\s+([^}]+?)|else)}}|\[(?:elif\s+([^\]]+?)|else)\])/gi;

            let lastIndex = 0;
            let currentCond = initialExpr;
            let m;

            while ((m = splitRegex.exec(body)) !== null) {
                const blockContent = body.slice(lastIndex, m.index);
                subParts.push({ cond: currentCond, content: blockContent });
                lastIndex = m.index + m[0].length;
                const elifExpr = m[1] || m[2] || m[3];
                currentCond = elifExpr ? elifExpr : '__ELSE__';
            }
            subParts.push({ cond: currentCond, content: body.slice(lastIndex) });

            for (const part of subParts) {
                if (part.cond === '__ELSE__' || this.evaluateCondition(part.cond, normalizedVars)) {
                    return part.content.replace(/^\r?\n/, '').replace(/\r?\n$/, '');
                }
            }
            return '';
        });

        // 2. 变量占位符全局替换 {{var_name}}
        for (const [k, v] of Object.entries(normalizedVars)) {
            if (v !== undefined && v !== null) {
                const r = new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'gi');
                text = text.replace(r, String(v));
            }
        }

        return text.trim();
    }

    /**
     * 保持向后兼容的变量替换入口，统一委托给 renderTemplate
     */
    static replaceVariables(template = '', vars = {}) {
        return this.renderTemplate(template, vars);
    }

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
     * 构建发送给 AI 模型的最终有效消息序列
     * 彻底告别隐式硬编码：
     * - 不再底层私自注入不可见的私聊历史（手机互动记录已全面改为附到酒馆正文最新一楼末尾，由正文历史透明读取）
     * - 按照提示词工作区拖拽排好的顺序遍历启用的条目：
     *   1. 遇到【正文历史记录插槽】：根据深度设置读取酒馆最新上下文（天然包含最新一楼末尾附带的手机互动记录）
     *   2. 遇到【内置功能规范 (输入规则 & 回复规则)】：
     *      - 提取 replyRule 作为 system 规范（要求 AI 按照 [MM-DD HH:mm] 角色名：消息 格式输出）
     *      - 提取 inputRule 作为 user 消息
     *   3. 遇到其他普通条目：正常解析与替换变量后注入其内容
     * @param {Object} options
     * @param {string} [options.appId='default'] 当前调用的 App 功能场景标识（'qq' | 'x' | 'taobao' | 'default' 或自定义功能键）
     * @param {string} [options.userMessage='你好'] 用户的实际输入内容
     * @param {Record<string, any>} [options.variables={}] 业务传入的扩展变量，如 { sender_name, user_name, content, persona, phase, ... }
     * @param {boolean} [options.useTavernPreset=true] 是否开启预设流水线
     * @returns {Array<{ role: string, content: string, name?: string }>}
     */
    static buildMessagesPayload({
        appId = 'default',
        userMessage = '你好',
        variables = {},
        useTavernPreset = true,
    } = {}) {
        // 如果未开启预设，直接单发用户纯文本消息
        if (!useTavernPreset) {
            return [{
                role: 'user',
                content: userMessage || '你好',
            }];
        }

        const items = this.getPromptItems();
        const messages = [];
        let hasUserInputInjected = false;

        const { userName, charName } = this.getContextVariables();
        const baseContent = userMessage || variables.content || variables.message || '你好';
        const nowTimeStr = this.formatPhoneLogTime();

        const lorebookContent = variables.lorebook || variables.persona || variables.personel || '';

        // 汇总变量池，支持规范变量与默认状态 phase（单聊中只保留 user_name、char_name、lorebook，支持 current_time）
        const allVars = {
            phase: '单聊', // 默认状态为单聊
            chat_type: '单聊',
            current_time: nowTimeStr,
            time: nowTimeStr,
            user_name: userName,
            char_name: charName,
            sender_name: userName,
            friend_name: charName,
            content: baseContent,
            message: baseContent,
            lorebook: lorebookContent,
            ...variables,
        };

        for (const item of items) {
            if (!item.enabled) continue;

            // 检查普通条目的应用范围过滤
            if (!item.isAppFeaturesSlot && !item.isChatHistorySlot) {
                if (item.appScope && item.appScope !== 'all' && appId !== 'default' && item.appScope !== appId) {
                    continue;
                }
            }

            // 1. 如果遇到特殊的【正文历史记录插槽】（只读上下文注入）
            if (item.isChatHistorySlot) {
                const memConfig = SettingsManager.getMemoryConfig();
                const depth = parseInt(memConfig.chatHistoryDepth, 10) || 0;
                if (depth > 0) {
                    const historyData = this.getChatHistoryMessages(depth);
                    if (historyData.inChat && historyData.messages.length > 0) {
                        for (const hMsg of historyData.messages) {
                            messages.push({
                                role: hMsg.role,
                                content: hMsg.content,
                                name: hMsg.name,
                            });
                        }
                    }
                }
                continue;
            }

            // 2. 如果遇到特殊的【内置功能规范 (输入规则 & 回复规则)】条目
            if (item.isAppFeaturesSlot) {
                const features = item.features || this.getDefaultFeatures();
                // 优先取当前 appId 对应的规则；若不存在则取 default
                const feature = features[appId] || features.default || Object.values(features)[0];

                // 2.1 注入回复规则 (Reply Rule，作为 system 消息)
                if (feature?.replyRule) {
                    const replyPrompt = this.replaceVariables(feature.replyRule, allVars);
                    if (replyPrompt.trim()) {
                        messages.push({
                            role: 'system',
                            content: replyPrompt.trim(),
                        });
                    }
                }

                // 2.2 注入输入规则 (Input Rule，作为 user 消息)
                const inputTemplate = feature?.inputRule || '{{content}}';
                let finalInputText = this.replaceVariables(inputTemplate, allVars);
                if (!finalInputText.trim()) {
                    finalInputText = baseContent;
                }

                messages.push({
                    role: 'user',
                    content: finalInputText.trim(),
                });
                hasUserInputInjected = true;
                continue;
            }

            // 3. 遇到其他普通系统/预设条目
            if (item.content && item.content.trim()) {
                const replacedContent = this.replaceVariables(item.content, allVars);
                messages.push({
                    role: item.role || 'system',
                    content: replacedContent.trim(),
                });
            }
        }

        // 兜底：如果流水线中未注入用户输入，追加用户当前消息
        if (!hasUserInputInjected) {
            messages.push({
                role: 'user',
                content: baseContent,
            });
        }

        return messages;
    }
}

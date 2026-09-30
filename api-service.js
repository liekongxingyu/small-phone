import { getContext, extension_settings } from '../../../extensions.js';
import { SettingsManager } from './settings-manager.js';
import { PromptManager } from './prompt-manager.js';

let currentActiveController = null;

/**
 * ApiService：负责获取酒馆连接预设、代理端点、模型拉取与消息测试调用
 */
export class ApiService {
    /**
     * 中止当前正在进行的 AI 生成请求
     */
    static abortCurrentRequest() {
        if (currentActiveController) {
            try {
                currentActiveController.abort();
            } catch (_) {}
            currentActiveController = null;
        }
        try {
            const context = (typeof Luker !== 'undefined' && Luker.getContext)
                ? Luker.getContext()
                : (typeof getContext === 'function' ? getContext() : null);
            if (context?.stopGeneration) {
                context.stopGeneration();
            } else if (typeof window.stopGeneration === 'function') {
                window.stopGeneration();
            }
        } catch (_) {}
    }

    /**
     * 获取所有可用的预设连接（Connection Profiles）与当前主 API
     * @returns {Array<{ id: string, name: string, url: string, model: string, source: string, rawProfile: any }>}
     */
    static getAvailableProfiles() {
        const result = [];
        const context = (typeof Luker !== 'undefined' && Luker.getContext)
            ? Luker.getContext()
            : getContext();

        // 1. 获取当前酒馆主界面的配置作为首选项
        try {
            const mainSettings = context?.extensionSettings || extension_settings;
            // 尝试读取当前 OpenAI/ChatCompletion 设置
            const oai = window.oai_settings || {};
            const mainUrl = oai.custom_url || oai.reverse_proxy || oai.base_url || 'https://api.openai.com/v1';
            const currentSource = oai.chat_completion_source || 'openai';
            const currentModel = oai[`${currentSource}_model`] || oai.custom_model || oai.openai_model || '';

            result.push({
                id: '__current_main__',
                name: `当前酒馆主连接 (${currentSource})`,
                url: mainUrl,
                model: currentModel,
                source: currentSource,
                rawProfile: null,
            });
        } catch (e) {
            console.warn('[SmallPhone] 获取当前主连接失败:', e);
        }

        // 2. 获取 Connection Manager 中的所有预设 Profiles (a, b, c...)
        try {
            let profileList = [];
            if (context?.connectionProfiles && typeof context.connectionProfiles.list === 'function') {
                profileList = context.connectionProfiles.list();
            } else if (Array.isArray(extension_settings?.connectionManager?.profiles)) {
                profileList = extension_settings.connectionManager.profiles.filter(p => p && p.mode === 'cc');
            }

            for (const profile of profileList) {
                const name = String(profile.name || '').trim();
                if (!name) continue;

                const url = String(profile['api-url'] || profile['base-url'] || profile['proxy-url'] || '').trim();
                const model = String(profile.model || '').trim();
                const api = String(profile.api || 'openai').trim();

                result.push({
                    id: name,
                    name: name,
                    url: url || '(默认端点)',
                    model: model,
                    source: api,
                    rawProfile: profile,
                });
            }
        } catch (e) {
            console.warn('[SmallPhone] 获取 Connection Profiles 失败:', e);
        }

        return result;
    }

    /**
     * 根据选中的 profile 或指定参数向服务端拉取可用模型列表
     * @param {Object} options
     * @param {string} options.source 接口来源类型（如 openai, custom, deepseek 等）
     * @param {string} options.url 自定义端点或代理端点
     * @param {Object} [options.rawProfile] Connection Profile 原始对象
     * @returns {Promise<Array<{ id: string, name: string }>>}
     */
    static async fetchModels({ source, url, rawProfile = null }) {
        const context = (typeof Luker !== 'undefined' && Luker.getContext)
            ? Luker.getContext()
            : getContext();

        const headers = (context && typeof context.getRequestHeaders === 'function')
            ? context.getRequestHeaders()
            : { 'Content-Type': 'application/json' };

        // 构造状态检查与模型拉取的请求体
        const payload = {
            chat_completion_source: source || 'custom',
        };

        if (url && url !== '(默认端点)') {
            payload.custom_url = url;
            payload.reverse_proxy = url;
            payload.base_url = url;
        }

        if (rawProfile) {
            if (rawProfile['proxy-password']) {
                payload.proxy_password = rawProfile['proxy-password'];
            }
            if (rawProfile['secret-id']) {
                payload.secret_id = rawProfile['secret-id'];
            }
            if (rawProfile['custom-include-headers']) {
                payload.custom_include_headers = rawProfile['custom-include-headers'];
            }
        }

        try {
            const res = await fetch('/api/backends/chat-completions/status', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload),
                cache: 'no-cache',
            });

            if (!res.ok) {
                throw new Error(`HTTP 错误: ${res.status} ${res.statusText}`);
            }

            const data = await res.json();
            const models = [];

            if (data && Array.isArray(data.data)) {
                for (const item of data.data) {
                    const id = typeof item === 'string' ? item : item?.id;
                    const name = typeof item === 'object' && item?.name ? item.name : id;
                    if (id) {
                        models.push({ id: String(id), name: String(name || id) });
                    }
                }
            }

            // 排序
            models.sort((a, b) => a.id.localeCompare(b.id));
            return models;
        } catch (error) {
            console.error('[SmallPhone] 拉取模型列表失败:', error);
            throw error;
        }
    }

    /**
     * 读取当前酒馆中启用的预设条目（包括系统预设条目与当前角色基本设定）
     * @returns {Array<{ role: string, name: string, content: string }>}
     */
    static getTavernPresetPrompts() {
        const presetItems = [];
        const context = (typeof Luker !== 'undefined' && Luker.getContext)
            ? Luker.getContext()
            : getContext();

        try {
            // 1. 尝试从 oai_settings / chatCompletionSettings 中读取已启用的预设条目
            const oai = window.oai_settings || context?.chatCompletionSettings || {};
            if (Array.isArray(oai.prompts)) {
                for (const item of oai.prompts) {
                    if (item && item.enabled !== false && item.content && typeof item.content === 'string' && item.content.trim()) {
                        presetItems.push({
                            role: item.role || 'system',
                            name: item.name || item.identifier || 'preset_prompt',
                            content: item.content.trim(),
                        });
                    }
                }
            }

            // 2. 如果当前有正在对话的角色，并且有自定义设定，一并纳入预设
            const thisChid = context?.this_chid ?? window.this_chid;
            const characters = context?.characters ?? window.characters ?? [];
            if (thisChid !== undefined && characters[thisChid]) {
                const char = characters[thisChid];
                if (char.system_prompt && char.system_prompt.trim()) {
                    presetItems.push({
                        role: 'system',
                        name: 'character_system_prompt',
                        content: char.system_prompt.trim(),
                    });
                }
                if (char.description && char.description.trim()) {
                    presetItems.push({
                        role: 'system',
                        name: 'character_description',
                        content: `[Character Description: ${char.name}]\n${char.description.trim()}`,
                    });
                }
                if (char.personality && char.personality.trim()) {
                    presetItems.push({
                        role: 'system',
                        name: 'character_personality',
                        content: `[Character Personality]\n${char.personality.trim()}`,
                    });
                }
            }
        } catch (e) {
            console.warn('[SmallPhone] 提取酒馆预设条目时出现异常:', e);
        }

        return presetItems;
    }

    /**
     * 发送测试消息至 AI
     * @param {Object} options
     * @param {string} [options.message='你好'] 要发送的消息文本
     * @param {string} [options.appId='default'] 激活的应用场景（如 'qq', 'x', 'taobao', 'default'）
     * @param {boolean} [options.useTavernPreset=false] 是否携带酒馆预设条目
     * @returns {Promise<{ reply: string, presetCount: number, timeMs: number }>}
     */
    static async sendTestMessage({ appId = 'default', message = '你好', useTavernPreset = false } = {}) {
        // 1. 组装消息列表（通过 PromptManager 按可拖拽顺序与当前场景 appId 动态注入）
        const messages = PromptManager.buildMessagesPayload({
            appId: appId || 'default',
            userMessage: message || '你好',
            useTavernPreset: useTavernPreset,
        });

        const presetCount = useTavernPreset
            ? Math.max(0, messages.length - 1)
            : 0;

        const result = await this.sendChatCompletion(messages);
        return {
            ...result,
            presetCount,
        };
    }

    /**
     * 通用聊天补全接口：接收任意标准 messages 数组并调用 AI 返回结果
     * @param {Array<{ role: string, content: string, name?: string }>} messages 
     * @param {Object} [options]
     * @param {number} [options.maxTokens] 最大 token（默认读取设置中的配置，默认值为 300,000）
     * @returns {Promise<{ reply: string, timeMs: number }>}
     */
    static async sendChatCompletion(messages, { maxTokens } = {}) {
        const startTime = Date.now();
        const savedApi = SettingsManager.getApiConfig();
        const availableProfiles = this.getAvailableProfiles();
        const profile = availableProfiles.find(p => p.id === savedApi.selectedProfile);

        // 解析最大词符数：优先取传参，其次取保存配置，默认回退为 300,000 (30万)
        const savedMaxTokens = Number(savedApi.maxTokens);
        const resolvedMaxTokens = (typeof maxTokens === 'number' && maxTokens > 0)
            ? maxTokens
            : ((!isNaN(savedMaxTokens) && savedMaxTokens > 0) ? savedMaxTokens : 300000);

        const context = (typeof Luker !== 'undefined' && Luker.getContext)
            ? Luker.getContext()
            : getContext();

        const headers = (context && typeof context.getRequestHeaders === 'function')
            ? context.getRequestHeaders()
            : { 'Content-Type': 'application/json' };

        // 目标模型
        const model = (savedApi.model && savedApi.model.trim())
            || profile?.model
            || 'gpt-3.5-turbo';

        // 来源类型
        const source = profile?.source || 'custom';

        // 目标端点
        let targetUrl = (savedApi.apiUrl && savedApi.apiUrl.trim()) || profile?.url || '';
        if (targetUrl === '(默认端点)') targetUrl = '';

        const payload = {
            messages,
            model,
            chat_completion_source: source,
            temperature: typeof savedApi.temperature === 'number' ? savedApi.temperature : 0.9,
            stream: false,
            max_tokens: resolvedMaxTokens,
        };

        if (targetUrl) {
            payload.custom_url = targetUrl;
            payload.reverse_proxy = targetUrl;
            payload.base_url = targetUrl;
        }

        if (profile?.rawProfile) {
            const raw = profile.rawProfile;
            if (raw['proxy-password']) payload.proxy_password = raw['proxy-password'];
            if (raw['secret-id']) payload.secret_id = raw['secret-id'];
            if (raw['custom-include-headers']) payload.custom_include_headers = raw['custom-include-headers'];
        }

        // 3. 发送请求
        currentActiveController = new AbortController();
        const signal = currentActiveController.signal;

        let response;
        try {
            response = await fetch('/api/backends/chat-completions/generate', {
                method: 'POST',
                headers: headers,
                cache: 'no-cache',
                body: JSON.stringify(payload),
                signal: signal,
            });
        } catch (fetchErr) {
            if (fetchErr.name === 'AbortError' || signal.aborted) {
                const abortError = new Error('生成已由用户手动停止');
                abortError.isAborted = true;
                throw abortError;
            }
            throw fetchErr;
        } finally {
            if (currentActiveController?.signal === signal) {
                currentActiveController = null;
            }
        }

        const timeMs = Date.now() - startTime;

        if (!response.ok) {
            let errorText = `${response.status} ${response.statusText}`;
            try {
                const errJson = await response.json();
                if (errJson?.error?.message) errorText = errJson.error.message;
            } catch (_) { }
            throw new Error(`请求失败 (${errorText})`);
        }

        const data = await response.json();
        if (data.error) {
            throw new Error(String(data.error.message || data.error));
        }

        // 4. 解析响应文本与思维链 (兼容 Reasoning / Thinking / 普通 Content)
        let reply = '';
        let reasoning = '';
        let isTokenExhausted = false;

        if (Array.isArray(data.choices) && data.choices.length > 0) {
            const firstChoice = data.choices[0];
            const msg = firstChoice.message || {};
            // 提取正文内容
            if (typeof msg.content === 'string' && msg.content.trim()) {
                reply = msg.content.trim();
            } else if (typeof firstChoice.text === 'string' && firstChoice.text.trim()) {
                reply = firstChoice.text.trim();
            }

            // 深度解析函数调用 / 工具调用 (Tool Calls / Function Calling 格式，如预设强制 emit_complete_response 输出)
            if (!reply) {
                reply = this.extractTextFromToolCalls(msg, firstChoice);
            }

            // 提取思维链 (DeepSeek / Gemini / Claude / OpenAI Thinking)
            if (typeof msg.reasoning_content === 'string' && msg.reasoning_content.trim()) {
                reasoning = msg.reasoning_content.trim();
            } else if (typeof msg.reasoning === 'string' && msg.reasoning.trim()) {
                reasoning = msg.reasoning.trim();
            } else if (typeof msg.thought === 'string' && msg.thought.trim()) {
                reasoning = msg.thought.trim();
            }

            // 检查是否发生 token 耗尽截断
            const completionTokens = data.usage?.completion_tokens ?? 0;
            if (completionTokens > 0 && Math.abs(completionTokens - maxTokens) <= 20) {
                isTokenExhausted = true;
            }
        } else if (Array.isArray(data.content)) {
            // Claude 格式 (普通文本、思维链与 tool_use 提取)
            reply = data.content.filter(c => c?.type === 'text').map(c => c?.text || '').join('').trim();
            const thoughts = data.content.filter(c => c?.type === 'thinking').map(c => c?.thinking || '').join('\n').trim();
            if (thoughts) reasoning = thoughts;

            if (!reply) {
                const toolUses = data.content.filter(c => c?.type === 'tool_use');
                const toolTexts = toolUses.map(tu => {
                    const input = tu.input || {};
                    return input.content || input.message || input.reply || input.response || input.text || (typeof input === 'string' ? input : JSON.stringify(input));
                }).filter(Boolean);
                if (toolTexts.length > 0) {
                    reply = toolTexts.join('\n\n').trim();
                }
            }
        } else if (typeof data.text === 'string') {
            reply = data.text.trim();
        }

        // 如果正文为空但有思考内容，展示思考内容
        if (!reply && reasoning) {
            reply = `[模型深度思考]:\n${reasoning}`;
        } else if (!reply && isTokenExhausted) {
            reply = `[提示]: 模型输出了 ${data.usage?.completion_tokens} 个 token，但在到达最大上限时仍未输出正文（可能被长思考过程耗尽）。建议关闭【使用酒馆预设】或增大 Token 上限后重试。`;
        } else if (!reply && typeof data === 'object') {
            reply = JSON.stringify(data, null, 2);
        }

        return {
            reply: String(reply).trim(),
            presetCount: Array.isArray(messages) ? Math.max(0, messages.length - 1) : 0,
            timeMs,
        };
    }

    /**
     * 深度提取函数调用 / 工具调用 (Tool Calls / Function Calling) 中的有效回复正文
     * 解决预设强制模型以 tool_calls (如 emit_complete_response) 返回时 content 为空的问题
     * @param {Object} msg message 对象
     * @param {Object} firstChoice 首个 choice 对象
     * @returns {string} 提取到的正文文本
     */
    static extractTextFromToolCalls(msg, firstChoice) {
        if (!msg && !firstChoice) return '';

        const toolCalls = msg?.tool_calls || firstChoice?.tool_calls;
        const functionCall = msg?.function_call || firstChoice?.function_call;

        const extractedTexts = [];

        // 1. 处理 tool_calls 数组
        if (Array.isArray(toolCalls) && toolCalls.length > 0) {
            for (const tc of toolCalls) {
                const fn = tc.function || tc;
                let args = fn.arguments ?? fn.input ?? fn.parameters;

                if (typeof args === 'string') {
                    args = args.trim();
                    if (args.startsWith('```')) {
                        args = args.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
                    }
                    try {
                        args = JSON.parse(args);
                    } catch (_) { }
                }

                if (typeof args === 'object' && args !== null) {
                    const candidates = [
                        args.content,
                        args.message,
                        args.reply,
                        args.response,
                        args.text,
                        args.body,
                        args.msg,
                        args.say,
                        args.dialogue,
                        args.output,
                        args.input,
                        args.action_input,
                    ];
                    const found = candidates.find(c => typeof c === 'string' && c.trim());
                    if (found) {
                        extractedTexts.push(found.trim());
                    } else {
                        const strVals = Object.values(args).filter(v => typeof v === 'string' && v.trim());
                        if (strVals.length > 0) {
                            extractedTexts.push(strVals.join('\n').trim());
                        } else {
                            extractedTexts.push(JSON.stringify(args));
                        }
                    }
                } else if (typeof args === 'string' && args.trim()) {
                    extractedTexts.push(args.trim());
                }
            }
        }

        // 2. 处理旧版 function_call 单对象
        if (functionCall) {
            let args = functionCall.arguments ?? functionCall.parameters;
            if (typeof args === 'string') {
                args = args.trim();
                if (args.startsWith('```')) {
                    args = args.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
                }
                try {
                    args = JSON.parse(args);
                } catch (_) { }
            }
            if (typeof args === 'object' && args !== null) {
                const candidates = [
                    args.content,
                    args.message,
                    args.reply,
                    args.response,
                    args.text,
                    args.body,
                    args.msg,
                ];
                const found = candidates.find(c => typeof c === 'string' && c.trim());
                if (found) {
                    extractedTexts.push(found.trim());
                } else {
                    const strVals = Object.values(args).filter(v => typeof v === 'string' && v.trim());
                    if (strVals.length > 0) {
                        extractedTexts.push(strVals.join('\n').trim());
                    } else {
                        extractedTexts.push(JSON.stringify(args));
                    }
                }
            } else if (typeof args === 'string' && args.trim()) {
                extractedTexts.push(args.trim());
            }
        }

        return extractedTexts.join('\n\n').trim();
    }
}

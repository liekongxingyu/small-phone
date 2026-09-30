import { extension_settings, getContext } from '../../../extensions.js';

export const EXTENSION_NAME = 'small-phone';

const defaultSettings = {
    enabled: true,
    position: {
        x: null,
        y: null,
    },
    size: {
        width: 300,
        height: 600,
    },
    theme: 'dark',
    chatFontSize: 11.5, // 聊天正文字体大小，默认 11.5px
    apiConfig: {
        selectedProfile: '__current_main__',
        apiUrl: '',
        model: '',
        temperature: 0.9,
        maxTokens: 300000, // 最大词符数，默认 30 万
    },
    promptConfig: {
        useTavernPreset: false, // 是否使用酒馆预设，默认 false
    },
    memoryConfig: {
        chatHistoryDepth: 6, // 读取正文中上下文的记录数（含用户输入），默认 6 条（即 3 轮）
    },
    taobaoConfig: {
        maxFavorites: 100, // 淘宝最大收藏数量，默认 100
    },
};


/**
 * 设置管理器，负责配置的持久化与读取
 */
export class SettingsManager {
    static init() {
        extension_settings[EXTENSION_NAME] = extension_settings[EXTENSION_NAME] || {};
        Object.assign(extension_settings[EXTENSION_NAME], {
            ...defaultSettings,
            ...extension_settings[EXTENSION_NAME],
        });
        this.applyChatFontSize();
    }

    static getSettings() {
        return extension_settings[EXTENSION_NAME] || { ...defaultSettings };
    }

    static get(key, defaultValue = null) {
        const settings = this.getSettings();
        return settings[key] !== undefined ? settings[key] : defaultValue;
    }

    static _save() {
        try {
            const context = getContext();
            if (context && typeof context.saveSettingsDebounced === 'function') {
                context.saveSettingsDebounced();
            }
        } catch (e) {
            console.warn('[SmallPhone] 保存配置失败:', e);
        }
    }

    static set(key, value) {
        if (!extension_settings[EXTENSION_NAME]) {
            extension_settings[EXTENSION_NAME] = { ...defaultSettings };
        }
        extension_settings[EXTENSION_NAME][key] = value;
        this._save();
    }

    static update(updaterFn) {
        if (!extension_settings[EXTENSION_NAME]) {
            extension_settings[EXTENSION_NAME] = { ...defaultSettings };
        }
        updaterFn(extension_settings[EXTENSION_NAME]);
        this._save();
    }

    static getApiConfig() {
        const settings = this.getSettings();
        return {
            ...defaultSettings.apiConfig,
            ...(settings.apiConfig || {}),
        };
    }

    static saveApiConfig(config) {
        if (!extension_settings[EXTENSION_NAME]) {
            extension_settings[EXTENSION_NAME] = { ...defaultSettings };
        }
        extension_settings[EXTENSION_NAME].apiConfig = {
            ...defaultSettings.apiConfig,
            ...(extension_settings[EXTENSION_NAME].apiConfig || {}),
            ...config,
        };
        this._save();
    }

    static getPromptConfig() {
        const settings = this.getSettings();
        return {
            ...defaultSettings.promptConfig,
            ...(settings.promptConfig || {}),
        };
    }

    static savePromptConfig(config) {
        if (!extension_settings[EXTENSION_NAME]) {
            extension_settings[EXTENSION_NAME] = { ...defaultSettings };
        }
        extension_settings[EXTENSION_NAME].promptConfig = {
            ...defaultSettings.promptConfig,
            ...(extension_settings[EXTENSION_NAME].promptConfig || {}),
            ...config,
        };
        this._save();
    }

    static getMemoryConfig() {
        const settings = this.getSettings();
        return {
            ...defaultSettings.memoryConfig,
            ...(settings.memoryConfig || {}),
        };
    }

    static saveMemoryConfig(config) {
        if (!extension_settings[EXTENSION_NAME]) {
            extension_settings[EXTENSION_NAME] = { ...defaultSettings };
        }
        extension_settings[EXTENSION_NAME].memoryConfig = {
            ...defaultSettings.memoryConfig,
            ...(extension_settings[EXTENSION_NAME].memoryConfig || {}),
            ...config,
        };
        this._save();
    }

    /**
     * 获取聊天正文字体大小（默认 11.5px）
     */
    static getChatFontSize() {
        const settings = this.getSettings();
        const val = parseFloat(settings.chatFontSize || settings.fontSize);
        return (!isNaN(val) && val >= 8 && val <= 32) ? val : 11.5;
    }

    /**
     * 保存聊天正文字体大小并即时应用生效
     */
    static saveChatFontSize(size) {
        const val = parseFloat(size);
        const valid = (!isNaN(val) && val >= 8 && val <= 32) ? val : 11.5;
        this.set('chatFontSize', valid);
        this.set('fontSize', valid);
        this.applyChatFontSize(valid);
        return valid;
    }

    /**
     * 将当前配置的字体大小动态应用到 DOM 根节点 CSS 变量中
     */
    static applyChatFontSize(size) {
        const valid = size !== undefined ? parseFloat(size) : this.getChatFontSize();
        if (typeof document !== 'undefined' && document.documentElement) {
            document.documentElement.style.setProperty('--sp-chat-font-size', `${valid}px`);
        }
    }

    /**
     * 获取淘宝相关全局配置
     */
    static getTaobaoConfig() {
        const settings = this.getSettings();
        return {
            ...defaultSettings.taobaoConfig,
            ...(settings.taobaoConfig || {}),
        };
    }

    /**
     * 保存淘宝相关全局配置
     */
    static saveTaobaoConfig(config) {
        if (!extension_settings[EXTENSION_NAME]) {
            extension_settings[EXTENSION_NAME] = { ...defaultSettings };
        }
        extension_settings[EXTENSION_NAME].taobaoConfig = {
            ...defaultSettings.taobaoConfig,
            ...(extension_settings[EXTENSION_NAME].taobaoConfig || {}),
            ...config,
        };
        this._save();
    }
}


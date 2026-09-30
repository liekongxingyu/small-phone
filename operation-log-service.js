import { extension_settings } from '../../../extensions.js';
import { EXTENSION_NAME, SettingsManager } from './settings-manager.js';

/**
 * 操作日志单条记录结构
 * @typedef {Object} OperationLogItem
 * @property {string} id 唯一日志标识
 * @property {string} time 时间文本，如 "19:20:05"
 * @property {number} timestamp 时间戳毫秒
 * @property {string} module 业务模块，如 "QQ单聊"、"QQ通讯录"、"提示词"、"系统设置"
 * @property {string} action 操作动作，如 "发送消息"、"收到回复"、"删除好友"、"清空会话"、"保存规则"
 * @property {'success'|'error'|'info'|'warning'} status 操作状态结果
 * @property {string} detail 极简状态元数据（绝不记录任何提示词/Prompt长文本！）
 */

/**
 * OperationLogService：负责记录插件内部的操作状态日志
 * 
 * 核心设计规范：
 * 1. 严格禁止记录任何提示词、Prompt 密文、系统指令与长对话正文！
 * 2. 仅记录纯粹的操作状态：时间、模块、动作、状态（成功/失败）与极简元信息。
 * 3. 滚动环形队列存储（FIFO，最多保留 100 条），存储紧凑，绝不臃肿。
 * 4. 支持事件监听，App 打开时实时无缝接收新状态。
 */
export class OperationLogService {
    static STORAGE_KEY = 'operationLogs';
    static MAX_LOGS_KEY = 'maxOperationLogs';
    static DEFAULT_MAX_LOGS = 100;
    static listeners = new Set();

    /**
     * 获取最大保留日志条数（默认 100）
     * @returns {number}
     */
    static getMaxLogs() {
        const settings = SettingsManager.getSettings();
        const val = parseInt(settings[this.MAX_LOGS_KEY], 10);
        return (!isNaN(val) && val > 0) ? val : this.DEFAULT_MAX_LOGS;
    }

    /**
     * 设置最大保留日志条数并持久化保存，若当前记录超出新上限则自动立即裁剪
     * @param {number|string} max
     * @returns {number}
     */
    static setMaxLogs(max) {
        let val = parseInt(max, 10);
        if (isNaN(val) || val <= 0) val = this.DEFAULT_MAX_LOGS;
        val = Math.max(10, Math.min(2000, val)); // 限制在 10 ~ 2000 条

        const settings = SettingsManager.getSettings();
        settings[this.MAX_LOGS_KEY] = val;

        const logs = this.getLogs();
        if (logs.length > val) {
            logs.length = val;
        }

        SettingsManager._save();

        for (const listener of this.listeners) {
            try {
                listener(null, logs);
            } catch (_) {}
        }

        return val;
    }

    /**
     * 格式化当前时间为 [HH:mm:ss]
     */
    static formatTime(date = new Date()) {
        const d = (date instanceof Date) ? date : new Date(date);
        const pad = (n) => String(n).padStart(2, '0');
        const h = pad(d.getHours());
        const m = pad(d.getMinutes());
        const s = pad(d.getSeconds());
        return `${h}:${m}:${s}`;
    }

    /**
     * 获取全部操作日志列表（按时间倒序排列，最新在最前）
     * @returns {OperationLogItem[]}
     */
    static getLogs() {
        const settings = SettingsManager.getSettings();
        if (!Array.isArray(settings[this.STORAGE_KEY])) {
            settings[this.STORAGE_KEY] = [];
        }
        return settings[this.STORAGE_KEY];
    }

    /**
     * 写入一条操作日志
     * 严格安全过滤：detail 截断至最多 60 字符，严禁带入提示词！
     * 
     * @param {Object} params
     * @param {string} params.module 模块名，如 "QQ单聊"
     * @param {string} params.action 动作名，如 "发送消息"
     * @param {'success'|'error'|'info'|'warning'} [params.status='success'] 结果状态
     * @param {string} [params.detail=''] 极简元信息摘要（严禁传入 Prompt！）
     * @returns {OperationLogItem}
     */
    static log({ module = '系统', action = '操作', status = 'success', detail = '' }) {
        // 安全净化：剥离多余换行、严格截断至 60 字符，杜绝长文本或提示词注入
        const safeDetail = String(detail || '')
            .replace(/[\r\n\t]+/g, ' ')
            .trim()
            .slice(0, 60);

        const now = Date.now();
        const item = {
            id: `log_${now}_${Math.random().toString(36).slice(2, 6)}`,
            time: this.formatTime(now),
            timestamp: now,
            module: String(module || '系统').trim(),
            action: String(action || '操作').trim(),
            status: ['success', 'error', 'info', 'warning'].includes(status) ? status : 'info',
            detail: safeDetail,
        };

        const logs = this.getLogs();
        logs.unshift(item); // 最新日志排在最前

        // 超出动态上限滚动淘汰（FIFO）
        const maxLimit = this.getMaxLogs();
        if (logs.length > maxLimit) {
            logs.length = maxLimit;
        }

        // 保存到后端 JSON
        SettingsManager._save();

        // 通知所有活跃的日志视图监听器
        for (const listener of this.listeners) {
            try {
                listener(item, logs);
            } catch (err) {
                console.warn('[OperationLogService] 监听器触发异常:', err);
            }
        }

        return item;
    }

    /**
     * 清空全部操作日志
     */
    static clearLogs() {
        const settings = SettingsManager.getSettings();
        settings[this.STORAGE_KEY] = [];
        SettingsManager._save();

        for (const listener of this.listeners) {
            try {
                listener(null, []);
            } catch (_) {}
        }
    }

    /**
     * 订阅新日志写入通知
     * @param {Function} callback (newItem, allLogs) => void
     * @returns {Function} 解绑函数
     */
    static subscribe(callback) {
        if (typeof callback === 'function') {
            this.listeners.add(callback);
            return () => this.listeners.delete(callback);
        }
        return () => {};
    }

    /**
     * 获取日志统计概览
     */
    static getStats() {
        const logs = this.getLogs();
        let success = 0;
        let error = 0;
        let info = 0;

        for (const item of logs) {
            if (item.status === 'success') success++;
            else if (item.status === 'error') error++;
            else info++;
        }

        return {
            total: logs.length,
            success,
            error,
            info,
            maxLogs: this.getMaxLogs(),
        };
    }
}

if (typeof window !== 'undefined') {
    window.OperationLogService = OperationLogService;
}

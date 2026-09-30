import { OperationLogService } from './operation-log-service.js';

/**
 * LogApp：小手机操作日志应用
 * 
 * 视觉风格：Windows 11 Fluent 极简设计
 * - 紧凑半透明卡片
 * - 纯净操作状态流（0 提示词）
 * - 实时状态更新与一键清空
 */
export class LogApp {
    constructor({ onBackToHome }) {
        this.onBackToHome = onBackToHome;
        this.container = null;
        this.unsubscribe = null;
    }

    /**
     * 构建并返回页面 DOM 节点
     */
    render() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }

        const template = `
            <div class="small-phone-app-page sp-log-page" id="sp-log-page">
                <!-- 顶栏 -->
                <div class="sp-log-header">
                    <button type="button" class="sp-log-back-btn" id="sp-log-back-btn" title="返回桌面">
                        <i class="fa-solid fa-chevron-left"></i> 桌面
                    </button>
                    <div class="sp-log-header-title">
                        <i class="fa-solid fa-clock-rotate-left"></i>
                        <span>操作日志</span>
                    </div>
                    <div class="sp-log-header-actions">
                        <button type="button" class="sp-log-icon-btn" id="sp-log-settings-btn" title="日志设置 (上限条数)">
                            <i class="fa-solid fa-sliders"></i>
                        </button>
                        <button type="button" class="sp-log-icon-btn" id="sp-log-refresh-btn" title="刷新日志">
                            <i class="fa-solid fa-arrows-rotate"></i>
                        </button>
                        <button type="button" class="sp-log-icon-btn text-danger" id="sp-log-clear-btn" title="清空全部操作日志">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>

                <!-- 日志设置抽屉面板 (默认收起) -->
                <div class="sp-log-settings-drawer" id="sp-log-settings-drawer" style="display: none;">
                    <div class="sp-log-settings-card">
                        <div class="sp-log-drawer-header">
                            <div class="sp-log-drawer-title">
                                <i class="fa-solid fa-sliders"></i> 日志设置
                            </div>
                            <button type="button" class="sp-log-drawer-close" id="sp-log-settings-close-btn">&times;</button>
                        </div>
                        <div class="sp-log-drawer-body">
                            <div class="sp-log-setting-field">
                                <label for="sp-log-max-input">最大保留日志条数 (默认 100)</label>
                                <div class="sp-log-input-row">
                                    <input type="number" id="sp-log-max-input" class="sp-input sp-log-num-input" min="10" max="2000" step="10" value="${OperationLogService.getMaxLogs()}" />
                                    <button type="button" class="sp-btn sp-btn-primary sp-btn-sm" id="sp-log-save-max-btn">
                                        保存
                                    </button>
                                </div>
                                <div class="sp-log-quick-tags">
                                    <button type="button" class="sp-log-tag-btn" data-val="50">50 条</button>
                                    <button type="button" class="sp-log-tag-btn" data-val="100">100 条 (默认)</button>
                                    <button type="button" class="sp-log-tag-btn" data-val="200">200 条</button>
                                    <button type="button" class="sp-log-tag-btn" data-val="500">500 条</button>
                                </div>
                                <span class="sp-log-hint-text">
                                    超出此上限后，将按先进先出 (FIFO) 自动淘汰最旧的操作状态记录。
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 统计概览胶囊 -->
                <div class="sp-log-stats-bar" id="sp-log-stats-bar">
                    <!-- 动态注入统计 -->
                </div>

                <!-- 日志流列表容器 -->
                <div class="sp-log-stream" id="sp-log-stream">
                    <!-- 动态注入日志列表 -->
                </div>
            </div>
        `;

        this.container = $(template);
        this._bindEvents();
        this._renderLogsList();

        // 订阅实时日志更新
        this.unsubscribe = OperationLogService.subscribe(() => {
            this._renderLogsList();
        });

        return this.container;
    }

    /**
     * 绑定事件监听
     */
    _bindEvents() {
        if (!this.container) return;

        // 1. 返回桌面
        this.container.on('click', '#sp-log-back-btn', () => {
            if (typeof this.onBackToHome === 'function') {
                this.onBackToHome();
            }
        });

        // 2. 刷新日志
        this.container.on('click', '#sp-log-refresh-btn', () => {
            this._renderLogsList();
            if (typeof toastr !== 'undefined') toastr.info('日志已刷新', '操作日志');
        });

        // 3. 清空日志
        this.container.on('click', '#sp-log-clear-btn', () => {
            if (confirm('确认清空所有操作日志记录吗？')) {
                OperationLogService.clearLogs();
                this._renderLogsList();
                if (typeof toastr !== 'undefined') toastr.info('操作日志已清空', '操作日志');
            }
        });

        // 4. 切换日志设置抽屉
        this.container.on('click', '#sp-log-settings-btn', () => {
            const $drawer = this.container.find('#sp-log-settings-drawer');
            $drawer.slideToggle(180, () => {
                if ($drawer.is(':visible')) {
                    this.container.find('#sp-log-max-input').val(OperationLogService.getMaxLogs()).focus();
                }
            });
        });

        // 5. 关闭设置抽屉
        this.container.on('click', '#sp-log-settings-close-btn', () => {
            this.container.find('#sp-log-settings-drawer').slideUp(160);
        });

        // 6. 点击快捷预设标签
        this.container.on('click', '.sp-log-tag-btn', (e) => {
            const val = parseInt($(e.currentTarget).data('val'), 10);
            if (!isNaN(val)) {
                this.container.find('#sp-log-max-input').val(val);
                this._saveMaxLogs(val);
            }
        });

        // 7. 保存最大条数设置
        this.container.on('click', '#sp-log-save-max-btn', () => {
            const val = parseInt(this.container.find('#sp-log-max-input').val(), 10);
            this._saveMaxLogs(val);
        });
    }

    /**
     * 保存最大保留日志条数
     */
    _saveMaxLogs(val) {
        if (isNaN(val) || val < 10) {
            if (typeof toastr !== 'undefined') toastr.warning('保留条数最少为 10 条', '日志设置');
            return;
        }
        if (val > 2000) {
            if (typeof toastr !== 'undefined') toastr.warning('保留条数最多为 2000 条', '日志设置');
            return;
        }

        const savedVal = OperationLogService.setMaxLogs(val);
        this.container.find('#sp-log-max-input').val(savedVal);
        this.container.find('#sp-log-settings-drawer').slideUp(160);
        this._renderLogsList();

        if (typeof toastr !== 'undefined') {
            toastr.success(`已保存！最大保留日志条数设为 ${savedVal} 条`, '日志设置');
        }
    }

    /**
     * 渲染统计栏与日志列表
     */
    _renderLogsList() {
        if (!this.container) return;

        const logs = OperationLogService.getLogs();
        const stats = OperationLogService.getStats();

        // 1. 渲染统计条（展示当前总计与上限）
        const $statsBar = this.container.find('#sp-log-stats-bar');
        $statsBar.html(`
            <div class="sp-log-stat-pill">
                <span class="sp-stat-num">${stats.total} <span class="sp-stat-max">/ ${stats.maxLogs}</span></span>
                <span class="sp-stat-label">总计/上限</span>
            </div>
            <div class="sp-log-stat-pill is-success">
                <span class="sp-stat-num text-success">${stats.success}</span>
                <span class="sp-stat-label">成功</span>
            </div>
            <div class="sp-log-stat-pill is-error">
                <span class="sp-stat-num text-danger">${stats.error}</span>
                <span class="sp-stat-label">异常</span>
            </div>
        `);

        // 2. 渲染日志列表
        const $stream = this.container.find('#sp-log-stream');
        $stream.empty();

        if (logs.length === 0) {
            $stream.html(`
                <div class="sp-log-empty-state">
                    <i class="fa-solid fa-inbox"></i>
                    <span>暂无操作日志</span>
                    <p>插件各项操作的状态将自动记录在此</p>
                </div>
            `);
            return;
        }

        const fragment = document.createDocumentFragment();

        for (const item of logs) {
            const isSuccess = item.status === 'success';
            const isError = item.status === 'error';

            let badgeClass = 'badge-info';
            let badgeText = '执行';
            if (isSuccess) {
                badgeClass = 'badge-success';
                badgeText = '成功';
            } else if (isError) {
                badgeClass = 'badge-error';
                badgeText = '失败';
            }

            const itemEl = document.createElement('div');
            itemEl.className = `sp-log-item status-${item.status}`;
            itemEl.innerHTML = `
                <div class="sp-log-item-top">
                    <div class="sp-log-time">${item.time}</div>
                    <div class="sp-log-module-tag">${item.module}</div>
                    <div class="sp-log-action">${item.action}</div>
                    <div class="sp-log-badge ${badgeClass}">${badgeText}</div>
                </div>
                ${item.detail ? `<div class="sp-log-detail">${this._escapeHtml(item.detail)}</div>` : ''}
            `;

            fragment.appendChild(itemEl);
        }

        $stream[0].appendChild(fragment);
    }

    /**
     * HTML 安全转义
     */
    _escapeHtml(str = '') {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}

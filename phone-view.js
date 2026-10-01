import { SettingsManager } from './settings-manager.js';
import { SettingsApp } from './settings-app.js';
import { QQApp } from './qq-app.js';
import { LogApp } from './log-app.js';
import { TaobaoApp } from './taobao-app.js';
import { XApp } from './x-app.js';

/**
 * 默认主屏幕预设 App 列表（按顺序：QQ，淘宝，X，设置，操作日志）
 */
const DEFAULT_APPS = [
    {
        id: 'qq',
        name: 'QQ',
        iconHtml: '<i class="fa-brands fa-qq"></i>',
        iconClass: 'small-phone-icon-qq',
    },
    {
        id: 'taobao',
        name: '淘宝',
        iconHtml: '<span class="small-phone-icon-text">淘</span>',
        iconClass: 'small-phone-icon-taobao',
    },
    {
        id: 'x',
        name: 'X',
        iconHtml: '<i class="fa-brands fa-x-twitter"></i>',
        iconClass: 'small-phone-icon-x',
    },
    {
        id: 'settings',
        name: '设置',
        iconHtml: '<i class="fa-solid fa-gear"></i>',
        iconClass: 'small-phone-icon-settings',
    },
    {
        id: 'logs',
        name: '操作日志',
        iconHtml: '<i class="fa-solid fa-clock-rotate-left"></i>',
        iconClass: 'small-phone-icon-logs',
    },
];

/**
 * PhoneView 类：负责小手机的 DOM 渲染、视口管理、PPT 矩形风格的 8 向自由拉伸与拖拽
 */
export class PhoneView {
    constructor() {
        this.container = null;
        this.isOpen = false;
        this.timeInterval = null;
        this.settingCallbacks = [];
        this.appClickCallbacks = {};
        this.appGrid = null;
        this.currentAppId = null; // 当前正在运行的 App
        this.settingsApp = null;
        this.qqApp = null;
        this.logApp = null;
        this.taobaoApp = null;
        this.xApp = null;
        this.isInteracting = false; // 是否正在拖拽或缩放

        // 最小与最大尺寸约束
        this.minWidth = 240;
        this.minHeight = 440;
    }

    /**
     * 初始化视图并挂载到 body
     */
    init() {
        if ($('#small-phone-wrapper').length > 0) {
            return;
        }

        const template = `
            <div id="small-phone-wrapper" class="small-phone-wrapper" style="display: none;">
                <!-- 8 向 PPT 风格缩放调整手柄 -->
                <div class="small-phone-resize-handle handle-n" data-dir="n" title="上下拉伸"></div>
                <div class="small-phone-resize-handle handle-s" data-dir="s" title="上下拉伸"></div>
                <div class="small-phone-resize-handle handle-w" data-dir="w" title="左右拉伸"></div>
                <div class="small-phone-resize-handle handle-e" data-dir="e" title="左右拉伸"></div>
                <div class="small-phone-resize-handle handle-nw" data-dir="nw" title="等比/自由拉伸"><div class="handle-dot"></div></div>
                <div class="small-phone-resize-handle handle-ne" data-dir="ne" title="等比/自由拉伸"><div class="handle-dot"></div></div>
                <div class="small-phone-resize-handle handle-sw" data-dir="sw" title="等比/自由拉伸"><div class="handle-dot"></div></div>
                <div class="small-phone-resize-handle handle-se" data-dir="se" title="等比/自由拉伸"><div class="handle-dot"></div></div>

                <div class="small-phone-case" id="small-phone-drag-body">
                    <!-- 手机侧边按键装饰 -->
                    <div class="small-phone-btn-volume-up"></div>
                    <div class="small-phone-btn-volume-down"></div>
                    <div class="small-phone-btn-power"></div>

                    <!-- 手机屏幕 -->
                    <div class="small-phone-screen">
                        <!-- 顶部状态栏与灵动岛 -->
                        <div class="small-phone-status-bar" id="small-phone-drag-handle" title="按住可拖动手机位置">
                            <span class="small-phone-time" id="small-phone-time">12:00</span>
                            <div class="small-phone-island">
                                <span class="small-phone-camera"></span>
                                <span class="small-phone-speaker"></span>
                            </div>
                            <div class="small-phone-status-icons">
                                <i class="fa-solid fa-signal"></i>
                                <i class="fa-solid fa-wifi"></i>
                                <i class="fa-solid fa-battery-three-quarters"></i>
                                <button type="button" class="small-phone-close-btn" id="small-phone-close-btn" title="关闭手机">
                                    <i class="fa-solid fa-xmark"></i>
                                </button>
                            </div>
                        </div>

                        <!-- 手机主屏幕视口 -->
                        <div class="small-phone-viewport" id="small-phone-viewport">
                            <!-- 桌面主屏 -->
                            <div class="small-phone-home-screen" id="small-phone-home-screen">
                                <div class="small-phone-widgets-area">
                                    <div class="small-phone-date-display" id="small-phone-date-display">星期一 9月28日</div>
                                </div>

                                <!-- 应用图标网格（按顺序渲染 QQ、淘宝、X、设置） -->
                                <div class="small-phone-app-grid" id="small-phone-app-grid">
                                </div>
                            </div>
                        </div>

                        <!-- 底部 Home 手势指示条 -->
                        <div class="small-phone-home-bar-area" id="small-phone-home-bar" title="返回桌面 / 关闭">
                            <div class="small-phone-home-indicator"></div>
                        </div>
                    </div>

                    <!-- 右下角自由移动控制手柄（长按或拖拽可平移手机位置） -->
                    <div class="small-phone-drag-corner" id="small-phone-drag-corner" title="长按右下角移动位置">
                        <i class="fa-solid fa-arrows-up-down-left-right"></i>
                    </div>
                </div>
            </div>
        `;

        $('body').append(template);
        this.container = $('#small-phone-wrapper');
        this.appGrid = $('#small-phone-app-grid');

        this.settingsApp = new SettingsApp({
            onBackToHome: () => this.closeCurrentApp(),
        });

        this.qqApp = new QQApp({
            onBackToHome: () => this.closeCurrentApp(),
        });

        this.logApp = new LogApp({
            onBackToHome: () => this.closeCurrentApp(),
        });

        this.taobaoApp = new TaobaoApp({
            onBackToHome: () => this.closeCurrentApp(),
            onSendToContact: ({ contactId, contactType, contactName, product, sendText }) => {
                this.openApp('qq');
                if (this.qqApp) {
                    this.qqApp.openChat(contactId, contactType);
                    setTimeout(() => {
                        const $input = $('#sp-qq-chat-input');
                        if ($input.length > 0) {
                            $input.val(sendText).trigger('input').trigger('change');
                        }
                    }, 80);
                }
                try {
                    OperationLogService.log({
                        module: '淘宝好物',
                        action: '发给联系人',
                        status: 'success',
                        detail: `商品: ${product?.name || ''} | 目标: ${contactName} (${contactType === 'group' ? '群聊' : '单聊'})`,
                    });
                } catch (_) {}
                if (typeof toastr !== 'undefined') {
                    toastr.success(`已切换至【${contactName}】聊天框并填入商品！`, '淘宝');
                }
            },
        });

        this.xApp = new XApp({
            onBackToHome: () => this.closeCurrentApp(),
        });

        this._renderDefaultApps();
        this._bindEvents();
        this._setupDraggable();
        this._setupResizable();
        this._updateTime();
        this._startClock();

        // 窗口尺寸变化时纠偏
        $(window).on('resize.smallphone', () => {
            if (this.isOpen) {
                this._clampInsideWindow();
            }
        });
    }

    /**
     * 渲染默认桌面图标（QQ，淘宝，X，设置，操作日志）
     */
    _renderDefaultApps() {
        if (!this.appGrid) return;
        this.appGrid.empty();

        for (const app of DEFAULT_APPS) {
            const appItem = $(`
                <div class="small-phone-app-item" id="small-phone-app-${app.id}" role="button" tabindex="0" title="${app.name}">
                    <div class="small-phone-app-icon ${app.iconClass || ''}">
                        ${app.iconHtml}
                    </div>
                    <span class="small-phone-app-label">${app.name}</span>
                </div>
            `);

            appItem.on('click', (e) => {
                e.stopPropagation();
                if (app.id === 'settings') {
                    this.openApp('settings');
                    this.triggerSettingClick();
                } else if (app.id === 'qq') {
                    this.openApp('qq');
                } else if (app.id === 'taobao') {
                    this.openApp('taobao');
                } else if (app.id === 'x') {
                    this.openApp('x');
                } else if (app.id === 'logs') {
                    this.openApp('logs');
                } else {
                    this.triggerAppClick(app.id, app.name);
                }
            });

            this.appGrid.append(appItem);
        }
    }

    /**
     * 打开某个应用（切换视口）
     */
    openApp(appId) {
        if (appId === 'settings' && this.settingsApp) {
            const pageEl = this.settingsApp.render();
            this.showAppView(pageEl, 'settings');
        } else if (appId === 'qq' && this.qqApp) {
            const pageEl = this.qqApp.render();
            this.showAppView(pageEl, 'qq');
        } else if (appId === 'taobao' && this.taobaoApp) {
            const pageEl = this.taobaoApp.render();
            this.showAppView(pageEl, 'taobao');
        } else if (appId === 'x' && this.xApp) {
            const pageEl = this.xApp.render();
            this.showAppView(pageEl, 'x');
        } else if (appId === 'logs' && this.logApp) {
            const pageEl = this.logApp.render();
            this.showAppView(pageEl, 'logs');
        }
    }


    /**
     * 在视口内呈现 App 页面并隐藏桌面
     */
    showAppView(pageEl, appId) {
        const viewport = $('#small-phone-viewport');
        const homeScreen = $('#small-phone-home-screen');

        viewport.find('.small-phone-app-page').remove();
        homeScreen.hide();
        viewport.append(pageEl);
        this.currentAppId = appId;
    }

    /**
     * 关闭当前应用，平滑返回主屏幕
     */
    closeCurrentApp() {
        const viewport = $('#small-phone-viewport');
        const homeScreen = $('#small-phone-home-screen');

        viewport.find('.small-phone-app-page').remove();
        homeScreen.show();
        this.currentAppId = null;
    }

    /**
     * 绑定基础点击事件
     */
    _bindEvents() {
        // 关闭按钮
        $('#small-phone-close-btn').on('click', (e) => {
            e.stopPropagation();
            this.hide();
        });

        // 底部指示条：若在应用内则返回桌面，若在桌面则收起手机
        $('#small-phone-home-bar').on('click', () => {
            if (this.currentAppId) {
                this.closeCurrentApp();
            } else {
                this.hide();
            }
        });
    }

    /**
     * 注册点击设置图标时的回调
     * @param {Function} callback
     */
    onSettingClick(callback) {
        if (typeof callback === 'function') {
            this.settingCallbacks.push(callback);
        }
    }

    /**
     * 触发设置点击
     */
    triggerSettingClick() {
        for (const cb of this.settingCallbacks) {
            try {
                cb();
            } catch (err) {
                console.error('[SmallPhone] 设置回调执行错误:', err);
            }
        }
    }

    /**
     * 注册任意应用点击的回调（为后续做功能完全解耦）
     */
    onAppClick(appId, callback) {
        if (!this.appClickCallbacks[appId]) {
            this.appClickCallbacks[appId] = [];
        }
        if (typeof callback === 'function') {
            this.appClickCallbacks[appId].push(callback);
        }
    }

    /**
     * 触发指定应用的点击
     */
    triggerAppClick(appId, appName) {
        const callbacks = this.appClickCallbacks[appId] || [];
        for (const cb of callbacks) {
            try {
                cb();
            } catch (err) {
                console.error(`[SmallPhone] App [${appId}] 回调执行错误:`, err);
            }
        }
        if (callbacks.length === 0) {
            console.log(`[SmallPhone] 点击了应用: ${appName} (${appId})`);
        }
    }

    /**
     * 为后续扩展功能预留：动态向桌面添加 App 图标
     */
    addAppIcon({ id, name, iconHtml, colorBg, onClick }) {
        if (!this.appGrid) return;
        const appItem = $(`
            <div class="small-phone-app-item" id="small-phone-app-${id}" role="button" tabindex="0" title="${name}">
                <div class="small-phone-app-icon" style="${colorBg ? `background: ${colorBg};` : ''}">
                    ${iconHtml}
                </div>
                <span class="small-phone-app-label">${name}</span>
            </div>
        `);

        if (typeof onClick === 'function') {
            appItem.on('click', (e) => {
                e.stopPropagation();
                onClick();
            });
        }

        const settingsItem = $('#small-phone-app-settings');
        if (settingsItem.length > 0) {
            settingsItem.before(appItem);
        } else {
            this.appGrid.append(appItem);
        }
    }

    /**
     * 判断当前是否为移动端屏幕（宽度 <= 600px）
     */
    isMobileView() {
        return (window.innerWidth || $(window).width()) <= 600;
    }

    /**
     * 拖拽与手势系统（双端适配）
     * - 移动端：按住顶部状态栏下拉顺畅收起，弹性回弹
     * - 桌面端：PPT 矩形自由移动
     */
    _setupDraggable() {
        const target = this.container;

        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let initialLeft = 0;
        let initialTop = 0;

        const onPointerDown = (e) => {
            // 忽略右上角关闭按钮点击或拉伸状态
            if ($(e.target).closest('#small-phone-close-btn').length > 0 || this.isInteracting) {
                return;
            }

            isDragging = true;
            this.isInteracting = true;

            const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
            const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

            startX = clientX;
            startY = clientY;

            const rect = target[0].getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;

            target.addClass('is-moving-phone is-dragging');
            $('#small-phone-drag-corner').addClass('is-active');
            $('body').addClass('small-phone-grabbing');

            $(document).on('pointermove.smallphonedrag touchmove.smallphonedrag', onPointerMove);
            $(document).on('pointerup.smallphonedrag pointercancel.smallphonedrag touchend.smallphonedrag touchcancel.smallphonedrag', onPointerUp);

            e.preventDefault();
        };

        const onPointerMove = (e) => {
            if (!isDragging) return;

            const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
            const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

            const dx = clientX - startX;
            const dy = clientY - startY;

            let newLeft = initialLeft + dx;
            let newTop = initialTop + dy;

            const winW = window.innerWidth || $(window).width();
            const winH = window.innerHeight || $(window).height();
            const targetW = target.outerWidth();
            const targetH = target.outerHeight();

            // 限制安全可视边界，确保小手机绝不滑出屏幕
            const maxLeft = Math.max(4, winW - targetW - 4);
            const maxTop = Math.max(4, winH - targetH - 4);

            newLeft = Math.max(4, Math.min(newLeft, maxLeft));
            newTop = Math.max(4, Math.min(newTop, maxTop));

            target.css({
                left: `${newLeft}px`,
                top: `${newTop}px`,
                right: 'auto',
                bottom: 'auto',
                transform: 'none',
            });
        };

        const onPointerUp = () => {
            if (!isDragging) return;
            isDragging = false;
            this.isInteracting = false;

            target.removeClass('is-moving-phone is-dragging');
            $('#small-phone-drag-corner').removeClass('is-active');
            $('body').removeClass('small-phone-grabbing');

            $(document).off('.smallphonedrag');

            // 分别持久化移动端与桌面端坐标
            const rect = target[0].getBoundingClientRect();
            const pos = { x: Math.round(rect.left), y: Math.round(rect.top) };
            if (this.isMobileView()) {
                SettingsManager.set('mobilePosition', pos);
            } else {
                SettingsManager.set('position', pos);
            }
        };

        // 顶部状态栏与右下角手柄均可触发拖动平移
        this.container.on('pointerdown touchstart', '#small-phone-drag-handle, #small-phone-drag-corner', onPointerDown);
    }

    /**
     * PPT 矩形模式 2：8 向边缘与边角拉伸（Resize）—— 仅在桌面端启用
     */
    _setupResizable() {
        const target = this.container;
        const self = this;

        target.find('.small-phone-resize-handle').on('pointerdown', function (e) {
            // 移动端不执行缩放
            if (self.isMobileView()) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            const dir = $(this).data('dir');
            self.isInteracting = true;

            const startX = e.clientX;
            const startY = e.clientY;
            const initialPos = target.position();
            const initialLeft = initialPos.left;
            const initialTop = initialPos.top;
            const initialWidth = target.outerWidth();
            const initialHeight = target.outerHeight();

            const winW = $(window).width();
            const winH = $(window).height();

            target.addClass('is-resizing');
            $('body').addClass(`small-phone-resizing-${dir}`);

            $(document).on('pointermove.smallphoneresize', (moveEvent) => {
                const dx = moveEvent.clientX - startX;
                const dy = moveEvent.clientY - startY;

                let newWidth = initialWidth;
                let newHeight = initialHeight;
                let newLeft = initialLeft;
                let newTop = initialTop;

                // 左右拉伸计算
                if (dir.includes('e')) {
                    const maxAllowedW = winW - initialLeft - 10;
                    newWidth = Math.max(self.minWidth, Math.min(maxAllowedW, initialWidth + dx));
                } else if (dir.includes('w')) {
                    const maxDx = initialWidth - self.minWidth;
                    const clampedDx = Math.min(dx, maxDx);
                    if (initialLeft + clampedDx >= 10) {
                        newWidth = initialWidth - clampedDx;
                        newLeft = initialLeft + clampedDx;
                    }
                }

                // 上下拉伸计算
                if (dir.includes('s')) {
                    const maxAllowedH = winH - initialTop - 10;
                    newHeight = Math.max(self.minHeight, Math.min(maxAllowedH, initialHeight + dy));
                } else if (dir.includes('n')) {
                    const maxDy = initialHeight - self.minHeight;
                    const clampedDy = Math.min(dy, maxDy);
                    if (initialTop + clampedDy >= 10) {
                        newHeight = initialHeight - clampedDy;
                        newTop = initialTop + clampedDy;
                    }
                }

                target.css({
                    width: `${Math.round(newWidth)}px`,
                    height: `${Math.round(newHeight)}px`,
                    left: `${Math.round(newLeft)}px`,
                    top: `${Math.round(newTop)}px`,
                    right: 'auto',
                    bottom: 'auto',
                });
            });

            $(document).on('pointerup.smallphoneresize pointercancel.smallphoneresize', () => {
                self.isInteracting = false;
                target.removeClass('is-resizing');
                $('body').removeClass(`small-phone-resizing-${dir}`);
                $(document).off('.smallphoneresize');

                const pos = target.position();
                SettingsManager.set('size', {
                    width: Math.round(target.outerWidth()),
                    height: Math.round(target.outerHeight()),
                });
                SettingsManager.set('position', {
                    x: Math.round(pos.left),
                    y: Math.round(pos.top),
                });
            });
        });
    }

    /**
     * 恢复尺寸与位置（智能双端分流）
     * - 移动端：交给 CSS 弹性居中布局，清空硬编码坐标
     * - 桌面端：恢复保存尺寸或默认视口绝对正中央
     */
    _restoreGeometry() {
        const winW = window.innerWidth || $(window).width();
        const winH = window.innerHeight || $(window).height();
        const isMobile = this.isMobileView();

        let width, height;
        if (isMobile) {
            width = Math.min(winW - 16, 390);
            height = Math.min(winH - 24, 740);
        } else {
            const savedSize = SettingsManager.get('size') || { width: 300, height: 600 };
            width = Math.max(this.minWidth, Math.min(savedSize.width || 300, winW - 20));
            height = Math.max(this.minHeight, Math.min(savedSize.height || 600, winH - 20));
        }

        const savedPos = isMobile
            ? SettingsManager.get('mobilePosition')
            : SettingsManager.get('position');

        let left, top;
        if (savedPos && typeof savedPos.x === 'number' && typeof savedPos.y === 'number') {
            const maxL = Math.max(6, winW - width - 6);
            const maxT = Math.max(6, winH - height - 6);
            left = Math.max(6, Math.min(savedPos.x, maxL));
            top = Math.max(6, Math.min(savedPos.y, maxT));
        } else {
            left = Math.max(8, Math.round((winW - width) / 2));
            top = Math.max(12, Math.round((winH - height) / 2));
        }

        this.container.css({
            width: `${width}px`,
            height: `${height}px`,
            left: `${left}px`,
            top: `${top}px`,
            right: 'auto',
            bottom: 'auto',
            transform: 'none',
        });
    }

    /**
     * 纠偏防止越界
     */
    _clampInsideWindow() {
        const winW = $(window).width();
        const winH = $(window).height();
        const width = this.container.outerWidth();
        const height = this.container.outerHeight();
        const pos = this.container.position();

        const left = Math.max(10, Math.min(pos.left, winW - width - 10));
        const top = Math.max(10, Math.min(pos.top, winH - height - 10));

        this.container.css({
            left: `${left}px`,
            top: `${top}px`,
        });
    }

    /**
     * 启动时钟定时器
     */
    _startClock() {
        if (this.timeInterval) clearInterval(this.timeInterval);
        this.timeInterval = setInterval(() => this._updateTime(), 10000);
    }

    /**
     * 更新状态栏时间与日期
     */
    _updateTime() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        $('#small-phone-time').text(`${hours}:${minutes}`);

        const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
        const weekday = weekdays[now.getDay()];
        const month = now.getMonth() + 1;
        const date = now.getDate();
        $('#small-phone-date-display').text(`${weekday} ${month}月${date}日`);
    }

    /**
     * 切换显示状态
     */
    toggle() {
        if (this.isOpen) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * 显示小手机
     */
    show() {
        if (!this.container) this.init();
        this._restoreGeometry();
        this._updateTime();
        this.container.removeClass('closing').addClass('opening').show();
        this.isOpen = true;
        setTimeout(() => {
            if (this.container && this.isOpen) {
                this.container.removeClass('opening');
            }
        }, 260);
    }

    /**
     * 隐藏小手机
     */
    hide() {
        if (!this.container || !this.isOpen) return;
        this.container.removeClass('opening').addClass('closing');
        setTimeout(() => {
            this.container.hide().removeClass('closing');
            this.isOpen = false;
        }, 220);
    }

    /**
     * 销毁组件
     */
    destroy() {
        if (this.timeInterval) {
            clearInterval(this.timeInterval);
            this.timeInterval = null;
        }
        $(window).off('.smallphone');
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
        this.isOpen = false;
    }
}

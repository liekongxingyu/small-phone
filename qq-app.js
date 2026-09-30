import { QQManager } from './qq-manager.js';
import { PhoneLogService } from './phone-log-service.js';
import { ApiService } from './api-service.js';
import { getContext } from '../../../extensions.js';

/**
 * 强制动态注入高优先级紧凑气泡与小头像样式
 * 彻底消除浏览器 style.css 强缓存问题，确保气泡小巧、消除空隙、头像精致
 */
export function ensureCompactStylesInjected() {
    if (typeof document === 'undefined' || typeof $ === 'undefined') return;
    const styleId = 'sp-qq-compact-bubbles-style';
    let $style = $(`#${styleId}`);
    if ($style.length === 0) {
        $style = $('<style>').attr('id', styleId).appendTo('head');
    }
    $style.text(`
        /* 强制无缓存紧凑气泡与小头像规则 */
        .sp-qq-chat-stream {
            flex: 1 !important;
            overflow-y: auto !important;
            padding: 6px 8px !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 3px !important;
        }
        .sp-qq-msg-row {
            display: flex !important;
            align-items: flex-start !important;
            gap: 5px !important;
            width: 100% !important;
            margin: 0 !important;
            transition: background 0.15s ease !important;
        }
        .sp-qq-msg-row.is-other {
            justify-content: flex-start !important;
        }
        .sp-qq-msg-row.is-self {
            justify-content: flex-end !important;
        }
        .sp-qq-msg-avatar {
            width: 20px !important;
            height: 20px !important;
            min-width: 20px !important;
            min-height: 20px !important;
            border-radius: 50% !important;
            color: #ffffff !important;
            font-size: 9.5px !important;
            font-weight: 700 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            flex-shrink: 0 !important;
            user-select: none !important;
            margin-top: 1px !important;
            line-height: 1 !important;
        }
        .sp-qq-msg-avatar.is-self-avatar {
            background-color: #2563eb !important;
            font-size: 9px !important;
        }
        .sp-qq-msg-bubble {
            max-width: 82% !important;
            padding: 3.5px 7.5px !important;
            font-size: var(--sp-chat-font-size, 11.5px) !important;
            line-height: 1.35 !important;
            word-break: break-word !important;
            white-space: pre-line !important;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2) !important;
            min-height: unset !important;
            height: auto !important;
        }
        .sp-qq-msg-row.is-other .sp-qq-msg-bubble {
            background: rgba(30, 41, 59, 0.9) !important;
            border: 1px solid rgba(255, 255, 255, 0.1) !important;
            color: #f1f5f9 !important;
            border-radius: 3px 8px 8px 8px !important;
        }
        .sp-qq-msg-row.is-self .sp-qq-msg-bubble {
            background: #2563eb !important;
            color: #ffffff !important;
            border-radius: 8px 3px 8px 8px !important;
        }
        .sp-qq-msg-bubble.is-typing {
            display: inline-flex !important;
            align-items: center !important;
            gap: 3px !important;
            padding: 4px 7px !important;
        }
        .sp-typing-dot {
            width: 3.5px !important;
            height: 3.5px !important;
        }

        /* 工具箱小图标与点击弹出的两个操作按钮 */
        .sp-qq-toolbox-btn {
            width: 26px !important;
            height: 26px !important;
            min-width: 26px !important;
            border-radius: 50% !important;
            background: rgba(255, 255, 255, 0.08) !important;
            border: 1px solid rgba(255, 255, 255, 0.16) !important;
            color: #94a3b8 !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            font-size: 11.5px !important;
            cursor: pointer !important;
            flex-shrink: 0 !important;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
            padding: 0 !important;
            margin-right: 2px !important;
        }
        .sp-qq-toolbox-btn:hover,
        .sp-qq-toolbox-btn.is-active {
            background: rgba(59, 130, 246, 0.25) !important;
            border-color: rgba(59, 130, 246, 0.6) !important;
            color: #60a5fa !important;
            transform: scale(1.08) !important;
        }
        .sp-qq-toolbox-panel {
            display: none !important;
            position: absolute !important;
            bottom: calc(100% + 8px) !important;
            left: 10px !important;
            z-index: 100 !important;
            align-items: center !important;
            gap: 8px !important;
            padding: 5px 8px !important;
            background: rgba(15, 23, 42, 0.96) !important;
            backdrop-filter: blur(16px) !important;
            border: 1px solid rgba(255, 255, 255, 0.18) !important;
            border-radius: 14px !important;
            box-shadow: 0 10px 28px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.06) !important;
        }
        .sp-qq-toolbox-panel.is-open {
            display: flex !important;
            animation: sp-toolbox-pop 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
        @keyframes sp-toolbox-pop {
            from { opacity: 0; transform: translateY(6px) scale(0.95); }
            to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .sp-qq-toolbox-action-btn {
            display: inline-flex !important;
            align-items: center !important;
            gap: 6px !important;
            padding: 5px 12px !important;
            border: 1px solid rgba(255, 255, 255, 0.12) !important;
            background: rgba(255, 255, 255, 0.08) !important;
            color: #f1f5f9 !important;
            font-size: 11.5px !important;
            font-weight: 500 !important;
            border-radius: 10px !important;
            cursor: pointer !important;
            transition: all 0.15s ease !important;
            user-select: none !important;
            white-space: nowrap !important;
        }
        .sp-qq-toolbox-action-btn:hover {
            background: rgba(59, 130, 246, 0.28) !important;
            border-color: rgba(59, 130, 246, 0.6) !important;
            color: #ffffff !important;
            transform: translateY(-1px) !important;
        }
        .sp-qq-toolbox-action-btn i {
            font-size: 12px !important;
            color: #38bdf8 !important;
        }
        .sp-qq-toolbox-action-btn:hover i {
            color: #60a5fa !important;
        }

        /* 发送按钮：停止发送动效 */
        .sp-qq-send-btn.is-generating {
            background: #ef4444 !important;
            border: 1px solid rgba(255, 255, 255, 0.3) !important;
            box-shadow: 0 0 12px rgba(239, 68, 68, 0.6) !important;
            animation: sp-pulse-stop 1.4s infinite ease-in-out !important;
        }
        .sp-qq-send-btn.is-generating:hover {
            background: #dc2626 !important;
            transform: scale(1.08) !important;
        }
        @keyframes sp-pulse-stop {
            0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 10px rgba(239, 68, 68, 0.6); }
            50% { opacity: 0.82; transform: scale(0.96); box-shadow: 0 0 4px rgba(239, 68, 68, 0.3); }
        }

        /* 精细复选操作栏与复选框 */
        .sp-qq-msg-select-wrap {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            margin-right: 4px !important;
            cursor: pointer !important;
            flex-shrink: 0 !important;
            align-self: center !important;
        }
        .sp-qq-msg-checkbox {
            width: 15px !important;
            height: 15px !important;
            cursor: pointer !important;
            accent-color: #2563eb !important;
        }
        .sp-qq-msg-row.is-selected {
            background: rgba(59, 130, 246, 0.16) !important;
            border-radius: 6px !important;
            outline: 1px dashed rgba(59, 130, 246, 0.45);
        }

        /* 联系人顶部搜索栏 */
        .sp-qq-contacts-search-header {
            padding: 8px 10px 5px 10px !important;
            position: sticky !important;
            top: 0 !important;
            z-index: 10 !important;
            background: rgba(15, 23, 42, 0.94) !important;
            backdrop-filter: blur(12px) !important;
            border-bottom: 1px solid rgba(255, 255, 255, 0.06) !important;
        }
        .sp-qq-contacts-search-header .sp-qq-search-box {
            margin-bottom: 0 !important;
            background: rgba(255, 255, 255, 0.06) !important;
            border: 1px solid rgba(255, 255, 255, 0.12) !important;
            border-radius: 10px !important;
            padding: 5px 9px !important;
            height: 30px !important;
            box-sizing: border-box !important;
            transition: all 0.2s ease !important;
        }
        .sp-qq-contacts-search-header .sp-qq-search-box:focus-within {
            background: rgba(255, 255, 255, 0.1) !important;
            border-color: #3b82f6 !important;
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2) !important;
        }
        .sp-qq-contacts-search-header .sp-qq-search-input {
            font-size: 11.5px !important;
        }
    `);
}

// 模块加载时立即尝试执行一次注入
if (typeof jQuery !== 'undefined') {
    jQuery(() => ensureCompactStylesInjected());
} else if (typeof document !== 'undefined') {
    ensureCompactStylesInjected();
}

/**
 * 强内联样式定义：直接打在 DOM 元素身上，杜绝浏览器 external CSS 缓存问题
 */
const INLINE_STYLES = {
    stream: 'display: flex !important; flex-direction: column !important; gap: 3px !important; padding: 6px 8px !important; flex: 1 !important; overflow-y: auto !important;',
    rowOther: 'display: flex !important; align-items: flex-start !important; justify-content: flex-start !important; gap: 5px !important; width: 100% !important; margin: 0 !important;',
    rowSelf: 'display: flex !important; align-items: flex-start !important; justify-content: flex-end !important; gap: 5px !important; width: 100% !important; margin: 0 !important;',
    avatarOther: (color) => `width: 20px !important; height: 20px !important; min-width: 20px !important; min-height: 20px !important; border-radius: 50% !important; background-color: ${color || '#3b82f6'} !important; color: #ffffff !important; font-size: 9.5px !important; font-weight: 700 !important; display: flex !important; align-items: center !important; justify-content: center !important; flex-shrink: 0 !important; user-select: none !important; margin-top: 1px !important; line-height: 1 !important;`,
    avatarSelf: 'width: 20px !important; height: 20px !important; min-width: 20px !important; min-height: 20px !important; border-radius: 50% !important; background-color: #2563eb !important; color: #ffffff !important; font-size: 9px !important; font-weight: 700 !important; display: flex !important; align-items: center !important; justify-content: center !important; flex-shrink: 0 !important; user-select: none !important; margin-top: 1px !important; line-height: 1 !important;',
    avatarPlaceholder: 'width: 20px !important; height: 20px !important; min-width: 20px !important; flex-shrink: 0 !important; visibility: hidden !important;',
    bubbleOther: 'max-width: 82% !important; padding: 3px 8px !important; font-size: var(--sp-chat-font-size, 11.5px) !important; line-height: 1.35 !important; border-radius: 3px 8px 8px 8px !important; background: rgba(30, 41, 59, 0.9) !important; border: 1px solid rgba(255, 255, 255, 0.1) !important; color: #f1f5f9 !important; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2) !important; word-break: break-word !important; white-space: pre-line !important; min-height: unset !important; height: auto !important;',
    bubbleSelf: 'max-width: 82% !important; padding: 3px 8px !important; font-size: var(--sp-chat-font-size, 11.5px) !important; line-height: 1.35 !important; border-radius: 8px 3px 8px 8px !important; background: #2563eb !important; color: #ffffff !important; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2) !important; word-break: break-word !important; white-space: pre-line !important; min-height: unset !important; height: auto !important;',
};

/**
 * QQApp 类：负责小手机内 QQ 应用的视图渲染与交互逻辑
 * 
 * 核心特性：
 * 1. 角色卡完全隔离：通讯录与聊天记录均随当前角色卡自动切换；
 * 2. 消息列表默认为空：只有产生过真实聊天记录的好友才会出现在「消息」页面；
 * 3. 联系人界面极简：名字后无括号备注、去除杂乱触发词标签；
 * 4. 世界书带实时搜索：条目支持名称/设定/内容即时过滤筛选；
 * 5. 全选/全不选与批量快速导入，纯后端 JSON 持久化。
 */
export class QQApp {
    constructor({ onBackToHome }) {
        this.onBackToHome = onBackToHome;
        this.container = null;
        this.currentTab = 'messages'; // 'messages' | 'contacts'
        this.activeChatId = null; // 当前会话 ID (可以是 friendId 或 groupId)
        this.activeChatType = 'friend'; // 'friend' | 'group'
        this.groupSelectedFriendIds = new Set(); // 建群弹窗中勾选的好友 ID 集合
        this.cachedWorldEntries = []; // 缓存读取到的世界书条目
        this.selectedUids = new Set(); // 导入弹窗中选中的条目 UID 集合
        this.searchKeyword = ''; // 世界书搜索过滤关键词
        this.contactsSearchKeyword = ''; // 联系人界面搜索过滤关键词
        this.isGenerating = false; // 是否正在生成中
        this.isMultiSelectMode = false; // 是否处于多选删除模式
        this.selectedMessageIds = new Set(); // 多选模式下选中的消息 ID 集合
        this.activeFlattenedMessages = []; // 当前会话的扁平消息缓存
        this._eventListenersBound = false;
        ensureCompactStylesInjected();
    }

    /** 兼容历史对 activeChatFriendId 的读取与赋值 */
    get activeChatFriendId() {
        return this.activeChatType === 'friend' ? this.activeChatId : null;
    }
    set activeChatFriendId(val) {
        this.activeChatId = val;
        this.activeChatType = 'friend';
    }

    /** 当前处于群聊时的群 ID */
    get activeChatGroupId() {
        return this.activeChatType === 'group' ? this.activeChatId : null;
    }
    set activeChatGroupId(val) {
        this.activeChatId = val;
        this.activeChatType = 'group';
    }

    /**
     * 构建并返回 QQ 根容器
     */
    render() {
        ensureCompactStylesInjected();
        const currentChar = QQManager.getCurrentCharacter();
        const template = `
            <div class="small-phone-app-page small-phone-qq-page" id="small-phone-qq-page">
                <!-- 主页视图 (消息 / 联系人) -->
                <div class="sp-qq-main-view" id="sp-qq-main-view" style="${this.activeChatId ? 'display: none;' : ''}">
                    <!-- QQ 顶栏 -->
                    <div class="sp-qq-header">
                        <div class="sp-qq-header-left">
                            <button type="button" class="sp-qq-back-home-btn" id="sp-qq-back-home-btn" title="返回小手机桌面">
                                <i class="fa-solid fa-chevron-left"></i> 桌面
                            </button>
                        </div>
                        <div class="sp-qq-header-title">
                            <span class="sp-qq-title-text">QQ</span>
                            <span class="sp-qq-status-dot" title="4G 在线"></span>
                        </div>
                        <div class="sp-qq-header-right">
                            <button type="button" class="sp-qq-icon-btn" id="sp-qq-more-btn" title="发起群聊或添加好友">
                                <i class="fa-solid fa-plus"></i>
                            </button>
                            <button type="button" class="sp-qq-icon-btn" id="sp-qq-settings-btn" title="QQ 个人设置 (修改我的昵称/user_name)">
                                <i class="fa-solid fa-gear"></i>
                            </button>
                        </div>
                    </div>

                    <!-- 顶部快捷下拉菜单 (点击 + 弹出) -->
                    <div class="sp-qq-dropdown-menu" id="sp-qq-dropdown-menu" style="display: none;">
                        <button type="button" class="sp-qq-dropdown-item" id="sp-qq-btn-open-create-group">
                            <i class="fa-solid fa-users" style="color: #38bdf8;"></i>
                            <span>发起群聊</span>
                        </button>
                        <button type="button" class="sp-qq-dropdown-item" id="sp-qq-btn-open-import">
                            <i class="fa-solid fa-book-bookmark" style="color: #a78bfa;"></i>
                            <span>从世界书一键导入好友</span>
                        </button>
                        <button type="button" class="sp-qq-dropdown-item" id="sp-qq-btn-open-manual-add">
                            <i class="fa-solid fa-user-pen" style="color: #34d399;"></i>
                            <span>手动添加新好友</span>
                        </button>
                        <button type="button" class="sp-qq-dropdown-item" id="sp-qq-btn-open-settings">
                            <i class="fa-solid fa-gear" style="color: #94a3b8;"></i>
                            <span>QQ 个人设置 (修改我的昵称)</span>
                        </button>
                    </div>

                    <!-- Tab 导航栏 (消息 / 联系人) -->
                    <div class="sp-qq-nav-tabs">
                        <button type="button" class="sp-qq-nav-tab ${this.currentTab === 'messages' ? 'active' : ''}" data-tab="messages">
                            <i class="fa-solid fa-message"></i> 消息
                        </button>
                        <button type="button" class="sp-qq-nav-tab ${this.currentTab === 'contacts' ? 'active' : ''}" data-tab="contacts">
                            <i class="fa-solid fa-address-book"></i> 联系人
                        </button>
                    </div>

                    <!-- 页面主体内容区 -->
                    <div class="sp-qq-body">
                        <!-- Tab 1: 最近会话列表 (默认为空) -->
                        <div class="sp-qq-tab-pane" id="sp-qq-pane-messages" style="${this.currentTab === 'messages' ? '' : 'display: none;'}">
                            <div class="sp-qq-chat-list" id="sp-qq-chat-list">
                                <!-- 由 _renderRecentChats 渲染 -->
                            </div>
                        </div>

                        <!-- Tab 2: 好友联系人列表 -->
                        <div class="sp-qq-tab-pane" id="sp-qq-pane-contacts" style="${this.currentTab === 'contacts' ? '' : 'display: none;'}">
                            <!-- 顶部联系人搜索栏 -->
                            <div class="sp-qq-contacts-search-header" id="sp-qq-contacts-search-header">
                                <div class="sp-qq-search-box">
                                    <i class="fa-solid fa-magnifying-glass sp-qq-search-icon"></i>
                                    <input type="text" class="sp-qq-search-input" id="sp-qq-contacts-search-input" placeholder="搜索联系人或群聊..." value="${this.contactsSearchKeyword || ''}" autocomplete="off">
                                    <button type="button" class="sp-qq-search-clear-btn" id="sp-qq-contacts-search-clear" style="${this.contactsSearchKeyword ? '' : 'display: none;'}" title="清空搜索">
                                        <i class="fa-solid fa-xmark"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="sp-qq-contacts-list" id="sp-qq-contacts-list">
                                <!-- 由 _renderContactsList 渲染 -->
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 私聊与群聊会话视窗 (独立页面) -->
                <div class="sp-qq-chat-view" id="sp-qq-chat-view" style="${this.activeChatId ? '' : 'display: none;'}">
                    <!-- 由 _renderChatView 渲染 -->
                </div>

                <!-- 弹窗 1：世界书一键多选导入弹窗（支持实时搜索、自动绑定角色世界书、换书通道） -->
                <div class="sp-qq-modal-overlay" id="sp-qq-import-modal" style="display: none;">
                    <div class="sp-qq-modal-card">
                        <div class="sp-qq-modal-header">
                            <div class="sp-qq-modal-title" id="sp-qq-import-title-text">
                                <i class="fa-solid fa-book-sparkles"></i> 导入世界书好友
                            </div>
                            <button type="button" class="sp-qq-modal-close" id="sp-qq-import-close-btn">&times;</button>
                        </div>
                        <div class="sp-qq-modal-body">
                            <!-- 绑定世界书状态指示栏 -->
                            <div class="sp-qq-modal-bar sp-qq-bound-info-bar">
                                <div class="sp-qq-bound-badge" title="当前角色关联的世界书">
                                    <i class="fa-solid fa-link"></i>
                                    <span id="sp-qq-bound-books-label">正在检测角色世界书...</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
                                    <button type="button" class="sp-btn-micro" id="sp-qq-btn-toggle-manual-book" title="切换选择其他世界书">
                                        <i class="fa-solid fa-book-open"></i> 换书
                                    </button>
                                    <button type="button" class="sp-btn-micro" id="sp-qq-btn-refresh-wi" title="重新从当前角色世界书同步条目">
                                        <i class="fa-solid fa-arrows-rotate"></i> 刷新
                                    </button>
                                </div>
                            </div>

                            <!-- 快速选书抽屉 (默认收起，点击“换书”或未检测到世界书时自动展开) -->
                            <div class="sp-qq-manual-book-drawer" id="sp-qq-manual-book-drawer" style="display: none; padding: 6px 8px; background: rgba(255,255,255,0.04); border-radius: 8px; margin-bottom: 6px; border: 1px dashed rgba(255,255,255,0.12);">
                                <div style="display: flex; gap: 6px; align-items: center;">
                                    <select id="sp-qq-custom-book-select" class="sp-select" style="flex: 1; font-size: 11px; padding: 4px 6px;">
                                        <option value="">正在获取可用世界书...</option>
                                    </select>
                                    <button type="button" class="sp-btn sp-btn-primary sp-btn-sm" id="sp-qq-btn-apply-custom-book" style="padding: 4px 10px; font-size: 11px;">
                                        载入
                                    </button>
                                </div>
                            </div>

                            <!-- 世界书条目搜索过滤框 -->
                            <div class="sp-qq-search-box">
                                <i class="fa-solid fa-magnifying-glass sp-qq-search-icon"></i>
                                <input type="text" class="sp-qq-search-input" id="sp-qq-import-search" placeholder="搜索条目人物名称、设定关键词或内容..." />
                                <button type="button" class="sp-qq-search-clear-btn" id="sp-qq-import-search-clear" style="display: none;" title="清空搜索">
                                    <i class="fa-solid fa-xmark"></i>
                                </button>
                            </div>

                            <!-- 多选操作工具栏：全选 / 全不选 / 统计 -->
                            <div class="sp-qq-select-toolbar">
                                <div class="sp-qq-select-btns">
                                    <button type="button" class="sp-btn-micro" id="sp-qq-btn-select-all">
                                        <i class="fa-solid fa-check-double"></i> 全选
                                    </button>
                                    <button type="button" class="sp-btn-micro" id="sp-qq-btn-select-none">
                                        <i class="fa-solid fa-xmark"></i> 全不选
                                    </button>
                                </div>
                                <span class="sp-qq-select-count" id="sp-qq-select-count">已选 0 项</span>
                            </div>

                            <!-- 条目多选列表 -->
                            <div class="sp-qq-import-list" id="sp-qq-import-list">
                                <div class="sp-qq-loading-hint"><i class="fa-solid fa-spinner fa-spin"></i> 正在读取角色绑定的世界书条目...</div>
                            </div>
                        </div>
                        <div class="sp-qq-modal-footer">
                            <button type="button" class="sp-btn sp-btn-secondary" id="sp-qq-import-cancel-btn">取消</button>
                            <button type="button" class="sp-btn sp-btn-primary" id="sp-qq-import-confirm-btn" disabled>
                                确认导入 (0)
                            </button>
                        </div>
                    </div>
                </div>

                <!-- 弹窗 2：手动添加新好友弹窗 -->
                <div class="sp-qq-modal-overlay" id="sp-qq-manual-modal" style="display: none;">
                    <div class="sp-qq-modal-card">
                        <div class="sp-qq-modal-header">
                            <div class="sp-qq-modal-title">
                                <i class="fa-solid fa-user-plus"></i> 添加新好友
                            </div>
                            <button type="button" class="sp-qq-modal-close" id="sp-qq-manual-close-btn">&times;</button>
                        </div>
                        <div class="sp-qq-modal-body">
                            <div class="sp-form-item">
                                <label>好友昵称 / 人物名字 <span style="color: #ef4444;">*</span></label>
                                <input type="text" id="sp-qq-new-name" class="sp-input" placeholder="例如：楚晚宁 / 派蒙" />
                            </div>
                            <div class="sp-form-row">
                                <div class="sp-form-item" style="flex: 1;">
                                    <label>QQ 号码 (留空自动生成)</label>
                                    <input type="text" id="sp-qq-new-number" class="sp-input" placeholder="8位数字靓号" />
                                </div>
                                <div class="sp-form-item" style="flex: 1;">
                                    <label>个性签名 / 备注 (可选)</label>
                                    <input type="text" id="sp-qq-new-remark" class="sp-input" placeholder="例如：海纳百川，有容乃大" />
                                </div>
                            </div>
                            <div class="sp-form-item">
                                <label>触发关键词 (逗号分隔，仅用于 AI 对话人设锚定)</label>
                                <input type="text" id="sp-qq-new-keys" class="sp-input" placeholder="例如：楚晚宁, 晚宁, 师尊" />
                            </div>
                            <div class="sp-form-item">
                                <label>专属人设设定 (支持长篇设定正文)</label>
                                <textarea id="sp-qq-new-prompt" class="sp-textarea" rows="3" placeholder="在此输入该好友的性格、说话口吻、外貌或背景故事..."></textarea>
                            </div>
                        </div>
                        <div class="sp-qq-modal-footer">
                            <button type="button" class="sp-btn sp-btn-secondary" id="sp-qq-manual-cancel-btn">取消</button>
                            <button type="button" class="sp-btn sp-btn-primary" id="sp-qq-manual-confirm-btn">确认添加</button>
                        </div>
                    </div>
                </div>

                <!-- 弹窗 3：QQ 个人设置 (修改我的昵称与QQ号) -->
                <div class="sp-qq-modal-overlay" id="sp-qq-settings-modal" style="display: none;">
                    <div class="sp-qq-modal-card">
                        <div class="sp-qq-modal-header">
                            <span><i class="fa-solid fa-gear"></i> QQ 个人设置</span>
                            <button type="button" class="sp-qq-icon-btn" id="sp-qq-settings-close-btn">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                        <div class="sp-qq-modal-body">
                            <div class="sp-form-item">
                                <label>我的昵称 (对应提示词中的 <code>{{user_name}}</code>)</label>
                                <input type="text" id="sp-qq-setting-user-name" class="sp-input" placeholder="默认为“我”" />
                                <span class="sp-form-tip" style="font-size: 10px; color: rgba(255,255,255,0.45); margin-top: 3px; display: block;">单聊发消息时将作为 {{user_name}} 注入提示词，默认为“我”。</span>
                            </div>
                            <div class="sp-form-item">
                                <label>我的 QQ 号</label>
                                <input type="text" id="sp-qq-setting-qq-number" class="sp-input" placeholder="如 888888" />
                            </div>
                            <div class="sp-form-divider" style="margin: 12px 0 10px 0; border-top: 1px dashed rgba(255, 255, 255, 0.12);"></div>
                            <div class="sp-form-item">
                                <label style="color: #f87171;"><i class="fa-solid fa-triangle-exclamation"></i> 聊天记录管理</label>
                                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 6px;">
                                    <span style="font-size: 11px; color: rgba(255, 255, 255, 0.55); line-height: 1.35;">
                                        清空当前会话中全部好友的聊天记录，并同步移除正文对应记录
                                    </span>
                                    <button type="button" class="sp-btn sp-btn-danger" id="sp-qq-clear-all-sessions-btn" style="flex-shrink: 0; padding: 4px 10px; font-size: 11px; background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); color: #fca5a5; cursor: pointer; border-radius: 4px;">
                                        <i class="fa-solid fa-trash-can"></i> 清除全部记录
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div class="sp-qq-modal-footer">
                            <button type="button" class="sp-btn sp-btn-secondary" id="sp-qq-settings-cancel-btn">取消</button>
                            <button type="button" class="sp-btn sp-btn-primary" id="sp-qq-settings-save-btn">保存设置</button>
                        </div>
                    </div>
                </div>

                <!-- 弹窗 4：发起群聊弹窗 (支持从通讯录多选成员并指定群名) -->
                <div class="sp-qq-modal-overlay" id="sp-qq-create-group-modal" style="display: none;">
                    <div class="sp-qq-modal-card">
                        <div class="sp-qq-modal-header">
                            <div class="sp-qq-modal-title">
                                <i class="fa-solid fa-users" style="color: #38bdf8;"></i> 发起群聊
                            </div>
                            <button type="button" class="sp-qq-modal-close" id="sp-qq-create-group-close-btn">&times;</button>
                        </div>
                        <div class="sp-qq-modal-body">
                            <div class="sp-form-item">
                                <label>群聊名称 <span style="font-size: 10px; color: rgba(255,255,255,0.45); font-weight: normal;">(留空将自动根据成员姓名生成)</span></label>
                                <input type="text" id="sp-qq-group-name-input" class="sp-input" placeholder="例如：摸鱼小分队 / 仙门议事堂" />
                            </div>
                            <div class="sp-form-item" style="margin-top: 10px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                    <label style="margin: 0;">选择群成员 (支持多选)</label>
                                    <span class="sp-qq-group-pick-count" id="sp-qq-group-pick-count" style="font-size: 11px; color: #38bdf8; font-weight: 600;">已选 0 人</span>
                                </div>
                                <div class="sp-qq-group-members-list" id="sp-qq-group-members-list" style="max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; padding: 4px; background: rgba(0,0,0,0.2); border-radius: 6px; border: 1px solid rgba(255,255,255,0.08);">
                                    <!-- 由 _renderGroupMemberPicker 动态填充 -->
                                </div>
                            </div>
                        </div>
                        <div class="sp-qq-modal-footer">
                            <button type="button" class="sp-btn sp-btn-secondary" id="sp-qq-create-group-cancel-btn">取消</button>
                            <button type="button" class="sp-btn sp-btn-primary" id="sp-qq-create-group-confirm-btn" disabled>
                                立即建群 (0)
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.container = $(template);
        this._bindEvents();
        this._listenCharacterChange();
        this._refreshViews();
        return this.container;
    }

    /**
     * 刷新并重新渲染当前主页视图或会话视图
     */
    _refreshViews() {
        if (!this.container) return;
        this._renderRecentChats();
        this._renderContactsList();

        // 彻底修复黑屏：若处于会话状态，立即恢复并渲染对应单聊或群聊视图
        if (this.activeChatId) {
            const isValid = this.activeChatType === 'group'
                ? Boolean(QQManager.getGroup(this.activeChatId))
                : Boolean(QQManager.getFriend(this.activeChatId));

            if (isValid) {
                this.container.find('#sp-qq-main-view').hide();
                this.container.find('#sp-qq-chat-view').show();
                this._renderChatView();
            } else {
                // 会话失效时，优雅重置为主页
                this.activeChatId = null;
                this.activeChatType = 'friend';
                this.container.find('#sp-qq-chat-view').hide().empty();
                this.container.find('#sp-qq-main-view').show();
            }
        } else {
            this.container.find('#sp-qq-chat-view').hide().empty();
            this.container.find('#sp-qq-main-view').show();
        }
    }

    /**
     * 渲染「消息」最近会话列表
     * 默认规则：默认为空，只有真正产生过聊天消息的会话才会列出（支持单聊与群聊）
     */
    _renderRecentChats() {
        const $list = this.container.find('#sp-qq-chat-list');
        const recentChats = QQManager.getRecentChats();
        $list.empty();

        if (recentChats.length === 0) {
            $list.html(`
                <div class="sp-qq-empty-box">
                    <i class="fa-solid fa-comments"></i>
                    <p>暂无聊天消息</p>
                    <span>去下方「联系人」列表点击好友或群聊发起聊天吧</span>
                </div>
            `);
            return;
        }

        recentChats.forEach(chat => {
            const isGroup = Boolean(chat.isGroup);
            const timeStr = this._formatTime(chat.lastTime);
            const initialText = isGroup
                ? (chat.name || '群').slice(0, 2)
                : ((chat.friend?.name || '友').slice(0, 1).toUpperCase());
            const avatarColor = (isGroup ? chat.group?.avatarColor : chat.friend?.avatarColor) || (isGroup ? '#10b981' : '#3b82f6');
            const groupBadge = isGroup
                ? `<span style="position: absolute; right: -2px; bottom: -2px; width: 10px; height: 10px; border-radius: 50%; background: #0284c7; color: #fff; font-size: 7px; display: flex; align-items: center; justify-content: center; border: 1.5px solid #0f172a;"><i class="fa-solid fa-users"></i></span>`
                : '';

            const itemHtml = `
                <div class="sp-qq-chat-item" data-id="${chat.id}" data-type="${isGroup ? 'group' : 'friend'}">
                    <div class="sp-qq-avatar" style="position: relative; background-color: ${avatarColor}; font-size: ${isGroup ? '9.5px' : '11px'}; font-weight: 700;">
                        ${initialText}
                        ${groupBadge}
                    </div>
                    <div class="sp-qq-chat-info">
                        <div class="sp-qq-chat-row">
                            <span class="sp-qq-chat-name">${chat.name}</span>
                            <span class="sp-qq-chat-time">${timeStr}</span>
                        </div>
                        <div class="sp-qq-chat-snippet" title="${chat.lastMessage}">
                            ${$('<div>').text(chat.lastMessage).html()}
                        </div>
                    </div>
                </div>
            `;
            $list.append(itemHtml);
        });
    }

    /**
     * 渲染「联系人」好友与群聊列表
     * 支持关键词实时搜索过滤（名称、群号、备注等）
     */
    _renderContactsList() {
        const $list = this.container.find('#sp-qq-contacts-list');
        const friends = QQManager.getFriends();
        const groups = QQManager.getGroups();
        const currentChar = QQManager.getCurrentCharacter();
        $list.empty();

        // 同步顶部搜索栏状态（若在当前容器中）
        if (this.container) {
            const $clearBtn = this.container.find('#sp-qq-contacts-search-clear');
            $clearBtn.toggle(Boolean(this.contactsSearchKeyword));
        }

        if (friends.length === 0 && groups.length === 0) {
            $list.html(`
                <div class="sp-qq-empty-box">
                    <i class="fa-solid fa-address-book"></i>
                    <p>【${currentChar.name}】通讯录空空如也</p>
                    <button type="button" class="sp-btn sp-btn-primary sp-btn-sm" id="sp-qq-empty-import-btn" style="margin-top: 10px;">
                        <i class="fa-solid fa-book-bookmark"></i> 一键导入世界书好友
                    </button>
                </div>
            `);
            return;
        }

        const kw = (this.contactsSearchKeyword || '').trim().toLowerCase();

        // 根据搜索关键字过滤群聊与好友
        const filteredGroups = kw ? groups.filter(g => {
            const name = (g.name || '').toLowerCase();
            const num = (g.groupNumber || '').toLowerCase();
            return name.includes(kw) || num.includes(kw);
        }) : groups;

        const filteredFriends = kw ? friends.filter(f => {
            const name = (f.name || '').toLowerCase();
            const remark = (f.remark || '').toLowerCase();
            const persona = (f.persona || '').toLowerCase();
            const qq = (f.qqNumber || '').toLowerCase();
            return name.includes(kw) || remark.includes(kw) || persona.includes(kw) || qq.includes(kw);
        }) : friends;

        // 若进行了搜索且无任何匹配项
        if (kw && filteredGroups.length === 0 && filteredFriends.length === 0) {
            $list.html(`
                <div class="sp-qq-empty-box" style="padding: 35px 16px;">
                    <i class="fa-solid fa-magnifying-glass" style="font-size: 26px; color: rgba(255, 255, 255, 0.25);"></i>
                    <p style="font-size: 12.5px; margin-top: 8px;">未找到与“${this.contactsSearchKeyword}”相关的联系人</p>
                    <span style="font-size: 11px; color: rgba(255, 255, 255, 0.4);">请检查关键词拼写或搜索群聊名称/群号</span>
                </div>
            `);
            return;
        }

        // 1. 群聊列表专区
        if (filteredGroups.length > 0) {
            const groupsHeader = `
                <div class="sp-qq-contacts-header-info" style="margin-bottom: 4px;">
                    <span class="sp-qq-contacts-count"><i class="fa-solid fa-users" style="margin-right: 4px; color: #38bdf8;"></i>我的群聊 (${filteredGroups.length}${kw ? ` / ${groups.length}` : ''})</span>
                    ${!kw ? `
                    <button type="button" class="sp-btn-micro" id="sp-qq-btn-inline-create-group" title="发起新群聊" style="font-size: 10px; padding: 2px 6px;">
                        <i class="fa-solid fa-plus"></i> 新建群
                    </button>
                    ` : ''}
                </div>
            `;
            $list.append(groupsHeader);

            filteredGroups.forEach(g => {
                const memberCount = (g.memberIds || []).length;
                const initialText = (g.name || '群').slice(0, 2);
                const itemHtml = `
                    <div class="sp-qq-contact-item sp-qq-group-contact-item" data-id="${g.id}" data-type="group">
                        <div class="sp-qq-avatar" style="background-color: ${g.avatarColor || '#10b981'}; font-size: 9.5px; font-weight: 700;">
                            ${initialText}
                        </div>
                        <div class="sp-qq-contact-info">
                            <span class="sp-qq-contact-name">${g.name}</span>
                            <span class="sp-qq-contact-sub" style="font-size: 10px; color: rgba(255,255,255,0.45);">${memberCount} 位成员 · 群号: ${g.groupNumber || '---'}</span>
                        </div>
                        <div class="sp-qq-contact-actions">
                            <button type="button" class="sp-btn-icon sp-btn-danger sp-qq-del-group-btn" data-id="${g.id}" title="解散群聊">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </div>
                `;
                $list.append(itemHtml);
            });
        }

        // 2. 全部好友列表专区
        if (filteredFriends.length > 0 || !kw) {
            const friendsHeader = `
                <div class="sp-qq-contacts-header-info" style="${filteredGroups.length > 0 ? 'margin-top: 14px;' : ''}">
                    <span class="sp-qq-contacts-count"><i class="fa-solid fa-user-group" style="margin-right: 4px; color: #818cf8;"></i>全部好友 (${filteredFriends.length}${kw ? ` / ${friends.length}` : ''})</span>
                    <span class="sp-qq-char-tag" title="当前角色专属"><i class="fa-solid fa-user-astronaut"></i> ${currentChar.name}</span>
                </div>
            `;
            $list.append(friendsHeader);

            if (filteredFriends.length === 0) {
                $list.append(`
                    <div style="padding: 12px 8px; text-align: center; color: rgba(255,255,255,0.4); font-size: 11px;">
                        暂无好友，点击右上角「+」导入或添加好友
                    </div>
                `);
            } else {
                filteredFriends.forEach(f => {
                    const initialChar = (f.name || '友').slice(0, 1).toUpperCase();
                    const itemHtml = `
                        <div class="sp-qq-contact-item" data-id="${f.id}" data-type="friend">
                            <div class="sp-qq-avatar" style="background-color: ${f.avatarColor || '#3b82f6'};">
                                ${initialChar}
                            </div>
                            <div class="sp-qq-contact-info">
                                <span class="sp-qq-contact-name">${f.name}</span>
                            </div>
                            <div class="sp-qq-contact-actions">
                                <button type="button" class="sp-btn-icon sp-btn-danger sp-qq-del-friend-btn" data-id="${f.id}" title="删除好友">
                                    <i class="fa-solid fa-trash-can"></i>
                                </button>
                            </div>
                        </div>
                    `;
                    $list.append(itemHtml);
                });
            }
        }
    }

    /**
     * 打开某个好友单聊或群聊窗口
     */
    openChat(id, type = 'friend') {
        this.activeChatId = id;
        this.activeChatType = type;
        this.isMultiSelectMode = false;
        this.selectedMessageIds.clear();
        this._closeToolboxPanel();
        this.container.find('#sp-qq-main-view').hide();
        this.container.find('#sp-qq-chat-view').show();
        this._renderChatView();
    }

    /**
     * 退出会话窗口，返回 QQ 主界面
     */
    closeChat() {
        this.activeChatId = null;
        this.activeChatType = 'friend';
        this.isMultiSelectMode = false;
        this.selectedMessageIds.clear();
        this._closeToolboxPanel();
        this.container.find('#sp-qq-chat-view').hide().empty();
        this.container.find('#sp-qq-main-view').show();
        this._refreshViews();
    }

    /**
     * 渲染聊天界面底部结构
     * 1. 常规模式：输入框左边工具箱小按钮，中间 textarea，右边发送按钮；
     *    点击工具箱小图标弹出包含两个按钮的面板：【重新生成】与【复选消息】；
     * 2. 多选模式：整个输入栏切换为精细复选操作栏（已选计数、全选、退出复选、删除），绝不重叠挂载。
     */
    _renderChatFooter(placeholderText) {
        if (this.isMultiSelectMode) {
            return `
                <div class="sp-qq-chat-footer">
                    <div class="sp-qq-multiselect-bar" id="sp-qq-multiselect-bar">
                        <div class="sp-qq-multiselect-info">
                            <span class="sp-qq-multiselect-count" id="sp-qq-multiselect-count">已选 ${this.selectedMessageIds.size} 条</span>
                            <button type="button" class="sp-qq-batch-btn" id="sp-qq-select-all-btn">
                                ${this.selectedMessageIds.size > 0 && this.selectedMessageIds.size >= (this.activeFlattenedMessages?.length || 0) ? '取消全选' : '全选'}
                            </button>
                        </div>
                        <div class="sp-qq-multiselect-actions">
                            <button type="button" class="sp-qq-batch-btn is-cancel" id="sp-qq-cancel-select-btn">退出复选</button>
                            <button type="button" class="sp-qq-batch-btn is-danger" id="sp-qq-batch-delete-btn" ${this.selectedMessageIds.size === 0 ? 'disabled' : ''}>
                                <i class="fa-solid fa-trash-can"></i> 删除
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }

        return `
            <div class="sp-qq-chat-footer" style="position: relative;">
                <!-- 点击工具箱小图标后弹出的两个操作按钮面板（重新生成 & 复选消息，默认隐藏） -->
                <div class="sp-qq-toolbox-panel" id="sp-qq-toolbox-panel">
                    <button type="button" class="sp-qq-toolbox-action-btn" id="sp-qq-toolbox-regen-btn" title="重新生成上一轮AI回复">
                        <i class="fa-solid fa-arrows-rotate"></i>
                        <span>重新生成</span>
                    </button>
                    <button type="button" class="sp-qq-toolbox-action-btn" id="sp-qq-toolbox-multiselect-btn" title="进入精细复选消息模式勾选删除">
                        <i class="fa-solid fa-square-check"></i>
                        <span>复选消息</span>
                    </button>
                </div>

                <!-- 常规输入栏 -->
                <div class="sp-qq-chat-input-bar" id="sp-qq-normal-input-bar">
                    <button type="button" class="sp-qq-toolbox-btn" id="sp-qq-toolbox-btn" title="点击展开工具箱">
                        <i class="fa-solid fa-toolbox"></i>
                    </button>
                    <textarea class="sp-qq-chat-textarea" id="sp-qq-chat-input" rows="1" placeholder="${placeholderText}" ${this.isGenerating ? 'disabled' : ''}></textarea>
                    <button type="button" class="sp-qq-send-btn ${this.isGenerating ? 'is-generating' : ''}" id="sp-qq-send-btn" title="${this.isGenerating ? '停止发送' : '发送'}">
                        <i class="fa-solid ${this.isGenerating ? 'fa-stop' : 'fa-paper-plane'}"></i>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * 渲染单聊或群聊会话窗口 HTML
     */
    _renderChatView() {
        ensureCompactStylesInjected();
        const $chatView = this.container.find('#sp-qq-chat-view');

        // A. 群聊视图渲染
        if (this.activeChatType === 'group') {
            const group = QQManager.getGroup(this.activeChatId);
            if (!group) {
                this.closeChat();
                return;
            }

            // 确保群历史消息发言人自愈
            QQManager.healGroupSessionFromTavernChat(group.id, group);

            const session = QQManager.getSession(group.id);
            const memberCount = (group.memberIds || []).length;
            const friends = QQManager.getFriends();
            const memberMap = new Map();
            friends.forEach(f => memberMap.set(f.id, f));

            const flattened = [];
            for (let i = 0; i < session.length; i++) {
                const msg = session[i];
                const isUser = msg.sender === 'user';
                if (isUser) {
                    flattened.push({
                        id: msg.id || `msg_group_${i}`,
                        origId: msg.id,
                        sessionIdx: i,
                        isUser: true,
                        senderName: msg.senderName || '我',
                        avatarColor: '#2563eb',
                        content: msg.content,
                    });
                } else {
                    let sName = msg.senderName || group.name;
                    let sContent = msg.content || '';
                    let sColor = msg.avatarColor || (msg.senderId && memberMap.get(msg.senderId)?.avatarColor) || '#10b981';

                    // 容错平滑自愈 1：如果历史数据中 senderName 被旧逻辑误切成时间
                    if (/^\d{2}[-\/]\d{2}/.test(sName) || /^\d{1,2}\]/.test(sContent)) {
                        const parsedAgain = QQManager.parseGroupReplyMessages(`${sName}:${sContent}`, friends);
                        if (parsedAgain.length > 0) {
                            sName = parsedAgain[0].senderName;
                            sContent = parsedAgain[0].content;
                            sColor = parsedAgain[0].avatarColor || sColor;
                        }
                    }

                    // 容错平滑自愈 2：如果 senderName 仍等于群名或缺失，尝试从群成员姓名与内容匹配
                    if (!msg.senderName || sName === group.name) {
                        const memberFriends = (group.memberIds || []).map(id => memberMap.get(id)).filter(Boolean);
                        for (const f of memberFriends) {
                            const shortName = f.name.length >= 3 ? f.name.slice(-2) : f.name;
                            if (sContent.includes(f.name) || sContent.includes(shortName)) {
                                sName = f.name;
                                sColor = f.avatarColor || sColor;
                                break;
                            }
                        }
                    }

                    const lines = PhoneLogService.extractIndividualReplyMessages(sContent);
                    for (let lIdx = 0; lIdx < lines.length; lIdx++) {
                        flattened.push({
                            id: msg.id ? (lines.length > 1 ? `${msg.id}_${lIdx}` : msg.id) : `msg_group_${i}_${lIdx}`,
                            origId: msg.id,
                            sessionIdx: i,
                            isUser: false,
                            senderName: sName,
                            senderId: msg.senderId,
                            avatarColor: sColor,
                            content: lines[lIdx],
                        });
                    }
                }
            }

            this.activeFlattenedMessages = flattened;

            const messagesHtml = flattened.map((item, idx) => {
                const isUser = item.isUser;
                const textContent = $('<div>').text(String(item.content || '').trim()).html();
                const isSelected = this.selectedMessageIds.has(String(item.id));
                const selectBoxHtml = this.isMultiSelectMode ? `
                    <div class="sp-qq-msg-select-wrap">
                        <input type="checkbox" class="sp-qq-msg-checkbox" data-msg-id="${item.id}" ${isSelected ? 'checked' : ''}>
                    </div>
                ` : '';

                if (isUser) {
                    const isConsecutive = idx > 0 && flattened[idx - 1].isUser;
                    const avatarHtml = !isConsecutive
                        ? `<div class="sp-qq-msg-avatar is-self-avatar" style="${INLINE_STYLES.avatarSelf}">我</div>`
                        : `<div class="sp-qq-avatar-placeholder" style="${INLINE_STYLES.avatarPlaceholder}" aria-hidden="true"></div>`;
                    const bubbleHtml = `<div class="sp-qq-msg-bubble" style="${INLINE_STYLES.bubbleSelf}">${textContent}</div>`;
                    return `<div class="sp-qq-msg-row is-self ${isSelected ? 'is-selected' : ''}" data-msg-id="${item.id}" style="${INLINE_STYLES.rowSelf}">${selectBoxHtml}${bubbleHtml}${avatarHtml}</div>`;
                } else {
                    const avatarText = this._getAvatarDisplayText(item.senderName);
                    const avatarHtml = `<div class="sp-qq-msg-avatar" style="${INLINE_STYLES.avatarOther(item.avatarColor)}">${avatarText}</div>`;
                    const senderNameHtml = `<div class="sp-qq-msg-sender-name" style="font-size: 9.5px; color: rgba(255, 255, 255, 0.55); margin-bottom: 2px; padding-left: 2px; line-height: 1;">${$('<div>').text(item.senderName).html()}</div>`;
                    const bubbleHtml = `<div class="sp-qq-msg-bubble" style="${INLINE_STYLES.bubbleOther}">${textContent}</div>`;

                    return `
                        <div class="sp-qq-msg-row is-other ${isSelected ? 'is-selected' : ''}" data-msg-id="${item.id}" style="${INLINE_STYLES.rowOther}">
                            ${selectBoxHtml}
                            ${avatarHtml}
                            <div style="display: flex; flex-direction: column; align-items: flex-start; max-width: 82%;">
                                ${senderNameHtml}
                                ${bubbleHtml}
                            </div>
                        </div>
                    `;
                }
            }).join('');

            const chatHtml = `
                <div class="sp-qq-chat-header">
                    <button type="button" class="sp-qq-chat-back-btn" id="sp-qq-chat-back-btn">
                        <i class="fa-solid fa-chevron-left"></i> 消息
                    </button>
                    <div class="sp-qq-chat-header-center">
                        <div class="sp-qq-chat-target-name">${group.name} (${memberCount}人)</div>
                        <div class="sp-qq-chat-target-status">
                            <span class="sp-qq-online-badge">群聊在线</span> · 群号: ${group.groupNumber || '---'}
                        </div>
                    </div>
                    <div class="sp-qq-chat-header-right">
                        <button type="button" class="sp-qq-icon-btn" id="sp-qq-chat-clear-btn" title="清空本群对话历史">
                            <i class="fa-solid fa-eraser"></i>
                        </button>
                    </div>
                </div>

                <!-- 消息流区域 -->
                <div class="sp-qq-chat-stream ${this.isMultiSelectMode ? 'is-multiselect-mode' : ''}" id="sp-qq-chat-stream" style="${INLINE_STYLES.stream}">
                    <div class="sp-qq-chat-notice">
                        <span>当前处于群聊【${group.name}】，${memberCount} 位成员已加入加密群聊</span>
                    </div>
                    ${messagesHtml}
                </div>

                <!-- 底部输入与操作栏 -->
                ${this._renderChatFooter('发送群聊消息...')}
            `;

            $chatView.html(chatHtml);
            this._scrollToBottom();
            return;
        }

        // B. 好友单聊视图渲染
        const friend = QQManager.getFriend(this.activeChatId);
        if (!friend) {
            this.closeChat();
            return;
        }

        const session = QQManager.getSession(friend.id);
        const initialChar = (friend.name || '友').slice(0, 1).toUpperCase();

        // 展开所有消息为单句扁平列表
        const flattened = [];
        for (let i = 0; i < session.length; i++) {
            const msg = session[i];
            const isUser = msg.sender === 'user';
            const lines = isUser 
                ? [msg.content]
                : PhoneLogService.extractIndividualReplyMessages(msg.content);
            for (let lIdx = 0; lIdx < lines.length; lIdx++) {
                flattened.push({
                    id: msg.id ? (lines.length > 1 ? `${msg.id}_${lIdx}` : msg.id) : `msg_friend_${i}_${lIdx}`,
                    origId: msg.id,
                    sessionIdx: i,
                    isUser,
                    senderName: isUser ? (QQManager.getUserProfile().name || '我') : friend.name,
                    avatarColor: isUser ? '#2563eb' : (friend.avatarColor || '#3b82f6'),
                    content: lines[lIdx],
                });
            }
        }

        this.activeFlattenedMessages = flattened;

        // 连续消息只显示一次头像：若上一条消息也是同一个发送人，则隐藏头像（透明占位保对齐）
        const messagesHtml = flattened.map((item, idx) => {
            const isUser = item.isUser;
            const isConsecutive = idx > 0 && flattened[idx - 1].isUser === isUser;
            const isSelected = this.selectedMessageIds.has(String(item.id));
            const selectBoxHtml = this.isMultiSelectMode ? `
                <div class="sp-qq-msg-select-wrap">
                    <input type="checkbox" class="sp-qq-msg-checkbox" data-msg-id="${item.id}" ${isSelected ? 'checked' : ''}>
                </div>
            ` : '';

            let avatarHtml = '';
            if (!isUser) {
                if (!isConsecutive) {
                    avatarHtml = `<div class="sp-qq-msg-avatar" style="${INLINE_STYLES.avatarOther(friend.avatarColor)}">${initialChar}</div>`;
                } else {
                    avatarHtml = `<div class="sp-qq-avatar-placeholder" style="${INLINE_STYLES.avatarPlaceholder}" aria-hidden="true"></div>`;
                }
            } else {
                if (!isConsecutive) {
                    avatarHtml = `<div class="sp-qq-msg-avatar is-self-avatar" style="${INLINE_STYLES.avatarSelf}">我</div>`;
                } else {
                    avatarHtml = `<div class="sp-qq-avatar-placeholder" style="${INLINE_STYLES.avatarPlaceholder}" aria-hidden="true"></div>`;
                }
            }

            const textContent = $('<div>').text(String(item.content || '').trim()).html();
            const bubbleHtml = `<div class="sp-qq-msg-bubble" style="${isUser ? INLINE_STYLES.bubbleSelf : INLINE_STYLES.bubbleOther}">${textContent}</div>`;
            return `<div class="sp-qq-msg-row ${isUser ? 'is-self' : 'is-other'} ${isSelected ? 'is-selected' : ''}" data-msg-id="${item.id}" style="${isUser ? INLINE_STYLES.rowSelf : INLINE_STYLES.rowOther}">${selectBoxHtml}${!isUser ? avatarHtml : ''}${bubbleHtml}${isUser ? avatarHtml : ''}</div>`;
        }).join('');

        const chatHtml = `
            <div class="sp-qq-chat-header">
                <button type="button" class="sp-qq-chat-back-btn" id="sp-qq-chat-back-btn">
                    <i class="fa-solid fa-chevron-left"></i> 消息
                </button>
                <div class="sp-qq-chat-header-center">
                    <div class="sp-qq-chat-target-name">${friend.name}</div>
                    <div class="sp-qq-chat-target-status">
                        <span class="sp-qq-online-badge">4G 在线</span> · QQ: ${friend.qqNumber}
                    </div>
                </div>
                <div class="sp-qq-chat-header-right">
                    <button type="button" class="sp-qq-icon-btn" id="sp-qq-chat-clear-btn" title="清空本对话历史">
                        <i class="fa-solid fa-eraser"></i>
                    </button>
                </div>
            </div>

            <!-- 消息流区域 -->
            <div class="sp-qq-chat-stream ${this.isMultiSelectMode ? 'is-multiselect-mode' : ''}" id="sp-qq-chat-stream" style="${INLINE_STYLES.stream}">
                <div class="sp-qq-chat-notice">
                    <span>你与 ${friend.name} 已成为 QQ 好友，正在通过加密信道私聊</span>
                </div>
                ${messagesHtml}
            </div>

            <!-- 底部输入与操作栏 -->
            ${this._renderChatFooter('发送私聊消息...')}
        `;

        $chatView.html(chatHtml);
        this._scrollToBottom();
    }

    /**
     * 关闭工具箱浮动面板并取消按钮激活高亮
     */
    _closeToolboxPanel() {
        if (!this.container) return;
        this.container.find('#sp-qq-toolbox-panel').removeClass('is-open');
        this.container.find('#sp-qq-toolbox-btn').removeClass('is-active');
    }

    /**
     * 进入多选删除模式
     */
    _enterMultiSelectMode() {
        this._closeToolboxPanel();
        if (this.isGenerating) {
            if (typeof toastr !== 'undefined') toastr.warning('请等待当前发送完成或先停止发送', 'QQ');
            return;
        }
        this.isMultiSelectMode = true;
        this.selectedMessageIds.clear();
        this._renderChatView();
    }

    /**
     * 退出多选删除模式
     */
    _exitMultiSelectMode() {
        this._closeToolboxPanel();
        this.isMultiSelectMode = false;
        this.selectedMessageIds.clear();
        this._renderChatView();
    }

    /**
     * 切换全选 / 取消全选
     */
    _toggleSelectAllMessages() {
        const total = (this.activeFlattenedMessages || []).length;
        if (total === 0) return;

        if (this.selectedMessageIds.size >= total) {
            this.selectedMessageIds.clear();
        } else {
            this.selectedMessageIds.clear();
            for (const item of this.activeFlattenedMessages) {
                this.selectedMessageIds.add(String(item.id));
            }
        }
        this._updateMultiSelectUI();
    }

    /**
     * 更新多选界面中的勾选状态与计数
     */
    _updateMultiSelectUI() {
        const count = this.selectedMessageIds.size;
        const total = (this.activeFlattenedMessages || []).length;
        this.container.find('#sp-qq-multiselect-count').text(`已选 ${count} 条`);
        this.container.find('#sp-qq-select-all-btn').text(count >= total && total > 0 ? '取消全选' : '全选');
        this.container.find('#sp-qq-batch-delete-btn').prop('disabled', count === 0);

        this.container.find('.sp-qq-msg-row').each((_, el) => {
            const $row = $(el);
            const msgId = String($row.data('msg-id'));
            const isChecked = this.selectedMessageIds.has(msgId);
            $row.toggleClass('is-selected', isChecked);
            $row.find('.sp-qq-msg-checkbox').prop('checked', isChecked);
        });
    }

    /**
     * 执行批量删除选中的消息并同步正文删除
     */
    async _handleBatchDeleteMessages() {
        if (!this.activeChatId || this.selectedMessageIds.size === 0) return;

        const count = this.selectedMessageIds.size;
        const confirmMsg = `确定删除选中的 ${count} 条消息吗？\n酒馆正文中的对应手机互动记录也将同步删除。`;
        if (!confirm(confirmMsg)) return;

        const itemsToRemove = (this.activeFlattenedMessages || [])
            .filter(item => this.selectedMessageIds.has(String(item.id)))
            .map(item => ({
                id: item.origId || item.id,
                content: item.content,
                senderName: item.senderName,
                isUser: item.isUser,
            }));

        try {
            await QQManager.deleteSessionMessages(this.activeChatId, itemsToRemove);
            this.isMultiSelectMode = false;
            this.selectedMessageIds.clear();
            this._renderChatView();
            if (typeof toastr !== 'undefined') {
                toastr.success(`已成功删除 ${count} 条消息并同步正文记录`, 'QQ');
            }
        } catch (err) {
            console.error('[QQApp] 批量删除消息出错:', err);
            if (typeof toastr !== 'undefined') {
                toastr.error(`删除失败: ${err.message || err}`, 'QQ');
            }
        }
    }

    /**
     * 手动停止当前的 AI 发送生成
     */
    _handleStopGeneration() {
        if (!this.isGenerating) return;
        try {
            ApiService.abortCurrentRequest();
        } catch (_) {}
        this.isGenerating = false;

        this.container.find('.sp-qq-msg-row.is-other:has(.is-typing), [id^="loading_"]').remove();

        const $sendBtn = this.container.find('#sp-qq-send-btn');
        const $input = this.container.find('#sp-qq-chat-input');
        $sendBtn.removeClass('is-generating').prop('disabled', false).attr('title', '发送').html('<i class="fa-solid fa-paper-plane"></i>');
        $input.prop('disabled', false);
        $input.blur();
        if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
        }

        if (typeof toastr !== 'undefined') {
            toastr.info('已停止发送', 'QQ');
        }
    }

    /**
     * 重新生成最后一轮 AI 回复
     */
    async _handleRegenerateMessage() {
        if (!this.activeChatId) return;
        if (this.isGenerating) {
            if (typeof toastr !== 'undefined') toastr.warning('当前正在生成中，请先等待或停止', 'QQ');
            return;
        }

        const session = QQManager.getSession(this.activeChatId);
        if (!Array.isArray(session) || session.length === 0) {
            if (typeof toastr !== 'undefined') toastr.info('当前暂无对话记录可重新生成', 'QQ');
            return;
        }

        // 寻找最后一条用户消息
        let lastUserIdx = -1;
        for (let i = session.length - 1; i >= 0; i--) {
            if (session[i].sender === 'user') {
                lastUserIdx = i;
                break;
            }
        }

        if (lastUserIdx === -1) {
            if (typeof toastr !== 'undefined') toastr.warning('未找到上一条用户发送的消息，无法重新生成', 'QQ');
            return;
        }

        const lastUserMsg = session[lastUserIdx];
        const userText = lastUserMsg.content;

        // 提取最后这次用户输入之后的所有 AI 回复（从 session 和正文中同步回滚）
        const aiMessagesToRemove = session.slice(lastUserIdx + 1);
        if (aiMessagesToRemove.length > 0) {
            const flattenToRemove = [];
            for (const msg of aiMessagesToRemove) {
                const lines = PhoneLogService.extractIndividualReplyMessages(msg.content);
                for (const line of lines) {
                    flattenToRemove.push({
                        id: msg.id,
                        content: line,
                        senderName: msg.senderName || '',
                        isUser: false,
                    });
                }
            }
            await QQManager.deleteSessionMessages(this.activeChatId, flattenToRemove);
        }

        // 刷新聊天界面（移除旧 AI 气泡）
        this._renderChatView();

        // 触发重新生成
        await this._executeGeneration(userText, { isRegenerate: true });
    }

    /**
     * 滚动聊天视窗到底部
     */
    _scrollToBottom() {
        const stream = this.container.find('#sp-qq-chat-stream')[0];
        if (stream) {
            stream.scrollTop = stream.scrollHeight;
        }
    }

    /**
     * 发送聊天消息逻辑（支持群聊与单聊分流）
     */
    async _handleSendMessage() {
        this._closeToolboxPanel();
        if (this.isGenerating) {
            this._handleStopGeneration();
            return;
        }

        const $input = this.container.find('#sp-qq-chat-input');
        const text = $input.val().trim();
        if (!text) return;
        if (!this.activeChatId) return;

        $input.val('');
        // 关键防护：用户发送后主动失焦，让移动端软键盘及时收起，避免遮挡聊天界面与回复
        $input.blur();
        if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
        }

        // 1. 界面上立刻上屏用户气泡
        const $stream = this.container.find('#sp-qq-chat-stream');
        const selfProfile = QQManager.getUserProfile();
        const selfInitial = (selfProfile.name || '我').slice(0, 1).toUpperCase();
        const userMsgHtml = `
            <div class="sp-qq-msg-row is-self" style="${INLINE_STYLES.rowSelf}">
                <div class="sp-qq-msg-bubble" style="${INLINE_STYLES.bubbleSelf}">${$('<div>').text(text).html()}</div>
                <div class="sp-qq-msg-avatar is-self-avatar" style="${INLINE_STYLES.avatarSelf}">${selfInitial}</div>
            </div>
        `;
        $stream.append(userMsgHtml);
        this._scrollToBottom();

        await this._executeGeneration(text, { isRegenerate: false });
    }

    /**
     * 执行底层调用与回复上屏（群聊与单聊统一调度，支持停止与重新生成）
     */
    async _executeGeneration(userText, { isRegenerate = false } = {}) {
        const $input = this.container.find('#sp-qq-chat-input');
        const $sendBtn = this.container.find('#sp-qq-send-btn');
        const $stream = this.container.find('#sp-qq-chat-stream');

        this.isGenerating = true;
        $input.blur();
        $input.prop('disabled', true);
        $sendBtn.addClass('is-generating').prop('disabled', false).attr('title', '停止发送').html('<i class="fa-solid fa-stop"></i>');

        const loadingId = `loading_${Date.now()}`;
        const isGroup = this.activeChatType === 'group';

        if (isGroup) {
            const group = QQManager.getGroup(this.activeChatId);
            const groupInitial = (group?.name || '群').slice(0, 1);
            const loadingHtml = `
                <div class="sp-qq-msg-row is-other" id="${loadingId}" style="${INLINE_STYLES.rowOther}">
                    <div class="sp-qq-msg-avatar" style="${INLINE_STYLES.avatarOther(group?.avatarColor || '#10b981')}">
                        ${groupInitial}
                    </div>
                    <div style="display: flex; flex-direction: column; align-items: flex-start; max-width: 82%;">
                        <div class="sp-qq-msg-sender-name" style="font-size: 9.5px; color: rgba(255, 255, 255, 0.55); margin-bottom: 2px;">群成员正在打字...</div>
                        <div class="sp-qq-msg-bubble is-typing" style="${INLINE_STYLES.bubbleOther}; display: inline-flex; align-items: center; gap: 3px; padding: 4px 7px;">
                            <span class="sp-typing-dot" style="width: 3.5px; height: 3.5px;"></span>
                            <span class="sp-typing-dot" style="width: 3.5px; height: 3.5px;"></span>
                            <span class="sp-typing-dot" style="width: 3.5px; height: 3.5px;"></span>
                        </div>
                    </div>
                </div>
            `;
            $stream.append(loadingHtml);
            this._scrollToBottom();

            try {
                const replyItems = await QQManager.sendGroupMessage(this.activeChatId, userText, { skipAppendUser: isRegenerate });
                $(`#${loadingId}`).remove();

                replyItems.forEach(item => {
                    const avatarText = this._getAvatarDisplayText(item.senderName);
                    const avatarHtml = `<div class="sp-qq-msg-avatar" style="${INLINE_STYLES.avatarOther(item.avatarColor)}">${avatarText}</div>`;
                    const senderNameHtml = `<div class="sp-qq-msg-sender-name" style="font-size: 9.5px; color: rgba(255, 255, 255, 0.55); margin-bottom: 2px; padding-left: 2px; line-height: 1;">${$('<div>').text(item.senderName).html()}</div>`;
                    const bubbleHtml = `<div class="sp-qq-msg-bubble" style="${INLINE_STYLES.bubbleOther}">${$('<div>').text(item.content).html()}</div>`;

                    const aiMsgHtml = `
                        <div class="sp-qq-msg-row is-other" style="${INLINE_STYLES.rowOther}">
                            ${avatarHtml}
                            <div style="display: flex; flex-direction: column; align-items: flex-start; max-width: 82%;">
                                ${senderNameHtml}
                                ${bubbleHtml}
                            </div>
                        </div>
                    `;
                    $stream.append(aiMsgHtml);
                });
                this._scrollToBottom();
            } catch (err) {
                $(`#${loadingId}`).remove();
                if (err?.isAborted || String(err?.message || err).includes('停止') || String(err?.message || err).includes('aborted')) {
                    console.log('[QQApp] 群聊生成已由用户手动停止');
                } else {
                    const errorHtml = `
                        <div class="sp-qq-msg-error">
                            <i class="fa-solid fa-triangle-exclamation"></i> 群消息发送失败: ${err.message || err}
                        </div>
                    `;
                    $stream.append(errorHtml);
                    this._scrollToBottom();
                }
            } finally {
                this.isGenerating = false;
                $input.prop('disabled', false);
                // 关键防护：联系人回复完毕后严禁自动聚焦，主动失焦收起虚拟键盘
                $input.blur();
                if (document.activeElement && typeof document.activeElement.blur === 'function') {
                    document.activeElement.blur();
                }
                setTimeout(() => { $input.blur(); }, 50);
                $sendBtn.removeClass('is-generating').prop('disabled', false).attr('title', '发送').html('<i class="fa-solid fa-paper-plane"></i>');
            }
            return;
        }

        // 单聊逻辑
        const friendId = this.activeChatId;
        const friend = QQManager.getFriend(friendId);
        const initialChar = (friend?.name || '友').slice(0, 1).toUpperCase();
        const loadingHtml = `
            <div class="sp-qq-msg-row is-other" id="${loadingId}" style="${INLINE_STYLES.rowOther}">
                <div class="sp-qq-msg-avatar" style="${INLINE_STYLES.avatarOther(friend?.avatarColor)}">
                    ${initialChar}
                </div>
                <div class="sp-qq-msg-bubble is-typing" style="${INLINE_STYLES.bubbleOther}; display: inline-flex; align-items: center; gap: 3px; padding: 4px 7px;">
                    <span class="sp-typing-dot" style="width: 3.5px; height: 3.5px;"></span>
                    <span class="sp-typing-dot" style="width: 3.5px; height: 3.5px;"></span>
                    <span class="sp-typing-dot" style="width: 3.5px; height: 3.5px;"></span>
                </div>
            </div>
        `;
        $stream.append(loadingHtml);
        this._scrollToBottom();

        try {
            const reply = await QQManager.sendMessageToFriend(friendId, userText, { skipAppendUser: isRegenerate });
            $(`#${loadingId}`).remove();

            const replyList = Array.isArray(reply) ? reply : PhoneLogService.extractIndividualReplyMessages(reply);
            replyList.forEach((msgItem, idx) => {
                const isConsecutive = idx > 0;
                const avatarHtml = !isConsecutive
                    ? `<div class="sp-qq-msg-avatar" style="${INLINE_STYLES.avatarOther(friend?.avatarColor)}">${initialChar}</div>`
                    : `<div class="sp-qq-avatar-placeholder" style="${INLINE_STYLES.avatarPlaceholder}" aria-hidden="true"></div>`;

                const aiMsgHtml = `
                    <div class="sp-qq-msg-row is-other" style="${INLINE_STYLES.rowOther}">
                        ${avatarHtml}
                        <div class="sp-qq-msg-bubble" style="${INLINE_STYLES.bubbleOther}">${$('<div>').text(msgItem).html()}</div>
                    </div>
                `;
                $stream.append(aiMsgHtml);
            });
            this._scrollToBottom();
        } catch (err) {
            $(`#${loadingId}`).remove();
            if (err?.isAborted || String(err?.message || err).includes('停止') || String(err?.message || err).includes('aborted')) {
                console.log('[QQApp] 单聊生成已由用户手动停止');
            } else {
                const errorHtml = `
                    <div class="sp-qq-msg-error">
                        <i class="fa-solid fa-triangle-exclamation"></i> 消息发送失败: ${err.message || err}
                    </div>
                `;
                $stream.append(errorHtml);
                this._scrollToBottom();
            }
        } finally {
            this.isGenerating = false;
            $input.prop('disabled', false);
            // 关键防护：联系人回复完毕后严禁自动聚焦，主动失焦收起虚拟键盘
            $input.blur();
            if (document.activeElement && typeof document.activeElement.blur === 'function') {
                document.activeElement.blur();
            }
            setTimeout(() => { $input.blur(); }, 50);
            $sendBtn.removeClass('is-generating').prop('disabled', false).attr('title', '发送').html('<i class="fa-solid fa-paper-plane"></i>');
        }
    }

    /**
     * 打开创建群聊弹窗
     */
    openCreateGroupModal() {
        this.container.find('#sp-qq-dropdown-menu').hide();
        const friends = QQManager.getFriends();
        if (friends.length === 0) {
            if (typeof toastr !== 'undefined') toastr.warning('当前通讯录尚无好友，请先添加好友再发起群聊！', 'QQ');
            else alert('当前通讯录尚无好友，请先添加好友再发起群聊！');
            return;
        }

        this.groupSelectedFriendIds = new Set();
        this.container.find('#sp-qq-group-name-input').val('');
        this._renderGroupMemberPicker(friends);
        this._updateGroupCreateButtonState();
        this.container.find('#sp-qq-create-group-modal').show();
        if (window.innerWidth > 600) {
            this.container.find('#sp-qq-group-name-input').focus();
        }
    }

    /**
     * 渲染群成员多选候选列表
     */
    _renderGroupMemberPicker(friends) {
        const $picker = this.container.find('#sp-qq-group-members-list');
        $picker.empty();

        friends.forEach(f => {
            const initialChar = (f.name || '友').slice(0, 1).toUpperCase();
            const isChecked = this.groupSelectedFriendIds.has(f.id);
            const itemHtml = `
                <div class="sp-qq-group-picker-item ${isChecked ? 'selected' : ''}" data-id="${f.id}" style="display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; cursor: pointer; background: ${isChecked ? 'rgba(56, 189, 248, 0.16)' : 'rgba(255, 255, 255, 0.03)'}; border: 1px solid ${isChecked ? 'rgba(56, 189, 248, 0.4)' : 'transparent'}; transition: all 0.15s ease;">
                    <input type="checkbox" class="sp-qq-group-member-check" data-id="${f.id}" ${isChecked ? 'checked' : ''} style="cursor: pointer; pointer-events: none; accent-color: #0284c7; width: 14px; height: 14px;" />
                    <div class="sp-qq-avatar" style="width: 22px; height: 22px; min-width: 22px; font-size: 10px; background-color: ${f.avatarColor || '#3b82f6'};">
                        ${initialChar}
                    </div>
                    <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
                        <span style="font-size: 11.5px; font-weight: 500; color: #f1f5f9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${f.name}</span>
                        ${f.remark ? `<span style="font-size: 9.5px; color: rgba(255, 255, 255, 0.45); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${f.remark}</span>` : ''}
                    </div>
                </div>
            `;
            $picker.append(itemHtml);
        });
    }

    /**
     * 更新建群按钮状态与已选计数
     */
    _updateGroupCreateButtonState() {
        const count = this.groupSelectedFriendIds.size;
        this.container.find('#sp-qq-group-pick-count').text(`已选 ${count} 人`);
        const $btn = this.container.find('#sp-qq-create-group-confirm-btn');
        $btn.text(`立即建群 (${count})`);
        $btn.prop('disabled', count === 0);
    }

    /**
     * 处理立即建群逻辑
     */
    _handleCreateGroup() {
        const name = this.container.find('#sp-qq-group-name-input').val().trim();
        const memberIds = Array.from(this.groupSelectedFriendIds);
        if (memberIds.length === 0) {
            alert('请至少选择 1 位好友加入群聊');
            return;
        }

        const newGroup = QQManager.createGroup({
            name,
            memberIds,
        });

        this.container.find('#sp-qq-create-group-modal').hide();
        this._refreshViews();
        if (typeof toastr !== 'undefined') toastr.success(`群聊【${newGroup.name}】已创建！`, 'QQ');
        this.openChat(newGroup.id, 'group');
    }

    /**
     * 获取经过当前搜索词过滤后的条目列表
     */
    _getFilteredWorldEntries() {
        if (!this.searchKeyword) return this.cachedWorldEntries;
        const q = this.searchKeyword.toLowerCase();
        return this.cachedWorldEntries.filter(entry => {
            const matchName = String(entry.name || '').toLowerCase().includes(q);
            const matchKeys = (entry.keys || []).some(k => String(k || '').toLowerCase().includes(q));
            const matchSnippet = String(entry.snippet || '').toLowerCase().includes(q);
            const matchContent = String(entry.content || '').toLowerCase().includes(q);
            return matchName || matchKeys || matchSnippet || matchContent;
        });
    }

    /**
     * 绑定页面交互事件
     */
    _bindEvents() {
        if (!this.container) return;

        // 1. 返回小手机主屏幕
        this.container.on('click', '#sp-qq-back-home-btn', () => {
            if (typeof this.onBackToHome === 'function') {
                this.onBackToHome();
            }
        });

        // 2. 切换 Tab (消息 / 联系人)
        this.container.on('click', '.sp-qq-nav-tab', (e) => {
            const tab = $(e.currentTarget).data('tab');
            this.currentTab = tab;
            this.container.find('.sp-qq-nav-tab').removeClass('active');
            $(e.currentTarget).addClass('active');

            if (tab === 'messages') {
                this.container.find('#sp-qq-pane-messages').show();
                this.container.find('#sp-qq-pane-contacts').hide();
                this._renderRecentChats();
            } else {
                this.container.find('#sp-qq-pane-messages').hide();
                this.container.find('#sp-qq-pane-contacts').show();
                this._renderContactsList();
            }
        });

        // 2.1 联系人搜索框实时输入过滤
        this.container.on('input', '#sp-qq-contacts-search-input', (e) => {
            this.contactsSearchKeyword = $(e.target).val().trim();
            this.container.find('#sp-qq-contacts-search-clear').toggle(Boolean(this.contactsSearchKeyword));
            this._renderContactsList();
        });

        // 2.2 联系人搜索框清空按钮
        this.container.on('click', '#sp-qq-contacts-search-clear', () => {
            this.contactsSearchKeyword = '';
            this.container.find('#sp-qq-contacts-search-input').val('').focus();
            this.container.find('#sp-qq-contacts-search-clear').hide();
            this._renderContactsList();
        });

        // 3. 点击顶部右侧操作按钮：切换显示下拉菜单
        this.container.on('click', '#sp-qq-more-btn', (e) => {
            e.stopPropagation();
            this.container.find('#sp-qq-dropdown-menu').toggle();
        });

        $(document).on('click.spQQCloseDropdown', (e) => {
            if (!$(e.target).closest('#sp-qq-dropdown-menu, #sp-qq-more-btn').length) {
                this.container?.find('#sp-qq-dropdown-menu').hide();
            }
        });

        // 3.1 点击打开创建群聊弹窗
        this.container.on('click', '#sp-qq-btn-open-create-group, #sp-qq-btn-inline-create-group', () => {
            this.container.find('#sp-qq-dropdown-menu').hide();
            this.openCreateGroupModal();
        });

        // 3.2 建群弹窗内：勾选/反选群成员
        this.container.on('click', '.sp-qq-group-picker-item', (e) => {
            const friendId = $(e.currentTarget).data('id');
            if (!friendId) return;
            const $item = $(e.currentTarget);
            const $check = $item.find('.sp-qq-group-member-check');

            if (this.groupSelectedFriendIds.has(friendId)) {
                this.groupSelectedFriendIds.delete(friendId);
                $item.removeClass('selected').css({
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderColor: 'transparent',
                });
                $check.prop('checked', false);
            } else {
                this.groupSelectedFriendIds.add(friendId);
                $item.addClass('selected').css({
                    background: 'rgba(56, 189, 248, 0.16)',
                    borderColor: 'rgba(56, 189, 248, 0.4)',
                });
                $check.prop('checked', true);
            }
            this._updateGroupCreateButtonState();
        });

        // 3.3 确认创建群聊
        this.container.on('click', '#sp-qq-create-group-confirm-btn', () => {
            this._handleCreateGroup();
        });

        // 3.4 关闭创建群聊弹窗
        this.container.on('click', '#sp-qq-create-group-close-btn, #sp-qq-create-group-cancel-btn', () => {
            this.container.find('#sp-qq-create-group-modal').hide();
        });

        // 4. 点击打开一键导入世界书弹窗
        this.container.on('click', '#sp-qq-btn-open-import, #sp-qq-empty-import-btn', () => {
            this.container.find('#sp-qq-dropdown-menu').hide();
            this.openImportModal();
        });

        // 5. 点击打开手动添加好友弹窗
        this.container.on('click', '#sp-qq-btn-open-manual-add', () => {
            this.container.find('#sp-qq-dropdown-menu').hide();
            this.container.find('#sp-qq-manual-modal').show();
            if (window.innerWidth > 600) {
                this.container.find('#sp-qq-new-name').focus();
            }
        });

        // 6. 关闭弹窗
        this.container.on('click', '#sp-qq-import-close-btn, #sp-qq-import-cancel-btn', () => {
            this.container.find('#sp-qq-import-modal').hide();
        });
        this.container.on('click', '#sp-qq-manual-close-btn, #sp-qq-manual-cancel-btn', () => {
            this.container.find('#sp-qq-manual-modal').hide();
        });
        this.container.on('click', '#sp-qq-settings-close-btn, #sp-qq-settings-cancel-btn', () => {
            this.container.find('#sp-qq-settings-modal').hide();
        });

        // 6.1 打开 QQ 个人设置弹窗 (修改 user_name)
        const openSettingsModal = () => {
            this.container.find('#sp-qq-dropdown-menu').hide();
            const profile = QQManager.getUserProfile();
            this.container.find('#sp-qq-setting-user-name').val(profile.name || '我');
            this.container.find('#sp-qq-setting-qq-number').val(profile.qqNumber || '888888');
            this.container.find('#sp-qq-settings-modal').show();
            if (window.innerWidth > 600) {
                this.container.find('#sp-qq-setting-user-name').focus();
            }
        };
        this.container.on('click', '#sp-qq-settings-btn, #sp-qq-btn-open-settings', openSettingsModal);

        // 6.2 保存 QQ 个人设置
        this.container.on('click', '#sp-qq-settings-save-btn', () => {
            const name = this.container.find('#sp-qq-setting-user-name').val().trim() || '我';
            const qqNumber = this.container.find('#sp-qq-setting-qq-number').val().trim() || '888888';
            QQManager.updateUserProfile({ name, qqNumber });
            this.container.find('#sp-qq-settings-modal').hide();
            if (typeof toastr !== 'undefined') toastr.success(`QQ 设置已保存！当前用户名为【${name}】`, 'QQ');
        });

        // 6.3 清除全部聊天记录
        this.container.on('click', '#sp-qq-clear-all-sessions-btn', async () => {
            if (confirm('确认清空当前聊天中的全部 QQ 聊天记录吗？\n（酒馆正文中的手机互动记录也将同步彻底移除）')) {
                await QQManager.clearAllSessions();
                this.closeChat();
                this._refreshViews();
                this.container.find('#sp-qq-settings-modal').hide();
                if (typeof toastr !== 'undefined') {
                    toastr.success('已清空全部聊天记录与正文记录', 'QQ');
                } else {
                    alert('已清空全部聊天记录');
                }
            }
        });

        // 7. 手动添加确认
        this.container.on('click', '#sp-qq-manual-confirm-btn', () => {
            const name = this.container.find('#sp-qq-new-name').val().trim();
            if (!name) {
                alert('请输入好友昵称/人名');
                return;
            }
            const qqNumber = this.container.find('#sp-qq-new-number').val().trim();
            const remark = this.container.find('#sp-qq-new-remark').val().trim();
            const keysStr = this.container.find('#sp-qq-new-keys').val().trim();
            const prompt = this.container.find('#sp-qq-new-prompt').val().trim();

            const keys = keysStr ? keysStr.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [name, remark].filter(Boolean);

            const newFriend = QQManager.addFriend({
                name,
                qqNumber,
                remark,
                signature: remark,
                keys,
                personaPrompt: prompt,
            });

            this.container.find('#sp-qq-new-name').val('');
            this.container.find('#sp-qq-new-number').val('');
            this.container.find('#sp-qq-new-remark').val('');
            this.container.find('#sp-qq-new-keys').val('');
            this.container.find('#sp-qq-new-prompt').val('');
            this.container.find('#sp-qq-manual-modal').hide();

            this._refreshViews();
            if (typeof toastr !== 'undefined') toastr.success(`已添加好友【${newFriend.name}】！`, 'QQ');
            this.openChat(newFriend.id, 'friend');
        });

        // 8. 点击会话或联系人条目进入单聊或群聊
        this.container.on('click', '.sp-qq-chat-item, .sp-qq-contact-item', (e) => {
            if ($(e.target).closest('.sp-qq-del-friend-btn, .sp-qq-del-group-btn').length) return;
            const id = $(e.currentTarget).data('id');
            const type = $(e.currentTarget).data('type') || 'friend';
            if (id) {
                this.openChat(id, type);
            }
        });

        // 9. 删除好友
        this.container.on('click', '.sp-qq-del-friend-btn', async (e) => {
            e.stopPropagation();
            const friendId = $(e.currentTarget).data('id');
            const friend = QQManager.getFriend(friendId);
            if (confirm(`确认删除好友【${friend?.name || '此联系人'}】吗？（聊天记录及正文中的手机互动也将同步删除）`)) {
                if (this.activeChatId === friendId) {
                    this.closeChat();
                }
                await QQManager.deleteFriend(friendId);
                this._refreshViews();
                if (typeof toastr !== 'undefined') toastr.info('好友及正文记录已删除', 'QQ');
            }
        });

        // 9.1 解散群聊
        this.container.on('click', '.sp-qq-del-group-btn', async (e) => {
            e.stopPropagation();
            const groupId = $(e.currentTarget).data('id');
            const group = QQManager.getGroup(groupId);
            if (confirm(`确认解散群聊【${group?.name || '此群聊'}】吗？\n（群聊记录及正文中的手机群聊互动也将同步彻底删除）`)) {
                if (this.activeChatId === groupId) {
                    this.closeChat();
                }
                await QQManager.deleteGroup(groupId);
                this._refreshViews();
                if (typeof toastr !== 'undefined') toastr.info('群聊已解散', 'QQ');
            }
        });

        // 10. 会话页面：返回消息列表
        this.container.on('click', '#sp-qq-chat-back-btn', () => {
            this.closeChat();
        });

        // 11. 会话页面：清空聊天记录
        this.container.on('click', '#sp-qq-chat-clear-btn', async () => {
            const isGroup = this.activeChatType === 'group';
            const targetName = isGroup 
                ? (QQManager.getGroup(this.activeChatId)?.name || '当前群聊')
                : (QQManager.getFriend(this.activeChatId)?.name || '当前好友');

            if (confirm(`确认清空【${targetName}】的聊天记录吗？（正文中的手机互动也将同步删除）`)) {
                await QQManager.clearSession(this.activeChatId);
                this._renderChatView();
                if (typeof toastr !== 'undefined') toastr.info('聊天记录及正文互动已清空', 'QQ');
            }
        });

        // 12. 会话页面：发消息与停止发送
        this.container.on('click', '#sp-qq-send-btn', () => {
            if (this.isGenerating) {
                this._handleStopGeneration();
            } else {
                this._handleSendMessage();
            }
        });

        this.container.on('keydown', '#sp-qq-chat-input', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!this.isGenerating) {
                    this._handleSendMessage();
                }
            }
        });

        // 12.1 工具箱按钮点击：展开/收起包含重新生成与复选消息的工具箱操作面板
        this.container.on('click', '#sp-qq-toolbox-btn', (e) => {
            e.stopPropagation();
            const $panel = this.container.find('#sp-qq-toolbox-panel');
            const $btn = $(e.currentTarget);
            const willOpen = !$panel.hasClass('is-open');
            $panel.toggleClass('is-open', willOpen);
            $btn.toggleClass('is-active', willOpen);
        });

        // 点击工具箱面板内部区域阻止向上冒泡，避免误触收起
        this.container.on('click', '#sp-qq-toolbox-panel', (e) => {
            e.stopPropagation();
        });

        // 12.2 工具箱按键 1：重新生成
        this.container.on('click', '#sp-qq-toolbox-regen-btn', (e) => {
            e.stopPropagation();
            this._closeToolboxPanel();
            this._handleRegenerateMessage();
        });

        // 12.3 工具箱按键 2：复选消息
        this.container.on('click', '#sp-qq-toolbox-multiselect-btn', (e) => {
            e.stopPropagation();
            this._closeToolboxPanel();
            this._enterMultiSelectMode();
        });

        // 12.4 点击任意非工具箱区域自动关闭工具箱面板
        $(document).on('click.spQQToolbox', (e) => {
            if (!$(e.target).closest('#sp-qq-toolbox-panel, #sp-qq-toolbox-btn').length) {
                this._closeToolboxPanel();
            }
        });

        // 12.5 多选模式：取消多选
        this.container.on('click', '#sp-qq-cancel-select-btn', () => {
            this._exitMultiSelectMode();
        });

        // 12.6 多选模式：全选 / 取消全选
        this.container.on('click', '#sp-qq-select-all-btn', () => {
            this._toggleSelectAllMessages();
        });

        // 12.7 多选模式：确认批量删除选中消息
        this.container.on('click', '#sp-qq-batch-delete-btn', async () => {
            await this._handleBatchDeleteMessages();
        });

        // 12.8 多选模式：复选框变化
        this.container.on('change', '.sp-qq-msg-checkbox', (e) => {
            const msgId = String($(e.target).data('msg-id'));
            const isChecked = $(e.target).prop('checked');
            if (isChecked) {
                this.selectedMessageIds.add(msgId);
            } else {
                this.selectedMessageIds.delete(msgId);
            }
            this._updateMultiSelectUI();
        });

        // 12.9 多选模式：点击整条消息行即可切换选中
        this.container.on('click', '.sp-qq-msg-row', (e) => {
            if (!this.isMultiSelectMode) return;
            if ($(e.target).is('input, label, a, button')) return;
            const $chk = $(e.currentTarget).find('.sp-qq-msg-checkbox');
            if ($chk.length) {
                const newState = !$chk.prop('checked');
                $chk.prop('checked', newState).trigger('change');
            }
        });

        // 13. 监听酒馆会话变更事件：当酒馆切换聊天存档时，自动重载对应聊天元文件的聊天记录并刷新页面
        if (!this._tavernEventsBound) {
            this._tavernEventsBound = true;
            try {
                const context = (typeof Luker !== 'undefined' && Luker.getContext)
                    ? Luker.getContext()
                    : (typeof getContext === 'function' ? getContext() : null);

                if (context?.eventSource && context?.eventTypes?.CHAT_CHANGED) {
                    context.eventSource.on(context.eventTypes.CHAT_CHANGED, () => {
                        this._refreshViews();
                        if (this.activeChatId) {
                            this._renderChatView();
                        }
                    });
                }
            } catch (err) {
                console.warn('[QQApp] 监听酒馆 CHAT_CHANGED 事件失败:', err);
            }
        }

        // 14. 导入弹窗专属事件（搜索、全选/全不选、换书）
        this._bindImportModalEvents();
    }

    /**
     * 绑定导入世界书条目弹窗内部专属事件
     */
    _bindImportModalEvents() {
        // 搜索输入过滤
        this.container.on('input', '#sp-qq-import-search', (e) => {
            this.searchKeyword = $(e.target).val().trim();
            this.container.find('#sp-qq-import-search-clear').toggle(Boolean(this.searchKeyword));
            this._renderVisibleEntries();
        });

        // 清空搜索
        this.container.on('click', '#sp-qq-import-search-clear', () => {
            this.searchKeyword = '';
            this.container.find('#sp-qq-import-search').val('').focus();
            this.container.find('#sp-qq-import-search-clear').hide();
            this._renderVisibleEntries();
        });

        // 刷新当前角色世界书条目
        this.container.on('click', '#sp-qq-btn-refresh-wi', async () => {
            this.searchKeyword = '';
            this.container.find('#sp-qq-import-search').val('');
            this.container.find('#sp-qq-import-search-clear').hide();
            await this.loadWorldEntries();
        });

        // 切换“换书”选择栏展开/折叠
        this.container.on('click', '#sp-qq-btn-toggle-manual-book', () => {
            const $drawer = this.container.find('#sp-qq-manual-book-drawer');
            $drawer.toggle();
        });

        // 手动载入指定世界书
        this.container.on('click', '#sp-qq-btn-apply-custom-book, .sp-qq-btn-load-fallback-book', async (e) => {
            let bookName = this.container.find('#sp-qq-custom-book-select').val();
            if (!bookName) {
                bookName = $(e.currentTarget).siblings('.sp-qq-fallback-book-select').val();
            }
            if (!bookName) {
                if (typeof toastr !== 'undefined') toastr.warning('请先选择一本世界书', 'QQ');
                return;
            }
            this.searchKeyword = '';
            this.container.find('#sp-qq-import-search').val('');
            this.container.find('#sp-qq-import-search-clear').hide();
            await this.loadSpecificBookEntries(bookName);
        });

        // 全选当前可见条目
        this.container.on('click', '#sp-qq-btn-select-all', () => {
            const visible = this._getFilteredWorldEntries();
            visible.forEach(e => this.selectedUids.add(e.uid));
            this.container.find('.sp-qq-entry-checkbox').prop('checked', true);
            this.container.find('.sp-qq-import-entry-card').addClass('is-selected');
            this._updateImportCountUI();
        });

        // 全不选当前可见条目
        this.container.on('click', '#sp-qq-btn-select-none', () => {
            const visible = this._getFilteredWorldEntries();
            visible.forEach(e => this.selectedUids.delete(e.uid));
            this.container.find('.sp-qq-entry-checkbox').prop('checked', false);
            this.container.find('.sp-qq-import-entry-card').removeClass('is-selected');
            this._updateImportCountUI();
        });

        // 单个复选框变动
        this.container.on('change', '.sp-qq-entry-checkbox', (e) => {
            const rawVal = $(e.target).val();
            const uid = isNaN(rawVal) ? rawVal : parseInt(rawVal, 10);
            const isChecked = $(e.target).is(':checked');
            const $card = $(e.target).closest('.sp-qq-import-entry-card');

            if (isChecked) {
                this.selectedUids.add(uid);
                $card.addClass('is-selected');
            } else {
                this.selectedUids.delete(uid);
                $card.removeClass('is-selected');
            }
            this._updateImportCountUI();
        });

        // 点击卡片本身切换勾选
        this.container.on('click', '.sp-qq-import-entry-card', (e) => {
            if ($(e.target).is('input[type="checkbox"]')) return;
            const $chk = $(e.currentTarget).find('.sp-qq-entry-checkbox');
            $chk.prop('checked', !$chk.prop('checked')).trigger('change');
        });

        // 确认批量导入
        this.container.on('click', '#sp-qq-import-confirm-btn', () => {
            const selected = this.cachedWorldEntries.filter(e => this.selectedUids.has(e.uid));
            if (selected.length === 0) return;

            const imported = QQManager.importFriendsFromWorldInfo(selected);
            this.container.find('#sp-qq-import-modal').hide();
            this._refreshViews();

            if (typeof toastr !== 'undefined') {
                toastr.success(`成功为当前角色导入 ${imported.length} 位世界书好友！`, 'QQ');
            }

            // 导入完成后切到联系人 Tab 展示导入的好友
            this.container.find('.sp-qq-nav-tab[data-tab="contacts"]').trigger('click');
        });
    }

    /**
     * 监听酒馆角色卡和聊天切换事件，自动平滑隔离更新视图
     */
    _listenCharacterChange() {
        if (this._eventListenersBound) return;
        this._eventListenersBound = true;

        try {
            const context = (typeof Luker !== 'undefined' && Luker.getContext)
                ? Luker.getContext()
                : getContext();

            const eventSource = context?.eventSource || window.eventSource;
            const eventTypes = context?.event_types || window.event_types;

            if (eventSource && eventTypes) {
                const handleCharacterSwitch = () => {
                    // 若在聊天，返回通讯录/消息主页
                    if (this.activeChatId) {
                        this.closeChat();
                    } else {
                        this._refreshViews();
                    }
                    // 若导入弹窗正打开，重新扫描新角色卡的世界书
                    if (this.container && this.container.find('#sp-qq-import-modal').is(':visible')) {
                        this.loadWorldEntries();
                    }
                };

                if (eventTypes.CHAT_CHANGED) {
                    eventSource.on(eventTypes.CHAT_CHANGED, handleCharacterSwitch);
                }
                if (eventTypes.CHARACTER_PAGE_LOADED) {
                    eventSource.on(eventTypes.CHARACTER_PAGE_LOADED, handleCharacterSwitch);
                }
            }
        } catch (e) {
            console.warn('[QQApp] 注册角色切换事件监听出错:', e);
        }
    }

    /**
     * 获取酒馆中所有可用的世界书名称列表（用于“换书”备选下拉）
     */
    _getAllKnownWorldBookNames() {
        const context = (typeof Luker !== 'undefined' && Luker.getContext)
            ? Luker.getContext()
            : getContext();

        let list = [];
        try {
            if (typeof world_names !== 'undefined' && Array.isArray(world_names)) {
                list.push(...world_names);
            } else if (typeof context?.getWorldInfoNames === 'function') {
                list.push(...context.getWorldInfoNames());
            }
        } catch (_) {}

        $('#world_editor_select option, #world_info option, #world_names option').each((_, el) => {
            const val = $(el).text().trim();
            if (val && !val.includes('---')) list.push(val);
        });

        return [...new Set(list.map(s => String(s || '').trim()).filter(Boolean))];
    }

    /**
     * 填充备选换书下拉框
     */
    _populateCustomBookSelect(activeBook = '') {
        const $sel = this.container.find('#sp-qq-custom-book-select');
        const books = this._getAllKnownWorldBookNames();
        $sel.empty();

        if (books.length === 0) {
            $sel.append('<option value="">酒馆暂无可用世界书</option>');
            return;
        }

        books.forEach(b => {
            const isSel = b === activeBook;
            $sel.append(new Option(b, b, isSel, isSel));
        });
    }

    /**
     * 打开导入弹窗并初始化加载当前角色绑定的世界书条目
     */
    async openImportModal() {
        this.container.find('#sp-qq-import-modal').show();
        this.container.find('#sp-qq-manual-book-drawer').hide();
        this.container.find('#sp-qq-import-search').val('');
        this.container.find('#sp-qq-import-search-clear').hide();
        this.searchKeyword = '';
        this.selectedUids.clear();
        this._updateImportCountUI();
        this._populateCustomBookSelect();
        await this.loadWorldEntries();
    }

    /**
     * 手动载入指定名称的世界书
     */
    async loadSpecificBookEntries(bookName) {
        const $label = this.container.find('#sp-qq-bound-books-label');
        const $list = this.container.find('#sp-qq-import-list');
        $list.html(`<div class="sp-qq-loading-hint"><i class="fa-solid fa-spinner fa-spin"></i> 正在读取世界书【${bookName}】...</div>`);

        try {
            const entries = await QQManager._fetchWorldInfoEntries(bookName);
            $label.text(`已载入世界书: ${bookName}`);
            this.container.find('#sp-qq-manual-book-drawer').hide();

            this.cachedWorldEntries = entries;
            this.selectedUids.clear();
            this._updateImportCountUI();

            this._renderVisibleEntries();
        } catch (err) {
            $list.html(`
                <div class="sp-qq-empty-box" style="padding: 20px; color: #ef4444;">
                    <i class="fa-solid fa-circle-exclamation"></i>
                    <p>载入世界书失败: ${err.message || err}</p>
                </div>
            `);
        }
    }

    /**
     * 自动扫描并加载当前角色卡绑定的世界书条目（无需手动选书）
     */
    async loadWorldEntries() {
        const $label = this.container.find('#sp-qq-bound-books-label');
        const $title = this.container.find('#sp-qq-import-title-text');
        const $list = this.container.find('#sp-qq-import-list');
        $list.html('<div class="sp-qq-loading-hint"><i class="fa-solid fa-spinner fa-spin"></i> 正在读取当前角色绑定的世界书条目...</div>');

        try {
            const scanResult = await QQManager.scanCurrentCharacterWorldEntries();
            const { characterName, boundBooks, entries } = scanResult;

            // 1. 更新标题与自动绑定摘要
            const titleHtml = `<i class="fa-solid fa-book-sparkles"></i> 导入【${characterName}】世界书好友`;
            $title.html(titleHtml);

            if (boundBooks.length > 0) {
                $label.text(`已绑定世界书: ${boundBooks.join('、')}`).attr('title', boundBooks.join('\n'));
                this._populateCustomBookSelect(boundBooks[0]);
            } else {
                $label.text('当前角色卡暂未检测到外部世界书 (包含卡内设定)');
                this._populateCustomBookSelect();
            }

            this.cachedWorldEntries = entries;
            this.selectedUids.clear();
            this._updateImportCountUI();

            if (entries.length === 0) {
                const allKnownBooks = this._getAllKnownWorldBookNames();
                const bookOptionsHtml = allKnownBooks.map(b => `<option value="${b}">${b}</option>`).join('');

                $list.html(`
                    <div class="sp-qq-empty-box" style="padding: 16px 12px; text-align: center;">
                        <i class="fa-solid fa-folder-open" style="font-size: 26px; color: rgba(255,255,255,0.3); margin-bottom: 6px;"></i>
                        <p style="font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.9); margin-bottom: 4px;">未检测到世界书条目</p>
                        <span style="font-size: 10.5px; color: rgba(255,255,255,0.5); line-height: 1.4; display: block; margin-bottom: 12px;">
                            角色卡【${characterName}】可能未在酒馆中绑定世界书。您可以直接选择酒馆中的现有世界书快速读取：
                        </span>
                        ${allKnownBooks.length > 0 ? `
                            <div style="display: flex; gap: 6px; width: 100%; max-width: 250px; margin: 0 auto;">
                                <select class="sp-select sp-qq-fallback-book-select" style="flex: 1; font-size: 11px; padding: 4px 6px;">
                                    ${bookOptionsHtml}
                                </select>
                                <button type="button" class="sp-btn sp-btn-primary sp-btn-sm sp-qq-btn-load-fallback-book" style="padding: 4px 10px; font-size: 11px;">
                                    载入
                                </button>
                            </div>
                        ` : `
                            <span style="font-size: 10px; color: #94a3b8;">酒馆中暂无世界书，请在酒馆世界书面板新建或导入。</span>
                        `}
                    </div>
                `);
                return;
            }

            // 2. 渲染可见条目
            this._renderVisibleEntries();

        } catch (err) {
            $list.html(`
                <div class="sp-qq-empty-box" style="padding: 20px; color: #ef4444;">
                    <i class="fa-solid fa-circle-exclamation"></i>
                    <p>读取世界书失败: ${err.message || err}</p>
                </div>
            `);
        }
    }

    /**
     * 根据搜索关键字渲染条目列表
     */
    _renderVisibleEntries() {
        const $list = this.container.find('#sp-qq-import-list');
        const visibleEntries = this._getFilteredWorldEntries();
        $list.empty();
        this._updateImportCountUI();

        if (visibleEntries.length === 0) {
            $list.html(`
                <div class="sp-qq-empty-box" style="padding: 24px 10px; text-align: center;">
                    <i class="fa-solid fa-magnifying-glass" style="font-size: 22px; color: rgba(255,255,255,0.25); margin-bottom: 6px;"></i>
                    <p style="font-size: 12px; color: rgba(255,255,255,0.7);">未找到匹配的条目</p>
                    <span style="font-size: 10px; color: rgba(255,255,255,0.4);">尝试更换搜索词或清空搜索框</span>
                </div>
            `);
            return;
        }

        visibleEntries.forEach(entry => {
            const isSelected = this.selectedUids.has(entry.uid);

            const cardHtml = `
                <div class="sp-qq-import-entry-card ${isSelected ? 'is-selected' : ''}" data-uid="${entry.uid}">
                    <div class="sp-qq-entry-chk-col">
                        <input type="checkbox" class="sp-qq-entry-checkbox" value="${entry.uid}" ${isSelected ? 'checked' : ''} />
                    </div>
                    <div class="sp-qq-entry-content-col">
                        <div class="sp-qq-entry-title-row">
                            <span class="sp-qq-entry-name">${entry.name}</span>
                            <span class="sp-qq-entry-world-badge"><i class="fa-solid fa-book"></i> ${entry.worldName}</span>
                        </div>
                        <div class="sp-qq-entry-snippet">
                            ${entry.snippet || '(无内容描述)'}
                        </div>
                    </div>
                </div>
            `;
            $list.append(cardHtml);
        });
    }

    /**
     * 更新导入弹窗底部确认按钮与计数显示
     */
    _updateImportCountUI() {
        const count = this.selectedUids.size;
        const total = this.cachedWorldEntries.length;
        const visible = this._getFilteredWorldEntries().length;

        let countText = `已选 ${count} / ${total} 项`;
        if (this.searchKeyword) {
            countText = `已选 ${count} 项 (过滤出 ${visible} 项)`;
        }

        this.container.find('#sp-qq-select-count').text(countText);
        const $confirmBtn = this.container.find('#sp-qq-import-confirm-btn');
        $confirmBtn.prop('disabled', count === 0).text(`确认导入 (${count})`);
    }

    /**
     * 友好时间格式化
     */
    _formatTime(timestamp) {
        if (!timestamp) return '';
        const d = new Date(timestamp);
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();
        const pad = (n) => String(n).padStart(2, '0');
        if (isToday) {
            return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
        }
        return `${d.getMonth() + 1}/${d.getDate()}`;
    }

    /**
     * 获取头像展示文本：统一只显示首字
     */
    _getAvatarDisplayText(name = '') {
        const clean = String(name || '').trim();
        return clean.slice(0, 1).toUpperCase() || '友';
    }
}


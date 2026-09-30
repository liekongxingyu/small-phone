import { PromptManager } from './prompt-manager.js';
import { SettingsManager } from './settings-manager.js';
import { OperationLogService } from './operation-log-service.js';

/**
 * PromptStudio 类：负责提示词条目工作区的界面渲染、内置功能规范双规则编辑、正文历史记录只读预览与拖拽排序
 */
export class PromptStudio {
    constructor({ container, onItemsChanged }) {
        this.$container = container;
        this.onItemsChanged = onItemsChanged;
        this.currentFilter = 'all'; // 'all' | 'common' | 'qq' | 'x' | 'taobao'
        this.activeSlotTabs = {}; // 记录特殊插槽当前展开选中的场景 tab，如 { '__app_features__': 'qq' }
        this.expandedItemIds = new Set(); // 记录当前保持展开状态的条目 ID
        this.dragSrcIndex = null;
    }

    /**
     * 初始化并渲染整个工作区
     */
    render() {
        if (!this.$container) return;

        const items = PromptManager.getPromptItems();

        const template = `
            <div class="sp-prompt-studio">
                <!-- 顶部工具栏：App 范围筛选与操作 -->
                <div class="sp-studio-toolbar">
                    <div class="sp-filter-tabs">
                        <button type="button" class="sp-filter-tab ${this.currentFilter === 'all' ? 'active' : ''}" data-filter="all">
                            全部条目 (${items.length})
                        </button>
                        <button type="button" class="sp-filter-tab ${this.currentFilter === 'common' ? 'active' : ''}" data-filter="common">
                            通用
                        </button>
                        <button type="button" class="sp-filter-tab ${this.currentFilter === 'qq' ? 'active' : ''}" data-filter="qq">
                            <i class="fa-brands fa-qq"></i> QQ
                        </button>
                        <button type="button" class="sp-filter-tab ${this.currentFilter === 'x' ? 'active' : ''}" data-filter="x">
                            <i class="fa-brands fa-x-twitter"></i> X
                        </button>
                        <button type="button" class="sp-filter-tab ${this.currentFilter === 'taobao' ? 'active' : ''}" data-filter="taobao">
                            <i class="fa-solid fa-bag-shopping"></i> 淘宝
                        </button>
                    </div>

                    <div class="sp-studio-actions">
                        <button type="button" class="sp-btn-tool" id="sp-studio-sync-btn" title="重新从当前酒馆读取并同步条目">
                            <i class="fa-solid fa-arrows-rotate"></i> 同步酒馆
                        </button>
                        <button type="button" class="sp-btn-tool sp-btn-tool-primary" id="sp-studio-add-btn" title="新加普通提示词条目">
                            <i class="fa-solid fa-plus"></i> 新加条目
                        </button>
                    </div>
                </div>

                <!-- 内联新加普通条目抽屉 (默认收起) -->
                <div class="sp-add-item-drawer" id="sp-add-item-drawer" style="display: none;">
                    <div class="sp-add-item-card">
                        <div class="sp-add-item-header">
                            <span><i class="fa-solid fa-plus-circle"></i> 新增提示词条目</span>
                            <button type="button" class="sp-btn-icon" id="sp-add-cancel-btn"><i class="fa-solid fa-xmark"></i></button>
                        </div>
                        <div class="sp-form-item">
                            <label>条目标题 / 作用说明</label>
                            <input type="text" id="sp-new-item-name" class="sp-input" placeholder="例如：QQ极简吐槽人设 / 思考引导" />
                        </div>
                        <div class="sp-form-row">
                            <div class="sp-form-item" style="flex: 1;">
                                <label>注入角色 (Role)</label>
                                <select id="sp-new-item-role" class="sp-select">
                                    <option value="system">system (系统提示词)</option>
                                    <option value="user">user (用户输入)</option>
                                    <option value="assistant">assistant (AI 回复前置)</option>
                                </select>
                            </div>
                            <div class="sp-form-item" style="flex: 1;">
                                <label>适用范围</label>
                                <select id="sp-new-item-scope" class="sp-select">
                                    <option value="all">通用 (全部应用生效)</option>
                                    <option value="qq">仅 QQ 聊天生效</option>
                                    <option value="x">仅 X (推特) 生效</option>
                                    <option value="taobao">仅 淘宝 生效</option>
                                </select>
                            </div>
                        </div>
                        <div class="sp-form-item">
                            <label>提示词内容</label>
                            <textarea id="sp-new-item-content" class="sp-textarea" rows="3" placeholder="在此输入具体的提示词内容..."></textarea>
                        </div>
                        <div class="sp-form-actions-inline">
                            <button type="button" class="sp-btn sp-btn-secondary" id="sp-add-dismiss-btn">取消</button>
                            <button type="button" class="sp-btn sp-btn-primary" id="sp-add-confirm-btn">确认添加</button>
                        </div>
                    </div>
                </div>

                <!-- 拖拽操作提示栏 -->
                <div class="sp-drag-hint-bar">
                    <span><i class="fa-solid fa-arrows-up-down"></i> 所有条目均可拖拽手柄调整先后顺序；点击条目展开内置功能规范(输入规则 & 回复规则)与正文历史</span>
                </div>

                <!-- 条目可拖拽列表容器 -->
                <div class="sp-prompt-list" id="sp-prompt-items-list">
                    <!-- 动态条目列表由 _renderListItems 填充 -->
                </div>
            </div>
        `;

        this.$container.html(template);
        this._bindToolbarEvents();
        this._initListEventDelegation();
        this._renderListItems();
    }

    /**
     * 渲染条目列表
     */
    _renderListItems() {
        const $list = this.$container.find('#sp-prompt-items-list');
        const allItems = PromptManager.getPromptItems();
        $list.empty();

        if (allItems.length === 0) {
            $list.html('<div class="sp-empty-hint">暂无提示词条目，点击上方“同步酒馆”导入</div>');
            return;
        }

        const memConfig = SettingsManager.getMemoryConfig();
        const depth = parseInt(memConfig.chatHistoryDepth, 10) || 0;
        const historyInfo = PromptManager.getChatHistoryMessages(depth);

        allItems.forEach((item, index) => {
            // 普通条目的应用范围过滤（核心插槽不受过滤限制，始终在流水线中呈现）
            if (!item.isAppFeaturesSlot && !item.isChatHistorySlot) {
                if (this.currentFilter === 'common' && item.appScope !== 'all') return;
                if (this.currentFilter === 'qq' && item.appScope !== 'qq' && item.appScope !== 'all') return;
                if (this.currentFilter === 'x' && item.appScope !== 'x' && item.appScope !== 'all') return;
                if (this.currentFilter === 'taobao' && item.appScope !== 'taobao' && item.appScope !== 'all') return;
            }

            const isFeaturesSlot = Boolean(item.isAppFeaturesSlot || item.id === PromptManager.APP_FEATURES_SLOT_ID);
            const isHistorySlot = Boolean(item.isChatHistorySlot || item.id === PromptManager.CHAT_HISTORY_SLOT_ID);
            const isSpecialSlot = isFeaturesSlot || isHistorySlot;
            const isExpanded = this.expandedItemIds.has(item.id);

            let cardClass = 'sp-prompt-item';
            if (isFeaturesSlot) cardClass += ' is-features-slot';
            if (isHistorySlot) cardClass += ' is-history-slot';
            if (!item.enabled) cardClass += ' is-disabled';
            if (isExpanded) cardClass += ' is-expanded';

            const roleBadgeClass = isHistorySlot
                ? 'role-history'
                : (isFeaturesSlot ? 'role-features' : (item.role === 'user' ? 'role-user' : (item.role === 'assistant' ? 'role-assistant' : 'role-system')));

            // 摘要文字生成
            let snippetText = item.content || '';
            if (isFeaturesSlot) {
                const feats = item.features || PromptManager.getDefaultFeatures();
                const activeKey = item.activeFeatureKey || 'qq';
                const curFeat = feats[activeKey] || feats.qq || feats.default || Object.values(feats)[0];
                const count = Object.keys(feats).length;
                snippetText = `当前配置: 【${curFeat?.name || activeKey}】 · 输入规则 & 回复规则 · 共 ${count} 个内置功能`;
            } else if (isHistorySlot) {
                if (!historyInfo.inChat) {
                    snippetText = '当前未进入正文 (暂无上下文)';
                } else if (depth === 0) {
                    snippetText = '上下文读取已设为 0 条 (不注入记忆)';
                } else {
                    const rounds = (historyInfo.messages.length / 2).toFixed(1).replace('.0', '');
                    snippetText = `正文上下文: 最近 ${historyInfo.messages.length} 条记录 (约 ${rounds} 轮对话)`;
                }
            } else if (snippetText.length > 50) {
                snippetText = snippetText.slice(0, 50) + '...';
            }

            // 特殊插槽专属徽章
            let slotBadgeHtml = '';
            if (isFeaturesSlot) {
                slotBadgeHtml = '<span class="sp-slot-badge slot-features"><i class="fa-solid fa-shapes"></i> 内置功能规范 (输入 & 回复)</span>';
            } else if (isHistorySlot) {
                slotBadgeHtml = '<span class="sp-slot-badge slot-history"><i class="fa-solid fa-clock-rotate-left"></i> 正文历史记录 (只读)</span>';
            }

            // 展开面板内容生成
            let editorBodyHtml = '';
            if (isHistorySlot) {
                editorBodyHtml = this._generateHistorySlotEditorHtml(item, historyInfo, depth);
            } else if (isFeaturesSlot) {
                editorBodyHtml = this._generateFeaturesSlotEditorHtml(item);
            } else {
                editorBodyHtml = this._generateNormalItemEditorHtml(item);
            }

            const itemHtml = `
                <div class="${cardClass}" data-id="${item.id}" data-index="${index}" draggable="false">
                    <!-- 卡片头部条 -->
                    <div class="sp-item-bar">
                        <!-- 左侧拖拽把手与序号 -->
                        <div class="sp-drag-handle" title="按住手柄上下拖拽调整注入顺序">
                            <i class="fa-solid fa-grip-vertical"></i>
                            <span class="sp-order-index">#${index + 1}</span>
                        </div>

                        <!-- 角色与标题摘要（点击可平滑展开/收起详情） -->
                        <div class="sp-item-title-col" role="button" tabindex="0" title="点击展开/收起具体内容">
                            <div class="sp-item-title-row">
                                <span class="sp-role-pill ${roleBadgeClass}">${isHistorySlot ? 'HISTORY' : (isFeaturesSlot ? 'FEATURES' : item.role.toUpperCase())}</span>
                                <span class="sp-item-name" title="${item.name}">${item.name}</span>
                                ${slotBadgeHtml}
                            </div>
                            <div class="sp-item-snippet" title="${snippetText}">
                                ${snippetText || '(点击展开编辑具体内容)'}
                            </div>
                        </div>

                        <!-- 右侧操作与开关 -->
                        <div class="sp-item-actions-col">
                            <!-- 移动微调按钮 -->
                            <div class="sp-move-btns">
                                <button type="button" class="sp-btn-micro sp-move-up" data-index="${index}" title="向上移动一位" ${index === 0 ? 'disabled' : ''}>
                                    <i class="fa-solid fa-chevron-up"></i>
                                </button>
                                <button type="button" class="sp-btn-micro sp-move-down" data-index="${index}" title="向下移动一位" ${index === allItems.length - 1 ? 'disabled' : ''}>
                                    <i class="fa-solid fa-chevron-down"></i>
                                </button>
                            </div>

                            <!-- 启用开关 -->
                            <label class="sp-switch-micro" title="${item.enabled ? '已启用此条目' : '已禁用此条目'}">
                                <input type="checkbox" class="sp-item-enable-toggle" data-id="${item.id}" ${item.enabled ? 'checked' : ''} />
                                <span class="sp-switch-slider-micro"></span>
                            </label>

                            <!-- 展开编辑折叠箭头 -->
                            <button type="button" class="sp-btn-icon sp-item-expand-btn" data-id="${item.id}" title="展开/收起多套功能编辑详情">
                                <i class="fa-solid fa-chevron-right sp-item-chevron" style="transform: rotate(${isExpanded ? '90deg' : '0deg'});"></i>
                            </button>

                            <!-- 删除按钮 (核心插槽锁定不可删除) -->
                            ${!isSpecialSlot ? `
                                <button type="button" class="sp-btn-icon sp-btn-danger sp-item-delete-btn" data-id="${item.id}" title="删除此条目">
                                    <i class="fa-solid fa-trash-can"></i>
                                </button>
                            ` : ''}
                        </div>
                    </div>

                    <!-- 展开编辑面板 -->
                    <div class="sp-item-editor-body" style="display: ${isExpanded ? 'block' : 'none'};">
                        ${editorBodyHtml}
                    </div>
                </div>
            `;
            $list.append(itemHtml);
        });
    }

    /**
     * 生成正文历史记录插槽（只读上下文）的面板 HTML
     */
    _generateHistorySlotEditorHtml(item, historyInfo, depth) {
        let contentHtml = '';

        if (!historyInfo.inChat) {
            contentHtml = `
                <div class="sp-history-empty">
                    <i class="fa-solid fa-comment-slash"></i>
                    <p>当前未进入正文聊天，暂无上下文记录。</p>
                    <span>在酒馆正文选择角色开始聊天后，此处将自动同步最新历史。</span>
                </div>
            `;
        } else if (depth === 0) {
            contentHtml = `
                <div class="sp-history-empty">
                    <i class="fa-solid fa-ban"></i>
                    <p>当前记忆管理已设为 <b>0 条</b>（不读取正文上下文）</p>
                    <span>若需将正文历史注入 AI，请在“设置 > 记忆管理”模块调大记录数。</span>
                </div>
            `;
        } else if (historyInfo.messages.length === 0) {
            contentHtml = `
                <div class="sp-history-empty">
                    <i class="fa-solid fa-wind"></i>
                    <p>正文聊天记录为空（共 0 条）</p>
                    <span>当前正文中尚未产生任何有效对话。</span>
                </div>
            `;
        } else {
            const rounds = (historyInfo.messages.length / 2).toFixed(1).replace('.0', '');
            const msgListHtml = historyInfo.messages.map(m => `
                <div class="sp-history-msg ${m.isUser ? 'is-user' : 'is-char'}">
                    <div class="sp-history-msg-meta">
                        <span class="sp-history-role-tag ${m.isUser ? 'tag-user' : 'tag-char'}">
                            <i class="fa-solid ${m.isUser ? 'fa-user' : 'fa-robot'}"></i> ${$('<div>').text(m.name).html()}
                        </span>
                        <span class="sp-history-msg-num">正文第 #${m.index} 条</span>
                    </div>
                    <div class="sp-history-msg-bubble">${$('<div>').text(m.content).html()}</div>
                </div>
            `).join('');

            contentHtml = `
                <div class="sp-history-timeline-summary">
                    <span>已抓取最新 <b>${historyInfo.messages.length}</b> 条消息 (约 <b>${rounds}</b> 轮对话) / 正文共 ${historyInfo.totalCount} 条记录</span>
                </div>
                <div class="sp-history-timeline">
                    ${msgListHtml}
                </div>
            `;
        }

        return `
            <div class="sp-history-slot-editor">
                <div class="sp-history-slot-header">
                    <div class="sp-history-slot-tip">
                        <i class="fa-solid fa-circle-info"></i>
                        <span>【正文历史插槽 (只读)】：此条目负责向 AI 注入正文最新上下文。位置可上下拖拽。若需修改读取条数，请在<b>“记忆管理”</b>模块调整。</span>
                    </div>
                    <button type="button" class="sp-btn-micro sp-refresh-history-btn" title="重新从酒馆正文同步上下文">
                        <i class="fa-solid fa-arrows-rotate"></i> 刷新正文
                    </button>
                </div>
                <div class="sp-history-body-container">
                    ${contentHtml}
                </div>
            </div>
        `;
    }

    /**
     * 生成【内置功能规范 (输入规则 & 回复规则)】条目的编辑面板 HTML
     * 架构：
     * 1. 顶部内置功能 Tab 栏（QQ、X、淘宝、默认，以及用户新加的功能）
     * 2. 右侧【+ 新加内置功能】触发按钮与内联抽屉
     * 3. 选定功能的两套规则并列编辑：【输入规则 (Input Rule)】与【回复规则 (Reply Rule)】
     */
    _generateFeaturesSlotEditorHtml(item) {
        const features = item.features || PromptManager.getDefaultFeatures();
        const activeKey = item.activeFeatureKey || Object.keys(features)[0] || 'qq';
        const curFeat = features[activeKey] || features.qq || features.default || Object.values(features)[0];

        // 渲染功能 Tabs
        const featureTabsHtml = Object.values(features).map(feat => {
            const isActive = feat.id === curFeat.id;
            const iconClass = feat.icon || 'fa-cubes';
            return `
                <div class="sp-feature-tab-item ${isActive ? 'active' : ''}">
                    <button type="button" class="sp-feature-tab-btn" data-feature-id="${feat.id}">
                        <i class="fa-solid ${iconClass}"></i> ${feat.name}
                    </button>
                    ${feat.isCustom ? `
                        <button type="button" class="sp-feature-tab-del-btn" data-feature-id="${feat.id}" title="删除该功能">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    ` : ''}
                </div>
            `;
        }).join('');

        return `
            <div class="sp-features-slot-editor" data-active-feature="${curFeat.id}">
                <!-- 顶部功能选择栏与新加功能入口 -->
                <div class="sp-features-bar-container">
                    <div class="sp-features-tabs-list">
                        ${featureTabsHtml}
                    </div>
                    <button type="button" class="sp-btn-micro sp-btn-add-feature-toggle" title="新加自定义内置功能">
                        <i class="fa-solid fa-plus"></i> 新加内置功能
                    </button>
                </div>

                <!-- 新加内置功能抽屉 (默认折叠) -->
                <div class="sp-new-feature-drawer" style="display: none;">
                    <div class="sp-new-feature-card">
                        <div class="sp-new-feature-row">
                            <div class="sp-form-item" style="flex: 1;">
                                <label>功能英文标识 (ID)</label>
                                <input type="text" class="sp-input sp-new-feat-key" placeholder="如 wechat / group_chat" />
                            </div>
                            <div class="sp-form-item" style="flex: 1.2;">
                                <label>功能显示名称</label>
                                <input type="text" class="sp-input sp-new-feat-name" placeholder="如 微信聊天 / 群聊" />
                            </div>
                            <div class="sp-new-feature-btns">
                                <button type="button" class="sp-btn sp-btn-micro sp-btn-primary sp-confirm-add-feature-btn">确认新增</button>
                                <button type="button" class="sp-btn sp-btn-micro sp-btn-secondary sp-cancel-add-feature-btn">取消</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 变量支持与机制说明提示栏 -->
                <div class="sp-features-intro-bar">
                    <div class="sp-features-intro-title">
                        <i class="fa-solid fa-circle-question"></i>
                        <span>当前正在编辑：<b>${curFeat.name}</b> (标识: <code>${curFeat.id}</code>)</span>
                    </div>
                    <div class="sp-features-vars-list">
                        <div><b>常用变量：</b><code>{{phase}}</code> (场景) · <code>{{user_name}}</code> 用户 · <code>{{char_name}}</code> 角色 · <code>{{message}}</code> 消息 · <code>{{lorebook}}</code> 世界书 · <code>{{extra_requirement}}</code> (淘宝界面额外要求)</div>
                        <div style="margin-top: 3px;"><b>条件分支语法：</b><code>{% if phase == "单聊" %}...{% elif phase == "群聊" %}...{% else %}...{% endif %}</code></div>
                    </div>
                </div>

                <!-- 核心双规则编辑面板：输入规则与回复规则 -->
                <div class="sp-features-dual-editors">
                    <!-- 1. 输入规则编辑区 -->
                    <div class="sp-rule-editor-box">
                        <div class="sp-rule-box-header">
                            <label class="sp-rule-box-label">
                                <i class="fa-solid fa-arrow-right-to-bracket text-blue"></i>
                                <span>输入规则 (Input Template)</span>
                            </label>
                            <span class="sp-rule-box-hint">发消息时组装为 User 消息注入，支持 phase 条件分支</span>
                        </div>
                        <textarea class="sp-textarea sp-feat-input-textarea" rows="5" data-feature-id="${curFeat.id}" placeholder="支持分支，例如：&#10;{% if phase == &quot;单聊&quot; %}&#10;{{user_name}} 对 {{char_name}} 发送了QQ消息：“{{message}}”&#10;{% elif phase == &quot;群聊&quot; %}&#10;{{user_name}} 在群聊中发送了QQ消息：“{{message}}”&#10;{% endif %}">${curFeat.inputRule || ''}</textarea>
                        <div class="sp-rule-box-footer">
                            <span>提示：支持 <code>if phase == "单聊"</code> 与 <code>phase == "群聊"</code> 分流不同模板</span>
                            <span class="sp-save-status">修改即时保存</span>
                        </div>
                    </div>

                    <!-- 2. 回复规则编辑区 -->
                    <div class="sp-rule-editor-box">
                        <div class="sp-rule-box-header">
                            <label class="sp-rule-box-label">
                                <i class="fa-solid fa-reply text-purple"></i>
                                <span>回复规则 & 角色规范 (Reply Rule)</span>
                            </label>
                            <span class="sp-rule-box-hint">组装为 System 消息注入，规范人设与即时通讯口吻，支持 phase 条件分支</span>
                        </div>
                        <textarea class="sp-textarea sp-feat-reply-textarea" rows="7" data-feature-id="${curFeat.id}" placeholder="在此输入回复口吻规范、角色设定与格式要求...">${curFeat.replyRule || ''}</textarea>
                        <div class="sp-rule-box-footer">
                            <span>提示：支持 <code>{{char_name}}</code>、<code>{{lorebook}}</code> (动态触发世界书) 及 <code>{% if phase == ... %}</code></span>
                            <span class="sp-save-status">修改即时保存</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 生成普通自定义/酒馆条目的编辑面板 HTML
     */
    _generateNormalItemEditorHtml(item) {
        return `
            <div class="sp-editor-inner">
                <div class="sp-form-row">
                    <div class="sp-form-item" style="flex: 1.5;">
                        <label>条目标题</label>
                        <input type="text" class="sp-input sp-edit-name" data-id="${item.id}" value="${item.name}" />
                    </div>
                    <div class="sp-form-item" style="flex: 1;">
                        <label>角色</label>
                        <select class="sp-select sp-edit-role" data-id="${item.id}">
                            <option value="system" ${item.role === 'system' ? 'selected' : ''}>system</option>
                            <option value="user" ${item.role === 'user' ? 'selected' : ''}>user</option>
                            <option value="assistant" ${item.role === 'assistant' ? 'selected' : ''}>assistant</option>
                        </select>
                    </div>
                    <div class="sp-form-item" style="flex: 1;">
                        <label>应用归属</label>
                        <select class="sp-select sp-edit-scope" data-id="${item.id}">
                            <option value="all" ${item.appScope === 'all' ? 'selected' : ''}>全部通用</option>
                            <option value="qq" ${item.appScope === 'qq' ? 'selected' : ''}>仅 QQ 聊天</option>
                            <option value="x" ${item.appScope === 'x' ? 'selected' : ''}>仅 X (推特)</option>
                            <option value="taobao" ${item.appScope === 'taobao' ? 'selected' : ''}>仅 淘宝</option>
                        </select>
                    </div>
                </div>

                <div class="sp-form-item">
                    <label>提示词详细内容 (支持 <code>{{user_name}}</code>, <code>{{char_name}}</code>)</label>
                    <textarea class="sp-textarea sp-edit-content" data-id="${item.id}" rows="4">${item.content || ''}</textarea>
                </div>
            </div>
        `;
    }

    /**
     * 绑定工具栏按钮与 App 范围过滤器事件
     */
    _bindToolbarEvents() {
        // App 过滤选项卡切换
        this.$container.find('.sp-filter-tab').off('click').on('click', (e) => {
            const filter = $(e.currentTarget).data('filter');
            this.currentFilter = filter;
            this.$container.find('.sp-filter-tab').removeClass('active');
            $(e.currentTarget).addClass('active');
            this._renderListItems();
        });

        // 展开新加条目抽屉
        this.$container.find('#sp-studio-add-btn').off('click').on('click', () => {
            this.$container.find('#sp-add-item-drawer').slideDown(180);
            this.$container.find('#sp-new-item-name').focus();
        });

        // 收起新加条目抽屉
        this.$container.find('#sp-add-cancel-btn, #sp-add-dismiss-btn').off('click').on('click', () => {
            this.$container.find('#sp-add-item-drawer').slideUp(180);
        });

        // 确认新加条目
        this.$container.find('#sp-add-confirm-btn').off('click').on('click', () => {
            const name = this.$container.find('#sp-new-item-name').val().trim() || '新提示词条目';
            const role = this.$container.find('#sp-new-item-role').val();
            const appScope = this.$container.find('#sp-new-item-scope').val();
            const content = this.$container.find('#sp-new-item-content').val().trim();

            const newItem = PromptManager.addItem({ name, role, appScope, content });

            this.$container.find('#sp-new-item-name').val('');
            this.$container.find('#sp-new-item-content').val('');
            this.$container.find('#sp-add-item-drawer').slideUp(180);

            // 新加的条目默认展开方便编辑
            if (newItem && newItem.id) {
                this.expandedItemIds.add(newItem.id);
            }

            this._renderListItems();
            this._notifyChange();
            if (typeof toastr !== 'undefined') toastr.success('已新加提示词条目！', 'SmallPhone');
        });

        // 从当前酒馆重新同步条目
        this.$container.find('#sp-studio-sync-btn').off('click').on('click', () => {
            PromptManager.syncFromTavern();
            this._renderListItems();
            this._notifyChange();

            try {
                OperationLogService.log({
                    module: '提示词',
                    action: '同步酒馆条目',
                    status: 'success',
                    detail: '已同步酒馆自带预设',
                });
            } catch (_) {}

            if (typeof toastr !== 'undefined') toastr.success('已从酒馆重新同步自带预设条目！', 'SmallPhone');
        });
    }

    /**
     * 采用事件委托机制初始化列表内所有条目的交互逻辑（展开、保存、切换功能Tab、新加功能、微调上下与拖拽）
     */
    _initListEventDelegation() {
        const $list = this.$container.find('#sp-prompt-items-list');

        // 先清理可能存在的历史命名空间事件
        $list.off('.spStudio');

        // 统一处理展开/收起：点击箭头按钮 或 点击标题/摘要列
        const toggleItemExpand = ($card) => {
            const itemId = $card.data('id');
            const $editor = $card.find('.sp-item-editor-body');
            const $chevron = $card.find('.sp-item-chevron');

            if ($editor.is(':visible')) {
                $editor.slideUp(160);
                $chevron.css('transform', 'rotate(0deg)');
                $card.removeClass('is-expanded');
                this.expandedItemIds.delete(itemId);
            } else {
                // 如果展开的是【正文历史记录插槽】，在展开瞬间自动动态拉取正文最新记录
                const item = PromptManager.getPromptItems().find(it => it.id === itemId);
                if (item && item.isChatHistorySlot) {
                    const memConfig = SettingsManager.getMemoryConfig();
                    const depth = parseInt(memConfig.chatHistoryDepth, 10) || 0;
                    const historyInfo = PromptManager.getChatHistoryMessages(depth);
                    $editor.html(this._generateHistorySlotEditorHtml(item, historyInfo, depth));

                    // 同步更新卡片头部摘要
                    let snippetText = '';
                    if (!historyInfo.inChat) {
                        snippetText = '当前未进入正文 (暂无上下文)';
                    } else if (depth === 0) {
                        snippetText = '上下文读取已设为 0 条 (不注入记忆)';
                    } else {
                        const rounds = (historyInfo.messages.length / 2).toFixed(1).replace('.0', '');
                        snippetText = `正文上下文: 最近 ${historyInfo.messages.length} 条记录 (约 ${rounds} 轮对话)`;
                    }
                    $card.find('.sp-item-snippet').text(snippetText).attr('title', snippetText);
                }

                $editor.slideDown(160);
                $chevron.css('transform', 'rotate(90deg)');
                $card.addClass('is-expanded');
                this.expandedItemIds.add(itemId);
            }
        };

        // 1. 点击展开按钮
        $list.on('click.spStudio', '.sp-item-expand-btn', (e) => {
            e.stopPropagation();
            const $card = $(e.currentTarget).closest('.sp-prompt-item');
            toggleItemExpand($card);
        });

        // 2. 点击条目标题/摘要栏展开/收起
        $list.on('click.spStudio', '.sp-item-title-col', (e) => {
            e.stopPropagation();
            const $card = $(e.currentTarget).closest('.sp-prompt-item');
            toggleItemExpand($card);
        });

        // 3. 展开编辑区域内部隔离：禁止点击编辑面板向外冒泡
        $list.on('click.spStudio mousedown.spStudio', '.sp-item-editor-body', (e) => {
            e.stopPropagation();
        });

        // 4. 内置功能 Tab 切换
        $list.on('click.spStudio', '.sp-feature-tab-btn', (e) => {
            e.stopPropagation();
            const featId = $(e.currentTarget).data('feature-id');
            const $card = $(e.currentTarget).closest('.sp-prompt-item');
            PromptManager.setActiveFeatureKey(featId);

            // 重新刷新该卡片的内部编辑器
            const slot = PromptManager.getAppFeaturesSlot();
            if (slot) {
                $card.find('.sp-item-editor-body').html(this._generateFeaturesSlotEditorHtml(slot));
                // 更新卡片摘要
                const curFeat = slot.features?.[featId];
                if (curFeat) {
                    const count = Object.keys(slot.features || {}).length;
                    const snippet = `当前配置: 【${curFeat.name}】 · 输入规则 & 回复规则 · 共 ${count} 个内置功能`;
                    $card.find('.sp-item-snippet').text(snippet).attr('title', snippet);
                }
            }
        });

        // 5. 点击“+ 新加内置功能”按钮展开/收起内联输入抽屉
        $list.on('click.spStudio', '.sp-btn-add-feature-toggle', (e) => {
            e.stopPropagation();
            const $drawer = $(e.currentTarget).closest('.sp-features-slot-editor').find('.sp-new-feature-drawer');
            $drawer.slideToggle(160, () => {
                if ($drawer.is(':visible')) {
                    $drawer.find('.sp-new-feat-key').focus();
                }
            });
        });

        // 6. 取消新增内置功能
        $list.on('click.spStudio', '.sp-cancel-add-feature-btn', (e) => {
            e.stopPropagation();
            $(e.currentTarget).closest('.sp-new-feature-drawer').slideUp(160);
        });

        // 7. 确认新增内置功能
        $list.on('click.spStudio', '.sp-confirm-add-feature-btn', (e) => {
            e.stopPropagation();
            const $editor = $(e.currentTarget).closest('.sp-features-slot-editor');
            const $keyInput = $editor.find('.sp-new-feat-key');
            const $nameInput = $editor.find('.sp-new-feat-name');

            const key = $keyInput.val().trim();
            const name = $nameInput.val().trim() || key;

            if (!key) {
                if (typeof toastr !== 'undefined') toastr.warning('请输入功能标识，如 wechat / sms', 'SmallPhone');
                $keyInput.focus();
                return;
            }

            try {
                PromptManager.addAppFeature(key, name);
                const slot = PromptManager.getAppFeaturesSlot();
                const $card = $editor.closest('.sp-prompt-item');
                $card.find('.sp-item-editor-body').html(this._generateFeaturesSlotEditorHtml(slot));
                
                // 更新卡片头部摘要
                const count = Object.keys(slot.features || {}).length;
                const snippet = `当前配置: 【${name}】 · 输入规则 & 回复规则 · 共 ${count} 个内置功能`;
                $card.find('.sp-item-snippet').text(snippet).attr('title', snippet);

                this._notifyChange();

                try {
                    OperationLogService.log({
                        module: '提示词',
                        action: '添加内置功能',
                        status: 'success',
                        detail: `功能: ${name} (${key})`,
                    });
                } catch (_) {}

                if (typeof toastr !== 'undefined') toastr.success(`已成功新增内置功能【${name}】！现在可开始编辑输入规则与回复规则。`, 'SmallPhone');
            } catch (err) {
                if (typeof toastr !== 'undefined') toastr.error(err.message, 'SmallPhone');
            }
        });

        // 8. 删除自定义内置功能
        $list.on('click.spStudio', '.sp-feature-tab-del-btn', (e) => {
            e.stopPropagation();
            const featId = $(e.currentTarget).data('feature-id');
            if (confirm(`确认删除内置功能【${featId}】吗？`)) {
                try {
                    PromptManager.deleteAppFeature(featId);
                    const slot = PromptManager.getAppFeaturesSlot();
                    const $card = $(e.currentTarget).closest('.sp-prompt-item');
                    $card.find('.sp-item-editor-body').html(this._generateFeaturesSlotEditorHtml(slot));
                    this._notifyChange();

                    try {
                        OperationLogService.log({
                            module: '提示词',
                            action: '删除内置功能',
                            status: 'info',
                            detail: `功能: ${featId}`,
                        });
                    } catch (_) {}

                    if (typeof toastr !== 'undefined') toastr.info('内置功能已删除', 'SmallPhone');
                } catch (err) {
                    if (typeof toastr !== 'undefined') toastr.error(err.message, 'SmallPhone');
                }
            }
        });

        // 9. 输入规则修改保存
        $list.on('input.spStudio', '.sp-feat-input-textarea', (e) => {
            const featId = $(e.target).data('feature-id');
            const val = $(e.target).val();
            PromptManager.updateAppFeature(featId, { inputRule: val });
            this._notifyChange();
        });
        $list.on('change.spStudio', '.sp-feat-input-textarea', (e) => {
            const featId = $(e.target).data('feature-id');
            try {
                OperationLogService.log({
                    module: '提示词',
                    action: '保存输入规则',
                    status: 'success',
                    detail: `功能: ${featId}`,
                });
            } catch (_) {}
        });

        // 10. 回复规则修改保存
        $list.on('input.spStudio', '.sp-feat-reply-textarea', (e) => {
            const featId = $(e.target).data('feature-id');
            const val = $(e.target).val();
            PromptManager.updateAppFeature(featId, { replyRule: val });
            this._notifyChange();
        });
        $list.on('change.spStudio', '.sp-feat-reply-textarea', (e) => {
            const featId = $(e.target).data('feature-id');
            try {
                OperationLogService.log({
                    module: '提示词',
                    action: '保存回复规则',
                    status: 'success',
                    detail: `功能: ${featId}`,
                });
            } catch (_) {}
        });

        // 11. 切换启用/禁用状态
        $list.on('change.spStudio', '.sp-item-enable-toggle', (e) => {
            e.stopPropagation();
            const id = $(e.target).data('id');
            const enabled = $(e.target).is(':checked');
            PromptManager.updateItem(id, { enabled });
            $(e.target).closest('.sp-prompt-item').toggleClass('is-disabled', !enabled);
            this._notifyChange();
        });

        // 12. 删除普通条目
        $list.on('click.spStudio', '.sp-item-delete-btn', (e) => {
            e.stopPropagation();
            const id = $(e.currentTarget).data('id');
            if (confirm('确认删除此提示词条目吗？')) {
                this.expandedItemIds.delete(id);
                PromptManager.deleteItem(id);
                this._renderListItems();
                this._notifyChange();
            }
        });

        // 13. 快速微调上移
        $list.on('click.spStudio', '.sp-move-up', (e) => {
            e.stopPropagation();
            const idx = parseInt($(e.currentTarget).data('index'), 10);
            if (idx > 0) {
                PromptManager.moveItem(idx, idx - 1);
                this._renderListItems();
                this._notifyChange();
            }
        });

        // 14. 快速微调下移
        $list.on('click.spStudio', '.sp-move-down', (e) => {
            e.stopPropagation();
            const idx = parseInt($(e.currentTarget).data('index'), 10);
            PromptManager.moveItem(idx, idx + 1);
            this._renderListItems();
            this._notifyChange();
        });

        // 15. 修改普通条目标题
        $list.on('change.spStudio input.spStudio', '.sp-edit-name', (e) => {
            const id = $(e.target).data('id');
            const name = $(e.target).val().trim() || '提示词条目';
            PromptManager.updateItem(id, { name });
            $(e.target).closest('.sp-prompt-item').find('.sp-item-name').text(name);
            this._notifyChange();
        });

        // 16. 修改普通条目角色
        $list.on('change.spStudio', '.sp-edit-role', (e) => {
            const id = $(e.target).data('id');
            const role = $(e.target).val();
            PromptManager.updateItem(id, { role });
            const $pill = $(e.target).closest('.sp-prompt-item').find('.sp-role-pill');
            $pill.text(role.toUpperCase()).attr('class', `sp-role-pill role-${role}`);
            this._notifyChange();
        });

        // 17. 修改普通条目适用应用范围
        $list.on('change.spStudio', '.sp-edit-scope', (e) => {
            const id = $(e.target).data('id');
            const appScope = $(e.target).val();
            PromptManager.updateItem(id, { appScope });
            this._renderListItems();
            this._notifyChange();
        });

        // 18. 修改普通条目内容
        $list.on('change.spStudio input.spStudio', '.sp-edit-content', (e) => {
            const id = $(e.target).data('id');
            const content = $(e.target).val();
            PromptManager.updateItem(id, { content });
            const snippet = content ? content.slice(0, 50) + (content.length > 50 ? '...' : '') : '(点击展开编辑具体内容)';
            $(e.target).closest('.sp-prompt-item').find('.sp-item-snippet').text(snippet);
            this._notifyChange();
        });

        // 19. 刷新正文历史记录插槽
        $list.on('click.spStudio', '.sp-refresh-history-btn', (e) => {
            e.stopPropagation();
            this._renderListItems();
            if (typeof toastr !== 'undefined') toastr.info('正文上下文记录已刷新！', 'SmallPhone');
        });

        // 20. 拖拽手柄精准激活拖拽
        $list.on('mousedown.spStudio', '.sp-drag-handle', (e) => {
            $(e.currentTarget).closest('.sp-prompt-item').attr('draggable', 'true');
        });
        $list.on('mouseup.spStudio mouseleave.spStudio', '.sp-drag-handle', () => {
            $list.find('.sp-prompt-item').attr('draggable', 'false');
        });

        // 21. HTML5 拖拽事件监听
        $list.on('dragstart.spStudio', '.sp-prompt-item', (e) => {
            const index = parseInt($(e.currentTarget).data('index'), 10);
            this.dragSrcIndex = index;
            $(e.currentTarget).addClass('is-dragging');
            e.originalEvent.dataTransfer.effectAllowed = 'move';
            e.originalEvent.dataTransfer.setData('text/plain', String(index));
        });

        $list.on('dragover.spStudio', '.sp-prompt-item', (e) => {
            e.preventDefault();
            e.originalEvent.dataTransfer.dropEffect = 'move';
            $(e.currentTarget).addClass('is-drag-over');
        });

        $list.on('dragleave.spStudio', '.sp-prompt-item', (e) => {
            $(e.currentTarget).removeClass('is-drag-over');
        });

        $list.on('drop.spStudio', '.sp-prompt-item', (e) => {
            e.preventDefault();
            e.stopPropagation();
            $(e.currentTarget).removeClass('is-drag-over');
            const targetIndex = parseInt($(e.currentTarget).data('index'), 10);

            if (this.dragSrcIndex !== null && this.dragSrcIndex !== targetIndex) {
                PromptManager.moveItem(this.dragSrcIndex, targetIndex);
                this._renderListItems();
                this._notifyChange();
                if (typeof toastr !== 'undefined') toastr.info('条目顺序已更新！', 'SmallPhone');
            }
        });

        $list.on('dragend.spStudio', () => {
            $list.find('.sp-prompt-item').removeClass('is-dragging is-drag-over').attr('draggable', 'false');
            this.dragSrcIndex = null;
        });
    }

    _notifyChange() {
        if (typeof this.onItemsChanged === 'function') {
            this.onItemsChanged();
        }
    }
}

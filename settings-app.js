import { SettingsManager } from './settings-manager.js';
import { ApiService } from './api-service.js';
import { PromptManager } from './prompt-manager.js';
import { PromptStudio } from './prompt-studio.js';
import { OperationLogService } from './operation-log-service.js';

/**
 * SettingsApp 类：管理小手机内部的“设置”界面与“API 配置”子模块
 */
export class SettingsApp {
    constructor({ onBackToHome }) {
        this.onBackToHome = onBackToHome;
        this.container = null;
        this.availableProfiles = [];
    }

    /**
     * 构建设置页面的 HTML 结构
     */
    render() {
        const savedApi = SettingsManager.getApiConfig();
        const savedPrompt = SettingsManager.getPromptConfig();
        const savedMemory = SettingsManager.getMemoryConfig();
        const currentFontSize = SettingsManager.getChatFontSize();
        const maxTokens = Number(savedApi.maxTokens || 300000);
        const maxTokensText = `${(maxTokens / 10000).toFixed(0)}万字`;
        const apiSummaryText = savedApi.model || (savedApi.selectedProfile ? '已选预设' : '未配置');
        const memorySummaryText = savedMemory.chatHistoryDepth > 0
            ? `${savedMemory.chatHistoryDepth}条 (${(savedMemory.chatHistoryDepth / 2).toFixed(1).replace('.0', '')}轮)`
            : '已关闭 (0条)';


        const template = `
            <div class="small-phone-app-page small-phone-settings-page" id="small-phone-settings-page">
                <!-- iOS 风格设置应用顶栏 -->
                <div class="sp-page-header">
                    <button type="button" class="sp-header-back-btn" id="sp-settings-back-btn" title="返回主屏幕">
                        <i class="fa-solid fa-chevron-left"></i> 桌面
                    </button>
                    <span class="sp-header-title">设置</span>
                    <div style="width: 48px;"></div> <!-- 保持对称 -->
                </div>

                <!-- 设置内容滚动区 -->
                <div class="sp-page-body">
                    <!-- 模块 1：API 配置模块 (默认收起 is-collapsed) -->
                    <div class="sp-settings-group is-collapsed" data-group="api">
                        <div class="sp-group-header" role="button" tabindex="0" title="点击展开/收起">
                            <div class="sp-group-header-left">
                                <i class="fa-solid fa-server sp-group-icon"></i>
                                <span class="sp-group-title-text">API 接口与模型配置</span>
                            </div>
                            <div class="sp-group-header-right">
                                <span class="sp-group-badge" id="sp-api-summary-badge">${apiSummaryText}</span>
                                <i class="fa-solid fa-chevron-right sp-group-chevron"></i>
                            </div>
                        </div>
                        
                        <div class="sp-group-body">
                            <div class="sp-group-inner">
                                <div class="sp-card">
                                    <!-- 预设连接选择 -->
                                    <div class="sp-form-item">
                                        <label for="sp-setting-profile-select">选择酒馆预设连接</label>
                                        <div class="sp-select-wrapper">
                                            <select id="sp-setting-profile-select" class="sp-select">
                                                <option value="">正在读取预设连接...</option>
                                            </select>
                                            <i class="fa-solid fa-chevron-down sp-select-arrow"></i>
                                        </div>
                                        <span class="sp-field-hint">直接读取当前酒馆已保存的预设连接（可与正文使用不同连接）</span>
                                    </div>

                                    <!-- 端点 URL -->
                                    <div class="sp-form-item">
                                        <label for="sp-setting-api-url">API 端点 (URL)</label>
                                        <input type="text" id="sp-setting-api-url" class="sp-input" placeholder="https://api.openai.com/v1" value="${savedApi.apiUrl || ''}" />
                                    </div>

                                    <!-- 模型选择与拉取 -->
                                    <div class="sp-form-item">
                                        <div class="sp-item-header-inline">
                                            <label for="sp-setting-model-select">模型名称 (Model)</label>
                                            <button type="button" class="sp-btn-link" id="sp-setting-fetch-models-btn" title="向服务端查询可用模型">
                                                <i class="fa-solid fa-arrows-rotate"></i> 拉取模型
                                            </button>
                                        </div>
                                        <div class="sp-select-wrapper">
                                            <select id="sp-setting-model-select" class="sp-select">
                                                ${savedApi.model ? `<option value="${savedApi.model}">${savedApi.model}</option>` : '<option value="">请先拉取或直接输入</option>'}
                                            </select>
                                            <i class="fa-solid fa-chevron-down sp-select-arrow"></i>
                                        </div>
                                        <input type="text" id="sp-setting-custom-model" class="sp-input" style="margin-top: 6px;" placeholder="或在此手动输入自定义模型" value="${savedApi.model || ''}" />
                                    </div>

                                    <!-- 温度调节 -->
                                    <div class="sp-form-item">
                                        <div class="sp-item-header-inline">
                                            <label for="sp-setting-temp-slider">温度 (Temperature)</label>
                                            <span class="sp-temp-badge" id="sp-temp-val">${Number(savedApi.temperature ?? 0.9).toFixed(2)}</span>
                                        </div>
                                        <input type="range" id="sp-setting-temp-slider" class="sp-slider" min="0" max="2" step="0.05" value="${savedApi.temperature ?? 0.9}" />
                                        <div class="sp-slider-labels">
                                            <span>严谨 (0.0)</span>
                                            <span>推荐 (0.9)</span>
                                            <span>发散 (2.0)</span>
                                        </div>
                                    </div>

                                    <!-- 最大词符数 (Max Tokens) 调节 -->
                                    <div class="sp-form-item">
                                        <div class="sp-item-header-inline">
                                            <label for="sp-setting-max-tokens">最大词符数 (Max Tokens)</label>
                                            <span class="sp-temp-badge" id="sp-max-tokens-badge">${maxTokensText} (${maxTokens})</span>
                                        </div>
                                        <input type="number" id="sp-setting-max-tokens" class="sp-input" min="1000" max="2000000" step="10000" value="${maxTokens}" placeholder="300000" />
                                        <div class="sp-quick-tags-row">
                                            <button type="button" class="sp-tag-btn ${maxTokens === 50000 ? 'is-active' : ''}" data-tokens="50000">5万 (50k)</button>
                                            <button type="button" class="sp-tag-btn ${maxTokens === 100000 ? 'is-active' : ''}" data-tokens="100000">10万 (100k)</button>
                                            <button type="button" class="sp-tag-btn ${maxTokens === 300000 ? 'is-active' : ''}" data-tokens="300000">30万 (300k, 默认)</button>
                                            <button type="button" class="sp-tag-btn ${maxTokens === 500000 ? 'is-active' : ''}" data-tokens="500000">50万 (500k)</button>
                                            <button type="button" class="sp-tag-btn ${maxTokens === 1000000 ? 'is-active' : ''}" data-tokens="1000000">100万 (1M)</button>
                                        </div>
                                        <span class="sp-field-hint" style="margin-top: 6px;">单次请求 AI 回复的最大词符生成上限。现已从原先硬编码 5 万升级为默认 300,000 (30万)</span>
                                    </div>

                                    <!-- 保存按钮 -->
                                    <div class="sp-form-actions">
                                        <button type="button" class="sp-btn sp-btn-primary" id="sp-setting-save-btn">
                                            <i class="fa-solid fa-floppy-disk"></i> 保存 API 配置
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 模块 2：提示词与注入 (默认收起 is-collapsed) -->
                    <div class="sp-settings-group is-collapsed" data-group="prompt">
                        <div class="sp-group-header" role="button" tabindex="0" title="点击展开/收起">
                            <div class="sp-group-header-left">
                                <i class="fa-solid fa-wand-magic-sparkles sp-group-icon"></i>
                                <span class="sp-group-title-text">提示词与注入</span>
                            </div>
                            <div class="sp-group-header-right">
                                <span class="sp-group-badge" id="sp-prompt-summary-badge">${savedPrompt.useTavernPreset ? '预设注入: 开' : '预设注入: 关'}</span>
                                <i class="fa-solid fa-chevron-right sp-group-chevron"></i>
                            </div>
                        </div>

                        <div class="sp-group-body">
                            <div class="sp-group-inner">
                                <div class="sp-card">
                                    <!-- 区域 1：酒馆预设选项 -->
                                    <div class="sp-section-block">
                                        <div class="sp-section-title">
                                            <span>预设上下文集成</span>
                                        </div>
                                        <div class="sp-switch-row">
                                            <div class="sp-switch-info">
                                                <label for="sp-setting-use-tavern-preset" class="sp-switch-label">使用酒馆预设</label>
                                                <span class="sp-field-hint">开启后向 AI 发消息将自动附带当前酒馆预设条目（System Prompt、角色设定等）；关闭则仅发送纯净输入</span>
                                            </div>
                                            <label class="sp-switch">
                                                <input type="checkbox" id="sp-setting-use-tavern-preset" ${savedPrompt.useTavernPreset ? 'checked' : ''} />
                                                <span class="sp-switch-slider"></span>
                                            </label>
                                        </div>
                                    </div>

                                    <!-- 区域 2：可拖拽与可修改的预设条目工作区 (当开启使用酒馆预设后展示) -->
                                    <div class="sp-prompt-studio-wrapper" id="sp-prompt-studio-wrapper" style="${savedPrompt.useTavernPreset ? '' : 'display: none;'}">
                                        <div class="sp-divider"></div>
                                        <div class="sp-section-block">
                                            <div class="sp-section-title">
                                                <span>激活条目编排与拖拽排序</span>
                                            </div>
                                            <div id="sp-prompt-studio-mount"></div>
                                        </div>
                                    </div>

                                    <div class="sp-divider"></div>

                                    <!-- 区域 3：接口连接与发送测试 -->
                                    <div class="sp-section-block">
                                        <div class="sp-section-title">
                                            <span>接口连接测试</span>
                                        </div>
                                        <div class="sp-form-item" style="margin-bottom: 8px;">
                                            <label for="sp-test-scenario-select">测试场景模式 (模拟激活对应输入与规则)</label>
                                            <div class="sp-select-wrapper">
                                                <select id="sp-test-scenario-select" class="sp-select">
                                                    <option value="default">默认场景 (单条消息测试“你好”)</option>
                                                    <option value="qq">QQ 聊天场景 (激活 QQ 输入模板 + QQ 规则)</option>
                                                    <option value="x">X (推特) 场景 (激活 X 输入模板 + X 规则)</option>
                                                    <option value="taobao">淘宝 场景 (激活 淘宝 输入模板 + 淘宝 规则)</option>
                                                </select>
                                                <i class="fa-solid fa-chevron-down sp-select-arrow"></i>
                                            </div>
                                        </div>
                                        <div class="sp-test-action-row">
                                            <button type="button" class="sp-btn sp-btn-secondary" id="sp-setting-test-msg-btn">
                                                <i class="fa-solid fa-paper-plane"></i> 发送场景测试
                                            </button>
                                        </div>
                                        <span class="sp-field-hint" style="margin-top: 6px;">按当前配置调用模型，自动激活该场景下的专属输入格式与回复规则</span>

                                        <!-- 测试结果反馈卡片（初始隐藏） -->
                                        <div class="sp-test-result-box" id="sp-test-result-box" style="display: none;">
                                            <div class="sp-test-result-header">
                                                <div class="sp-test-status" id="sp-test-status">
                                                    <i class="fa-solid fa-circle-check"></i> 测试完成
                                                </div>
                                                <span class="sp-test-meta" id="sp-test-meta">耗时 0ms</span>
                                            </div>
                                            <div class="sp-test-details" id="sp-test-details">已注入 0 条酒馆预设</div>
                                            <div class="sp-test-content-scroll">
                                                <div class="sp-test-content" id="sp-test-content"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 模块 3：记忆管理 (默认收起 is-collapsed) -->
                    <div class="sp-settings-group is-collapsed" data-group="memory">
                        <div class="sp-group-header" role="button" tabindex="0" title="点击展开/收起">
                            <div class="sp-group-header-left">
                                <i class="fa-solid fa-brain sp-group-icon"></i>
                                <span class="sp-group-title-text">记忆管理</span>
                            </div>
                            <div class="sp-group-header-right">
                                <span class="sp-group-badge" id="sp-memory-summary-badge">${memorySummaryText}</span>
                                <i class="fa-solid fa-chevron-right sp-group-chevron"></i>
                            </div>
                        </div>

                        <div class="sp-group-body">
                            <div class="sp-group-inner">
                                <div class="sp-card">
                                    <div class="sp-section-block">
                                        <div class="sp-section-title">
                                            <span>正文上下文读取深度</span>
                                        </div>
                                        <div class="sp-form-item">
                                            <div class="sp-item-header-inline">
                                                <label for="sp-setting-history-depth-slider">正文消息记录数 (含用户输入)</label>
                                                <span class="sp-temp-badge" id="sp-history-depth-val">${savedMemory.chatHistoryDepth} 条</span>
                                            </div>
                                            <div class="sp-slider-row">
                                                <input type="range" id="sp-setting-history-depth-slider" class="sp-slider" min="0" max="30" step="1" value="${savedMemory.chatHistoryDepth}" />
                                                <input type="number" id="sp-setting-history-depth-number" class="sp-input sp-input-number-compact" min="0" max="100" value="${savedMemory.chatHistoryDepth}" />
                                            </div>
                                            <div class="sp-slider-labels">
                                                <span>不读取 (0)</span>
                                                <span>推荐 (6条/3轮)</span>
                                                <span>深上下文 (30条)</span>
                                            </div>
                                        </div>

                                        <!-- 实时轮数换算与模式说明卡片 -->
                                        <div class="sp-memory-status-box">
                                            <div class="sp-memory-status-icon">
                                                <i class="fa-solid fa-circle-nodes"></i>
                                            </div>
                                            <div class="sp-memory-status-text" id="sp-memory-rounds-hint">
                                                <!-- 由 _bindEvents 动态初始化填充 -->
                                            </div>
                                        </div>
                                        
                                        <span class="sp-field-hint" style="margin-top: 8px;">
                                            在正文聊天中，用户与角色各发言一次构成 1 轮（2 条记录）。设为 6 即读取正文最近 3 轮对话上下文；设为 0 则不读取正文。已同步更新提示词模块中的【正文历史记录插槽】。
                                        </span>
                                    </div>

                                    <!-- 保存按钮 -->
                                    <div class="sp-form-actions">
                                        <button type="button" class="sp-btn sp-btn-primary" id="sp-setting-save-memory-btn">
                                            <i class="fa-solid fa-floppy-disk"></i> 保存记忆配置
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 模块 4：界面显示与正文字号 (默认收起 is-collapsed) -->
                    <div class="sp-settings-group is-collapsed" data-group="display">
                        <div class="sp-group-header" role="button" tabindex="0" title="点击展开/收起">
                            <div class="sp-group-header-left">
                                <i class="fa-solid fa-text-height sp-group-icon"></i>
                                <span class="sp-group-title-text">界面显示与正文字号</span>
                            </div>
                            <div class="sp-group-header-right">
                                <span class="sp-group-badge" id="sp-display-summary-badge">正文: ${currentFontSize}px</span>
                                <i class="fa-solid fa-chevron-right sp-group-chevron"></i>
                            </div>
                        </div>

                        <div class="sp-group-body">
                            <div class="sp-group-inner">
                                <div class="sp-card">
                                    <div class="sp-section-block">
                                        <div class="sp-section-title">
                                            <span>聊天正文字体大小调节</span>
                                        </div>
                                        <div class="sp-form-item">
                                            <div class="sp-item-header-inline">
                                                <label for="sp-setting-font-size-slider">正文字号 (Font Size)</label>
                                                <span class="sp-temp-badge" id="sp-font-size-val">${currentFontSize} px</span>
                                            </div>

                                            <!-- 精细调节控制行：减号 + 滑块 + 加号 + 精确数值输入 -->
                                            <div class="sp-font-adjust-row">
                                                <button type="button" class="sp-font-adjust-btn" id="sp-font-size-minus" title="减少 0.5px">
                                                    <i class="fa-solid fa-minus"></i>
                                                </button>
                                                <input type="range" id="sp-setting-font-size-slider" class="sp-slider" min="9.0" max="20.0" step="0.5" value="${currentFontSize}" style="flex: 1;" />
                                                <button type="button" class="sp-font-adjust-btn" id="sp-font-size-plus" title="增加 0.5px">
                                                    <i class="fa-solid fa-plus"></i>
                                                </button>
                                                <input type="number" id="sp-setting-font-size-number" class="sp-input sp-input-number-compact" min="8" max="28" step="0.5" value="${currentFontSize}" style="width: 58px; text-align: center;" />
                                            </div>

                                            <div class="sp-slider-labels">
                                                <span>紧凑 (9px)</span>
                                                <span>默认 (11.5px)</span>
                                                <span>大字 (16px)</span>
                                                <span>超大 (20px)</span>
                                            </div>

                                            <div style="display: flex; justify-content: flex-end; margin-top: 6px;">
                                                <button type="button" class="sp-btn-link" id="sp-font-size-reset-btn" title="一键恢复到默认大小">
                                                    <i class="fa-solid fa-rotate-left"></i> 恢复默认 (11.5px)
                                                </button>
                                            </div>

                                            <!-- 实时高仿真预览卡片 -->
                                            <div class="sp-font-preview-box">
                                                <div class="sp-font-preview-title">
                                                    <i class="fa-solid fa-eye"></i> 实时正文字号预览效果
                                                </div>
                                                <div style="display: flex; gap: 6px; align-items: flex-start; margin-top: 4px;">
                                                    <div style="width: 20px; height: 20px; border-radius: 50%; background-color: #ec4899; color: #fff; font-size: 9.5px; font-weight: 700; display: flex; align-items: center; justify-content: center; line-height: 1; flex-shrink: 0; margin-top: 1px;">小</div>
                                                    <div style="display: flex; flex-direction: column; align-items: flex-start; max-width: 82%;">
                                                        <div style="font-size: 9.5px; color: rgba(255, 255, 255, 0.55); margin-bottom: 2px; padding-left: 2px; line-height: 1;">小春乃绘</div>
                                                        <div class="sp-qq-msg-bubble" id="sp-font-preview-bubble" style="background: rgba(30, 41, 59, 0.9); border: 1px solid rgba(255, 255, 255, 0.1); color: #f1f5f9; border-radius: 3px 8px 8px 8px; padding: 3px 8px; line-height: 1.35; font-size: var(--sp-chat-font-size, 11.5px);">
                                                            主人辛苦啦！这是聊天正文字号预览，拖动滑块即可精细微调哦♡
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <span class="sp-field-hint" style="margin-top: 8px;">
                                                精细化控制小手机内 QQ 单聊与群聊气泡中的正文字号大小。支持 0.5px 精细步进调节，修改实时生效并自动保存。
                                            </span>
                                        </div>

                                        <!-- 保存按钮 -->
                                        <div class="sp-form-actions">
                                            <button type="button" class="sp-btn sp-btn-primary" id="sp-setting-save-display-btn">
                                                <i class="fa-solid fa-floppy-disk"></i> 保存显示配置
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 模块 5：关于 (默认收起 is-collapsed) -->
                    <div class="sp-settings-group is-collapsed" data-group="about">
                        <div class="sp-group-header" role="button" tabindex="0" title="点击展开/收起">
                            <div class="sp-group-header-left">
                                <i class="fa-solid fa-circle-info sp-group-icon"></i>
                                <span class="sp-group-title-text">关于 SmallPhone</span>
                            </div>
                            <div class="sp-group-header-right">
                                <span class="sp-group-badge">v1.0</span>
                                <i class="fa-solid fa-chevron-right sp-group-chevron"></i>
                            </div>
                        </div>
                        <div class="sp-group-body">
                            <div class="sp-group-inner">
                                <div class="sp-card sp-about-card">
                                    <div class="sp-about-item">
                                        <span>版本</span>
                                        <span class="sp-text-muted">SmallPhone v1.0</span>
                                    </div>
                                    <div class="sp-about-item">
                                        <span>解耦状态</span>
                                        <span class="sp-tag-success">模块化就绪</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.container = $(template);
        this._bindEvents();
        this.refreshProfiles();
        return this.container;
    }

    /**
     * 绑定页面交互事件
     */
    _bindEvents() {
        if (!this.container) return;

        // 返回桌面
        this.container.find('#sp-settings-back-btn').on('click', () => {
            if (typeof this.onBackToHome === 'function') {
                this.onBackToHome();
            }
        });

        // 手风琴折叠/展开模块控制：点击模块头部切换展开/收起
        this.container.find('.sp-group-header').on('click', (e) => {
            const $header = $(e.currentTarget);
            const $group = $header.closest('.sp-settings-group');
            $group.toggleClass('is-collapsed');
        });

        // 键盘无障碍支持（Enter 或 Space 展开/收起）
        this.container.find('.sp-group-header').on('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                $(e.currentTarget).trigger('click');
            }
        });

        // 预设选择改变 -> 联动填充 URL 与默认 Model
        this.container.find('#sp-setting-profile-select').on('change', (e) => {
            const selectedId = $(e.target).val();
            const profile = this.availableProfiles.find(p => p.id === selectedId);
            if (profile) {
                if (profile.url && profile.url !== '(默认端点)') {
                    this.container.find('#sp-setting-api-url').val(profile.url);
                }
                if (profile.model) {
                    this.container.find('#sp-setting-custom-model').val(profile.model);
                    // 补充到 select 里
                    const $modelSelect = this.container.find('#sp-setting-model-select');
                    if ($modelSelect.find(`option[value="${profile.model}"]`).length === 0) {
                        $modelSelect.append(new Option(profile.model, profile.model, true, true));
                    } else {
                        $modelSelect.val(profile.model);
                    }
                }
            }
        });

        // 模型下拉改变 -> 同步到手动输入框
        this.container.find('#sp-setting-model-select').on('change', (e) => {
            const val = $(e.target).val();
            if (val) {
                this.container.find('#sp-setting-custom-model').val(val);
            }
        });

        // 手动输入模型 -> 同步回下拉
        this.container.find('#sp-setting-custom-model').on('input', (e) => {
            const val = $(e.target).val().trim();
            const $modelSelect = this.container.find('#sp-setting-model-select');
            if (val && $modelSelect.find(`option[value="${val}"]`).length === 0) {
                $modelSelect.append(new Option(val, val, true, true));
            } else if (val) {
                $modelSelect.val(val);
            }
        });

        // 温度滑块滑动 -> 实时更新数值显示
        this.container.find('#sp-setting-temp-slider').on('input', (e) => {
            const val = parseFloat($(e.target).val());
            this.container.find('#sp-temp-val').text(val.toFixed(2));
        });

        // 最大词符数输入监听 -> 同步徽章
        const $maxTokensInput = this.container.find('#sp-setting-max-tokens');
        const $maxTokensBadge = this.container.find('#sp-max-tokens-badge');
        const updateMaxTokensBadge = (val) => {
            const num = parseInt(val, 10);
            if (!isNaN(num) && num > 0) {
                const wan = (num / 10000).toFixed(0);
                $maxTokensBadge.text(`${wan}万字 (${num})`);
            } else {
                $maxTokensBadge.text('默认 (30万)');
            }
        };

        $maxTokensInput.on('input change', (e) => {
            updateMaxTokensBadge($(e.target).val());
        });

        // 最大词符数快捷标签点击
        this.container.find('.sp-quick-tags-row .sp-tag-btn').on('click', (e) => {
            const tokens = $(e.currentTarget).data('tokens');
            $maxTokensInput.val(tokens);
            updateMaxTokensBadge(tokens);
            this.container.find('.sp-quick-tags-row .sp-tag-btn').removeClass('is-active');
            $(e.currentTarget).addClass('is-active');
        });

        // 拉取模型按钮点击
        this.container.find('#sp-setting-fetch-models-btn').on('click', async () => {
            await this.handleFetchModels();
        });

        // 保存配置按钮点击
        this.container.find('#sp-setting-save-btn').on('click', () => {
            this.handleSave();
        });

        // 初始化 PromptStudio 条目编排与拖拽工作区
        const $studioMount = this.container.find('#sp-prompt-studio-mount');
        this.promptStudio = new PromptStudio({
            container: $studioMount,
            onItemsChanged: () => {
                // 条目发生变动（如拖拽重排、修改、增删）时的回调
            },
        });
        this.promptStudio.render();

        // 切换“是否使用酒馆预设” -> 动态展开/收起条目工作区
        this.container.find('#sp-setting-use-tavern-preset').on('change', (e) => {
            const isChecked = $(e.target).is(':checked');
            SettingsManager.savePromptConfig({ useTavernPreset: isChecked });
            this.container.find('#sp-prompt-summary-badge').text(isChecked ? '预设注入: 开' : '预设注入: 关');

            const $wrapper = this.container.find('#sp-prompt-studio-wrapper');
            if (isChecked) {
                $wrapper.slideDown(200);
                this.promptStudio.render();
            } else {
                $wrapper.slideUp(200);
            }

            if (typeof toastr !== 'undefined') {
                toastr.info(isChecked ? '已开启酒馆预设注入，激活条目已展开' : '已关闭酒馆预设注入', 'SmallPhone');
            }
        });

        // 记忆管理：滑块与数字输入框联动计算
        const $depthSlider = this.container.find('#sp-setting-history-depth-slider');
        const $depthNumber = this.container.find('#sp-setting-history-depth-number');
        const $depthBadge = this.container.find('#sp-history-depth-val');
        const $roundsHint = this.container.find('#sp-memory-rounds-hint');

        const updateMemoryHint = (val) => {
            const num = Math.max(0, parseInt(val, 10) || 0);
            $depthBadge.text(`${num} 条`);
            const rounds = (num / 2).toFixed(1).replace('.0', '');
            let hintHtml = '';
            if (num === 0) {
                hintHtml = '<b>当前模式：纯净对话 (0条)</b><br>不向模型附带任何正文聊天记录，小手机作为完全独立的对话环境。';
            } else {
                hintHtml = `<b>当前模式：读取正文最近 ${num} 条消息 (约 ${rounds} 轮问答)</b><br>向 AI 发送消息时，将按先后顺序自动附带正文最新的 ${num} 条历史记录（含您的发言与角色回复）。`;
            }
            $roundsHint.html(hintHtml);
        };

        // 初始化提示
        updateMemoryHint($depthSlider.val());

        $depthSlider.on('input change', (e) => {
            const val = $(e.target).val();
            $depthNumber.val(val);
            updateMemoryHint(val);
        });

        $depthNumber.on('input change', (e) => {
            let val = parseInt($(e.target).val(), 10);
            if (isNaN(val) || val < 0) val = 0;
            if (val > 100) val = 100;
            $depthSlider.val(Math.min(val, 30));
            updateMemoryHint(val);
        });

        // 保存记忆配置
        this.container.find('#sp-setting-save-memory-btn').on('click', () => {
            let depth = parseInt($depthNumber.val(), 10);
            if (isNaN(depth) || depth < 0) depth = 0;

            SettingsManager.saveMemoryConfig({ chatHistoryDepth: depth });

            const rounds = (depth / 2).toFixed(1).replace('.0', '');
            const badgeText = depth > 0 ? `${depth}条 (${rounds}轮)` : '已关闭 (0条)';
            this.container.find('#sp-memory-summary-badge').text(badgeText);

            // 联动刷新提示词工作区中的正文历史插槽预览
            if (this.promptStudio) {
                this.promptStudio._renderListItems();
            }

            try {
                OperationLogService.log({
                    module: '系统设置',
                    action: '保存记忆配置',
                    status: 'success',
                    detail: `正文深度: ${depth} 条 (${rounds} 轮)`,
                });
            } catch (_) { }

            if (typeof toastr !== 'undefined') {
                toastr.success(`记忆配置已保存！正文上下文深度：${depth} 条 (${rounds} 轮)`, 'SmallPhone');
            } else {
                alert(`记忆配置已保存！正文上下文深度：${depth} 条`);
            }
        });

        // ------------------ 显示与正文字号事件绑定 ------------------
        const $fontSlider = this.container.find('#sp-setting-font-size-slider');
        const $fontNumber = this.container.find('#sp-setting-font-size-number');
        const $fontValBadge = this.container.find('#sp-font-size-val');
        const $fontSummaryBadge = this.container.find('#sp-display-summary-badge');
        const $previewBubble = this.container.find('#sp-font-preview-bubble');

        const syncFontSize = (val, shouldSave = false) => {
            let num = parseFloat(val);
            if (isNaN(num)) num = 11.5;
            num = Math.max(8.0, Math.min(28.0, num));
            const fixed = Math.round(num * 10) / 10;

            $fontSlider.val(fixed);
            $fontNumber.val(fixed);
            $fontValBadge.text(`${fixed} px`);
            $fontSummaryBadge.text(`正文: ${fixed}px`);

            // 实时应用到全局 CSS 变量与预览气泡
            SettingsManager.applyChatFontSize(fixed);
            if ($previewBubble.length > 0) {
                $previewBubble[0].style.setProperty('font-size', `${fixed}px`, 'important');
            }

            if (shouldSave) {
                SettingsManager.saveChatFontSize(fixed);
            }
            return fixed;
        };

        $fontSlider.on('input change', (e) => {
            syncFontSize($(e.target).val());
        });

        $fontNumber.on('input change', (e) => {
            syncFontSize($(e.target).val());
        });

        // 微调按钮：减少 0.5px
        this.container.find('#sp-font-size-minus').on('click', () => {
            const current = parseFloat($fontNumber.val()) || 11.5;
            syncFontSize(current - 0.5);
        });

        // 微调按钮：增加 0.5px
        this.container.find('#sp-font-size-plus').on('click', () => {
            const current = parseFloat($fontNumber.val()) || 11.5;
            syncFontSize(current + 0.5);
        });

        // 重置为默认 11.5px
        this.container.find('#sp-font-size-reset-btn').on('click', () => {
            syncFontSize(11.5, true);
            if (typeof toastr !== 'undefined') {
                toastr.info('已恢复正文字号为默认值: 11.5px', 'SmallPhone');
            }
        });

        // 保存显示配置
        this.container.find('#sp-setting-save-display-btn').on('click', () => {
            const finalSize = syncFontSize($fontNumber.val(), true);
            try {
                OperationLogService.log({
                    module: '系统设置',
                    action: '保存正文字号',
                    status: 'success',
                    detail: `正文字号: ${finalSize}px`,
                });
            } catch (_) { }

            if (typeof toastr !== 'undefined') {
                toastr.success(`正文字号已保存并生效！当前：${finalSize}px`, 'SmallPhone');
            } else {
                alert(`正文字号已保存并生效！当前：${finalSize}px`);
            }
        });

        // 点击测试键发送测试
        this.container.find('#sp-setting-test-msg-btn').on('click', async () => {
            await this.handleTestMessage();
        });
    }


    /**
     * 刷新可用预设连接列表
     */
    refreshProfiles() {
        if (!this.container) return;
        const $select = this.container.find('#sp-setting-profile-select');
        const savedApi = SettingsManager.getApiConfig();

        this.availableProfiles = ApiService.getAvailableProfiles();
        $select.empty();

        if (this.availableProfiles.length === 0) {
            $select.append('<option value="">暂无预设连接 (可在酒馆连接管理器中添加)</option>');
            return;
        }

        for (const p of this.availableProfiles) {
            const isSelected = p.id === savedApi.selectedProfile;
            const optionText = `${p.name} (${p.url || p.source || '内置'})`;
            $select.append(new Option(optionText, p.id, isSelected, isSelected));
        }

        // 如果未选过任何 profile，默认首个
        if (!savedApi.selectedProfile && this.availableProfiles.length > 0) {
            $select.val(this.availableProfiles[0].id).trigger('change');
        }
    }

    /**
     * 拉取模型列表处理
     */
    async handleFetchModels() {
        const $btn = this.container.find('#sp-setting-fetch-models-btn');
        const $select = this.container.find('#sp-setting-model-select');
        const selectedProfileId = this.container.find('#sp-setting-profile-select').val();
        const currentUrl = this.container.find('#sp-setting-api-url').val().trim();

        const profile = this.availableProfiles.find(p => p.id === selectedProfileId);
        const source = profile?.source || 'custom';

        $btn.prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> 拉取中...');

        try {
            const models = await ApiService.fetchModels({
                source: source,
                url: currentUrl,
                rawProfile: profile?.rawProfile,
            });

            if (!models || models.length === 0) {
                if (typeof toastr !== 'undefined') {
                    toastr.warning('未拉取到模型列表，您可以直接在下方手动输入模型名称', 'SmallPhone');
                }
                return;
            }

            // 填充到下拉框
            $select.empty();
            const currentModelVal = this.container.find('#sp-setting-custom-model').val().trim();

            for (const m of models) {
                const isSelected = m.id === currentModelVal;
                $select.append(new Option(m.name || m.id, m.id, isSelected, isSelected));
            }

            if (!currentModelVal && models.length > 0) {
                $select.val(models[0].id).trigger('change');
            }

            if (typeof toastr !== 'undefined') {
                toastr.success(`成功拉取到 ${models.length} 个可用模型！`, 'SmallPhone');
            }
        } catch (err) {
            if (typeof toastr !== 'undefined') {
                toastr.error(`拉取模型失败: ${err.message || err}`, 'SmallPhone');
            } else {
                alert(`拉取模型失败: ${err.message || err}`);
            }
        } finally {
            $btn.prop('disabled', false).html('<i class="fa-solid fa-arrows-rotate"></i> 拉取模型');
        }
    }

    /**
     * 保存配置到系统 JSON
     */
    handleSave() {
        const selectedProfile = this.container.find('#sp-setting-profile-select').val();
        const apiUrl = this.container.find('#sp-setting-api-url').val().trim();
        const model = this.container.find('#sp-setting-custom-model').val().trim();
        const temperature = parseFloat(this.container.find('#sp-setting-temp-slider').val());
        const maxTokens = parseInt(this.container.find('#sp-setting-max-tokens').val(), 10);

        const newConfig = {
            selectedProfile,
            apiUrl,
            model,
            temperature: isNaN(temperature) ? 0.9 : temperature,
            maxTokens: (!isNaN(maxTokens) && maxTokens > 0) ? maxTokens : 300000,
        };

        SettingsManager.saveApiConfig(newConfig);

        // 同步更新头部折叠时的概览胶囊
        const summaryText = newConfig.model || (newConfig.selectedProfile ? '已选预设' : '未配置');
        this.container.find('#sp-api-summary-badge').text(summaryText);

        try {
            OperationLogService.log({
                module: '系统设置',
                action: '保存API配置',
                status: 'success',
                detail: `模型: ${newConfig.model || '未指定'} | 预设: ${newConfig.selectedProfile || '直连'} | 最大词符: ${newConfig.maxTokens}`,
            });
        } catch (_) { }

        if (typeof toastr !== 'undefined') {
            toastr.success('SmallPhone API 配置已保存至系统！', 'SmallPhone');
        } else {
            alert('SmallPhone API 配置已保存！');
        }
    }

    /**
     * 处理发送“你好”测试消息
     */
    async handleTestMessage() {
        const $btn = this.container.find('#sp-setting-test-msg-btn');
        const $resultBox = this.container.find('#sp-test-result-box');
        const $status = this.container.find('#sp-test-status');
        const $meta = this.container.find('#sp-test-meta');
        const $details = this.container.find('#sp-test-details');
        const $content = this.container.find('#sp-test-content');

        const selectedScenario = this.container.find('#sp-test-scenario-select').val() || 'default';
        const scenarioText = this.container.find('#sp-test-scenario-select option:selected').text();
        const useTavernPreset = this.container.find('#sp-setting-use-tavern-preset').is(':checked');
        const promptItems = PromptManager.getPromptItems();
        const userInputItem = promptItems.find(it => it.isUserInputSlot);
        const testMessage = userInputItem?.content?.trim() || '你好';

        $btn.prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> 发送中...');
        $resultBox.slideDown(180);
        $status.attr('class', 'sp-test-status sp-status-loading').html(`<i class="fa-solid fa-spinner fa-spin"></i> 正在测试模式：${scenarioText}...`);
        $meta.text('请求中');
        $details.text(useTavernPreset ? `激活场景 [${selectedScenario}] 的专属输入模板与规则规范 (共注入 ${promptItems.filter(it => it.enabled).length} 项)...` : `发送单条测试：“${testMessage}” (未附加预设)...`);
        $content.text('等待响应中...');

        try {
            const result = await ApiService.sendTestMessage({
                appId: selectedScenario,
                message: testMessage,
                useTavernPreset: useTavernPreset,
            });

            $status.attr('class', 'sp-test-status sp-status-success').html('<i class="fa-solid fa-circle-check"></i> 测试成功');
            $meta.text(`耗时 ${result.timeMs}ms`);
            $details.text(useTavernPreset ? `已成功注入 [${selectedScenario}] 规则与输入模板 (共注入 ${result.presetCount} 项)` : '纯净单条消息 (未注入酒馆预设)');
            $content.text(result.reply || '(收到空响应)');

            if (typeof toastr !== 'undefined') {
                toastr.success('AI 回复测试成功！', 'SmallPhone');
            }

            try {
                OperationLogService.log({
                    module: '系统设置',
                    action: '测试连接',
                    status: 'success',
                    detail: `模式: ${selectedScenario} | 耗时: ${result.timeMs}ms`,
                });
            } catch (_) { }
        } catch (err) {
            $status.attr('class', 'sp-test-status sp-status-error').html('<i class="fa-solid fa-circle-xmark"></i> 测试失败');
            $meta.text('错误');
            $details.text('调用异常');
            $content.text(`错误详情: ${err.message || err}`);

            if (typeof toastr !== 'undefined') {
                toastr.error(`测试失败: ${err.message || err}`, 'SmallPhone');
            }

            try {
                const errMsg = (err?.message || String(err)).slice(0, 35);
                OperationLogService.log({
                    module: '系统设置',
                    action: '测试连接',
                    status: 'error',
                    detail: `模式: ${selectedScenario} | 错误: ${errMsg}`,
                });
            } catch (_) { }
        } finally {
            $btn.prop('disabled', false).html('<i class="fa-solid fa-paper-plane"></i> 重新发送“你好”测试');
        }
    }
}

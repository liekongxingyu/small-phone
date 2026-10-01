import { XManager } from './x-manager.js';
import { QQManager } from './qq-manager.js';

/**
 * XApp
 * 社交平台 X (推特) 界面渲染与全功能交互层
 * 
 * 核心升级交互：
 * 1. 动态与热搜板块平滑 Tab 切换
 * 2. 伪搜索定向刷新机制：输入框内容作为 Prompt 意图引导词传给 AI 生成
 * 3. 动态流浏览、真实点赞动效、评论区折叠展开
 * 4. 用户发动态后，自动触发世界观角色跟评互动并同步嵌至正文
 * 5. 用户对推文或评论回复互动，并实时刷出对方角色的跟帖回响与正文嵌入
 * 6. 点击刷新时：画面旧推文清空并载入全新轮次，正文中历史轮次天然保留
 * 7. 提供【清空本轮】按钮：一键清空画面并连带剔除正文中嵌入的当前轮次记录
 */
export class XApp {
    constructor({ onBackToHome } = {}) {
        this.onBackToHome = onBackToHome || (() => {});
        this.currentTab = 'feed'; // 'records' | 'feed' | 'trending'
        this.isGeneratingFeed = false;
        this.isGeneratingTrending = false;
        this.activeTrending = null; // 当前查看详情的热搜对象
        this.page = null;
    }

    /**
     * 主渲染入口
     */
    render() {
        const page = $(`
            <div class="small-phone-app-page sp-x-app-page" id="sp-x-app-container">
                <!-- 1. 顶部 Header -->
                <header class="sp-x-header">
                    <div class="sp-x-header-left">
                        <button class="sp-x-btn-icon" id="sp-x-btn-back" title="返回桌面">
                            <i class="fa-solid fa-chevron-left"></i>
                        </button>
                    </div>
                    <div class="sp-x-header-center">
                        <i class="fa-brands fa-x-twitter sp-x-logo-icon"></i>
                    </div>
                    <div class="sp-x-header-right">
                        <!-- 清空当前轮次动态按钮 (连带正文) -->
                        <button class="sp-x-btn-icon sp-x-btn-clear-round" id="sp-x-btn-clear-round" title="清空本轮动态 (连带正文)">
                            <i class="fa-regular fa-trash-can"></i>
                        </button>
                        <!-- 发推按钮 -->
                        <button class="sp-x-btn-compose-header" id="sp-x-header-compose" title="发推">
                            <i class="fa-solid fa-feather-pointed"></i>
                        </button>
                    </div>
                </header>

                <!-- 2. 板块 Tab 切换栏 (记录 | 动态 | 热搜) -->
                <nav class="sp-x-tabs-nav">
                    <button class="sp-x-tab-btn" data-tab="records" id="sp-x-tab-btn-records">
                        <span>记录</span>
                        <div class="sp-x-tab-indicator"></div>
                    </button>
                    <button class="sp-x-tab-btn active" data-tab="feed" id="sp-x-tab-btn-feed">
                        <span>动态</span>
                        <div class="sp-x-tab-indicator"></div>
                    </button>
                    <button class="sp-x-tab-btn" data-tab="trending" id="sp-x-tab-btn-trending">
                        <span>热搜</span>
                        <div class="sp-x-tab-indicator"></div>
                    </button>
                </nav>

                <!-- 3. 意图引导输入栏 (伪搜索/方向生成) -->
                <div class="sp-x-guidance-bar">
                    <div class="sp-x-guidance-input-box">
                        <i class="fa-solid fa-magnifying-glass sp-x-search-icon"></i>
                        <input type="text" id="sp-x-guidance-input" class="sp-x-guidance-input" placeholder="想看什么动态？(默认留空)" autocomplete="off">
                        <button class="sp-x-btn-clear-search" id="sp-x-clear-guidance" style="display: none;" title="清空">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                    <button class="sp-x-btn-refresh" id="sp-x-btn-refresh-feed" title="刷新生成内容">
                        <i class="fa-solid fa-arrows-rotate"></i>
                        <span>刷新</span>
                    </button>
                </div>

                <!-- 4. 内容主体滚动区域 -->
                <main class="sp-x-main-scroll" id="sp-x-main-scroll">
                    <!-- 记录列表容器 -->
                    <div class="sp-x-tab-content" id="sp-x-content-records" style="display: none;">
                        <div class="sp-x-records-header">
                            <div class="sp-x-records-header-left">
                                <span class="sp-x-records-header-title"><i class="fa-solid fa-clock-rotate-left"></i> 动态轮次记录</span>
                                <span class="sp-x-records-header-count" id="sp-x-records-count">0</span>
                            </div>
                            <button class="sp-x-btn-clear-all-records" id="sp-x-btn-clear-all-records" title="清空全部历史动态与正文记录">
                                <i class="fa-regular fa-trash-can"></i>
                                <span>全部清空</span>
                            </button>
                        </div>
                        <div class="sp-x-records-list" id="sp-x-records-list"></div>
                    </div>

                    <!-- 动态列表容器 -->
                    <div class="sp-x-tab-content active" id="sp-x-content-feed">
                        <div class="sp-x-feed-list" id="sp-x-feed-list"></div>
                    </div>

                    <!-- 热搜榜单容器 -->
                    <div class="sp-x-tab-content" id="sp-x-content-trending" style="display: none;">
                        <div class="sp-x-trending-list" id="sp-x-trending-list"></div>
                    </div>
                </main>

                <!-- 5. 悬浮发推按钮 -->
                <button class="sp-x-floating-compose-btn" id="sp-x-floating-compose" title="发动态">
                    <i class="fa-solid fa-plus"></i>
                </button>

                <!-- 6. 发推模态弹窗 (实名/匿名切换) -->
                <div class="sp-x-modal-overlay" id="sp-x-compose-modal" style="display: none;">
                    <div class="sp-x-compose-card">
                        <div class="sp-x-compose-header">
                            <button class="sp-x-compose-cancel" id="sp-x-compose-cancel">取消</button>
                            <span class="sp-x-compose-title">发布动态</span>
                            <button class="sp-x-compose-submit" id="sp-x-compose-submit">发布</button>
                        </div>
                        
                        <!-- 实名 / 匿名 切换栏 -->
                        <div class="sp-x-identity-toggle-box">
                            <div class="sp-x-identity-info">
                                <span class="sp-x-identity-label" id="sp-x-identity-label">实名发布</span>
                                <span class="sp-x-identity-sub" id="sp-x-identity-sub">公开展示你的个人昵称</span>
                            </div>
                            <label class="sp-x-switch">
                                <input type="checkbox" id="sp-x-anonymous-switch">
                                <span class="sp-x-slider"></span>
                            </label>
                        </div>

                        <!-- 文本输入区 -->
                        <div class="sp-x-compose-body">
                            <textarea id="sp-x-compose-textarea" class="sp-x-compose-textarea" placeholder="有什么新鲜事想分享？" rows="4"></textarea>
                            <div class="sp-x-compose-footer">
                                <span class="sp-x-char-counter" id="sp-x-char-counter">0/280</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 7. 热搜话题详情抽屉模态窗 -->
                <div class="sp-x-modal-overlay" id="sp-x-trending-detail-modal" style="display: none;">
                    <div class="sp-x-trending-detail-card">
                        <div class="sp-x-trending-detail-header">
                            <button class="sp-x-btn-icon" id="sp-x-trending-detail-back">
                                <i class="fa-solid fa-chevron-left"></i>
                            </button>
                            <span class="sp-x-trending-detail-title">话题详情</span>
                            <div style="width: 28px;"></div>
                        </div>
                        <div class="sp-x-trending-detail-content" id="sp-x-trending-detail-body"></div>
                    </div>
                </div>
            </div>
        `);

        this.page = page;
        this._bindEvents(page);

        // 初始化动态列表与热搜
        this.renderFeedList();
        this.renderTrendingList();

        return page;
    }

    /**
     * 绑定各类点击与切换事件
     */
    _bindEvents(page) {
        // 返回桌面
        page.find('#sp-x-btn-back').on('click', () => {
            this.onBackToHome();
        });

        // Tab 切换
        page.find('.sp-x-tab-btn').on('click', (e) => {
            const tab = $(e.currentTarget).data('tab');
            this.switchTab(tab);
        });

        // 清空当前轮次动态 (连带正文)
        page.find('#sp-x-btn-clear-round').on('click', async () => {
            const activeRound = XManager.getActiveRound();
            if (!activeRound) {
                if (typeof toastr !== 'undefined') toastr.info('当前没有可清空的动态轮次', 'X');
                return;
            }

            if (confirm('确认清除当前这轮动态吗？将连带切除嵌入正文的对应记录。')) {
                const $btn = page.find('#sp-x-btn-clear-round');
                $btn.prop('disabled', true);
                try {
                    await XManager.clearRound(activeRound.id);
                    this.renderFeedList();
                    if (this.currentTab === 'records') {
                        this.renderRecordsList();
                    }
                    if (typeof toastr !== 'undefined') {
                        toastr.success('该轮动态及正文嵌入记录已彻底清除', 'X');
                    }
                } catch (err) {
                    if (typeof toastr !== 'undefined') toastr.error('清除失败: ' + err.message, 'X');
                } finally {
                    $btn.prop('disabled', false);
                }
            }
        });

        // 清空全部历史动态与正文记录
        page.find('#sp-x-btn-clear-all-records').on('click', async () => {
            const rounds = XManager.getRounds();
            if (!rounds || rounds.length === 0) {
                if (typeof toastr !== 'undefined') toastr.info('暂无任何动态记录', 'X');
                return;
            }

            if (confirm(`确认清空全部 ${rounds.length} 轮历史动态吗？正文中所有嵌入的 X 动态记录都将被彻底移除！`)) {
                try {
                    await XManager.clearAllRounds();
                    this.renderRecordsList();
                    if (typeof toastr !== 'undefined') {
                        toastr.success('已清空全部历史动态与正文记录', 'X');
                    }
                } catch (err) {
                    if (typeof toastr !== 'undefined') toastr.error('清空失败: ' + err.message, 'X');
                }
            }
        });

        // 引导词输入框实时监听
        const $guidanceInput = page.find('#sp-x-guidance-input');
        const $clearBtn = page.find('#sp-x-clear-guidance');

        $guidanceInput.on('input', () => {
            if ($guidanceInput.val().trim()) {
                $clearBtn.show();
            } else {
                $clearBtn.hide();
            }
        });

        $clearBtn.on('click', () => {
            $guidanceInput.val('').trigger('input');
        });

        // 点击刷新生成
        page.find('#sp-x-btn-refresh-feed').on('click', () => {
            const guidance = $guidanceInput.val().trim();
            if (this.currentTab === 'trending') {
                this.handleRefreshTrending(guidance);
            } else {
                // feed 或 records 时，刷新动态流！
                this.handleRefreshFeeds(guidance);
            }
        });

        // 回车快捷刷新
        $guidanceInput.on('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                page.find('#sp-x-btn-refresh-feed').click();
            }
        });

        // 打开发布弹窗
        page.find('#sp-x-floating-compose, #sp-x-header-compose').on('click', () => {
            this.openComposeModal();
        });

        // 关闭发布弹窗
        page.find('#sp-x-compose-cancel').on('click', () => {
            this.closeComposeModal();
        });

        // 匿名开关切换
        page.find('#sp-x-anonymous-switch').on('change', (e) => {
            const isAnon = $(e.currentTarget).is(':checked');
            const userProfile = QQManager.getUserProfile ? QQManager.getUserProfile() : { name: '我' };
            const myName = userProfile.name || '我';

            if (isAnon) {
                page.find('#sp-x-identity-label').text('匿名发布');
                page.find('#sp-x-identity-sub').text('以随机匿名代号发布，隐藏个人真实账号');
            } else {
                page.find('#sp-x-identity-label').text('实名发布');
                page.find('#sp-x-identity-sub').text(`以 @${myName} 公开展示个人昵称`);
            }
        });

        // 字数统计
        page.find('#sp-x-compose-textarea').on('input', (e) => {
            const len = $(e.currentTarget).val().length;
            page.find('#sp-x-char-counter').text(`${len}/280`);
            if (len > 280) {
                page.find('#sp-x-char-counter').css('color', '#f4212e');
            } else {
                page.find('#sp-x-char-counter').css('color', 'rgba(255,255,255,0.4)');
            }
        });

        // 确认发推
        page.find('#sp-x-compose-submit').on('click', () => {
            this.handlePostTweet();
        });

        // 关闭话题详情模态窗
        page.find('#sp-x-trending-detail-back').on('click', () => {
            page.find('#sp-x-trending-detail-modal').fadeOut(150);
        });
    }

    /**
     * 切换 Tab (records | feed | trending)
     */
    switchTab(tab) {
        if (this.currentTab === tab) return;
        this.currentTab = tab;

        const page = this.page;
        page.find('.sp-x-tab-btn').removeClass('active');
        page.find(`.sp-x-tab-btn[data-tab="${tab}"]`).addClass('active');

        const $input = page.find('#sp-x-guidance-input');

        page.find('#sp-x-content-records').hide();
        page.find('#sp-x-content-feed').hide();
        page.find('#sp-x-content-trending').hide();

        if (tab === 'records') {
            page.find('#sp-x-content-records').show();
            page.find('#sp-x-floating-compose').fadeOut(150);
            page.find('#sp-x-header-compose').hide();
            page.find('#sp-x-btn-clear-round').hide();
            $input.attr('placeholder', '想看什么题材？点击刷新即可生成新一轮');
            this.renderRecordsList();
        } else if (tab === 'feed') {
            page.find('#sp-x-content-feed').show();
            page.find('#sp-x-floating-compose').fadeIn(150);
            page.find('#sp-x-header-compose').show();
            page.find('#sp-x-btn-clear-round').show();
            $input.attr('placeholder', '想看什么动态？(默认留空)');
            this.renderFeedList();
        } else {
            page.find('#sp-x-content-trending').show();
            page.find('#sp-x-floating-compose').fadeOut(150);
            page.find('#sp-x-header-compose').hide();
            page.find('#sp-x-btn-clear-round').hide();
            $input.attr('placeholder', '引导热搜风向... (默认留空)');
            this.renderTrendingList();
        }
    }

    /**
     * 渲染轮次历史记录列表
     */
    renderRecordsList() {
        const page = this.page;
        const $list = page.find('#sp-x-records-list');
        const $count = page.find('#sp-x-records-count');
        const rounds = XManager.getRounds();
        const activeRound = XManager.getActiveRound();

        $count.text(rounds.length);

        if (!rounds || rounds.length === 0) {
            $list.html(`
                <div class="sp-x-empty-state">
                    <div class="sp-x-empty-icon"><i class="fa-solid fa-clock-rotate-left"></i></div>
                    <div class="sp-x-empty-title">暂无动态轮次记录</div>
                    <div class="sp-x-empty-desc">每刷新生成一轮动态，都会在此自动归档并同步记录在正文中。</div>
                    <button class="sp-x-btn-empty-action" id="sp-x-btn-create-first-round">
                        <i class="fa-solid fa-arrows-rotate"></i> 生成第一轮动态
                    </button>
                </div>
            `);

            $list.find('#sp-x-btn-create-first-round').on('click', () => {
                this.handleRefreshFeeds('');
            });
            return;
        }

        const htmlArr = rounds.map((r, index) => {
            const isActive = activeRound && activeRound.id === r.id;
            const feeds = Array.isArray(r.feeds) ? r.feeds : [];
            let totalComments = 0;
            for (const f of feeds) {
                if (Array.isArray(f.comments)) totalComments += f.comments.length;
            }

            // 格式化时间
            let timeStr = '刚刚';
            if (r.createdAt) {
                const d = new Date(r.createdAt);
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const h = String(d.getHours()).padStart(2, '0');
                const min = String(d.getMinutes()).padStart(2, '0');
                timeStr = `${m}-${day} ${h}:${min}`;
            }

            // 提取第一条推文内容预览
            const firstFeed = feeds[0];
            const firstAuthor = firstFeed ? (firstFeed.author_name || '网友') : '';
            const firstContent = firstFeed ? (firstFeed.content || '').replace(/\r?\n/g, ' ').slice(0, 48) : '暂无推文';

            const guidanceTag = r.guidance ? `<span class="sp-x-record-guidance-tag"><i class="fa-solid fa-hashtag"></i>${this._escape(r.guidance)}</span>` : '';
            const activeBadge = isActive ? `<span class="sp-x-record-active-badge"><i class="fa-solid fa-circle-check"></i> 当前浏览</span>` : '';

            return `
                <div class="sp-x-record-item ${isActive ? 'active' : ''}" data-round-id="${r.id}">
                    <div class="sp-x-record-item-header">
                        <div class="sp-x-record-meta">
                            <span class="sp-x-record-round-num">第 ${rounds.length - index} 轮</span>
                            <span class="sp-x-record-time"><i class="fa-regular fa-clock"></i> ${timeStr}</span>
                            ${activeBadge}
                            ${guidanceTag}
                        </div>
                        <button class="sp-x-btn-delete-record" data-round-id="${r.id}" title="清除该轮及正文记录">
                            <i class="fa-regular fa-trash-can"></i>
                        </button>
                    </div>
                    <div class="sp-x-record-item-body">
                        <div class="sp-x-record-stats">
                            <span><i class="fa-solid fa-bolt"></i> ${feeds.length} 条动态</span>
                            <span class="sp-x-record-dot">·</span>
                            <span><i class="fa-regular fa-comments"></i> ${totalComments} 条互动</span>
                        </div>
                        <div class="sp-x-record-preview">
                            ${firstFeed ? `<strong>@${this._escape(firstAuthor)}</strong>: ` : ''}
                            <span>${this._escape(firstContent)}${firstFeed && firstFeed.content && firstFeed.content.length > 48 ? '...' : ''}</span>
                        </div>
                    </div>
                    <div class="sp-x-record-item-footer">
                        <span class="sp-x-record-enter-tip">点击切换到该轮动态 <i class="fa-solid fa-arrow-right"></i></span>
                    </div>
                </div>
            `;
        });

        $list.html(htmlArr.join(''));

        // 绑定点击条目切换到该轮动态
        $list.find('.sp-x-record-item').on('click', (e) => {
            const roundId = $(e.currentTarget).data('round-id');
            if (roundId) {
                XManager.setActiveRound(roundId);
                this.switchTab('feed');
                if (typeof toastr !== 'undefined') {
                    toastr.info('已切换到所选动态轮次', 'X');
                }
            }
        });

        // 绑定单个轮次删除按钮
        $list.find('.sp-x-btn-delete-record').on('click', async (e) => {
            e.stopPropagation(); // 阻止触发卡片点击切换
            const roundId = $(e.currentTarget).data('round-id');
            if (!roundId) return;

            if (confirm('确认清除该轮动态吗？将连带切除嵌入正文的对应记录。')) {
                try {
                    await XManager.clearRound(roundId);
                    this.renderRecordsList();
                    if (typeof toastr !== 'undefined') {
                        toastr.success('该轮动态及正文记录已彻底清除', 'X');
                    }
                } catch (err) {
                    if (typeof toastr !== 'undefined') toastr.error('清除失败: ' + err.message, 'X');
                }
            }
        });
    }

    /**
     * 刷新并生成动态流
     * 开启全新轮次；历史轮次在正文中保留不消失，新轮次追加写入正文并同步记入记录页签！
     */
    async handleRefreshFeeds(guidance) {
        if (this.isGeneratingFeed) return;
        this.isGeneratingFeed = true;

        const $btn = this.page.find('#sp-x-btn-refresh-feed');
        $btn.addClass('loading').prop('disabled', true);
        $btn.find('i').addClass('fa-spin');
        $btn.find('span').text('生成中');

        // 界面先展示骨架/加载占位
        const $list = this.page.find('#sp-x-feed-list');
        $list.html(`
            <div class="sp-x-loading-feed-state">
                <i class="fa-solid fa-spinner fa-spin"></i>
                <span>正在刷新生成新一轮动态并记入记录与正文...</span>
            </div>
        `);

        try {
            await XManager.generateFeeds({ guidance });
            // 如果刷新时在 records 标签，自动切到 feed 查看
            if (this.currentTab === 'records') {
                this.switchTab('feed');
            } else {
                this.renderFeedList();
            }
            if (typeof toastr !== 'undefined') {
                toastr.success('新一轮动态已生成并同步记入记录与正文！', 'X');
            }
        } catch (err) {
            console.error('[XApp] 刷新动态失败:', err);
            if (typeof toastr !== 'undefined') {
                toastr.error(err?.message || '刷新动态失败，请重试', 'X');
            }
            this.renderFeedList();
        } finally {
            this.isGeneratingFeed = false;
            $btn.removeClass('loading').prop('disabled', false);
            $btn.find('i').removeClass('fa-spin');
            $btn.find('span').text('刷新');
        }
    }

    /**
     * 刷新并生成热搜榜单
     */
    async handleRefreshTrending(guidance) {
        if (this.isGeneratingTrending) return;
        this.isGeneratingTrending = true;

        const $btn = this.page.find('#sp-x-btn-refresh-feed');
        $btn.addClass('loading').prop('disabled', true);
        $btn.find('i').addClass('fa-spin');
        $btn.find('span').text('生成中');

        try {
            await XManager.generateHotTrends({ guidance });
            this.renderTrendingList();
            if (typeof toastr !== 'undefined') {
                toastr.success('热搜榜已刷新！', 'X');
            }
        } catch (err) {
            console.error('[XApp] 刷新热搜失败:', err);
            if (typeof toastr !== 'undefined') {
                toastr.error(err?.message || '刷新热搜失败，请重试', 'X');
            }
        } finally {
            this.isGeneratingTrending = false;
            $btn.removeClass('loading').prop('disabled', false);
            $btn.find('i').removeClass('fa-spin');
            $btn.find('span').text('刷新');
        }
    }

    /**
     * 渲染动态流列表
     */
    renderFeedList() {
        const feeds = XManager.getFeeds();
        const rounds = XManager.getRounds();
        const activeRound = XManager.getActiveRound();
        const $list = this.page.find('#sp-x-feed-list');
        $list.empty();

        if (feeds.length === 0) {
            $list.html(`
                <div class="sp-x-empty-state">
                    <div class="sp-x-empty-icon"><i class="fa-brands fa-x-twitter"></i></div>
                    <div class="sp-x-empty-title">本轮暂无动态</div>
                    <div class="sp-x-empty-desc">在上方输入想看的内容（或直接留空），点击“刷新”开启本轮推文并自动嵌至正文！</div>
                    <button class="sp-x-btn-empty-action" id="sp-x-empty-refresh-feed">
                        <i class="fa-solid fa-arrows-rotate"></i> 立即生成本轮动态
                    </button>
                </div>
            `);

            $list.find('#sp-x-empty-refresh-feed').on('click', () => {
                this.handleRefreshFeeds('');
            });
            return;
        }

        // 若存在多轮记录，在动态流顶部展示当前轮次指示卡
        if (rounds.length > 1 && activeRound) {
            const currentIdx = rounds.findIndex(r => r.id === activeRound.id);
            const roundNum = currentIdx !== -1 ? (rounds.length - currentIdx) : 1;
            const $banner = $(`
                <div class="sp-x-feed-round-banner">
                    <div class="sp-x-feed-round-info">
                        <span class="sp-x-feed-round-badge"><i class="fa-solid fa-clock-rotate-left"></i> 第 ${roundNum} 轮动态</span>
                        ${activeRound.guidance ? `<span class="sp-x-feed-round-tag">#${this._escape(activeRound.guidance)}#</span>` : ''}
                    </div>
                    <button class="sp-x-btn-switch-record" id="sp-x-btn-switch-record">
                        <span>全部轮次 (${rounds.length})</span>
                        <i class="fa-solid fa-chevron-right"></i>
                    </button>
                </div>
            `);
            $banner.find('#sp-x-btn-switch-record').on('click', () => {
                this.switchTab('records');
            });
            $list.append($banner);
        }

        for (const feed of feeds) {
            const $card = this._createTweetCard(feed);
            $list.append($card);
        }
    }

    /**
     * 创建单条推文卡片 DOM
     */
    _createTweetCard(feed) {
        const isAnon = Boolean(feed.is_anonymous);
        const authorInitial = (feed.author_name || 'U').slice(0, 1).toUpperCase();
        const hasComments = Array.isArray(feed.comments) && feed.comments.length > 0;

        const avatarHtml = isAnon
            ? `<div class="sp-x-avatar anon"><i class="fa-solid fa-mask"></i></div>`
            : `<div class="sp-x-avatar ${feed.is_user ? 'user' : ''}">${authorInitial}</div>`;

        const badgeHtml = feed.is_user
            ? `<span class="sp-x-badge-user">我</span>`
            : (isAnon ? `<span class="sp-x-badge-anon">匿名</span>` : '');

        const $card = $(`
            <article class="sp-x-tweet-card" data-feed-id="${feed.id}">
                <div class="sp-x-tweet-aside">
                    ${avatarHtml}
                </div>
                <div class="sp-x-tweet-main">
                    <!-- 作者与时间行 -->
                    <div class="sp-x-tweet-author-line">
                        <span class="sp-x-author-name">${this._escape(feed.author_name)}</span>
                        ${badgeHtml}
                        <span class="sp-x-author-handle">@${this._escape(feed.author_handle)}</span>
                        <span class="sp-x-dot">·</span>
                        <span class="sp-x-time">${this._escape(feed.time_ago || '刚刚')}</span>
                    </div>

                    <!-- 推文正文 -->
                    <div class="sp-x-tweet-body">
                        ${this._formatContent(feed.content)}
                    </div>

                    <!-- 互动按钮栏 (回复、评论展开、点赞、删除，坚决无转发) -->
                    <div class="sp-x-tweet-actions">
                        <!-- 回复按钮 (打开快捷回复抽屉) -->
                        <button class="sp-x-action-btn btn-reply" title="回复推文">
                            <i class="fa-solid fa-reply"></i>
                            <span class="sp-x-action-label">回复</span>
                        </button>

                        <!-- 查看评论按钮 -->
                        <button class="sp-x-action-btn btn-comment ${hasComments ? 'has-comments' : ''}" title="查看评论">
                            <i class="fa-regular fa-comment"></i>
                            <span class="sp-x-action-count">${feed.comments?.length || 0}</span>
                        </button>

                        <!-- 点赞按钮 -->
                        <button class="sp-x-action-btn btn-like ${feed.isLiked ? 'liked' : ''}" title="点赞">
                            <i class="${feed.isLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
                            <span class="sp-x-action-count">${feed.likes || 0}</span>
                        </button>

                        <!-- 删除按钮 (仅用户自己的推文展示删除图标) -->
                        ${feed.is_user ? `
                            <button class="sp-x-action-btn btn-delete" title="删除推文">
                                <i class="fa-regular fa-trash-can"></i>
                            </button>
                        ` : ''}
                    </div>

                    <!-- 内嵌快捷回复框 (默认折叠) -->
                    <div class="sp-x-inline-reply-box" style="display: none;">
                        <div class="sp-x-reply-target-tip">
                            <span>回复 <b class="sp-x-reply-target-name">@${this._escape(feed.author_name)}</b></span>
                            <button type="button" class="sp-x-btn-cancel-reply" title="收起回复"><i class="fa-solid fa-xmark"></i></button>
                        </div>
                        <div class="sp-x-reply-input-row">
                            <textarea class="sp-x-reply-input" placeholder="写下你的回复..." rows="2"></textarea>
                        </div>
                        <div class="sp-x-reply-tools-row">
                            <label class="sp-x-reply-anon-label" title="匿名回复">
                                <input type="checkbox" class="sp-x-reply-anon-checkbox">
                                <span>匿名</span>
                            </label>
                            <button type="button" class="sp-x-btn-submit-reply">发送回复</button>
                        </div>
                    </div>

                    <!-- 折叠评论区 -->
                    <div class="sp-x-comments-section" style="${hasComments ? '' : 'display: none;'}">
                        <div class="sp-x-comments-list"></div>
                    </div>
                </div>
            </article>
        `);

        // 渲染内部已有评论
        this._renderCommentsInsideCard($card, feed);

        // 点赞交互
        $card.find('.btn-like').on('click', (e) => {
            e.stopPropagation();
            const res = XManager.toggleLike(feed.id);
            if (res.success) {
                const $btn = $(e.currentTarget);
                const $icon = $btn.find('i');
                const $count = $btn.find('.sp-x-action-count');

                $btn.toggleClass('liked', res.isLiked);
                $icon.removeClass('fa-solid fa-regular').addClass(res.isLiked ? 'fa-solid fa-heart' : 'fa-regular fa-heart');
                $count.text(res.likes);

                $btn.addClass('pop-anim');
                setTimeout(() => $btn.removeClass('pop-anim'), 300);
            }
        });

        // 展开/收起评论区
        $card.find('.btn-comment').on('click', (e) => {
            e.stopPropagation();
            const $commentSection = $card.find('.sp-x-comments-section');
            if ($commentSection.is(':visible')) {
                $commentSection.slideUp(150);
            } else {
                this._renderCommentsInsideCard($card, feed);
                $commentSection.slideDown(150);
            }
        });

        // 展开回复抽屉
        $card.find('.btn-reply').on('click', (e) => {
            e.stopPropagation();
            const $replyBox = $card.find('.sp-x-inline-reply-box');
            $replyBox.find('.sp-x-reply-target-name').text(`@${feed.author_name}`);
            $replyBox.data('reply-to-author', feed.author_name);
            $replyBox.slideToggle(150, () => {
                if ($replyBox.is(':visible')) {
                    $replyBox.find('.sp-x-reply-input').focus();
                }
            });
        });

        // 收起回复抽屉
        $card.find('.sp-x-btn-cancel-reply').on('click', (e) => {
            e.stopPropagation();
            $card.find('.sp-x-inline-reply-box').slideUp(150);
        });

        // 提交回复推文/评论
        $card.find('.sp-x-btn-submit-reply').on('click', async (e) => {
            e.stopPropagation();
            const $replyBox = $card.find('.sp-x-inline-reply-box');
            const $input = $replyBox.find('.sp-x-reply-input');
            const text = $input.val().trim();
            const isAnon = $replyBox.find('.sp-x-reply-anon-checkbox').is(':checked');
            const replyToAuthor = $replyBox.data('reply-to-author') || feed.author_name;

            if (!text) {
                if (typeof toastr !== 'undefined') toastr.warning('请输入回复内容', 'X');
                return;
            }

            const $submitBtn = $(e.currentTarget);
            $submitBtn.prop('disabled', true).text('发送中');

            try {
                const { comment, reactionsPromise } = await XManager.replyToTweet({
                    tweetId: feed.id,
                    replyToAuthor: (replyToAuthor !== feed.author_name) ? replyToAuthor : '',
                    content: text,
                    isAnonymous: isAnon,
                });

                $input.val('');
                $replyBox.slideUp(150);

                // 更新评论列表并展开
                const $section = $card.find('.sp-x-comments-section');
                this._renderCommentsInsideCard($card, feed);
                $section.slideDown(150);

                // 更新评论计数徽章
                $card.find('.btn-comment .sp-x-action-count').text(feed.comments.length);

                // 在评论列表末尾显示对方正在回复加载占位
                const $list = $card.find('.sp-x-comments-list');
                const $loadingIndicator = $(`
                    <div class="sp-x-comment-reaction-loading">
                        <i class="fa-solid fa-spinner fa-spin"></i>
                        <span>对方正在输入回复...</span>
                    </div>
                `);
                $list.append($loadingIndicator);

                // 异步处理角色回响
                reactionsPromise.then((newReplies) => {
                    $loadingIndicator.remove();
                    if (newReplies && newReplies.length > 0) {
                        this._renderCommentsInsideCard($card, feed);
                        $card.find('.btn-comment .sp-x-action-count').text(feed.comments.length);
                        if (typeof toastr !== 'undefined') toastr.success('收到新回复！', 'X');
                    }
                });

            } catch (err) {
                if (typeof toastr !== 'undefined') toastr.error(err.message, 'X');
            } finally {
                $submitBtn.prop('disabled', false).text('发送回复');
            }
        });

        // 删除推文
        $card.find('.btn-delete').on('click', async (e) => {
            e.stopPropagation();
            if (confirm('确认删除这条动态吗？')) {
                await XManager.deleteFeed(feed.id);
                $card.slideUp(150, () => $card.remove());
            }
        });

        return $card;
    }

    /**
     * 辅助渲染卡片内部的评论列表
     */
    _renderCommentsInsideCard($card, feed) {
        const $list = $card.find('.sp-x-comments-list');
        $list.empty();

        if (feed.comments && feed.comments.length > 0) {
            for (const c of feed.comments) {
                const isUser = Boolean(c.is_user);
                const isAnon = Boolean(c.is_anonymous);
                const $item = $(`
                    <div class="sp-x-comment-item" data-comment-id="${c.id || ''}">
                        <div class="sp-x-comment-header">
                            <div class="sp-x-comment-author">
                                <span class="c-name">${this._escape(c.author_name)}</span>
                                ${isUser ? '<span class="sp-x-badge-user">我</span>' : (isAnon ? '<span class="sp-x-badge-anon">匿名</span>' : '')}
                                <span class="c-handle">@${this._escape(c.author_handle)}</span>
                            </div>
                            <button type="button" class="sp-x-btn-comment-reply" title="回复TA">
                                <i class="fa-solid fa-reply"></i>
                            </button>
                        </div>
                        <div class="sp-x-comment-content">${this._formatContent(c.content)}</div>
                    </div>
                `);

                // 点击单条评论的回复
                $item.find('.sp-x-btn-comment-reply').on('click', (e) => {
                    e.stopPropagation();
                    const $replyBox = $card.find('.sp-x-inline-reply-box');
                    $replyBox.find('.sp-x-reply-target-name').text(`@${c.author_name}`);
                    $replyBox.data('reply-to-author', c.author_name);
                    $replyBox.slideDown(150, () => {
                        $replyBox.find('.sp-x-reply-input').focus();
                    });
                });

                $list.append($item);
            }
        } else {
            $list.html(`<div class="sp-x-no-comment">暂无评论，点击回复抢沙发！</div>`);
        }
    }

    /**
     * 渲染热搜榜单列表
     */
    renderTrendingList() {
        const trends = XManager.getHotTrends();
        const $list = this.page.find('#sp-x-trending-list');
        $list.empty();

        if (trends.length === 0) {
            $list.html(`
                <div class="sp-x-empty-state">
                    <div class="sp-x-empty-icon"><i class="fa-solid fa-fire"></i></div>
                    <div class="sp-x-empty-title">暂无热搜榜单</div>
                    <div class="sp-x-empty-desc">点击下方按钮或在顶部输入热搜风向，一键生成全网舆论榜单！</div>
                    <button class="sp-x-btn-empty-action" id="sp-x-empty-refresh-trending">
                        <i class="fa-solid fa-arrows-rotate"></i> 立即生成热搜榜
                    </button>
                </div>
            `);

            $list.find('#sp-x-empty-refresh-trending').on('click', () => {
                this.handleRefreshTrending('');
            });
            return;
        }

        // 渲染榜单头部
        $list.append(`
            <div class="sp-x-trending-header-bar">
                <span>实时热搜榜 · 综合</span>
                <span class="sp-x-trending-heat-title">热度指数</span>
            </div>
        `);

        for (const item of trends) {
            const rank = item.rank || 1;
            const isTop3 = rank <= 3;
            const badgeClass = item.tag_type === '爆' ? 'badge-hot-burst' : (item.tag_type === '新' ? 'badge-hot-new' : 'badge-hot-warm');

            const $item = $(`
                <div class="sp-x-trending-item ${isTop3 ? 'top-rank' : ''}" role="button" tabindex="0">
                    <div class="sp-x-trending-rank ${isTop3 ? `rank-${rank}` : ''}">${rank}</div>
                    <div class="sp-x-trending-info">
                        <div class="sp-x-trending-tag-line">
                            <span class="sp-x-trending-tag">${this._escape(item.tag)}</span>
                            ${item.tag_type ? `<span class="sp-x-hot-badge ${badgeClass}">${this._escape(item.tag_type)}</span>` : ''}
                        </div>
                        <div class="sp-x-trending-summary">${this._escape(item.summary || '')}</div>
                    </div>
                    <div class="sp-x-trending-heat">${this._escape(item.heat || '')}</div>
                </div>
            `);

            // 点击查看话题详情
            $item.on('click', () => {
                this.openTrendingDetail(item);
            });

            $list.append($item);
        }
    }

    /**
     * 打开热搜话题详情模态窗
     */
    openTrendingDetail(trendItem) {
        this.activeTrending = trendItem;
        const $modal = this.page.find('#sp-x-trending-detail-modal');
        const $body = this.page.find('#sp-x-trending-detail-body');

        const sampleTweets = Array.isArray(trendItem.sample_tweets) ? trendItem.sample_tweets : [];

        $body.html(`
            <!-- 话题概括卡片 -->
            <div class="sp-x-detail-hero">
                <div class="sp-x-detail-tag">${this._escape(trendItem.tag)}</div>
                <div class="sp-x-detail-stats">
                    <span>排名：No.${trendItem.rank}</span>
                    <span class="sp-x-dot">·</span>
                    <span>热度：${this._escape(trendItem.heat)}</span>
                </div>
                <div class="sp-x-detail-summary">${this._escape(trendItem.summary)}</div>
            </div>

            <!-- 话题相关精选推文 -->
            <div class="sp-x-detail-tweets-header">热门讨论</div>
            <div class="sp-x-detail-tweets-list">
                ${sampleTweets.length > 0 ? sampleTweets.map(t => `
                    <div class="sp-x-detail-tweet-item">
                        <div class="sp-x-detail-author">
                            <div class="sp-x-avatar sm">${(t.author_name || 'U').slice(0, 1)}</div>
                            <span class="sp-x-author-name">${this._escape(t.author_name)}</span>
                        </div>
                        <div class="sp-x-detail-text">${this._formatContent(t.content)}</div>
                    </div>
                `).join('') : '<div class="sp-x-no-comment">暂无更多推文讨论</div>'}
            </div>
        `);

        $modal.fadeIn(150);
    }

    /**
     * 打开发布推文弹窗
     */
    openComposeModal() {
        const page = this.page;
        const $modal = page.find('#sp-x-compose-modal');
        const $textarea = page.find('#sp-x-compose-textarea');
        const $switch = page.find('#sp-x-anonymous-switch');

        const userProfile = QQManager.getUserProfile ? QQManager.getUserProfile() : { name: '我' };
        const myName = userProfile.name || '我';

        $textarea.val('');
        page.find('#sp-x-char-counter').text('0/280');
        $switch.prop('checked', false);
        page.find('#sp-x-identity-label').text('实名发布');
        page.find('#sp-x-identity-sub').text(`以 @${myName} 公开展示个人昵称`);

        $modal.fadeIn(150, () => {
            $textarea.focus();
        });
    }

    /**
     * 关闭发推弹窗
     */
    closeComposeModal() {
        this.page.find('#sp-x-compose-modal').fadeOut(150);
    }

    /**
     * 处理发推
     */
    async handlePostTweet() {
        const $textarea = this.page.find('#sp-x-compose-textarea');
        const content = $textarea.val().trim();
        const isAnon = this.page.find('#sp-x-anonymous-switch').is(':checked');

        if (!content) {
            if (typeof toastr !== 'undefined') toastr.warning('请输入推文内容', 'X');
            return;
        }

        const $submitBtn = this.page.find('#sp-x-compose-submit');
        $submitBtn.prop('disabled', true).text('发布中...');

        try {
            const { tweet, reactionsPromise } = await XManager.postUserTweet({
                content,
                isAnonymous: isAnon,
            });

            this.closeComposeModal();
            this.renderFeedList();

            // 平滑滚动回顶部
            this.page.find('#sp-x-main-scroll').scrollTop(0);

            if (typeof toastr !== 'undefined') {
                toastr.success(isAnon ? '已匿名发布动态并记录正文！' : '已实名发布动态并记录正文！', 'X');
            }

            // 获取刚渲染的卡片，自动展示等待角色跟评提示
            const $firstCard = this.page.find('.sp-x-tweet-card').first();
            const $section = $firstCard.find('.sp-x-comments-section');
            const $list = $firstCard.find('.sp-x-comments-list');
            $section.show();

            const $reactionLoading = $(`
                <div class="sp-x-comment-reaction-loading">
                    <i class="fa-solid fa-spinner fa-spin"></i>
                    <span>世界线角色正在查看并回复你的动态...</span>
                </div>
            `);
            $list.append($reactionLoading);

            // 异步处理跟评落地
            reactionsPromise.then((addedComments) => {
                $reactionLoading.remove();
                if (addedComments && addedComments.length > 0) {
                    this._renderCommentsInsideCard($firstCard, tweet);
                    $firstCard.find('.btn-comment .sp-x-action-count').text(tweet.comments.length);
                    if (typeof toastr !== 'undefined') {
                        toastr.success(`已有 ${addedComments.length} 位角色回复了你的动态！`, 'X');
                    }
                }
            });

        } catch (err) {
            if (typeof toastr !== 'undefined') {
                toastr.error(err?.message || '发布失败', 'X');
            }
        } finally {
            $submitBtn.prop('disabled', false).text('发布');
        }
    }

    /**
     * 辅助：安全转义
     */
    _escape(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * 格式化推文或评论内容（支持换行、图片/视频媒体卡片徽章识别与富媒体展示）
     */
    _formatContent(text) {
        if (!text) return '';
        let escaped = this._escape(text).replace(/\n/g, '<br>');

        // 解析 [图片：xxx] 或 [配图：xxx] 或 [图片: xxx]
        escaped = escaped.replace(/\[(图片|配图)[：:]\s*([^\]]+)\]/g, (match, tag, desc) => {
            return `<div class="sp-x-media-attachment photo">
                <i class="fa-regular fa-image"></i>
                <span class="sp-x-media-label">${tag}</span>
                <span class="sp-x-media-desc">${desc.trim()}</span>
            </div>`;
        });

        // 解析 [视频：xxx] 或 [视频: xxx]
        escaped = escaped.replace(/\[视频[：:]\s*([^\]]+)\]/g, (match, desc) => {
            return `<div class="sp-x-media-attachment video">
                <i class="fa-solid fa-play"></i>
                <span class="sp-x-media-label">视频</span>
                <span class="sp-x-media-desc">${desc.trim()}</span>
            </div>`;
        });

        return escaped;
    }
}

if (typeof window !== 'undefined') {
    window.XApp = XApp;
}

import { TaobaoManager } from './taobao-manager.js';
import { OperationLogService } from './operation-log-service.js';

/**
 * TaobaoApp 类：管理小手机内“淘宝”应用的视图渲染与交互
 */
export class TaobaoApp {
    constructor({ onBackToHome, onSendToContact }) {
        this.onBackToHome = onBackToHome;
        this.onSendToContact = onSendToContact;
        this.container = null;
        this.activeTab = 'recommend'; // 'recommend' | 'favorites'
        this.isLoading = false;
        this.currentSendingProduct = null;
    }

    /**
     * 构建并返回淘宝 App 容器
     */
    render() {
        const template = `
            <div class="small-phone-app-page sp-taobao-page" id="sp-taobao-page">
                <!-- 顶栏：淘宝橙经典色调 -->
                <div class="sp-page-header sp-taobao-header">
                    <button type="button" class="sp-header-back-btn sp-taobao-back-btn" id="sp-taobao-back-btn" title="返回主屏幕">
                        <i class="fa-solid fa-chevron-left"></i> 桌面
                    </button>

                    <!-- 双 Tab 切换：好物推荐 / 我的收藏 -->
                    <div class="sp-taobao-tab-switch">
                        <button type="button" class="sp-taobao-tab-btn is-active" data-tab="recommend" id="sp-taobao-tab-recommend">
                            好物推荐
                        </button>
                        <button type="button" class="sp-taobao-tab-btn" data-tab="favorites" id="sp-taobao-tab-favorites">
                            我的收藏 <span class="sp-taobao-badge" id="sp-taobao-fav-count">0</span>
                        </button>
                    </div>

                    <!-- 右侧操作区：刷新 + 设置 -->
                    <div class="sp-taobao-header-actions">
                        <button type="button" class="sp-taobao-icon-btn" id="sp-taobao-refresh-btn" title="刷新商品（原来的商品会消失并替换）">
                            <i class="fa-solid fa-rotate-right"></i>
                        </button>
                        <button type="button" class="sp-taobao-icon-btn" id="sp-taobao-settings-btn" title="淘宝设置">
                            <i class="fa-solid fa-gear"></i>
                        </button>
                    </div>
                </div>

                <!-- 额外要求偏好栏 (默认为空，随提示词发送) -->
                <div class="sp-taobao-search-bar" id="sp-taobao-search-bar">
                    <div class="sp-taobao-search-box">
                        <i class="fa-solid fa-magnifying-glass sp-taobao-search-icon"></i>
                        <input type="text" id="sp-taobao-extra-req-input" class="sp-taobao-search-input" 
                               placeholder="额外要求（如：来几个吃的/喝的，留空随缘）" />
                        <button type="button" class="sp-taobao-search-clear" id="sp-taobao-req-clear-btn" title="清空" style="display: none;">
                            <i class="fa-solid fa-circle-xmark"></i>
                        </button>
                    </div>
                    <button type="button" class="sp-taobao-search-submit-btn" id="sp-taobao-search-submit-btn" title="按此要求搜罗好物">
                        搜好物
                    </button>
                </div>

                <!-- 内容滚动区 -->
                <div class="sp-page-body sp-taobao-body" id="sp-taobao-body">
                    <div class="sp-taobao-products-list" id="sp-taobao-products-list">
                        <!-- 商品列表由 _renderList 渲染 -->
                    </div>
                </div>

                <!-- 淘宝设置弹窗 (默认隐藏) -->
                <div class="sp-taobao-modal-mask" id="sp-taobao-settings-modal" style="display: none;">
                    <div class="sp-taobao-modal-card">
                        <div class="sp-taobao-modal-header">
                            <span><i class="fa-solid fa-gear"></i> 淘宝偏好设置</span>
                            <button type="button" class="sp-taobao-modal-close" id="sp-taobao-settings-close">&times;</button>
                        </div>
                        <div class="sp-taobao-modal-body">
                            <div class="sp-form-item">
                                <label for="sp-taobao-max-fav-input">最大收藏数量</label>
                                <input type="number" id="sp-taobao-max-fav-input" class="sp-input" min="10" max="1000" step="10" value="100" />
                                <span class="sp-field-hint">当前聊天中最多允许收藏的好物上限（默认 100 件）</span>
                            </div>
                            <div class="sp-divider" style="margin: 12px 0;"></div>
                            <div class="sp-danger-zone">
                                <button type="button" class="sp-btn sp-btn-danger" id="sp-taobao-clear-fav-btn" style="width: 100%;">
                                    <i class="fa-solid fa-trash-can"></i> 清空当前全部收藏
                                </button>
                            </div>
                        </div>
                        <div class="sp-taobao-modal-footer">
                            <button type="button" class="sp-btn sp-btn-secondary" id="sp-taobao-settings-cancel">取消</button>
                            <button type="button" class="sp-btn sp-btn-primary" id="sp-taobao-settings-save">
                                <i class="fa-solid fa-floppy-disk"></i> 保存
                            </button>
                        </div>
                    </div>
                </div>

                <!-- 发送给联系人选择弹窗 (默认隐藏) -->
                <div class="sp-taobao-modal-mask" id="sp-taobao-contact-modal" style="display: none;">
                    <div class="sp-taobao-modal-card sp-taobao-contact-picker-card">
                        <div class="sp-taobao-modal-header">
                            <span><i class="fa-solid fa-share-nodes"></i> 选择发送联系人</span>
                            <button type="button" class="sp-taobao-modal-close" id="sp-taobao-contact-close">&times;</button>
                        </div>
                        <div class="sp-taobao-contact-product-tip" id="sp-taobao-contact-product-tip">
                            将商品发送至对应聊天
                        </div>
                        <div class="sp-taobao-contacts-picker-body" id="sp-taobao-contacts-picker-list">
                            <!-- 动态加载联系人列表 -->
                        </div>
                        <div class="sp-taobao-modal-footer">
                            <button type="button" class="sp-btn sp-btn-secondary" id="sp-taobao-contact-cancel" style="width: 100%;">
                                取消
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.container = $(template);
        this._bindEvents();
        this._updateFavCountBadge();

        // 初次渲染当前列表（点击刷新按钮才刷新）
        this._renderList();

        return this.container;
    }

    /**
     * 更新顶栏收藏计数
     */
    _updateFavCountBadge() {
        if (!this.container) return;
        const favs = TaobaoManager.getFavorites();
        const max = TaobaoManager.getMaxFavorites();
        this.container.find('#sp-taobao-fav-count').text(`${favs.length}/${max}`);
    }

    /**
     * 绑定页面交互事件
     */
    _bindEvents() {
        if (!this.container) return;

        // 1. 返回主屏幕
        this.container.find('#sp-taobao-back-btn').on('click', () => {
            if (typeof this.onBackToHome === 'function') {
                this.onBackToHome();
            }
        });

        // 2. Tab 切换：好物推荐 / 我的收藏
        this.container.find('.sp-taobao-tab-btn').on('click', (e) => {
            const tab = $(e.currentTarget).data('tab');
            if (this.activeTab === tab) return;
            this.activeTab = tab;
            this.container.find('.sp-taobao-tab-btn').removeClass('is-active');
            $(e.currentTarget).addClass('is-active');

            const $searchBar = this.container.find('#sp-taobao-search-bar');
            if (tab === 'recommend') {
                $searchBar.slideDown(150);
            } else {
                $searchBar.slideUp(150);
            }

            this._renderList();
        });

        // 额外偏好/要求输入框事件监听
        const $extraInput = this.container.find('#sp-taobao-extra-req-input');
        const $clearBtn = this.container.find('#sp-taobao-req-clear-btn');

        $extraInput.on('input', (e) => {
            const val = $(e.target).val();
            if (val && val.trim().length > 0) {
                $clearBtn.show();
            } else {
                $clearBtn.hide();
            }
        });

        $clearBtn.on('click', () => {
            $extraInput.val('').trigger('input');
            $extraInput.focus();
        });

        $extraInput.on('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this._handleRefresh();
            }
        });

        this.container.find('#sp-taobao-search-submit-btn').on('click', () => {
            this._handleRefresh();
        });

        // 3. 点击刷新商品
        this.container.find('#sp-taobao-refresh-btn').on('click', () => {
            if (this.isLoading) return;
            this._handleRefresh();
        });

        // 4. 打开设置弹窗
        this.container.find('#sp-taobao-settings-btn').on('click', () => {
            const currentMax = TaobaoManager.getMaxFavorites();
            this.container.find('#sp-taobao-max-fav-input').val(currentMax);
            this.container.find('#sp-taobao-settings-modal').fadeIn(150);
        });

        // 5. 关闭设置弹窗
        this.container.find('#sp-taobao-settings-close, #sp-taobao-settings-cancel').on('click', () => {
            this.container.find('#sp-taobao-settings-modal').fadeOut(150);
        });

        // 6. 保存设置
        this.container.find('#sp-taobao-settings-save').on('click', () => {
            const inputVal = parseInt(this.container.find('#sp-taobao-max-fav-input').val(), 10);
            const savedVal = TaobaoManager.setMaxFavorites(inputVal);
            this.container.find('#sp-taobao-settings-modal').fadeOut(150);
            this._updateFavCountBadge();
            if (typeof toastr !== 'undefined') {
                toastr.success(`淘宝设置已保存！最大收藏数：${savedVal} 件`, '淘宝');
            }
        });

        // 7. 清空当前收藏
        this.container.find('#sp-taobao-clear-fav-btn').on('click', () => {
            if (confirm('确认清空当前聊天的全部已收藏商品吗？')) {
                const count = TaobaoManager.clearFavorites();
                this._updateFavCountBadge();
                if (this.activeTab === 'favorites') {
                    this._renderList();
                }
                if (typeof toastr !== 'undefined') {
                    toastr.info(`已清空 ${count} 件收藏`, '淘宝');
                }
            }
        });

        // 8. 委托事件：商品卡片上的“收藏”、“发给联系人”和“发送”按钮
        this.container.find('#sp-taobao-products-list').on('click', '.sp-btn-fav', (e) => {
            e.stopPropagation();
            const $btn = $(e.currentTarget);
            const itemId = $btn.data('id');
            this._handleToggleFavorite(itemId, $btn);
        });

        this.container.find('#sp-taobao-products-list').on('click', '.sp-btn-send-contact', (e) => {
            e.stopPropagation();
            const itemId = $(e.currentTarget).data('id');
            this._handleOpenContactPicker(itemId);
        });

        this.container.find('#sp-taobao-products-list').on('click', '.sp-btn-send', (e) => {
            e.stopPropagation();
            const itemId = $(e.currentTarget).data('id');
            this._handleSendProduct(itemId);
        });

        // 9. 联系人弹窗关闭与条目选择
        this.container.find('#sp-taobao-contact-close, #sp-taobao-contact-cancel').on('click', () => {
            this.container.find('#sp-taobao-contact-modal').fadeOut(150);
            this.currentSendingProduct = null;
        });

        this.container.find('#sp-taobao-contacts-picker-list').on('click', '.sp-taobao-contact-item', (e) => {
            e.stopPropagation();
            const $item = $(e.currentTarget);
            const contactId = $item.data('id');
            const contactType = $item.data('type') || 'friend';
            const contactName = $item.data('name') || '联系人';
            this._handleConfirmSendToContact(contactId, contactType, contactName);
        });
    }

    /**
     * 刷新商品核心逻辑
     */
    async _handleRefresh() {
        if (this.isLoading) return;

        // 校验酒馆当前是否在有效会话中
        if (!TaobaoManager.hasActiveChatSession()) {
            const warnText = '未进入有效会话，请先在酒馆选择角色并进入聊天后再刷新淘宝好物~';
            if (typeof toastr !== 'undefined' && toastr.warning) {
                toastr.warning(warnText, '淘宝');
            } else {
                alert(warnText);
            }
            return;
        }

        this.isLoading = true;

        const $btn = this.container.find('#sp-taobao-refresh-btn');
        $btn.find('i').addClass('is-spinning');

        // 如果在“我的收藏”页面点击刷新，自动切回“好物推荐”
        if (this.activeTab !== 'recommend') {
            this.activeTab = 'recommend';
            this.container.find('.sp-taobao-tab-btn').removeClass('is-active');
            this.container.find('#sp-taobao-tab-recommend').addClass('is-active');
            this.container.find('#sp-taobao-search-bar').slideDown(150);
        }

        // 读取界面上输入的额外要求
        const req = this.container.find('#sp-taobao-extra-req-input').val()?.trim() || '';

        // 显示加载骨架/动效卡片
        const safeReq = $('<div>').text(req).html();
        const loadingTitle = req ? `正在搜罗“${safeReq}”好物...` : '正在搜罗契合当前世界的新好物...';
        this.container.find('#sp-taobao-products-list').html(`
            <div class="sp-taobao-loading-box">
                <i class="fa-solid fa-spinner fa-spin sp-taobao-spinner"></i>
                <div class="sp-taobao-loading-text">${loadingTitle}</div>
                <div class="sp-taobao-loading-sub">结合当前角色设定与世界书条目智能生成中</div>
            </div>
        `);

        try {
            await TaobaoManager.refreshProducts(req);
            this._renderList();
        } catch (err) {
            console.error('[TaobaoApp] 刷新好物失败:', err);
            this.container.find('#sp-taobao-products-list').html(`
                <div class="sp-taobao-empty-box">
                    <i class="fa-solid fa-triangle-exclamation sp-taobao-empty-icon" style="color: #ef4444;"></i>
                    <div class="sp-taobao-empty-title">刷新好物遇到一点问题</div>
                    <div class="sp-taobao-empty-desc">${err?.message || err}</div>
                    <button type="button" class="sp-btn sp-btn-primary" id="sp-taobao-retry-btn" style="margin-top: 10px;">
                        <i class="fa-solid fa-rotate-right"></i> 重新尝试
                    </button>
                </div>
            `);
            this.container.find('#sp-taobao-retry-btn').on('click', () => this._handleRefresh());
        } finally {
            this.isLoading = false;
            $btn.find('i').removeClass('is-spinning');
        }
    }

    /**
     * 渲染商品卡片列表
     */
    _renderList() {
        if (!this.container) return;
        const $list = this.container.find('#sp-taobao-products-list');
        this._updateFavCountBadge();

        let items = [];
        let emptyHint = '';

        if (this.activeTab === 'recommend') {
            items = TaobaoManager.getCurrentProducts();
            emptyHint = '当前暂无推荐商品，点击右上角刷新搜罗好物~';
        } else {
            items = TaobaoManager.getFavorites();
            emptyHint = '还没有收藏任何商品哦，在好物推荐中点击“⭐ 收藏”即可加入~';
        }

        if (items.length === 0) {
            const hasSession = TaobaoManager.hasActiveChatSession();
            let emptyTitle = this.activeTab === 'recommend' ? '暂无商品展示' : '收藏夹是空的';
            let emptyDesc = emptyHint;

            if (this.activeTab === 'recommend' && !hasSession) {
                emptyTitle = '未进入聊天会话';
                emptyDesc = '请先在酒馆中选择角色并进入聊天，再点击刷新搜罗契合当前角色与世界的好物~';
            }

            $list.html(`
                <div class="sp-taobao-empty-box">
                    <i class="fa-solid fa-bag-shopping sp-taobao-empty-icon"></i>
                    <div class="sp-taobao-empty-title">${emptyTitle}</div>
                    <div class="sp-taobao-empty-desc">${emptyDesc}</div>
                    ${this.activeTab === 'recommend' ? `
                        <button type="button" class="sp-btn sp-btn-primary" id="sp-taobao-empty-refresh-btn" style="margin-top: 12px; background: #ff5000; border-color: #ff5000;">
                            <i class="fa-solid fa-rotate-right"></i> 立即刷新搜罗好物
                        </button>
                    ` : ''}
                </div>
            `);
            $list.find('#sp-taobao-empty-refresh-btn').on('click', () => this._handleRefresh());
            return;
        }

        const cardsHtml = items.map(item => {
            const isFav = TaobaoManager.isFavorite(item.id) || TaobaoManager.isFavorite(item.name);
            const safeName = $('<div>').text(item.name).html();
            const safePrice = $('<div>').text(item.price).html();
            const safeDesc = $('<div>').text(item.description).html();

            return `
                <div class="sp-taobao-card" data-id="${item.id}" data-name="${safeName}">
                    <div class="sp-taobao-card-top">
                        <div class="sp-taobao-card-title">${safeName}</div>
                        <div class="sp-taobao-card-price">${safePrice}</div>
                    </div>
                    <div class="sp-taobao-card-desc">${safeDesc}</div>
                    <div class="sp-taobao-card-actions">
                        <button type="button" class="sp-taobao-act-btn sp-btn-fav ${isFav ? 'is-favorited' : ''}" data-id="${item.id}" title="${isFav ? '取消收藏' : '加入收藏夹'}">
                            <i class="fa-${isFav ? 'solid' : 'regular'} fa-star"></i>
                            <span>${isFav ? '已收藏' : '收藏'}</span>
                        </button>
                        <button type="button" class="sp-taobao-act-btn sp-btn-send-contact" data-id="${item.id}" title="发给QQ联系人并跳转聊天">
                            <i class="fa-solid fa-share-nodes"></i>
                            <span>发给联系人</span>
                        </button>
                        <button type="button" class="sp-taobao-act-btn sp-btn-send" data-id="${item.id}" title="将本商品填入当前输入框">
                            <i class="fa-solid fa-paper-plane"></i>
                            <span>发送</span>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        $list.html(cardsHtml);
    }

    /**
     * 处理点击收藏/取消收藏
     */
    _handleToggleFavorite(itemId, $btn) {
        let product = null;
        if (this.activeTab === 'recommend') {
            product = TaobaoManager.getCurrentProducts().find(p => p.id === itemId);
        } else {
            product = TaobaoManager.getFavorites().find(p => p.id === itemId);
        }

        if (!product) return;

        const isCurrentlyFav = TaobaoManager.isFavorite(product.id) || TaobaoManager.isFavorite(product.name);

        if (isCurrentlyFav) {
            // 取消收藏
            TaobaoManager.removeFavorite(product.id);
            TaobaoManager.removeFavorite(product.name);
            if (typeof toastr !== 'undefined') {
                toastr.info(`已取消收藏【${product.name}】`, '淘宝');
            }

            if (this.activeTab === 'favorites') {
                // 在收藏页直接移除该卡片
                this._renderList();
            } else {
                $btn.removeClass('is-favorited')
                    .find('i').removeClass('fa-solid').addClass('fa-regular')
                    .end().find('span').text('收藏');
                this._updateFavCountBadge();
            }
        } else {
            // 添加收藏
            const res = TaobaoManager.addFavorite(product);
            if (res.success) {
                $btn.addClass('is-favorited')
                    .find('i').removeClass('fa-regular').addClass('fa-solid')
                    .end().find('span').text('已收藏');
                this._updateFavCountBadge();
                if (typeof toastr !== 'undefined') {
                    toastr.success(`已加入收藏【${product.name}】`, '淘宝');
                }
            } else {
                if (typeof toastr !== 'undefined') {
                    toastr.warning(res.reason || '收藏失败', '淘宝');
                } else {
                    alert(res.reason || '收藏失败');
                }
            }
        }
    }

    /**
     * 处理点击“发送”
     */
    _handleSendProduct(itemId) {
        let product = null;
        if (this.activeTab === 'recommend') {
            product = TaobaoManager.getCurrentProducts().find(p => p.id === itemId);
        } else {
            product = TaobaoManager.getFavorites().find(p => p.id === itemId);
        }

        if (!product) return;

        TaobaoManager.sendProductToChat(product);
    }

    /**
     * 打开联系人选择器弹窗
     * @param {string} itemId 商品 ID
     */
    _handleOpenContactPicker(itemId) {
        // 检查是否有可用好友或群聊，没好友则拦截不可发送
        const contacts = TaobaoManager.getAvailableContacts();
        if (contacts.length === 0) {
            const tipText = '通讯录中暂无好友或群聊，无法发送商品。请先在 QQ 通讯录添加好友或新建群聊哦~';
            if (typeof toastr !== 'undefined' && toastr.warning) {
                toastr.warning(tipText, '淘宝');
            } else {
                alert(tipText);
            }
            return;
        }

        let product = null;
        if (this.activeTab === 'recommend') {
            product = TaobaoManager.getCurrentProducts().find(p => p.id === itemId);
        } else {
            product = TaobaoManager.getFavorites().find(p => p.id === itemId);
        }

        if (!product) return;
        this.currentSendingProduct = product;

        const safeProductName = $('<div>').text(product.name).html();
        this.container.find('#sp-taobao-contact-product-tip').html(`
            <span>将商品 <b>【${safeProductName}】</b> 发送至：</span>
        `);

        // 渲染联系人列表
        const $pickerList = this.container.find('#sp-taobao-contacts-picker-list');
        $pickerList.empty();

        const listHtml = contacts.map(c => {
                const safeName = $('<div>').text(c.name).html();
                const safeSub = $('<div>').text(c.subText).html();
                const safeInitial = $('<div>').text(c.avatarText || '友').html();
                const tagBadge = c.type === 'group'
                    ? '<span class="sp-contact-type-tag tag-group">群聊</span>'
                    : '<span class="sp-contact-type-tag tag-friend">好友</span>';

                return `
                    <div class="sp-taobao-contact-item" data-id="${c.id}" data-type="${c.type}" data-name="${safeName}">
                        <div class="sp-taobao-contact-avatar" style="background-color: ${c.avatarColor || '#3b82f6'};">
                            ${safeInitial}
                        </div>
                        <div class="sp-taobao-contact-meta">
                            <div class="sp-taobao-contact-name-row">
                                <span class="sp-taobao-contact-name">${safeName}</span>
                                ${tagBadge}
                            </div>
                            <span class="sp-taobao-contact-sub">${safeSub}</span>
                        </div>
                        <i class="fa-solid fa-paper-plane sp-taobao-contact-arrow" title="发送"></i>
                    </div>
                `;
            }).join('');
            $pickerList.html(listHtml);

        this.container.find('#sp-taobao-contact-modal').fadeIn(150);
    }

    /**
     * 确认发送给指定联系人，跳转到聊天界面
     * @param {string} contactId 联系人 ID
     * @param {string} contactType 'friend' | 'group'
     * @param {string} contactName 联系人名称
     */
    _handleConfirmSendToContact(contactId, contactType, contactName) {
        const product = this.currentSendingProduct;
        this.container.find('#sp-taobao-contact-modal').fadeOut(150);
        this.currentSendingProduct = null;

        if (!product) return;

        const sendText = `选择了商品【${product.name}】`;

        if (typeof this.onSendToContact === 'function') {
            this.onSendToContact({
                contactId,
                contactType,
                contactName,
                product,
                sendText,
            });
        } else {
            // 兜底直接填入当前聊天框
            TaobaoManager.sendProductToChat(product);
        }
    }
}

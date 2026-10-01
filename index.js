import { getContext } from '../../../extensions.js';
import { SettingsManager, EXTENSION_NAME } from './settings-manager.js';
import { PhoneView } from './phone-view.js';
import { ensureCompactStylesInjected } from './qq-app.js';

let phoneView = null;

/**
 * 注入魔法棒下拉菜单项
 */
function registerWandMenuEntry() {
    const wandMenu = $('#extensionsMenu');
    if (wandMenu.length === 0) {
        return;
    }

    if ($('#small_phone_wand_entry').length > 0) {
        return;
    }

    const wandItemHtml = `
        <div id="small_phone_wand_entry" class="list-group-item flex-container flexGap5 interactable" title="打开 SmallPhone">
            <div class="fa-solid fa-mobile-screen-button extensionsMenuExtensionButton"></div>
            <span>SmallPhone</span>
        </div>
    `;

    wandMenu.append(wandItemHtml);

    $('#small_phone_wand_entry').on('click', () => {
        // 关闭魔法棒下拉菜单并打开小手机
        $('#extensionsMenu').hide();
        phoneView.toggle();
    });
}

/**
 * 注册 Slash 命令 (/smallphone)
 */
function registerCommands(ctx) {
    try {
        if (ctx && ctx.SlashCommandParser && ctx.SlashCommand) {
            ctx.SlashCommandParser.addCommandObject(ctx.SlashCommand.fromProps({
                name: 'smallphone',
                callback: () => {
                    phoneView.toggle();
                    return 'SmallPhone 状态已切换';
                },
                returns: ctx.ARGUMENT_TYPE ? ctx.ARGUMENT_TYPE.STRING : 'string',
                helpString: '打开或关闭 SmallPhone 小手机窗口。',
            }));
        }
    } catch (err) {
        console.warn('[SmallPhone] 注册 Slash 命令失败:', err);
    }
}

/**
 * 插件主初始化入口
 */
jQuery(async () => {
    const context = (typeof Luker !== 'undefined' && Luker.getContext)
        ? Luker.getContext()
        : getContext();

    // 0. 注入高优先级紧凑样式
    ensureCompactStylesInjected();

    // 1. 初始化设置
    SettingsManager.init();

    // 2. 初始化手机视图
    phoneView = new PhoneView();
    phoneView.init();

    // 3. 监听小手机内的各 App 点击
    phoneView.onAppClick('qq', () => {
        phoneView.openApp('qq');
    });

    phoneView.onAppClick('taobao', () => {
        phoneView.openApp('taobao');
    });

    phoneView.onAppClick('x', () => {
        phoneView.openApp('x');
    });

    phoneView.onAppClick('settings', () => {
        phoneView.openApp('settings');
    });

    phoneView.onAppClick('logs', () => {
        phoneView.openApp('logs');
    });

    // 4. 挂载到魔法棒菜单
    registerWandMenuEntry();

    // 如果 extensionsMenu 是动态生成的，使用观察器或延迟重试保底
    const observer = new MutationObserver(() => {
        if ($('#extensionsMenu').length > 0 && $('#small_phone_wand_entry').length === 0) {
            registerWandMenuEntry();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // 5. 注册 Slash 命令
    registerCommands(context);

    // 6. 对外暴露扩展 API，保持解耦
    if (context && typeof context.registerExtensionApi === 'function') {
        context.registerExtensionApi(EXTENSION_NAME, {
            open: () => phoneView.show(),
            close: () => phoneView.hide(),
            toggle: () => phoneView.toggle(),
            addAppIcon: (options) => phoneView.addAppIcon(options),
            onAppClick: (appId, callback) => phoneView.onAppClick(appId, callback),
            getSettings: () => SettingsManager.getSettings(),
            getApiConfig: () => SettingsManager.getApiConfig(),
        });
    }

    console.log('[SmallPhone] 插件加载完成');
});

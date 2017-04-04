
import { TheiaPlugin, TheiaApplication } from "../application";
import { MenuBar as MenuBarWidget, Menu as MenuWidget, Widget } from "@phosphor/widgets";
import { CommandRegistry as PhosphorCommandRegistry } from "@phosphor/commands";
import { CommandRegistry } from "../../common/command";
import { injectable, inject } from "inversify";
import { ActionMenuNode, CompositeMenuNode, MenuModelRegistry, MAIN_MENU_BAR } from '../../common/menu';

@injectable()
export class MainMenuFactory {

    constructor(
        @inject(CommandRegistry) protected commandRegistry: CommandRegistry,
        @inject(MenuModelRegistry) protected menuProvider: MenuModelRegistry
    ) {
    }

    createMenuBar(): MenuBarWidget {
        const menuBar = new MenuBarWidget();
        menuBar.id = 'theia:menubar';
        const menuModel = this.menuProvider.getMenu(MAIN_MENU_BAR);
        const phosphorCommands = this.createPhosporCommands(menuModel);
        for (let menu of menuModel.subMenus) {
            if (menu instanceof CompositeMenuNode) {
                const menuWidget = this.createMenuWidget(menu, phosphorCommands);
                menuBar.addMenu(menuWidget);
            }
        }
        return menuBar;
    }

    createContextMenu(path: string): MenuWidget {
        const menuModel = this.menuProvider.getMenu(path);
        const phosphorCommands = this.createPhosporCommands(menuModel);

        const contextMenu = new MenuWidget({
            commands: phosphorCommands
        });

        for (let menu of menuModel.subMenus) {
            if (menu instanceof CompositeMenuNode) {
                contextMenu.addItem({
                    type: 'submenu',
                    submenu: this.createMenuWidget(menu, phosphorCommands)
                });
            } else if (menu instanceof ActionMenuNode) {
                contextMenu.addItem({
                    command: menu.action.commandId,
                    type: 'command'
                });
            }
        }
        return contextMenu;
    }

    private createPhosporCommands(menu: CompositeMenuNode): PhosphorCommandRegistry {
        const commands = new PhosphorCommandRegistry();
        const commandRegistry = this.commandRegistry;
        function initCommands(current: CompositeMenuNode): void {
            for (let menu of current.subMenus) {
                if (menu instanceof ActionMenuNode) {
                    const command = commandRegistry.getCommand(menu.action.commandId);
                    if (command) {
                        let handler = commandRegistry.getActiveHandler(command.id) || {
                            execute: (e) => { },
                            isEnabled: (e) => { return false; },
                            isVisible: (e) => { return true; }
                        };

                        handler = handler!;
                        commands.addCommand(command.id, {
                            execute: (e: any) => handler.execute(e),
                            label: menu.label,
                            icon: command.iconClass,
                            isEnabled: (e: any) => {
                                if (handler.isEnabled) {
                                    return handler.isEnabled(e);
                                } else {
                                    return true;
                                }
                            },
                            isVisible: (e: any) => {
                                if (handler.isVisible) {
                                    return handler.isVisible(e);
                                } else {
                                    return true;
                                }
                            }
                        })
                    }
                } else if (menu instanceof CompositeMenuNode) {
                    initCommands(menu);
                }
            }
        }
        initCommands(menu);
        return commands;
    }

    private createMenuWidget(menu: CompositeMenuNode, commands: PhosphorCommandRegistry): MenuWidget {
        const result = new MenuWidget({
            commands
        });
        if (menu.label) {
            result.title.label = menu.label;
        }
        this.fillSubMenus(result, menu, commands);
        return result;
    }

    private fillSubMenus(parent: MenuWidget, menu: CompositeMenuNode, commands: PhosphorCommandRegistry): void {
        for (let item of menu.subMenus) {
            if (item instanceof CompositeMenuNode) {
                if (item.label) {
                    parent.addItem({
                        submenu: this.createMenuWidget(item, commands)
                    });
                } else {
                    if (item.subMenus.length > 0) {
                        if (parent.items.length > 0) {
                            parent.addItem({
                                type: 'separator'
                            });
                        }
                        this.fillSubMenus(parent, item, commands);
                    }
                }
            } else if (item instanceof ActionMenuNode) {
                parent.addItem({
                    command: item.action.commandId,
                    type: 'command'
                });
            }
        }
    }

}

@injectable()
export class BrowserMenuBarContribution implements TheiaPlugin {

    constructor( @inject(MainMenuFactory) private factory: MainMenuFactory) {
    }

    onStart(app: TheiaApplication): void {
        app.shell.addToTopArea(this.getLogo());
        const menu = this.factory.createMenuBar();
        app.shell.addToTopArea(menu);
    }

    private getLogo(): Widget {
        const logo = new Widget();
        logo.id = 'theia:icon';
        logo.addClass('theia-icon');
        return logo;
    }
}

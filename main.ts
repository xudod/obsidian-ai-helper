import { App, Editor, MarkdownView, Notice, Plugin } from 'obsidian';
import { PluginSettings } from './types';
import { HerdsmanHelperSettingTab, DEFAULT_SETTINGS } from './settings';
import { HerdsmanClient } from './herdsman-client';
import { HerdsmanResponseModal } from './response-modal';

export default class HerdsmanHelperPlugin extends Plugin {
  settings: PluginSettings;
  herdsmanClient: HerdsmanClient | null = null;

  async onload() {
    await this.loadSettings();
    
    // 初始化Herdsman客户端
    this.herdsmanClient = new HerdsmanClient(
      this.settings.herdsmanUrl,
      this.settings.modelName
    );

    // 添加编辑器右键菜单命令
    this.addCommand({
      id: 'ask-herdsman',
      name: '向 Herdsman 提问',
      editorCallback: (editor: Editor, view: MarkdownView) => {
        this.handleAskHerdsman(editor);
      }
    });

    // 添加编辑器菜单项（右键菜单）
    this.registerEvent(
      this.app.workspace.on('editor-menu', (menu, editor, view) => {
        const selection = editor.getSelection();
        if (selection && selection.trim().length > 0) {
          menu.addItem((item) => {
            item
              .setTitle('🤖 向 Herdsman 提问')
              .setIcon('bot')
              .onClick(() => {
                this.handleAskHerdsman(editor);
              });
          });
        }
      })
    );

    // 添加设置选项卡
    this.addSettingTab(new HerdsmanHelperSettingTab(this.app, this));

    console.log('Herdsman Helper 插件已加载');
  }

  async handleAskHerdsman(editor: Editor) {
    // 获取选中的文本
    const selectedText = editor.getSelection();
    
    if (!selectedText || selectedText.trim().length === 0) {
      new Notice('请先选中要提问的文本');
      return;
    }

    // 检查模型配置
    if (!this.settings.modelName) {
      new Notice('请先在设置中配置Herdsman模型');
      return;
    }

    // 创建弹窗
    const modal = new HerdsmanResponseModal(this.app, selectedText);
    
    // 设置确认回调
    modal.onConfirm = (response) => {
      this.insertResponseBelowSelection(editor, selectedText, response);
      if (this.settings.showNotice) {
        new Notice('已将回复插入到笔记');
      }
    };

    // 设置取消回调
    modal.onCancel = () => {
      if (this.settings.showNotice) {
        new Notice('已取消');
      }
    };

    // 打开弹窗
    modal.open();

    // 发送请求到 Herdsman（使用Node.js HTTP模块实现流式响应，避免CORS问题）
    try {
      await this.queryHerdsmanStream(selectedText, (chunk) => {
        modal.updateResponse(chunk);
      });
      modal.completeResponse();
    } catch (error) {
      console.error('Herdsman 请求失败:', error);
      modal.showError(`请求失败: ${error.message}`);
    }
  }

  async queryHerdsmanStream(prompt: string, onChunk: (chunk: string) => void) {
    if (!this.herdsmanClient) {
      throw new Error('Herdsman客户端未初始化');
    }
    return await this.herdsmanClient.sendMessageStream(prompt, {
      temperature: this.settings.temperature,
      maxTokens: this.settings.maxTokens
    }, onChunk);
  }

  insertResponseBelowSelection(editor: Editor, selectedText: string, response: string) {
    const to = editor.getCursor('to');
    
    const responseText = `\n\n**🤖 Herdsman 回复:**\n${response}\n`;
    
    editor.replaceRange(responseText, to);
    
    const newCursorPos = {
      line: to.line + responseText.split('\n').length - 1,
      ch: 0
    };
    editor.setCursor(newCursorPos);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    
    // 更新客户端配置
    if (this.herdsmanClient) {
      this.herdsmanClient.updateConfig(
        this.settings.herdsmanUrl,
        this.settings.modelName
      );
    }
  }

  onunload() {
    console.log('Herdsman Helper 插件已卸载');
  }
}

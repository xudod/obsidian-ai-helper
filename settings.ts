import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import { PluginSettings } from './types';
import { HerdsmanClient } from './herdsman-client';

// 默认配置
export const DEFAULT_SETTINGS: PluginSettings = {
  herdsmanUrl: 'http://localhost:8080/v1',
  modelName: '',
  temperature: 0.7,
  maxTokens: 1000,
  showNotice: true
};

export class HerdsmanHelperSettingTab extends PluginSettingTab {
  plugin: any;
  herdsmanClient: HerdsmanClient | null = null;
  availableModels: string[] = [];
  isRefreshingModels: boolean = false;

  constructor(app: App, plugin: any) {
    super(app, plugin);
    this.plugin = plugin;
  }

  async display(): Promise<void> {
    const { containerEl } = this;
    containerEl.empty();

    // 初始化Herdsman客户端
    this.herdsmanClient = new HerdsmanClient(
      this.plugin.settings.herdsmanUrl,
      this.plugin.settings.modelName
    );

    // 标题
    containerEl.createEl('h2', { text: '🤖 Herdsman 助手设置' });

    // ========== Herdsman配置 ==========
    containerEl.createEl('h3', { text: 'Herdsman 配置' });

    // Herdsman服务地址
    new Setting(containerEl)
      .setName('Herdsman服务地址')
      .setDesc('本地Herdsman服务的API地址（OpenAI兼容）')
      .addText(text => text
        .setPlaceholder('http://localhost:8080/v1')
        .setValue(this.plugin.settings.herdsmanUrl)
        .onChange(async (value) => {
          this.plugin.settings.herdsmanUrl = value;
          await this.plugin.saveSettings();
          if (this.herdsmanClient) {
            this.herdsmanClient.updateConfig(value, this.plugin.settings.modelName);
          }
        }));

    // 测试连接按钮
    new Setting(containerEl)
      .setName('测试连接')
      .setDesc('测试是否能连接到Herdsman服务')
      .addButton(button => button
        .setButtonText('测试连接')
        .setCta()
        .onClick(async () => {
          if (this.herdsmanClient) {
            const isConnected = await this.herdsmanClient.testConnection();
            if (isConnected) {
              new Notice('✓ Herdsman连接成功');
            } else {
              new Notice('✗ Herdsman连接失败，请检查服务是否运行');
            }
          }
        }));

    // 模型选择
    new Setting(containerEl)
      .setName('模型名称')
      .setDesc('选择要使用的大模型')
      .addDropdown(async dropdown => {
        if (this.availableModels.length > 0) {
          this.availableModels.forEach(model => {
            dropdown.addOption(model, model);
          });
        } else {
          dropdown.addOption('', '点击右侧刷新按钮加载模型');
        }
        
        dropdown.setValue(this.plugin.settings.modelName || '');
        dropdown.onChange(async (value) => {
          this.plugin.settings.modelName = value;
          await this.plugin.saveSettings();
          if (this.herdsmanClient) {
            this.herdsmanClient.updateConfig(
              this.plugin.settings.herdsmanUrl,
              value
            );
          }
        });
        
        const refreshButton = document.createElement('button');
        refreshButton.textContent = '🔄 刷新模型列表';
        refreshButton.style.marginLeft = '8px';
        refreshButton.onclick = async () => {
          if (this.isRefreshingModels) return;
          
          this.isRefreshingModels = true;
          refreshButton.textContent = '加载中...';
          refreshButton.disabled = true;
          
          try {
            if (this.herdsmanClient) {
              const models = await this.herdsmanClient.listModels();
              this.availableModels = models;
              
              dropdown.selectEl.empty();
              if (models.length === 0) {
                dropdown.addOption('', '未找到模型');
              } else {
                models.forEach(model => {
                  dropdown.addOption(model, model);
                });
                if (models.includes(this.plugin.settings.modelName)) {
                  dropdown.setValue(this.plugin.settings.modelName);
                } else if (models.length > 0) {
                  dropdown.setValue(models[0]);
                  this.plugin.settings.modelName = models[0];
                  await this.plugin.saveSettings();
                }
              }
              new Notice(`找到 ${models.length} 个模型`);
            }
          } catch (error) {
            new Notice('加载模型列表失败，请检查Herdsman连接');
          } finally {
            this.isRefreshingModels = false;
            refreshButton.textContent = '🔄 刷新模型列表';
            refreshButton.disabled = false;
          }
        };
        
        dropdown.selectEl.parentElement?.appendChild(refreshButton);
      });

    // 分隔线
    containerEl.createEl('hr');

    // ========== 高级设置 ==========
    containerEl.createEl('h3', { text: '高级设置' });

    // 温度参数
    new Setting(containerEl)
      .setName('温度参数')
      .setDesc('控制输出的随机性（0-1，值越高越随机）')
      .addSlider(slider => slider
        .setLimits(0, 1, 0.05)
        .setValue(this.plugin.settings.temperature)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.temperature = value;
          await this.plugin.saveSettings();
        }));

    // 最大生成Tokens
    new Setting(containerEl)
      .setName('最大生成 Tokens')
      .setDesc('回复的最大长度')
      .addText(text => text
        .setPlaceholder('1000')
        .setValue(String(this.plugin.settings.maxTokens))
        .onChange(async (value) => {
          const numValue = parseInt(value);
          if (!isNaN(numValue) && numValue > 0) {
            this.plugin.settings.maxTokens = numValue;
            await this.plugin.saveSettings();
          }
        }));

    // 显示通知
    new Setting(containerEl)
      .setName('显示通知')
      .setDesc('操作时显示状态通知')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.showNotice)
        .onChange(async (value) => {
          this.plugin.settings.showNotice = value;
          await this.plugin.saveSettings();
        }));

    // 分隔线
    containerEl.createEl('hr');

    // ========== 使用说明 ==========
    containerEl.createEl('h3', { text: '使用说明' });
    containerEl.createEl('p', { 
      text: '1. 在编辑器中选中任意文本',
      attr: { style: 'margin-bottom: 4px;' }
    });
    containerEl.createEl('p', { 
      text: '2. 右键点击，选择"🤖 向 Herdsman 提问"',
      attr: { style: 'margin-bottom: 4px;' }
    });
    containerEl.createEl('p', { 
      text: '3. AI 的回复将自动插入到选中内容的下方'
    });

    // 分隔线
    containerEl.createEl('hr');

    // ========== 插件描述 ==========
    containerEl.createEl('h3', { text: '插件描述' });
    containerEl.createEl('p', { 
      text: '这是一个Obsidian插件，功能是在MD笔记中框选某段内容，然后右键选择执行插件功能。',
      attr: { style: 'margin-bottom: 8px; color: var(--text-muted);' }
    });
    containerEl.createEl('p', { 
      text: '插件将选中的内容发送给本地的Herdsman服务，然后将Herdsman返回的结果续写在当前文档选中内容的下方。',
      attr: { style: 'color: var(--text-muted);' }
    });
  }
}

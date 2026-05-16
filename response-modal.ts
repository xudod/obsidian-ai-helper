import { App, Modal } from 'obsidian';

export class HerdsmanResponseModal extends Modal {
  private prompt: string;
  private responseContainer: HTMLElement;
  private cancelButton: HTMLButtonElement;
  private confirmButton: HTMLButtonElement;
  private loadingIndicator: HTMLElement;
  private isProcessing: boolean = false;
  
  onConfirm: (response: string) => void;
  onCancel: () => void;

  constructor(app: App, prompt: string) {
    super(app);
    this.prompt = prompt;
    this.onConfirm = () => {};
    this.onCancel = () => {};
  }

  onOpen() {
    const { contentEl } = this;
    
    // 设置弹窗样式
    this.titleEl.setText('🤖 Herdsman 响应');
    this.modalEl.style.width = '600px';
    this.modalEl.style.maxHeight = '70vh';

    // 创建内容区域
    contentEl.style.padding = '16px';

    // 用户输入区域
    const promptSection = contentEl.createDiv();
    promptSection.style.marginBottom = '16px';
    
    const promptLabel = promptSection.createEl('div', { 
      text: '您的提问:',
      attr: { style: 'font-weight: bold; margin-bottom: 8px; color: var(--text-accent);' }
    });
    
    const promptContent = promptSection.createEl('div', {
      cls: 'herdsman-prompt-content'
    });
    promptContent.style.background = 'var(--background-secondary)';
    promptContent.style.padding = '12px';
    promptContent.style.borderRadius = '8px';
    promptContent.style.fontFamily = 'var(--font-mono)';
    promptContent.style.fontSize = '14px';
    promptContent.style.whiteSpace = 'pre-wrap';
    promptContent.style.wordBreak = 'break-word';
    promptContent.textContent = this.prompt.length > 200 ? this.prompt.substring(0, 200) + '...' : this.prompt;

    // 加载指示器
    this.loadingIndicator = contentEl.createDiv({ cls: 'herdsman-loading' });
    this.loadingIndicator.style.display = 'flex';
    this.loadingIndicator.style.alignItems = 'center';
    this.loadingIndicator.style.justifyContent = 'center';
    this.loadingIndicator.style.padding = '20px';
    
    const spinner = this.loadingIndicator.createEl('div', { cls: 'herdsman-spinner' });
    spinner.style.width = '24px';
    spinner.style.height = '24px';
    spinner.style.border = '3px solid var(--background-modifier-border)';
    spinner.style.borderTopColor = 'var(--interactive-accent)';
    spinner.style.borderRadius = '50%';
    spinner.style.animation = 'spin 1s linear infinite';
    
    const loadingText = this.loadingIndicator.createEl('span', { text: ' 正在思考...' });
    loadingText.style.marginLeft = '8px';

    // 响应内容区域
    this.responseContainer = contentEl.createDiv({ cls: 'herdsman-response-content' });
    this.responseContainer.style.display = 'none';
    this.responseContainer.style.background = 'var(--background-secondary)';
    this.responseContainer.style.padding = '12px';
    this.responseContainer.style.borderRadius = '8px';
    this.responseContainer.style.fontFamily = 'var(--font-mono)';
    this.responseContainer.style.fontSize = '14px';
    this.responseContainer.style.whiteSpace = 'pre-wrap';
    this.responseContainer.style.wordBreak = 'break-word';
    this.responseContainer.style.maxHeight = '300px';
    this.responseContainer.style.overflowY = 'auto';
    this.responseContainer.style.minHeight = '100px';

    // 按钮区域
    const buttonContainer = contentEl.createDiv();
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'flex-end';
    buttonContainer.style.gap = '8px';
    buttonContainer.style.marginTop = '16px';

    this.cancelButton = buttonContainer.createEl('button', { 
      text: '取消',
      cls: 'herdsman-btn herdsman-btn-cancel'
    });
    this.cancelButton.style.background = 'var(--background-modifier-hover)';
    this.cancelButton.style.color = 'var(--text-normal)';
    this.cancelButton.style.border = 'none';
    this.cancelButton.style.borderRadius = '6px';
    this.cancelButton.style.padding = '8px 16px';
    this.cancelButton.style.cursor = 'pointer';
    this.cancelButton.addEventListener('click', () => this.close());

    this.confirmButton = buttonContainer.createEl('button', { 
      text: '插入到笔记',
      cls: 'herdsman-btn herdsman-btn-confirm'
    });
    this.confirmButton.style.background = 'var(--interactive-accent)';
    this.confirmButton.style.color = 'white';
    this.confirmButton.style.border = 'none';
    this.confirmButton.style.borderRadius = '6px';
    this.confirmButton.style.padding = '8px 16px';
    this.confirmButton.style.cursor = 'pointer';
    this.confirmButton.disabled = true;
    this.confirmButton.style.opacity = '0.5';
    this.confirmButton.addEventListener('click', () => {
      this.onConfirm(this.responseContainer.textContent || '');
      this.close();
    });

    // 添加动画样式
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      .herdsman-response-content {
        animation: fadeIn 0.3s ease;
      }
    `;
    contentEl.appendChild(style);
  }

  /**
   * 更新响应内容（流式）
   */
  updateResponse(content: string) {
    if (!this.responseContainer) return;
    
    // 如果是第一次收到内容，显示响应区域，隐藏加载指示器
    if (!this.isProcessing) {
      this.isProcessing = true;
      this.loadingIndicator.style.display = 'none';
      this.responseContainer.style.display = 'block';
    }
    
    this.responseContainer.textContent += content;
    this.responseContainer.scrollTop = this.responseContainer.scrollHeight;
    
    // 启用确认按钮
    this.confirmButton.disabled = false;
    this.confirmButton.style.opacity = '1';
  }

  /**
   * 显示错误信息
   */
  showError(message: string) {
    this.loadingIndicator.style.display = 'none';
    
    const errorContainer = this.contentEl.createDiv({ cls: 'herdsman-error' });
    errorContainer.style.background = 'var(--background-modifier-error)';
    errorContainer.style.color = 'white';
    errorContainer.style.padding = '12px';
    errorContainer.style.borderRadius = '8px';
    errorContainer.style.marginBottom = '16px';
    errorContainer.textContent = message;
    
    this.cancelButton.textContent = '关闭';
  }

  /**
   * 完成响应
   */
  completeResponse() {
    this.loadingIndicator.style.display = 'none';
    this.responseContainer.style.display = 'block';
    
    if (!this.responseContainer.textContent) {
      this.responseContainer.textContent = '未能获取响应';
    }
    
    this.confirmButton.disabled = false;
    this.confirmButton.style.opacity = '1';
  }

  onClose() {
    this.onCancel();
  }
}

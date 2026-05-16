// 插件配置类型
export interface PluginSettings {
  // Herdsman配置
  herdsmanUrl: string;          // Herdsman服务地址
  modelName: string;            // 模型名称
  temperature: number;          // 温度参数
  maxTokens: number;            // 最大生成Tokens
  showNotice: boolean;          // 是否显示通知
}

// 对话消息接口
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// API 请求接口
export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature: number;
  max_tokens: number;
  stream?: boolean;
}

// API 响应接口
export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// 模型列表响应接口
export interface ModelListResponse {
  object: string;
  data: Array<{
    id: string;
    object: string;
    created: number;
    owned_by: string;
    root?: string;
    parent?: string;
  }>;
}

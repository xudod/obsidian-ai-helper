import { requestUrl } from 'obsidian';
import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';

/**
 * Herdsman API客户端
 * 负责与本地Herdsman服务通信（OpenAI兼容）
 */
export class HerdsmanClient {
    private baseUrl: string;
    private modelName: string;

    constructor(baseUrl: string, modelName: string) {
        this.baseUrl = this.normalizeBaseUrl(baseUrl);
        this.modelName = modelName;
        console.log(`[HerdsmanClient] 初始化完成 - Base URL: ${this.baseUrl}, Model: ${this.modelName}`);
    }

    /**
     * 更新配置
     */
    updateConfig(baseUrl: string, modelName: string) {
        this.baseUrl = this.normalizeBaseUrl(baseUrl);
        this.modelName = modelName;
        console.log(`[HerdsmanClient] 配置更新 - Base URL: ${this.baseUrl}, Model: ${this.modelName}`);
    }

    /**
     * 标准化基础URL
     * 移除末尾斜杠和可能的 /v1 后缀，确保API调用时正确拼接路径
     */
    private normalizeBaseUrl(baseUrl: string): string {
        let normalized = baseUrl.replace(/\/$/, ''); // 移除末尾斜杠
        // 如果URL末尾是 /v1，也移除它，因为我们在API调用时会添加
        normalized = normalized.replace(/\/v1$/, '');
        return normalized;
    }

    /**
     * 获取已安装的模型列表
     * @returns 模型名称数组
     */
    async listModels(): Promise<string[]> {
        console.log(`[HerdsmanClient] 开始获取模型列表 - URL: ${this.baseUrl}/v1/models`);
        try {
            const response = await requestUrl({
                url: `${this.baseUrl}/v1/models`,
                method: 'GET',
                throw: false
            });

            console.log(`[HerdsmanClient] 获取模型列表响应状态: ${response.status}`);

            if (response.status !== 200) {
                console.error('Failed to fetch models:', response.status);
                return [];
            }

            const data = response.json;
            console.log(`[HerdsmanClient] 获取模型列表成功，数量: ${data?.data?.length || 0}`);
            if (data && data.data && Array.isArray(data.data)) {
                return data.data.map((model: any) => model.id);
            }

            return [];
        } catch (error) {
            console.error('Error fetching models from Herdsman:', error);
            return [];
        }
    }

    /**
     * 测试Herdsman服务连接
     * @returns 是否连接成功
     */
    async testConnection(): Promise<boolean> {
        console.log(`[HerdsmanClient] 测试连接 - URL: ${this.baseUrl}/v1/models`);
        try {
            const response = await requestUrl({
                url: `${this.baseUrl}/v1/models`,
                method: 'GET',
                throw: false
            });

            console.log(`[HerdsmanClient] 连接测试响应状态: ${response.status}`);
            return response.status === 200;
        } catch (error) {
            console.error('Herdsman connection test failed:', error);
            return false;
        }
    }

    /**
     * 调用大模型处理文本
     * @param systemPrompt 系统提示词
     * @param userContent 用户内容
     * @returns 大模型响应文本
     */
    async chat(
        systemPrompt: string,
        userContent: string
    ): Promise<string> {
        const fullPrompt = systemPrompt.replace('{{content}}', userContent);

        const body = {
            model: this.modelName,
            messages: [
                {
                    role: 'user',
                    content: fullPrompt
                }
            ],
            stream: false
        };

        try {
            const response = await requestUrl({
                url: `${this.baseUrl}/v1/chat/completions`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body),
                throw: false
            });

            if (response.status !== 200) {
                throw new Error(`Herdsman API error: ${response.status}`);
            }

            const data = response.json;
            return data.choices?.[0]?.message?.content || '';
        } catch (error) {
            console.error('Herdsman chat error:', error);
            throw new Error(`调用大模型失败: ${error.message}`);
        }
    }

    /**
     * 发送消息给大模型（简化版）
     * @param prompt 用户提示词
     * @param options 可选参数
     * @returns 大模型响应
     */
    async sendMessage(prompt: string, options?: {
        temperature?: number;
        maxTokens?: number;
    }): Promise<any> {
        console.log(`[HerdsmanClient] sendMessage - 模型: ${this.modelName}, 温度: ${options?.temperature ?? 0.7}, MaxTokens: ${options?.maxTokens ?? 1000}`);
        
        const body = {
            model: this.modelName,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: options?.temperature ?? 0.7,
            max_tokens: options?.maxTokens ?? 1000,
            stream: false
        };

        try {
            const response = await requestUrl({
                url: `${this.baseUrl}/v1/chat/completions`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body),
                throw: false
            });

            console.log(`[HerdsmanClient] sendMessage 响应状态: ${response.status}`);

            if (response.status !== 200) {
                throw new Error(`Herdsman API error: ${response.status}`);
            }

            return response.json;
        } catch (error) {
            console.error('Herdsman sendMessage error:', error);
            throw new Error(`发送消息失败: ${error.message}`);
        }
    }

    /**
     * 发送消息给大模型（流式响应，使用Node.js HTTP模块避免CORS问题）
     * @param prompt 用户提示词
     * @param options 可选参数
     * @param onChunk 接收流式数据的回调函数
     * @returns 完整响应文本
     */
    async sendMessageStream(prompt: string, options?: {
        temperature?: number;
        maxTokens?: number;
    }, onChunk?: (chunk: string) => void): Promise<string> {
        console.log(`[HerdsmanClient] sendMessageStream 开始 - URL: ${this.baseUrl}/v1/chat/completions`);
        console.log(`[HerdsmanClient] 参数 - 模型: ${this.modelName}, 温度: ${options?.temperature ?? 0.7}, MaxTokens: ${options?.maxTokens ?? 1000}`);

        const body = {
            model: this.modelName,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: options?.temperature ?? 0.7,
            max_tokens: options?.maxTokens ?? 1000,
            stream: true
        };

        return new Promise((resolve, reject) => {
            try {
                const url = new URL(`${this.baseUrl}/v1/chat/completions`);
                const isHttps = url.protocol === 'https:';
                const client = isHttps ? https : http;

                const options = {
                    hostname: url.hostname,
                    port: url.port,
                    path: url.pathname,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'text/event-stream',
                    }
                };

                const req = client.request(options, (res) => {
                    console.log(`[HerdsmanClient] HTTP响应状态: ${res.statusCode}`);

                    if (res.statusCode !== 200) {
                        let errorData = '';
                        res.on('data', (chunk) => {
                            errorData += chunk;
                        });
                        res.on('end', () => {
                            console.error(`[HerdsmanClient] HTTP错误: ${res.statusCode} - ${errorData}`);
                            reject(new Error(`Herdsman API error: ${res.statusCode}`));
                        });
                        return;
                    }

                    let fullResponse = '';
                    let buffer = '';
                    let chunkCount = 0;

                    res.on('data', (chunk) => {
                        buffer += chunk.toString('utf8');
                        chunkCount++;

                        // 按行处理
                        const lines = buffer.split('\n');
                        buffer = lines.pop() || '';

                        for (const line of lines) {
                            if (line.trim() === '') continue;
                            if (line.startsWith('data: ')) {
                                const dataStr = line.substring(6);
                                if (dataStr === '[DONE]') {
                                    console.log('[HerdsmanClient] 收到 [DONE] 信号');
                                    continue;
                                }
                                try {
                                    const data = JSON.parse(dataStr);
                                    const content = data.choices?.[0]?.delta?.content || '';
                                    if (content) {
                                        fullResponse += content;
                                        console.log(`[HerdsmanClient] 收到内容片段，长度: ${content.length}`);
                                        onChunk?.(content);
                                    }
                                } catch (error) {
                                    console.warn('Failed to parse streaming chunk:', error, 'Raw:', line);
                                }
                            }
                        }
                    });

                    res.on('end', () => {
                        // 处理剩余的 buffer
                        if (buffer) {
                            console.log(`[HerdsmanClient] 处理剩余buffer: ${buffer.length} 字符`);
                            const lines = buffer.split('\n');
                            for (const line of lines) {
                                if (line.trim() === '' || line.startsWith('data: [DONE]')) continue;
                                if (line.startsWith('data: ')) {
                                    const dataStr = line.substring(6);
                                    try {
                                        const data = JSON.parse(dataStr);
                                        const content = data.choices?.[0]?.delta?.content || '';
                                        if (content) {
                                            fullResponse += content;
                                            onChunk?.(content);
                                        }
                                    } catch (error) {
                                        console.warn('Failed to parse final chunk:', error);
                                    }
                                }
                            }
                        }

                        console.log(`[HerdsmanClient] 流式响应完成，总长度: ${fullResponse.length} 字符，数据块数: ${chunkCount}`);
                        resolve(fullResponse);
                    });

                    res.on('error', (error) => {
                        console.error('[HerdsmanClient] 响应错误:', error);
                        reject(new Error(`响应错误: ${error.message}`));
                    });
                });

                req.on('error', (error) => {
                    console.error('[HerdsmanClient] 请求错误:', error);
                    reject(new Error(`请求错误: ${error.message}`));
                });

                req.write(JSON.stringify(body));
                req.end();

                console.log(`[HerdsmanClient] 发送请求，body长度: ${JSON.stringify(body).length} 字符`);

            } catch (error) {
                console.error('[HerdsmanClient] 流式请求初始化失败:', error);
                
                // 回退到非流式请求
                this.sendMessage(prompt, options).then((result) => {
                    const content = result.choices?.[0]?.message?.content || '';
                    console.log(`[HerdsmanClient] 回退请求成功，长度: ${content.length}`);
                    if (onChunk && content) {
                        onChunk(content);
                    }
                    resolve(content);
                }).catch((fallbackError) => {
                    console.error('[HerdsmanClient] 回退请求也失败:', fallbackError);
                    reject(new Error(`流式请求失败，回退请求也失败: ${fallbackError.message}`));
                });
            }
        });
    }
}
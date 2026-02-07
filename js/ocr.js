// OCR 识别模块
const OCR = {
    // 阿里云OCR识别
    async aliyunOCR(imageBase64) {
        const config = Config.getAIProviderConfig();
        if (!config.accessKeyId || !config.accessKeySecret) {
            throw new Error('请先配置阿里云 AccessKey');
        }

        try {
            // 生成签名
            const endpoint = 'ocr.cn-shanghai.aliyuncs.com';
            const apiVersion = '2021-07-07';
            const action = 'RecognizeGeneral';

            const params = {
                Action: action,
                Version: apiVersion,
                Format: 'JSON',
                SignatureMethod: 'HMAC-SHA1',
                SignatureNonce: Date.now().toString(),
                SignatureVersion: '1.0',
                AccessKeyId: config.accessKeyId,
                Timestamp: new Date().toISOString().replace(/\.\d+Z$/, 'Z')
            };

            // 对图片进行Base64编码
            const imageData = imageBase64.split(',')[1];

            // 发送请求
            const response = await fetch(
                `https://${endpoint}/?${this.buildQueryString(params)}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: `Body=${encodeURIComponent(imageData)}`
                }
            );

            const data = await response.json();

            if (data.Code === '200') {
                return this.parseAliyunResult(data.Data);
            } else {
                throw new Error(`OCR识别失败: ${data.Message}`);
            }
        } catch (error) {
            console.error('阿里云OCR错误:', error);
            throw error;
        }
    },

    // 百度OCR识别
    async baiduOCR(imageBase64) {
        const config = Config.getAIProviderConfig();
        if (!config.apiKey || !config.secretKey) {
            throw new Error('请先配置百度 API Key');
        }

        try {
            // 获取access_token
            const tokenResponse = await fetch(
                `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${config.apiKey}&client_secret=${config.secretKey}`
            );
            const tokenData = await tokenResponse.json();

            if (!tokenData.access_token) {
                throw new Error('获取百度access_token失败');
            }

            // OCR识别
            const imageData = imageBase64.split(',')[1];
            const response = await fetch(
                `https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic?access_token=${tokenData.access_token}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: `image=${encodeURIComponent(imageData)}`
                }
            );

            const data = await response.json();

            if (data.words_result) {
                return this.parseBaiduResult(data);
            } else {
                throw new Error(`OCR识别失败: ${data.error_msg}`);
            }
        } catch (error) {
            console.error('百度OCR错误:', error);
            throw error;
        }
    },

    // 腾讯云OCR识别
    async tencentOCR(imageBase64) {
        const config = Config.getAIProviderConfig();
        if (!config.secretId || !config.secretKey) {
            throw new Error('请先配置腾讯云 SecretId');
        }

        try {
            const imageData = imageBase64.split(',')[1];
            const timestamp = Math.floor(Date.now() / 1000);

            const payload = {
                ImageBase64: imageData,
                LanguageType: 'zh'
            };

            const response = await fetch(
                `https://ocr.tencentcloudapi.com/`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-TC-Action': 'GeneralBasicOCR',
                        'X-TC-Timestamp': timestamp,
                        'X-TC-Region': config.region || 'ap-guangzhou',
                        'Authorization': this.generateTencentAuth(config, 'GeneralBasicOCR', timestamp, JSON.stringify(payload))
                    },
                    body: JSON.stringify(payload)
                }
            );

            const data = await response.json();

            if (data.Response && data.Response.TextDetections) {
                return this.parseTencentResult(data.Response);
            } else {
                throw new Error(`OCR识别失败: ${data.Error?.Message}`);
            }
        } catch (error) {
            console.error('腾讯云OCR错误:', error);
            throw error;
        }
    },

    // OpenAI GPT-4 Vision识别
    async openaiOCR(imageBase64) {
        const config = Config.getAIProviderConfig();
        if (!config.apiKey) {
            throw new Error('请先配置 OpenAI API Key');
        }

        try {
            const response = await fetch(
                `${config.baseURL || 'https://api.openai.com/v1'}/chat/completions`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${config.apiKey}`
                    },
                    body: JSON.stringify({
                        model: config.model || 'gpt-4-vision-preview',
                        messages: [
                            {
                                role: 'user',
                                content: [
                                    {
                                        type: 'text',
                                        text: '请识别这张图片中的作业题目内容，以清晰的格式输出每个题目。只输出题目内容，不要做任何解答。'
                                    },
                                    {
                                        type: 'image_url',
                                        image_url: {
                                            url: imageBase64
                                        }
                                    }
                                ]
                            }
                        ],
                        max_tokens: 2000
                    })
                }
            );

            const data = await response.json();

            if (data.choices && data.choices[0]) {
                const content = data.choices[0].message.content;
                return this.parseOpenAIResult(content);
            } else {
                throw new Error(`OCR识别失败: ${data.error?.message}`);
            }
        } catch (error) {
            console.error('OpenAI OCR错误:', error);
            throw error;
        }
    },

    // 解析阿里云OCR结果
    parseAliyunResult(data) {
        if (data && data.Results && data.Results.length > 0) {
            return data.Results.map(item => item.Content).join('\n');
        }
        return '';
    },

    // 解析百度OCR结果
    parseBaiduResult(data) {
        if (data.words_result) {
            return data.words_result.map(item => item.words).join('\n');
        }
        return '';
    },

    // 解析腾讯云OCR结果
    parseTencentResult(data) {
        if (data.TextDetections) {
            return data.TextDetections.map(item => item.DetectedText).join('\n');
        }
        return '';
    },

    // 解析OpenAI结果
    parseOpenAIResult(content) {
        return content;
    },

    // 构建查询字符串
    buildQueryString(params) {
        const sorted = Object.keys(params).sort();
        return sorted.map(key => `${key}=${encodeURIComponent(params[key])}`).join('&');
    },

    // 生成腾讯云认证
    generateTencentAuth(config, action, timestamp, payload) {
        // 简化的签名生成逻辑
        // 实际使用时需要完整实现腾讯云签名算法
        return `TC3-HMAC-SHA256 Credential=${config.secretId}, SignedHeaders=content-type;host, Signature=...`;
    },

    // 主识别方法
    async recognize(imageBase64) {
        const provider = Config.get('aiProvider');

        switch (provider) {
            case 'aliyun':
                return await this.aliyunOCR(imageBase64);
            case 'baidu':
                return await this.baiduOCR(imageBase64);
            case 'tencent':
                return await this.tencentOCR(imageBase64);
            case 'openai':
                return await this.openaiOCR(imageBase64);
            default:
                return await this.aliyunOCR(imageBase64);
        }
    }
};
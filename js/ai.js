// AI 解题模块
const AI = {
    // 阿里云通义千问
    async qwenGenerate(prompt, question, userAnswer = '') {
        const config = Config.getAIProviderConfig();
        if (!config.accessKeyId || !config.accessKeySecret) {
            throw new Error('请先配置阿里云 AccessKey');
        }

        try {
            const response = await fetch(
                'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${config.accessKeyId}`
                    },
                    body: JSON.stringify({
                        model: 'qwen-max',
                        input: {
                            messages: [
                                {
                                    role: 'system',
                                    content: `你是一个专业的作业辅导AI助手。请按照以下JSON格式输出答案，不要输出任何其他内容：
{
  "questions": [
    {
      "number": "题目序号",
      "question": "题目内容",
      "solutionSteps": ["解题步骤1", "解题步骤2", ...],
      "finalAnswer": "最终答案",
      "knowledgePoints": ["知识点1", "知识点2", ...]
    }
  ]
}

要求：
1. 识别每个题目，按顺序编号
2. 提供详细的解题步骤
3. 给出正确的最终答案
4. 列出本题考察的知识点
5. 确保输出的JSON格式正确，可以被JSON.parse()解析
6. 如果用户提供了答案，需要分析其正确性，并在correction字段中标注错误位置
7. 对于数学题，用标准数学符号
8. 对于选择题，说明每个选项的正误原因`
                                },
                                {
                                    role: 'user',
                                    content: userAnswer ? `${prompt}\n\n用户答案：\n${userAnswer}` : prompt
                                }
                            ]
                        },
                        parameters: {
                            result_format: 'message'
                        }
                    })
                }
            );

            const data = await response.json();

            if (data.output && data.output.choices && data.output.choices[0]) {
                const content = data.output.choices[0].message.content;
                return this.parseAIResponse(content, userAnswer);
            } else {
                throw new Error(`AI生成失败: ${data.message}`);
            }
        } catch (error) {
            console.error('阿里云AI错误:', error);
            throw error;
        }
    },

    // 百度文心一言
    async ernieGenerate(prompt, question, userAnswer = '') {
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

            const response = await fetch(
                `https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/ernie-4.0-8k?access_token=${tokenData.access_token}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        messages: [
                            {
                                role: 'user',
                                content: userAnswer ? `${prompt}\n\n用户答案：\n${userAnswer}` : prompt
                            }
                        ]
                    })
                }
            );

            const data = await response.json();

            if (data.result) {
                return this.parseAIResponse(data.result, userAnswer);
            } else {
                throw new Error(`AI生成失败: ${data.error_msg}`);
            }
        } catch (error) {
            console.error('百度AI错误:', error);
            throw error;
        }
    },

    // 腾讯混元
    async hunyuanGenerate(prompt, question, userAnswer = '') {
        const config = Config.getAIProviderConfig();
        if (!config.secretId || !config.secretKey) {
            throw new Error('请先配置腾讯云 SecretId');
        }

        try {
            const response = await fetch(
                'https://hunyuan.tencentcloudapi.com/',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-TC-Action': 'ChatCompletions',
                        'X-TC-Timestamp': Math.floor(Date.now() / 1000),
                        'X-TC-Region': config.region || 'ap-guangzhou',
                        'Authorization': this.generateTencentAuth(config, 'ChatCompletions', Math.floor(Date.now() / 1000), '{}')
                    },
                    body: JSON.stringify({
                        Model: 'hunyuan-pro',
                        Messages: [
                            {
                                Role: 'user',
                                Content: userAnswer ? `${prompt}\n\n用户答案：\n${userAnswer}` : prompt
                            }
                        ]
                    })
                }
            );

            const data = await response.json();

            if (data.Response && data.Response.Choices && data.Response.Choices[0]) {
                return this.parseAIResponse(data.Response.Choices[0].Message.Content, userAnswer);
            } else {
                throw new Error(`AI生成失败: ${data.Error?.Message}`);
            }
        } catch (error) {
            console.error('腾讯云AI错误:', error);
            throw error;
        }
    },

    // OpenAI GPT
    async openaiGenerate(prompt, question, userAnswer = '') {
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
                        model: config.model || 'gpt-4',
                        messages: [
                            {
                                role: 'system',
                                content: `你是一个专业的作业辅导AI助手。请按照以下JSON格式输出答案：
{
  "questions": [
    {
      "number": "题目序号",
      "question": "题目内容",
      "solutionSteps": ["解题步骤1", "解题步骤2", ...],
      "finalAnswer": "最终答案",
      "knowledgePoints": ["知识点1", "知识点2", ...]
    }
  ]
}

要求：
1. 识别每个题目，按顺序编号
2. 提供详细的解题步骤
3. 给出正确的最终答案
4. 列出本题考察的知识点
5. 如果用户提供了答案，需要分析其正确性，并在correction字段中标注错误位置
6. 确保输出的JSON格式正确`
                            },
                            {
                                role: 'user',
                                content: userAnswer ? `${prompt}\n\n用户答案：\n${userAnswer}` : prompt
                            }
                        ],
                        temperature: 0.7,
                        max_tokens: 4000
                    })
                }
            );

            const data = await response.json();

            if (data.choices && data.choices[0]) {
                const content = data.choices[0].message.content;
                return this.parseAIResponse(content, userAnswer);
            } else {
                throw new Error(`AI生成失败: ${data.error?.message}`);
            }
        } catch (error) {
            console.error('OpenAI AI错误:', error);
            throw error;
        }
    },

    // 解析AI响应
    parseAIResponse(content, userAnswer) {
        try {
            // 尝试提取JSON部分
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const result = JSON.parse(jsonMatch[0]);

                // 如果需要纠错且用户提供了答案
                if (Config.get('enableCorrection') && userAnswer) {
                    return this.addCorrection(result, userAnswer);
                }

                return result;
            }

            // 如果无法解析为JSON，返回一个默认结构
            return {
                questions: [{
                    number: '1',
                    question: content.substring(0, 100) + '...',
                    solutionSteps: ['AI无法解析题目，请检查图片清晰度'],
                    finalAnswer: '无法生成答案',
                    knowledgePoints: []
                }]
            };
        } catch (error) {
            console.error('解析AI响应失败:', error);

            // 返回原始内容
            return {
                questions: [{
                    number: '1',
                    question: content.substring(0, 200) + '...',
                    solutionSteps: ['AI响应格式异常，请稍后重试'],
                    finalAnswer: '无法生成答案',
                    knowledgePoints: []
                }]
            };
        }
    },

    // 添加答案纠错
    addCorrection(result, userAnswer) {
        // 这里使用简单的文本对比进行纠错
        // 实际应用中应该使用AI进行智能纠错

        result.questions.forEach((q, index) => {
            if (q.finalAnswer && userAnswer) {
                // 简单的字符串匹配
                const isCorrect = this.checkAnswer(q.finalAnswer, userAnswer);

                q.correction = {
                    userAnswer: userAnswer,
                    isCorrect: isCorrect,
                    errors: isCorrect ? [] : [{
                        position: '答案错误',
                        userValue: userAnswer,
                        correctValue: q.finalAnswer
                    }]
                };
            }
        });

        return result;
    },

    // 简单答案检查
    checkAnswer(correctAnswer, userAnswer) {
        // 去除空格和标点进行比较
        const normalize = str => str.replace(/[\s,，.。;；:：()（）]/g, '').toLowerCase();
        return normalize(correctAnswer) === normalize(userAnswer);
    },

    // 生成腾讯云认证
    generateTencentAuth(config, action, timestamp, payload) {
        // 简化的签名生成逻辑
        return `TC3-HMAC-SHA256 Credential=${config.secretId}, SignedHeaders=content-type;host, Signature=...`;
    },

    // 主生成方法
    async generate(question, userAnswer = '') {
        const provider = Config.get('aiProvider');

        // 构建提示词
        const prompt = `请解答以下作业题目，并提供详细的解题步骤和知识点：

${question}

请严格按照指定的JSON格式输出答案。`;

        switch (provider) {
            case 'aliyun':
                return await this.qwenGenerate(prompt, question, userAnswer);
            case 'baidu':
                return await this.ernieGenerate(prompt, question, userAnswer);
            case 'tencent':
                return await this.hunyuanGenerate(prompt, question, userAnswer);
            case 'openai':
                return await this.openaiGenerate(prompt, question, userAnswer);
            default:
                return await this.qwenGenerate(prompt, question, userAnswer);
        }
    },

    // 智能纠错
    async smartCorrect(question, userAnswer, correctAnswer) {
        const provider = Config.get('aiProvider');
        const config = Config.getAIProviderConfig();

        const prompt = `请分析以下题目和用户答案，指出用户答案中的错误：

题目：${question}

用户答案：${userAnswer}

正确答案：${correctAnswer}

请返回JSON格式：
{
  "isCorrect": true/false,
  "errors": [
    {
      "position": "错误位置描述",
      "userValue": "用户的错误值",
      "correctValue": "正确值",
      "explanation": "错误原因说明"
    }
  ]
}`;

        try {
            // 使用当前AI服务商进行纠错
            const result = await this.generate(prompt);
            return result;
        } catch (error) {
            console.error('智能纠错失败:', error);
            return {
                isCorrect: false,
                errors: [{
                    position: '整体',
                    userValue: userAnswer,
                    correctValue: correctAnswer,
                    explanation: '无法进行详细纠错，请参考正确答案'
                }]
            };
        }
    }
};
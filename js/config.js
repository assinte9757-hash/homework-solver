// 配置管理
const Config = {
    // 默认配置
    defaults: {
        aiProvider: 'aliyun',
        enableCorrection: true,
        aliyun: {
            accessKeyId: '',
            accessKeySecret: '',
            region: 'cn-hangzhou'
        },
        baidu: {
            apiKey: '',
            secretKey: ''
        },
        tencent: {
            secretId: '',
            secretKey: '',
            region: 'ap-guangzhou'
        },
        openai: {
            apiKey: '',
            baseURL: 'https://api.openai.com/v1',
            model: 'gpt-4-vision-preview'
        },
        zhipu: {
            apiKey: '',
            baseURL: 'https://open.bigmodel.cn/api/paas/v4',
            model: 'glm-4v'
        }
    },

    // 当前配置
    current: {},

    // 初始化配置
    init() {
        const saved = localStorage.getItem('homework_config');
        if (saved) {
            try {
                const savedConfig = JSON.parse(saved);
                // 深度合并：保留保存的配置，但用默认值填充缺失的字段
                this.current = {
                    ...this.defaults,
                    ...savedConfig,
                    // 确保每个提供商的配置都完整
                    aliyun: { ...this.defaults.aliyun, ...savedConfig.aliyun },
                    baidu: { ...this.defaults.baidu, ...savedConfig.baidu },
                    tencent: { ...this.defaults.tencent, ...savedConfig.tencent },
                    openai: { ...this.defaults.openai, ...savedConfig.openai },
                    zhipu: { ...this.defaults.zhipu, ...savedConfig.zhipu }
                };
                console.log('配置初始化完成，当前AI提供商:', this.current.aiProvider);
                console.log('智谱配置:', this.current.zhipu);
            } catch (e) {
                console.error('解析配置失败:', e);
                this.current = { ...this.defaults };
            }
        } else {
            this.current = { ...this.defaults };
            console.log('使用默认配置');
        }
    },

    // 保存配置
    save() {
        localStorage.setItem('homework_config', JSON.stringify(this.current));
    },

    // 获取配置
    get(key) {
        return this.current[key];
    },

    // 设置配置
    set(key, value) {
        this.current[key] = value;
    },

    // 获取当前AI服务商配置
    getAIProviderConfig() {
        const provider = this.current.aiProvider;
        return this.current[provider] || {};
    },

    // 验证配置
    validate() {
        const provider = this.current.aiProvider;
        const config = this.current[provider];

        switch (provider) {
            case 'aliyun':
                return config && config.accessKeyId && config.accessKeySecret;
            case 'baidu':
                return config && config.apiKey && config.secretKey;
            case 'tencent':
                return config && config.secretId && config.secretKey;
            case 'openai':
                return config && config.apiKey;
            case 'zhipu':
                return config && config.apiKey;
            default:
                return false;
        }
    },

    // 重置配置
    reset() {
        this.current = { ...this.defaults };
        this.save();
    }
};

// 初始化
Config.init();
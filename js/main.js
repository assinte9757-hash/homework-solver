// 全局变量
let stream = null;
let currentImageData = null;
let currentOCRResult = null;
let currentAIResult = null;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    // 请求相机权限
    requestCameraPermission();

    // 加载保存的设置
    loadSettings();

    // 加载历史记录
    History.renderList();
});

// 请求相机权限
async function requestCameraPermission() {
    try {
        const constraints = {
            video: {
                facingMode: 'environment', // 使用后置摄像头
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            }
        };

        stream = await navigator.mediaDevices.getUserMedia(constraints);
        const videoElement = document.getElementById('cameraPreview');
        videoElement.srcObject = stream;
    } catch (error) {
        console.error('无法访问相机:', error);
        showToast('无法访问相机，请检查权限设置');
    }
}

// 拍照
function capturePhoto() {
    const video = document.getElementById('cameraPreview');
    const canvas = document.getElementById('cameraCanvas');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // 转换为Base64
    currentImageData = canvas.toDataURL('image/jpeg', 0.8);

    // 显示预览
    showPreview();
}

// 从相册选择
function selectFromGallery() {
    document.getElementById('galleryInput').click();
}

// 处理相册选择
function handleGallerySelect(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            currentImageData = e.target.result;
            showPreview();
        };
        reader.readAsDataURL(file);
    }
}

// 显示预览
function showPreview() {
    document.getElementById('cameraSection').style.display = 'none';
    document.getElementById('previewSection').style.display = 'block';
    document.getElementById('previewImage').src = currentImageData;
}

// 重新拍照
function retakePhoto() {
    document.getElementById('previewSection').style.display = 'none';
    document.getElementById('cameraSection').style.display = 'block';
    currentImageData = null;
}

// 显示相机
function showCamera() {
    document.getElementById('resultSection').style.display = 'none';
    document.getElementById('cameraSection').style.display = 'block';
    currentImageData = null;
    currentOCRResult = null;
    currentAIResult = null;
}

// 开始分析
async function startAnalysis() {
    if (!currentImageData) {
        showToast('请先拍照或选择图片');
        return;
    }

    // 检查配置
    if (!Config.validate()) {
        const provider = Config.get('aiProvider');
        const providerNames = {
            'aliyun': '阿里云',
            'baidu': '百度',
            'tencent': '腾讯云',
            'openai': 'OpenAI',
            'zhipu': '智谱AI'
        };
        const providerName = providerNames[provider] || provider;
        console.log('配置验证失败，当前提供商:', provider);
        console.log('当前配置:', Config.current);
        showToast(`请先完成${providerName}的配置`);
        showSettings();
        return;
    }

    // 显示加载中
    showLoading('正在识别作业内容...');
    document.getElementById('previewSection').style.display = 'none';

    try {
        // OCR识别
        updateLoadingText('正在OCR识别...');
        currentOCRResult = await OCR.recognize(currentImageData);

        if (!currentOCRResult || currentOCRResult.trim().length === 0) {
            throw new Error('未能识别到有效的作业内容，请确保图片清晰');
        }

        // AI解题
        updateLoadingText('正在分析题目并生成答案...');
        currentAIResult = await AI.generate(currentOCRResult);

        if (!currentAIResult || !currentAIResult.questions || currentAIResult.questions.length === 0) {
            throw new Error('AI未能生成有效的答案，请稍后重试');
        }

        // 保存到历史记录
        History.add(currentImageData, currentOCRResult, currentAIResult);

        // 渲染结果
        renderResults(currentAIResult);

        // 设置导出数据
        Export.setResult(currentAIResult);

        // 显示结果
        hideLoading();
        document.getElementById('resultSection').style.display = 'block';

        showToast('识别完成！');
    } catch (error) {
        console.error('分析失败:', error);
        hideLoading();
        document.getElementById('cameraSection').style.display = 'block';
        showToast(error.message || '分析失败，请重试');
    }
}

// 渲染结果
function renderResults(aiResult) {
    const resultContent = document.getElementById('resultContent');

    if (!aiResult || !aiResult.questions) {
        resultContent.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>无法显示结果</p>
            </div>
        `;
        return;
    }

    resultContent.innerHTML = aiResult.questions.map((q, index) => `
        <div class="answer-card">
            <div class="answer-header">
                <div class="answer-number">${q.number || (index + 1)}</div>
                <div class="answer-title">${q.question || '题目内容'}</div>
            </div>
            <div class="answer-body">
                <!-- 解题思路 -->
                <div class="solution-steps">
                    <div class="section-title">
                        <i class="fas fa-lightbulb"></i>
                        解题思路
                    </div>
                    <ul class="step-list">
                        ${(q.solutionSteps || ['暂无详细解题步骤']).map(step => `
                            <li>${step}</li>
                        `).join('')}
                    </ul>
                </div>

                <!-- 完整答案及纠错 -->
                <div class="complete-answer">
                    <div class="section-title">
                        <i class="fas fa-check-circle"></i>
                        完整答案及纠错
                    </div>
                    <div class="final-answer">
                        <div class="final-answer-label">正确答案：</div>
                        <div>${q.finalAnswer || '答案生成中...'}</div>
                    </div>

                    ${q.correction && !q.correction.isCorrect ? `
                        <div class="correction-section">
                            <div class="correction-label">
                                <i class="fas fa-exclamation-triangle"></i>
                                答案纠错
                            </div>
                            <div class="correction-content">
                                <div style="margin-bottom: 8px;">
                                    <strong>你的答案：</strong>
                                    <span class="error-highlight">${q.correction.userAnswer || '未提供'}</span>
                                </div>
                                ${(q.correction.errors || []).map(error => `
                                    <div style="margin-bottom: 6px;">
                                        <strong>错误位置：</strong>${error.position}
                                        <br>
                                        <strong>正确应为：</strong>
                                        <span class="correct-highlight">${error.correctValue}</span>
                                        ${error.explanation ? `<br><small>${error.explanation}</small>` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>

                <!-- 考察知识点 -->
                <div class="knowledge-points">
                    <div class="section-title">
                        <i class="fas fa-book"></i>
                        考察知识点
                    </div>
                    <div class="knowledge-tags">
                        ${(q.knowledgePoints || ['暂无知识点标注']).map(point => `
                            <span class="knowledge-tag">${point}</span>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// 显示加载中
function showLoading(text) {
    document.getElementById('loadingSection').style.display = 'flex';
    document.getElementById('loadingText').textContent = text;
}

// 更新加载文本
function updateLoadingText(text) {
    document.getElementById('loadingText').textContent = text;
}

// 隐藏加载中
function hideLoading() {
    document.getElementById('loadingSection').style.display = 'none';
}

// 显示历史记录
function showHistory() {
    History.renderList();
    document.getElementById('historyModal').style.display = 'flex';
}

// 关闭历史记录
function closeHistory() {
    document.getElementById('historyModal').style.display = 'none';
}

// 显示设置
function showSettings() {
    // 加载当前配置
    const provider = Config.get('aiProvider');
    document.getElementById('aiProvider').value = provider;
    document.getElementById('enableCorrection').checked = Config.get('enableCorrection');

    // 加载各服务商配置
    const aliyunConfig = Config.get('aliyun') || {};
    document.getElementById('aliyunAccessKeyId').value = aliyunConfig.accessKeyId || '';
    document.getElementById('aliyunAccessKeySecret').value = aliyunConfig.accessKeySecret || '';

    const baiduConfig = Config.get('baidu') || {};
    document.getElementById('baiduApiKey').value = baiduConfig.apiKey || '';
    document.getElementById('baiduSecretKey').value = baiduConfig.secretKey || '';

    const tencentConfig = Config.get('tencent') || {};
    document.getElementById('tencentSecretId').value = tencentConfig.secretId || '';
    document.getElementById('tencentSecretKey').value = tencentConfig.secretKey || '';

    const openaiConfig = Config.get('openai') || {};
    document.getElementById('openaiApiKey').value = openaiConfig.apiKey || '';
    document.getElementById('openaiBaseURL').value = openaiConfig.baseURL || '';

    const zhipuConfig = Config.get('zhipu') || {};
    document.getElementById('zhipuApiKey').value = zhipuConfig.apiKey || '';
    document.getElementById('zhipuBaseURL').value = zhipuConfig.baseURL || '';

    // 更新显示的字段
    updateProviderFields();

    document.getElementById('settingsModal').style.display = 'flex';
}

// 关闭设置
function closeSettings() {
    document.getElementById('settingsModal').style.display = 'none';
}

// 更新提供商字段
function updateProviderFields() {
    const provider = document.getElementById('aiProvider').value;

    // 隐藏所有配置
    document.querySelectorAll('.provider-config').forEach(el => {
        el.style.display = 'none';
    });

    // 显示对应配置
    document.getElementById(`${provider}Config`).style.display = 'block';
}

// 重置配置
function resetConfig() {
    if (confirm('确定要重置所有配置吗？这将清除所有已保存的API密钥和设置。')) {
        localStorage.removeItem('homework_config');
        console.log('配置已重置');
        closeSettings();
        setTimeout(() => {
            showToast('配置已重置，请重新设置');
        }, 300);
    }
}

// 保存设置
function saveSettings() {
    try {
        // 获取AI提供商
        const provider = document.getElementById('aiProvider').value;
        Config.set('aiProvider', provider);
        Config.set('enableCorrection', document.getElementById('enableCorrection').checked);

        // 保存阿里云配置
        Config.set('aliyun', {
            accessKeyId: document.getElementById('aliyunAccessKeyId').value.trim(),
            accessKeySecret: document.getElementById('aliyunAccessKeySecret').value.trim(),
            region: 'cn-hangzhou'
        });

        // 保存百度配置
        Config.set('baidu', {
            apiKey: document.getElementById('baiduApiKey').value.trim(),
            secretKey: document.getElementById('baiduSecretKey').value.trim()
        });

        // 保存腾讯云配置
        Config.set('tencent', {
            secretId: document.getElementById('tencentSecretId').value.trim(),
            secretKey: document.getElementById('tencentSecretKey').value.trim(),
            region: 'ap-guangzhou'
        });

        // 保存OpenAI配置
        Config.set('openai', {
            apiKey: document.getElementById('openaiApiKey').value.trim(),
            baseURL: document.getElementById('openaiBaseURL').value.trim() || 'https://api.openai.com/v1',
            model: 'gpt-4-vision-preview'
        });

        // 保存智谱配置
        Config.set('zhipu', {
            apiKey: document.getElementById('zhipuApiKey').value.trim(),
            baseURL: document.getElementById('zhipuBaseURL').value.trim() || 'https://open.bigmodel.cn/api/paas/v4',
            model: 'glm-4v'
        });

        // 保存到localStorage
        Config.save();

        closeSettings();
        showToast('设置已保存');
    } catch (error) {
        console.error('保存设置失败:', error);
        showToast('保存失败，请重试');
    }
}

// 加载设置
function loadSettings() {
    // 配置已通过Config.init()自动加载
}

// 导出PDF
function exportToPDF() {
    Export.exportToPDF();
}

// 显示提示消息
function showToast(message) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');

    toastMessage.textContent = message;
    toast.style.display = 'block';

    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

// 点击模态框外部关闭
document.addEventListener('click', function(e) {
    const historyModal = document.getElementById('historyModal');
    const settingsModal = document.getElementById('settingsModal');

    if (e.target === historyModal) {
        closeHistory();
    }
    if (e.target === settingsModal) {
        closeSettings();
    }
});

// 页面卸载时关闭相机
window.addEventListener('beforeunload', function() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
});
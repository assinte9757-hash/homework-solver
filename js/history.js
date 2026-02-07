// 历史记录管理模块
const History = {
    // 存储键
    STORAGE_KEY: 'homework_history',

    // 限制历史记录数量
    MAX_RECORDS: 100,

    // 获取所有历史记录
    getAll() {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error('解析历史记录失败:', e);
                return [];
            }
        }
        return [];
    },

    // 添加历史记录
    add(imageBase64, ocrResult, aiResult) {
        const history = this.getAll();

        const record = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            image: imageBase64,
            ocrResult: ocrResult,
            aiResult: aiResult,
            questionCount: aiResult?.questions?.length || 0
        };

        // 添加到开头
        history.unshift(record);

        // 限制数量
        if (history.length > this.MAX_RECORDS) {
            history.length = this.MAX_RECORDS;
        }

        // 保存
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));

        return record;
    },

    // 获取单条记录
    get(id) {
        const history = this.getAll();
        return history.find(record => record.id === id);
    },

    // 删除记录
    remove(id) {
        let history = this.getAll();
        history = history.filter(record => record.id !== id);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
    },

    // 清空所有记录
    clear() {
        localStorage.removeItem(this.STORAGE_KEY);
    },

    // 格式化日期
    formatDate(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        // 小于1小时
        if (diff < 3600000) {
            const minutes = Math.floor(diff / 60000);
            return minutes < 1 ? '刚刚' : `${minutes}分钟前`;
        }

        // 小于1天
        if (diff < 86400000) {
            const hours = Math.floor(diff / 3600000);
            return `${hours}小时前`;
        }

        // 小于7天
        if (diff < 604800000) {
            const days = Math.floor(diff / 86400000);
            return `${days}天前`;
        }

        // 显示完整日期
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    },

    // 获取预览文本
    getPreviewText(aiResult) {
        if (!aiResult || !aiResult.questions || aiResult.questions.length === 0) {
            return '无法识别题目内容';
        }

        const firstQuestion = aiResult.questions[0];
        const preview = firstQuestion.question || '';
        return preview.length > 100 ? preview.substring(0, 100) + '...' : preview;
    },

    // 渲染历史列表
    renderList() {
        const historyList = document.getElementById('historyList');
        const history = this.getAll();

        if (history.length === 0) {
            historyList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>暂无历史记录</p>
                </div>
            `;
            return;
        }

        historyList.innerHTML = history.map(record => `
            <div class="history-item" onclick="History.view('${record.id}')">
                <div class="history-date">
                    <i class="fas fa-clock"></i>
                    ${this.formatDate(record.timestamp)}
                    <span style="margin-left: 10px; color: var(--primary-color);">
                        <i class="fas fa-list-ol"></i>
                        ${record.questionCount} 题
                    </span>
                </div>
                <div class="history-preview">
                    ${this.getPreviewText(record.aiResult)}
                </div>
                <div class="history-actions">
                    <button class="btn btn-secondary history-btn" onclick="event.stopPropagation(); History.view('${record.id}')">
                        <i class="fas fa-eye"></i>
                        查看
                    </button>
                    <button class="btn btn-secondary history-btn" onclick="event.stopPropagation(); History.delete('${record.id}')">
                        <i class="fas fa-trash"></i>
                        删除
                    </button>
                </div>
            </div>
        `).join('');
    },

    // 查看历史记录
    view(id) {
        const record = this.get(id);
        if (!record) {
            showToast('记录不存在');
            return;
        }

        // 显示结果
        renderResults(record.aiResult);

        // 关闭历史弹窗
        closeHistory();
    },

    // 删除历史记录
    delete(id) {
        if (confirm('确定要删除这条记录吗？')) {
            this.remove(id);
            this.renderList();
            showToast('记录已删除');
        }
    },

    // 清空所有记录
    clearAll() {
        if (confirm('确定要清空所有历史记录吗？此操作不可恢复！')) {
            this.clear();
            this.renderList();
            showToast('历史记录已清空');
        }
    }
};
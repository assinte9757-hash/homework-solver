// 导出模块
const Export = {
    // 当前AI结果
    currentResult: null,

    // 设置当前结果
    setResult(result) {
        this.currentResult = result;
    },

    // 导出为PDF
    async exportToPDF() {
        if (!this.currentResult || !this.currentResult.questions) {
            showToast('没有可导出的内容');
            return;
        }

        try {
            showToast('正在生成PDF...');

            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');

            // 设置字体
            pdf.setFont('helvetica');

            // 添加标题
            pdf.setFontSize(18);
            pdf.setTextColor(40, 40, 40);
            pdf.text('作业解题答案', 105, 20, { align: 'center' });

            // 添加日期
            pdf.setFontSize(10);
            pdf.setTextColor(100, 100, 100);
            const date = new Date().toLocaleString('zh-CN');
            pdf.text(`导出时间: ${date}`, 105, 28, { align: 'center' });

            // 添加分隔线
            pdf.setDrawColor(200, 200, 200);
            pdf.line(20, 32, 190, 32);

            let yPos = 45;
            const pageHeight = 280;
            const margin = 20;

            // 遍历每个题目
            for (let i = 0; i < this.currentResult.questions.length; i++) {
                const q = this.currentResult.questions[i];

                // 检查是否需要新页面
                if (yPos > pageHeight - 50) {
                    pdf.addPage();
                    yPos = 20;
                }

                // 题目标题
                pdf.setFontSize(14);
                pdf.setTextColor(74, 144, 226);
                pdf.text(`第 ${q.number} 题`, margin, yPos);
                yPos += 8;

                // 题目内容
                pdf.setFontSize(10);
                pdf.setTextColor(60, 60, 60);
                const questionLines = pdf.splitTextToSize(q.question || '题目内容', 170);
                pdf.text(questionLines, margin, yPos);
                yPos += questionLines.length * 5 + 5;

                // 解题思路
                pdf.setFontSize(11);
                pdf.setTextColor(74, 144, 226);
                pdf.text('一、解题思路', margin, yPos);
                yPos += 5;

                pdf.setFontSize(10);
                pdf.setTextColor(60, 60, 60);
                if (q.solutionSteps && q.solutionSteps.length > 0) {
                    q.solutionSteps.forEach((step, idx) => {
                        const stepLines = pdf.splitTextToSize(`${idx + 1}. ${step}`, 170);
                        pdf.text(stepLines, margin + 3, yPos);
                        yPos += stepLines.length * 5 + 3;
                    });
                } else {
                    pdf.text('无详细解题步骤', margin + 3, yPos);
                    yPos += 5;
                }
                yPos += 3;

                // 完整答案
                pdf.setFontSize(11);
                pdf.setTextColor(74, 144, 226);
                pdf.text('二、完整答案', margin, yPos);
                yPos += 5;

                pdf.setFontSize(10);
                pdf.setTextColor(60, 60, 60);
                const answerLines = pdf.splitTextToSize(q.finalAnswer || '答案', 170);
                pdf.text(answerLines, margin + 3, yPos);
                yPos += answerLines.length * 5 + 5;

                // 纠错信息（如果有）
                if (q.correction && !q.correction.isCorrect) {
                    pdf.setFontSize(11);
                    pdf.setTextColor(245, 158, 11);
                    pdf.text('答案纠错', margin, yPos);
                    yPos += 5;

                    pdf.setFontSize(9);
                    pdf.setTextColor(60, 60, 60);
                    pdf.text(`你的答案: ${q.correction.userAnswer || '未提供'}`, margin + 3, yPos);
                    yPos += 5;

                    if (q.correction.errors && q.correction.errors.length > 0) {
                        q.correction.errors.forEach(error => {
                            const errorLines = pdf.splitTextToSize(`错误: ${error.position} - 应为 ${error.correctValue}`, 167);
                            pdf.text(errorLines, margin + 3, yPos);
                            yPos += errorLines.length * 4 + 2;
                        });
                    }
                    yPos += 3;
                }

                // 知识点
                if (q.knowledgePoints && q.knowledgePoints.length > 0) {
                    pdf.setFontSize(11);
                    pdf.setTextColor(74, 144, 226);
                    pdf.text('三、考察知识点', margin, yPos);
                    yPos += 5;

                    pdf.setFontSize(10);
                    pdf.setTextColor(60, 60, 60);
                    const pointsText = q.knowledgePoints.join('、');
                    const pointsLines = pdf.splitTextToSize(pointsText, 170);
                    pdf.text(pointsLines, margin + 3, yPos);
                    yPos += pointsLines.length * 5 + 5;
                }

                // 添加分隔线
                yPos += 5;
                pdf.setDrawColor(220, 220, 220);
                pdf.line(margin, yPos, 190, yPos);
                yPos += 10;
            }

            // 添加页脚
            const totalPages = pdf.internal.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                pdf.setPage(i);
                pdf.setFontSize(8);
                pdf.setTextColor(150, 150, 150);
                pdf.text(`第 ${i} 页 / 共 ${totalPages} 页`, 105, 290, { align: 'center' });
            }

            // 保存PDF
            pdf.save(`作业解题答案_${new Date().getTime()}.pdf`);

            showToast('PDF导出成功');
        } catch (error) {
            console.error('导出PDF失败:', error);
            showToast('导出失败，请稍后重试');
        }
    },

    // 导出为图片
    async exportToImage() {
        if (!this.currentResult || !this.currentResult.questions) {
            showToast('没有可导出的内容');
            return;
        }

        try {
            showToast('正在生成图片...');

            const resultContent = document.getElementById('resultContent');
            const canvas = await html2canvas(resultContent, {
                scale: 2,
                useCORS: true,
                logging: false
            });

            // 创建下载链接
            const link = document.createElement('a');
            link.download = `作业解题答案_${new Date().getTime()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();

            showToast('图片导出成功');
        } catch (error) {
            console.error('导出图片失败:', error);
            showToast('导出失败，请稍后重试');
        }
    }
};
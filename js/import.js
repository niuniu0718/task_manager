// 批量导入功能
const BulkImport = {
    previewData: [],
    currentFile: null,

    // 初始化
    init() {
        // 检查 XLSX 库是否加载
        if (typeof XLSX === 'undefined') {
            console.error('XLSX 库未加载，批量导入功能不可用');
            // 延迟检查，可能是网络慢
            setTimeout(() => {
                if (typeof XLSX === 'undefined') {
                    console.warn('XLSX 库仍未加载，请检查网络连接');
                }
            }, 3000);
        }
        this.bindEvents();
    },

    // 绑定事件
    bindEvents() {
        // 选项卡切换
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // 文件上传区点击
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');

        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFile(e.target.files[0]);
            }
        });

        // 拖拽上传
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0) {
                this.handleFile(e.dataTransfer.files[0]);
            }
        });

        // 清除文件
        document.getElementById('clearFile').addEventListener('click', () => {
            this.clearFile();
        });

        // 取消导入
        document.getElementById('cancelImport').addEventListener('click', () => {
            this.clearFile();
        });

        // 确认导入
        document.getElementById('confirmImport').addEventListener('click', () => {
            this.confirmImport();
        });

        // 下载模板
        document.getElementById('downloadTemplate').addEventListener('click', () => {
            this.downloadTemplate();
        });

        // 导出数据
        document.getElementById('exportData').addEventListener('click', () => {
            this.exportData();
        });

        // 按责任人导出 - 切换面板
        document.getElementById('toggleOwnerSelector').addEventListener('click', () => {
            this.toggleOwnerSelector();
        });

        // 全选
        document.getElementById('selectAllOwners').addEventListener('click', () => {
            this.selectAllOwners(true);
        });

        // 取消全选
        document.getElementById('deselectAllOwners').addEventListener('click', () => {
            this.selectAllOwners(false);
        });

        // 导出选中的责任人
        document.getElementById('exportSelectedOwners').addEventListener('click', () => {
            this.exportSelectedOwners();
        });

        // 备份数据
        document.getElementById('backupData').addEventListener('click', () => {
            this.backupData();
        });

        // 恢复备份
        document.getElementById('restoreData').addEventListener('click', () => {
            document.getElementById('backupFileInput').click();
        });

        // 备份文件选择
        document.getElementById('backupFileInput').addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.restoreFromBackup(e.target.files[0]);
                e.target.value = '';
            }
        });
    },

    // 切换选项卡
    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tabName}`);
        });
    },

    // 处理文件
    handleFile(file) {
        // 检查 XLSX 库是否加载
        if (typeof XLSX === 'undefined') {
            alert('文件解析库未加载！\n\n可能原因：\n1. 网络连接问题\n2. CDN 资源被阻止\n\n请检查网络连接或刷新页面重试。');
            this.clearFile();
            return;
        }

        const fileName = file.name.toLowerCase();
        const isValidFormat = fileName.endsWith('.xlsx') || fileName.endsWith('.csv');

        if (!isValidFormat) {
            alert('仅支持 .xlsx 和 .csv 格式的文件');
            return;
        }

        this.currentFile = file;

        // 显示文件名
        document.getElementById('fileName').textContent = file.name;
        document.getElementById('currentFile').style.display = 'flex';
        document.getElementById('uploadArea').style.display = 'none';

        // 读取并解析文件
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = this.parseFile(e.target.result, file.name);
                this.previewData = this.validateData(data);
                this.showPreview();
            } catch (error) {
                console.error('文件解析错误:', error);
                alert('文件解析失败：' + error.message + '\n\n请确保文件格式正确。');
                this.clearFile();
            }
        };
        reader.onerror = () => {
            alert('文件读取失败，请重试。');
            this.clearFile();
        };
        reader.readAsBinaryString(file);
    },

    // 解析文件
    parseFile(data, fileName) {
        if (typeof XLSX === 'undefined') {
            throw new Error('XLSX 库未加载');
        }
        const workbook = XLSX.read(data, { type: 'binary' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        return jsonData;
    },

    // 验证数据
    validateData(data) {
        if (!data || data.length === 0) {
            throw new Error('文件中没有数据');
        }

        return data.map((row, index) => {
            const result = {
                index: index + 1,
                id: this.trimValue(row['任务ID'] || row['id'] || ''),
                content: this.trimValue(row['任务内容'] || row['content'] || ''),
                owner: this.trimValue(row['责任人'] || row['owner'] || ''),
                department: this.trimValue(row['部门'] || row['department'] || ''),
                source: this.trimValue(row['来源'] || row['source'] || ''),
                deadline: this.parseDate(row['计划完成时间'] || row['deadline'] || ''),
                progress: this.trimValue(row['最新进展'] || row['progress'] || ''),
                status: this.parseStatus(row['任务状态'] || row['status'] || ''),
                errors: [],
                warnings: []
            };

            // 检查是否为更新模式（有任务ID）
            if (result.id) {
                const existingTask = TaskStorage.getTasks().find(t => t.id === result.id);
                if (existingTask) {
                    result.isUpdate = true;
                    result.originalTask = existingTask;

                    // 检查不可修改字段是否被修改
                    if (result.content && result.content !== existingTask.content) {
                        result.warnings.push('⚠️ 任务内容不可修改，将保持原值');
                        result.content = existingTask.content; // 恢复原值
                    }

                    // 记录原始进展用于对比
                    result.originalProgress = existingTask.progress || '';
                    result.existingHistory = existingTask.progressHistory || [];
                }
            }

            // 验证必填字段
            if (!result.content) {
                result.errors.push('任务内容不能为空');
            }
            if (!result.owner) {
                result.errors.push('责任人不能为空');
            }
            if (!result.deadline) {
                result.errors.push('日期格式无效');
            }

            // 验证状态
            if (row['任务状态'] || row['status']) {
                if (!result.status) {
                    result.warnings.push('状态值无法识别，将自动计算');
                }
            }

            // 检查是否需要计算状态
            if (result.deadline && !result.status) {
                const now = new Date();
                now.setHours(0, 0, 0, 0);
                const deadline = new Date(result.deadline);
                result.status = now > deadline ? 'delay' : 'ongoing';
            }

            return result;
        });
    },

    // 去除空格
    trimValue(value) {
        return typeof value === 'string' ? value.trim() : value;
    },

    // 解析日期
    parseDate(dateStr) {
        if (!dateStr) return null;

        dateStr = this.trimValue(dateStr);

        // 尝试多种日期格式
        const formats = [
            /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/, // YYYY-MM-DD 或 YYYY/MM/DD
            /(\d{4})年(\d{1,2})月(\d{1,2})日/,    // YYYY年MM月DD日
            /(\d{1,2})[-/](\d{1,2})[-/](\d{4})/  // MM-DD-YYYY 或 MM/DD/YYYY
        ];

        for (const format of formats) {
            const match = dateStr.match(format);
            if (match) {
                let year, month, day;
                if (format === formats[2]) {
                    // MM-DD-YYYY 格式
                    [_, month, day, year] = match;
                } else {
                    [_, year, month, day] = match;
                }
                const date = new Date(year, month - 1, day);
                if (!isNaN(date.getTime())) {
                    return date.toISOString().split('T')[0];
                }
            }
        }

        return null;
    },

    // 解析状态
    parseStatus(statusStr) {
        if (!statusStr) return null;
        statusStr = this.trimValue(String(statusStr).toLowerCase());

        const statusMap = {
            'ongoing': 'ongoing',
            '进行中': 'ongoing',
            'delay': 'delay',
            '延期': 'delay',
            'delayed': 'delay',
            'close': 'close',
            'closed': 'close',
            '完成': 'close',
            '已完成': 'close',
            'done': 'close'
        };

        return statusMap[statusStr] || null;
    },

    // 显示预览
    showPreview() {
        const container = document.getElementById('previewContainer');
        const tbody = document.getElementById('previewTableBody');
        const summary = document.getElementById('previewSummary');

        // 统计错误和警告
        const errorCount = this.previewData.filter(item => item.errors.length > 0).length;
        const warningCount = this.previewData.filter(item => item.warnings.length > 0).length;

        // 显示摘要
        summary.innerHTML = `
            共 ${this.previewData.length} 条数据
            ${errorCount > 0 ? `<span class="error-count">${errorCount} 条错误</span>` : ''}
            ${warningCount > 0 ? `<span style="color: var(--color-warning)">${warningCount} 条警告</span>` : ''}
        `;

        // 生成表格
        tbody.innerHTML = this.previewData.map(item => {
            const rowClass = item.errors.length > 0 ? 'error-row' : (item.warnings.length > 0 ? 'warning-row' : '');
            const statusDisplay = this.getStatusDisplay(item.status);
            const validationStatus = item.errors.length > 0
                ? '<span class="status-error">❌ 有错误</span>'
                : (item.warnings.length > 0 ? '<span class="status-warning">⚠️ 有警告</span>' : '<span class="status-ok">✓ 正常</span>');

            return `
                <tr class="${rowClass}">
                    <td>${item.index}</td>
                    <td>
                        ${this.escapeHtml(item.content)}
                        ${item.errors.filter(e => e.includes('任务内容')).map(e => `<span class="error-hint">⚠️ ${e}</span>`).join('')}
                    </td>
                    <td>
                        ${this.escapeHtml(item.owner)}
                        ${item.errors.filter(e => e.includes('责任人')).map(e => `<span class="error-hint">⚠️ ${e}</span>`).join('')}
                    </td>
                    <td>${this.escapeHtml(item.department)}</td>
                    <td>${this.escapeHtml(item.source)}</td>
                    <td>
                        ${item.deadline}
                        ${item.errors.filter(e => e.includes('日期')).map(e => `<span class="error-hint">⚠️ ${e}</span>`).join('')}
                    </td>
                    <td>${this.escapeHtml(item.progress)}</td>
                    <td>${statusDisplay}</td>
                    <td>${validationStatus}</td>
                </tr>
            `;
        }).join('');

        container.style.display = 'block';
    },

    // 获取状态显示
    getStatusDisplay(status) {
        const statusMap = {
            'ongoing': '<span style="color: var(--color-ongoing)">进行中</span>',
            'delay': '<span style="color: var(--color-delay)">已延期</span>',
            'close': '<span style="color: var(--color-close)">已完成</span>'
        };
        return statusMap[status] || status;
    },

    // HTML转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    },

    // 确认导入
    confirmImport() {
        // 检查存储是否可用
        if (!TaskStorage.isAvailable) {
            alert('存储功能不可用！请关闭隐私模式或检查浏览器设置。');
            return;
        }

        const overwrite = document.getElementById('overwriteMode').checked;

        // 只导入没有错误的数据
        const validData = this.previewData.filter(item => item.errors.length === 0);

        if (validData.length === 0) {
            alert('没有可以导入的数据，请检查文件中的错误');
            return;
        }

        let existingTasks = TaskStorage.getTasks();
        let updateCount = 0;
        let newCount = 0;
        let historyAddedCount = 0;

        // 处理每条数据
        validData.forEach(item => {
            if (item.id && item.isUpdate) {
                // 更新已有任务
                const taskIndex = existingTasks.findIndex(t => t.id === item.id);
                if (taskIndex !== -1) {
                    const originalTask = existingTasks[taskIndex];

                    // 只更新允许修改的字段：状态、最新进展
                    const updates = {
                        status: item.status,
                        updatedAt: new Date().toISOString()
                    };

                    // 如果"最新进展"有变化，添加到进展历史中
                    if (item.progress && item.progress !== originalTask.progress) {
                        const progressHistory = originalTask.progressHistory || [];
                        updates.progressHistory = [
                            { time: new Date().toISOString(), content: item.progress },
                            ...progressHistory
                        ];
                        updates.progress = item.progress;
                        historyAddedCount++;
                    }

                    existingTasks[taskIndex] = {
                        ...originalTask,
                        ...updates
                    };
                    updateCount++;
                    return;
                }
            }

            // 新增任务
            existingTasks.push({
                id: item.id || this.generateId(),
                content: item.content,
                owner: item.owner,
                department: item.department,
                source: item.source,
                deadline: item.deadline,
                progress: item.progress,
                status: item.status,
                createdAt: new Date().toISOString()
            });
            newCount++;
        });

        // 如果选择了覆盖模式，只保留导入的数据
        if (overwrite) {
            const importedIds = validData.map(item => item.id || this.generateId());
            existingTasks = existingTasks.filter(t => importedIds.includes(t.id));
        }

        // 保存
        const success = TaskStorage.saveTasks(existingTasks);

        if (!success) {
            alert('导入失败，数据保存出错。请检查浏览器存储设置。');
            return;
        }

        // 显示结果
        let message = '';
        if (updateCount > 0) {
            message = `成功更新 ${updateCount} 条任务`;
            if (historyAddedCount > 0) {
                message += `（新增 ${historyAddedCount} 条进展记录）`;
            }
            if (newCount > 0) {
                message += `，新增 ${newCount} 条任务`;
            }
        } else {
            message = `成功导入 ${newCount} 条任务`;
        }
        const errorCount = this.previewData.length - validData.length;
        if (errorCount > 0) {
            message += `，跳过 ${errorCount} 条有错误的数据`;
        }
        alert(message);

        // 清理并刷新
        this.clearFile();
        App.tasks = TaskStorage.getTasks();
        App.updateAllTaskStatus();
        // 直接调用 renderCore 立即刷新，不使用节流
        App.renderCore();
        this.updateExportOwnerList();

        // 切换到任务列表
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === 'all');
        });
        App.currentFilter = 'all';
    },

    // 清除文件
    clearFile() {
        this.currentFile = null;
        this.previewData = [];
        document.getElementById('currentFile').style.display = 'none';
        document.getElementById('uploadArea').style.display = 'block';
        document.getElementById('previewContainer').style.display = 'none';
        document.getElementById('fileInput').value = '';
        document.getElementById('overwriteMode').checked = false;
    },

    // 生成唯一ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    // 下载模板
    downloadTemplate() {
        const templateData = [
            {
                '任务内容': '完成需求文档',
                '责任人': '张三',
                '部门': '研发部',
                '来源': '产品需求',
                '计划完成时间': '2026-03-15',
                '最新进展': '已完成初稿',
                '任务状态': ''
            },
            {
                '任务内容': '代码审查',
                '责任人': '李四',
                '部门': '研发部',
                '来源': '内部评审',
                '计划完成时间': '2026-03-20',
                '最新进展': '进行中',
                '任务状态': 'ongoing'
            },
            {
                '任务内容': '测试用例编写',
                '责任人': '王五',
                '部门': '测试部',
                '来源': '质量保障',
                '计划完成时间': '2026-03-10',
                '最新进展': '已完成',
                '任务状态': 'close'
            }
        ];

        const worksheet = XLSX.utils.json_to_sheet(templateData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, '导入模板');
        XLSX.writeFile(workbook, '任务导入模板.xlsx');
    },

    // 导出数据（支持单选和多选）
    exportData(filterOwners = null) {
        let tasks = TaskStorage.getTasks();

        if (tasks.length === 0) {
            alert('暂无数据可导出');
            return;
        }

        // 按责任人筛选（支持单选和多选）
        if (filterOwners) {
            const ownerArray = Array.isArray(filterOwners) ? filterOwners : [filterOwners];
            tasks = tasks.filter(task => {
                const taskOwners = this.parseOwners(task.owner);
                return taskOwners.some(o => ownerArray.includes(o));
            });
            if (tasks.length === 0) {
                alert('选中的责任人暂无任务');
                return;
            }
        }

        // 转换为导出格式（包含任务ID用于后续更新）
        // 字段说明：带*的列可修改，其他列请勿修改
        const exportData = tasks.map(task => ({
            '任务ID（不可修改）': task.id,
            '*任务内容': task.content,
            '*责任人': task.owner,
            '*部门': task.department || '',
            '*来源': task.source || '',
            '*计划完成时间': task.deadline,
            '*最新进展（将添加到历史）': task.progress || '',
            '*任务状态': task.status,
            '创建时间（不可修改）': task.createdAt
        }));

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, '任务列表');

        // 生成文件名（包含日期和责任人）
        const date = new Date().toISOString().split('T')[0];
        let suffix = '';
        if (filterOwners) {
            const ownerArray = Array.isArray(filterOwners) ? filterOwners : [filterOwners];
            if (ownerArray.length === 1) {
                suffix = `_${ownerArray[0]}`;
            } else if (ownerArray.length <= 3) {
                suffix = `_${ownerArray.join('_')}`;
            } else {
                suffix = `_${ownerArray.length}人`;
            }
        }
        XLSX.writeFile(workbook, `任务导出${suffix}_${date}.xlsx`);
    },

    // 解析责任人（支持逗号分隔）
    parseOwners(ownerStr) {
        if (!ownerStr) return ['未分配'];
        return ownerStr.split(/[,，;；]/)
            .map(o => o.trim())
            .filter(o => o.length > 0);
    },

    // 更新责任人下拉列表
    updateExportOwnerList() {
        const tasks = TaskStorage.getTasks();
        const owners = new Set();

        tasks.forEach(task => {
            const taskOwners = this.parseOwners(task.owner);
            taskOwners.forEach(o => owners.add(o));
        });

        // 更新多选面板
        const container = document.getElementById('ownerCheckboxes');
        if (!container) return;

        container.innerHTML = [...owners].sort().map(owner => `
            <label class="owner-checkbox" data-owner="${this.escapeHtml(owner)}">
                <input type="checkbox" value="${this.escapeHtml(owner)}">
                <span>${this.escapeHtml(owner)}</span>
            </label>
        `).join('');

        // 绑定点击事件
        container.querySelectorAll('.owner-checkbox').forEach(label => {
            label.addEventListener('click', (e) => {
                e.preventDefault();
                label.classList.toggle('selected');
                const checkbox = label.querySelector('input');
                checkbox.checked = label.classList.contains('selected');
            });
        });
    },

    // 切换责任人选择面板
    toggleOwnerSelector() {
        const panel = document.getElementById('ownerSelectorPanel');
        if (panel.style.display === 'none') {
            panel.style.display = 'block';
            this.updateExportOwnerList();
        } else {
            panel.style.display = 'none';
        }
    },

    // 全选/取消全选
    selectAllOwners(selected) {
        const checkboxes = document.querySelectorAll('#ownerCheckboxes .owner-checkbox');
        checkboxes.forEach(label => {
            if (selected) {
                label.classList.add('selected');
                label.querySelector('input').checked = true;
            } else {
                label.classList.remove('selected');
                label.querySelector('input').checked = false;
            }
        });
    },

    // 获取选中的责任人
    getSelectedOwners() {
        const selected = document.querySelectorAll('#ownerCheckboxes .owner-checkbox.selected');
        return Array.from(selected).map(label => label.dataset.owner);
    },

    // 导出选中的责任人
    exportSelectedOwners() {
        const owners = this.getSelectedOwners();
        if (owners.length === 0) {
            alert('请至少选择一个责任人');
            return;
        }
        this.exportData(owners);
    },

    // 备份数据到本地文件
    backupData() {
        const tasks = TaskStorage.getTasks();

        if (tasks.length === 0) {
            alert('暂无数据可备份');
            return;
        }

        // 创建备份数据（包含元信息）
        const backup = {
            version: '1.0',
            backupTime: new Date().toISOString(),
            taskCount: tasks.length,
            tasks: tasks
        };

        // 导出为 JSON 文件
        const dataStr = JSON.stringify(backup, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        const date = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        a.download = `任务备份_${date}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // 记录备份时间
        localStorage.setItem('lastBackupTime', new Date().toISOString());
        this.showBackupInfo('备份成功！已下载 ' + tasks.length + ' 条任务');
    },

    // 从备份文件恢复数据
    restoreFromBackup(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const backup = JSON.parse(e.target.result);

                if (!backup.tasks || !Array.isArray(backup.tasks)) {
                    throw new Error('无效的备份文件格式');
                }

                const confirmMsg = `确定要从备份恢复 ${backup.taskCount} 条任务吗？\n\n备份时间: ${new Date(backup.backupTime).toLocaleString()}\n\n注意：这将覆盖当前所有数据！`;

                if (!confirm(confirmMsg)) {
                    return;
                }

                // 保存恢复的数据
                TaskStorage.saveTasks(backup.tasks);
                App.tasks = TaskStorage.getTasks();
                App.updateAllTaskStatus();
                // 直接调用 renderCore 立即刷新
                App.renderCore();
                this.updateExportOwnerList();

                alert('恢复成功！已恢复 ' + backup.taskCount + ' 条任务');
            } catch (error) {
                alert('恢复失败：' + error.message);
            }
        };
        reader.readAsText(file);
    },

    // 检查自动备份提醒
    checkAutoBackup() {
        const lastBackup = localStorage.getItem('lastBackupTime');
        const backupInfo = document.getElementById('backupInfo');

        if (!lastBackup) {
            // 从未备份过
            if (backupInfo && TaskStorage.getTasks().length > 0) {
                backupInfo.textContent = '💡 提示：您还没有备份过数据，建议点击"备份数据"保存一份';
                backupInfo.classList.add('show');
            }
            return;
        }

        const lastBackupDate = new Date(lastBackup);
        const now = new Date();
        const daysSinceBackup = Math.floor((now - lastBackupDate) / (1000 * 60 * 60 * 24));

        if (daysSinceBackup >= 7 && backupInfo && TaskStorage.getTasks().length > 0) {
            backupInfo.textContent = `⚠️ 距离上次备份已过 ${daysSinceBackup} 天，建议立即备份数据！`;
            backupInfo.classList.add('show');
            backupInfo.style.background = '#FEF3C7';
            backupInfo.style.color = '#92400E';
        }
    },

    // 显示备份信息
    showBackupInfo(message) {
        const backupInfo = document.getElementById('backupInfo');
        if (backupInfo) {
            backupInfo.textContent = '✅ ' + message;
            backupInfo.classList.add('show');
            backupInfo.style.background = '#D1FAE5';
            backupInfo.style.color = '#065F46';
            setTimeout(() => {
                backupInfo.classList.remove('show');
            }, 5000);
        }
    }
};

// 初始化导入功能
document.addEventListener('DOMContentLoaded', () => {
    BulkImport.init();
    // 延迟更新责任人列表，确保任务已加载
    setTimeout(() => {
        BulkImport.updateExportOwnerList();
        BulkImport.checkAutoBackup();
    }, 500);
});

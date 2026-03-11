// 应用主逻辑 - 性能优化版
const App = {
    tasks: [],
    currentFilter: 'all',
    taskToDelete: null,
    taskToEdit: null,
    lastRenderTime: 0,
    renderCache: {},

    // 节流函数
    throttle(func, delay) {
        let lastCall = 0;
        return function(...args) {
            const now = Date.now();
            if (now - lastCall >= delay) {
                lastCall = now;
                func.apply(this, args);
            }
        };
    },

    // 防抖函数
    debounce(func, delay) {
        let timeoutId;
        return function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    },

    // 初始化应用
    init() {
        this.tasks = TaskStorage.getTasks();
        this.updateAllTaskStatus();
        ChartManager.init();
        this.render();
        this.bindEvents();
        // 改为每5分钟刷新一次，减少CPU占用
        this.startAutoRefresh();
    },

    // 更新所有任务状态
    updateAllTaskStatus() {
        this.tasks = this.tasks.map(task => ({
            ...task,
            status: this.calculateStatus(task)
        }));
    },

    // 计算任务状态
    calculateStatus(task) {
        if (task.status === 'close') return 'close';
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const deadline = new Date(task.deadline);
        return now > deadline ? 'delay' : 'ongoing';
    },

    // 检查是否即将到期（7天内）
    isUpcoming(task) {
        if (task.status === 'close') return false;
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const deadline = new Date(task.deadline);
        const daysUntil = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
        return daysUntil >= 0 && daysUntil <= 7;
    },

    // 计算延期天数
    getDelayDays(task) {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const deadline = new Date(task.deadline);
        const diffTime = now - deadline;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    },

    // 绑定事件
    bindEvents() {
        // 表单提交
        document.getElementById('taskForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addTask();
        });

        // 筛选按钮
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.filter;
                this.renderTaskList();
            });
        });

        // 删除确认弹窗
        document.getElementById('cancelDelete').addEventListener('click', () => {
            this.closeDeleteModal();
        });

        document.getElementById('confirmDelete').addEventListener('click', () => {
            if (this.taskToDelete) {
                TaskStorage.deleteTask(this.taskToDelete);
                this.tasks = TaskStorage.getTasks();
                this.closeDeleteModal();
                this.render();
            }
        });

        // 点击弹窗外部关闭
        document.getElementById('deleteModal').addEventListener('click', (e) => {
            if (e.target.id === 'deleteModal') {
                this.closeDeleteModal();
            }
        });

        // 编辑弹窗
        document.getElementById('cancelEdit').addEventListener('click', () => {
            this.closeEditModal();
        });

        document.getElementById('editForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveEditTask();
        });

        document.getElementById('editModal').addEventListener('click', (e) => {
            if (e.target.id === 'editModal') {
                this.closeEditModal();
            }
        });

        // 任务列表按钮事件委托
        document.getElementById('taskList').addEventListener('click', (e) => {
            const completeBtn = e.target.closest('.btn-complete');
            const editBtn = e.target.closest('.btn-edit');
            const deleteBtn = e.target.closest('.btn-delete');

            if (completeBtn) {
                const taskId = completeBtn.dataset.taskId;
                this.completeTask(taskId);
            } else if (editBtn) {
                const taskId = editBtn.dataset.taskId;
                this.openEditModal(taskId);
            } else if (deleteBtn) {
                const taskId = deleteBtn.dataset.taskId;
                this.showDeleteModal(taskId);
            }
        });
    },

    // 添加任务
    addTask() {
        const contentInput = document.getElementById('taskContent');
        const ownerInput = document.getElementById('taskOwner');
        const deadlineInput = document.getElementById('taskDeadline');

        const content = contentInput.value.trim();
        const owner = ownerInput.value.trim();
        const department = document.getElementById('taskDepartment').value.trim();
        const deadline = deadlineInput.value;
        const progress = document.getElementById('taskProgress').value.trim();

        if (!content || !owner || !deadline) {
            alert('请填写所有必填字段');
            return;
        }

        const task = {
            id: this.generateId(),
            content,
            owner,
            department,
            deadline,
            progress,
            status: 'ongoing',
            createdAt: new Date().toISOString()
        };

        if (TaskStorage.addTask(task)) {
            this.tasks = TaskStorage.getTasks();
            contentInput.value = '';
            ownerInput.value = '';
            document.getElementById('taskDepartment').value = '';
            deadlineInput.value = '';
            document.getElementById('taskProgress').value = '';
            this.render();
        }
    },

    // 完成任务
    completeTask(taskId) {
        TaskStorage.updateTask(taskId, { status: 'close' });
        this.tasks = TaskStorage.getTasks();
        this.render();
    },

    // 打开编辑弹窗
    openEditModal(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        this.taskToEdit = taskId;

        // 填充表单
        document.getElementById('editContent').value = task.content;
        document.getElementById('editOwner').value = task.owner;
        document.getElementById('editDepartment').value = task.department || '';
        document.getElementById('editDeadline').value = task.deadline;
        document.getElementById('editProgress').value = task.progress || '';
        document.getElementById('editStatus').checked = task.status === 'close';

        document.getElementById('editModal').classList.add('show');
    },

    // 关闭编辑弹窗
    closeEditModal() {
        this.taskToEdit = null;
        document.getElementById('editModal').classList.remove('show');
    },

    // 保存编辑
    saveEditTask() {
        const content = document.getElementById('editContent').value.trim();
        const owner = document.getElementById('editOwner').value.trim();
        const department = document.getElementById('editDepartment').value.trim();
        const deadline = document.getElementById('editDeadline').value;
        const progress = document.getElementById('editProgress').value.trim();
        const isCompleted = document.getElementById('editStatus').checked;

        if (!content || !owner || !deadline) {
            alert('请填写所有必填字段');
            return;
        }

        const updates = {
            content,
            owner,
            department,
            deadline,
            progress,
            status: isCompleted ? 'close' : this.calculateStatus({ deadline, status: 'ongoing' })
        };

        TaskStorage.updateTask(this.taskToEdit, updates);
        this.tasks = TaskStorage.getTasks();
        this.closeEditModal();
        this.render();
    },

    // 显示删除确认弹窗
    showDeleteModal(taskId) {
        this.taskToDelete = taskId;
        document.getElementById('deleteModal').classList.add('show');
    },

    // 关闭删除确认弹窗
    closeDeleteModal() {
        this.taskToDelete = null;
        document.getElementById('deleteModal').classList.remove('show');
    },

    // 生成唯一ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    // 渲染整个界面 - 使用节流优化
    render: this.throttle(function() {
        requestAnimationFrame(() => {
            this.updateMetrics();
            this.updateOwnerTable();
            this.updateCharts();
            this.renderTaskList();
            this.updateOwnerDatalist();
        });
    }, 100),

    // 更新关键指标
    updateMetrics() {
        const total = this.tasks.length;
        const upcoming = this.tasks.filter(t => this.isUpcoming(t)).length;
        const delayed = this.tasks.filter(t => t.status === 'delay').length;
        const completed = this.tasks.filter(t => t.status === 'close').length;

        // 使用文本节点更新，减少DOM操作
        this.setTextContent('totalTasks', total);
        this.setTextContent('upcomingTasks', upcoming);
        this.setTextContent('delayedTasks', delayed);
        this.setTextContent('completedTasks', completed);

        // 7天内到期超过3个显示红色警告
        const upcomingCard = document.getElementById('upcomingCard');
        if (upcoming > 3) {
            upcomingCard.classList.remove('warning');
            upcomingCard.classList.add('danger');
        } else {
            upcomingCard.classList.remove('danger');
            upcomingCard.classList.add('warning');
        }
    },

    // 设置文本内容的辅助函数
    setTextContent(id, text) {
        const el = document.getElementById(id);
        if (el && el.textContent !== String(text)) {
            el.textContent = text;
        }
    },

    // 更新部门统计表 - 使用缓存
    updateOwnerTable() {
        const cacheKey = JSON.stringify(this.tasks.map(t => ({ d: t.department, s: t.status })));
        if (this.renderCache.deptTable === cacheKey) return;
        this.renderCache.deptTable = cacheKey;

        const deptStats = {};

        this.tasks.forEach(task => {
            const dept = task.department || '未分配';
            if (!deptStats[dept]) {
                deptStats[dept] = { total: 0, ongoing: 0, delay: 0, close: 0 };
            }
            deptStats[dept].total++;
            deptStats[dept][task.status]++;
        });

        // 按延期数量排序
        const sortedDepts = Object.entries(deptStats)
            .map(([department, stats]) => ({ department, ...stats }))
            .sort((a, b) => b.delay - a.delay);

        const tbody = document.getElementById('ownerTableBody');

        if (sortedDepts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-state">暂无数据</td></tr>';
            return;
        }

        tbody.innerHTML = sortedDepts.map(d => `
            <tr>
                <td>${this.escapeHtml(d.department)}</td>
                <td>${d.total}</td>
                <td style="color: var(--color-ongoing)">${d.ongoing}</td>
                <td style="color: var(--color-delay)">${d.delay}</td>
                <td style="color: var(--color-close)">${d.close}</td>
            </tr>
        `).join('');

        return sortedDepts;
    },

    // 更新图表 - 使用防抖优化
    updateCharts: this.debounce(function() {
        const ongoing = this.tasks.filter(t => t.status === 'ongoing').length;
        const delayed = this.tasks.filter(t => t.status === 'delay').length;
        const completed = this.tasks.filter(t => t.status === 'close').length;

        ChartManager.updateStatusChart(ongoing, delayed, completed);

        const ownerData = this.updateOwnerTable() || [];
        ChartManager.updateOwnerChart(ownerData);
    }, 200),

    // 更新责任人和部门数据列表（用于下拉提示）
    updateOwnerDatalist() {
        const owners = [...new Set(this.tasks.map(t => t.owner))];
        const ownerDatalist = document.getElementById('ownerList');
        if (ownerDatalist) {
            ownerDatalist.innerHTML = owners.map(o => `<option value="${o}">`).join('');
        }

        const departments = [...new Set(this.tasks.map(t => t.department).filter(d => d))];
        const deptDatalist = document.getElementById('departmentList');
        if (deptDatalist) {
            deptDatalist.innerHTML = departments.map(d => `<option value="${d}">`).join('');
        }
    },

    // 渲染任务列表 - 使用DocumentFragment优化
    renderTaskList() {
        const taskList = document.getElementById('taskList');

        let filteredTasks = this.tasks;

        if (this.currentFilter !== 'all') {
            filteredTasks = this.tasks.filter(t => t.status === this.currentFilter);
        }

        // 排序：延期任务置顶，然后按deadline排序
        filteredTasks.sort((a, b) => {
            if (a.status === 'delay' && b.status !== 'delay') return -1;
            if (a.status !== 'delay' && b.status === 'delay') return 1;
            return new Date(a.deadline) - new Date(b.deadline);
        });

        if (filteredTasks.length === 0) {
            taskList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📭</div>
                    <p>暂无任务</p>
                </div>
            `;
            return;
        }

        // 使用DocumentFragment减少DOM操作
        const fragment = document.createDocumentFragment();
        const tempDiv = document.createElement('div');

        filteredTasks.forEach(task => {
            const statusClass = `status-${task.status}`;
            let badge = '';

            if (task.status === 'close') {
                badge = '<span class="task-badge success">✓ 已完成</span>';
            } else if (task.status === 'delay') {
                const delayDays = this.getDelayDays(task);
                badge = `<span class="task-badge danger">⚠️ 已延期 ${delayDays}天</span>`;
            } else if (this.isUpcoming(task)) {
                badge = '<span class="task-badge warning">⏰ 即将到期</span>';
            }

            // 根据任务状态显示不同的按钮
            let actionButtons = '';
            if (task.status === 'close') {
                actionButtons = `
                    <button class="action-btn btn-edit" data-task-id="${task.id}">编辑</button>
                    <button class="action-btn btn-delete" data-task-id="${task.id}">删除</button>
                `;
            } else {
                actionButtons = `
                    <button class="action-btn btn-complete" data-task-id="${task.id}">完成</button>
                    <button class="action-btn btn-edit" data-task-id="${task.id}">编辑</button>
                    <button class="action-btn btn-delete" data-task-id="${task.id}">删除</button>
                `;
            }

            const department = task.department ? `<span>🏢 ${this.escapeHtml(task.department)}</span>` : '';
            const progress = task.progress ? `<span>📝 ${this.escapeHtml(task.progress)}</span>` : '';

            tempDiv.innerHTML = `
                <div class="task-card ${statusClass}">
                    <div class="task-content">
                        <div class="task-title">${this.escapeHtml(task.content)}</div>
                        <div class="task-meta">
                            <span>👤 ${this.escapeHtml(task.owner)}</span>
                            ${department}
                            <span>📅 ${task.deadline}</span>
                            ${badge}
                        </div>
                        ${progress ? `<div class="task-progress">${progress}</div>` : ''}
                    </div>
                    <div class="task-actions">
                        ${actionButtons}
                    </div>
                </div>
            `;
            fragment.appendChild(tempDiv.firstElementChild);
        });

        taskList.innerHTML = '';
        taskList.appendChild(fragment);
    },

    // HTML转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    },

    // 启动自动刷新（每5分钟）
    startAutoRefresh() {
        setInterval(() => {
            this.updateAllTaskStatus();
            this.render();
        }, 5 * 60 * 1000); // 改为5分钟
    }
};

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

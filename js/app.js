// 节流函数
function throttle(func, delay) {
    let lastCall = 0;
    return function(...args) {
        const now = Date.now();
        if (now - lastCall >= delay) {
            lastCall = now;
            return func.apply(this, args);
        }
    };
}

// 防抖函数
function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

// 应用主逻辑 - 性能优化版
const App = {
    tasks: [],
    currentFilter: 'all',
    taskToDelete: null,
    taskToEdit: null,
    lastRenderTime: 0,
    renderCache: {},

    // 虚拟滚动配置
    virtualScroll: {
        itemHeight: 95,          // 每个任务卡片的估计高度
        bufferSize: 5,           // 上下缓冲区数量
        visibleStart: 0,         // 当前可见区域起始索引
        visibleEnd: 20,          // 当前可见区域结束索引
        filteredTasks: [],       // 缓存筛选后的任务
        filterCacheKey: '',      // 筛选缓存键
    },

    // 初始化应用
    init() {
        // 检查存储是否可用
        if (!TaskStorage.isAvailable) {
            alert('警告：浏览器存储功能不可用！\n\n可能原因：\n1. 使用了隐私/无痕模式\n2. 浏览器安全设置禁用了存储\n\n请关闭隐私模式或更换浏览器。');
        }

        // 初始化节流渲染函数（确保 this 正确绑定）
        this._renderThrottled = throttle(() => {
            requestAnimationFrame(() => {
                this.renderCore();
            });
        }, 100);

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
                // 重置虚拟滚动状态
                this.virtualScroll.visibleStart = 0;
                this.virtualScroll.filterCacheKey = '';
                this.renderTaskList();
            });
        });

        // 虚拟滚动事件
        const taskList = document.getElementById('taskList');
        taskList.addEventListener('scroll', throttle(() => {
            this.handleVirtualScroll();
        }, 16)); // 约60fps

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

    // 渲染核心逻辑
    renderCore() {
        this.updateMetrics();
        this.updateOwnerTable();
        this.updateChartsCore();
        this.renderTaskList();
        this.updateOwnerDatalist();
    },

    // 渲染整个界面（绑定 this）
    render() {
        if (this._renderThrottled) {
            this._renderThrottled();
        }
    },

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
        if (this.renderCache.deptTable === cacheKey) return this.renderCache.deptTableData;
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

        // 按延期率排序
        const sortedDepts = Object.entries(deptStats)
            .map(([department, stats]) => {
                const delayRate = stats.total > 0 ? ((stats.delay / stats.total) * 100).toFixed(1) : 0;
                return { department, ...stats, delayRate };
            })
            .sort((a, b) => b.delayRate - a.delayRate);

        const tbody = document.getElementById('ownerTableBody');

        if (sortedDepts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">暂无数据</td></tr>';
            return;
        }

        tbody.innerHTML = sortedDepts.map(d => {
            const delayRateClass = d.delayRate > 30 ? 'style="color: var(--color-delay); font-weight: 600;"' :
                                   d.delayRate > 10 ? 'style="color: var(--color-warning);"' : '';
            return `
            <tr>
                <td>${this.escapeHtml(d.department)}</td>
                <td>${d.total}</td>
                <td style="color: var(--color-ongoing)">${d.ongoing}</td>
                <td style="color: var(--color-delay)">${d.delay}</td>
                <td style="color: var(--color-close)">${d.close}</td>
                <td ${delayRateClass}>${d.delayRate}%</td>
            </tr>
        `}).join('');

        this.renderCache.deptTableData = sortedDepts;
        return sortedDepts;
    },

    // 更新图表核心逻辑
    updateChartsCore() {
        const ongoing = this.tasks.filter(t => t.status === 'ongoing').length;
        const delayed = this.tasks.filter(t => t.status === 'delay').length;
        const completed = this.tasks.filter(t => t.status === 'close').length;

        // 设置任务数量用于动画优化
        ChartManager.setTaskCount(this.tasks.length);
        ChartManager.updateStatusChart(ongoing, delayed, completed);

        const ownerData = this.updateOwnerTable() || [];
        ChartManager.updateOwnerChart(ownerData);
    },

    // 更新图表
    updateCharts() {
        this.updateChartsCore();
    },

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

    // 获取筛选后的任务（带缓存）
    getFilteredTasks() {
        const cacheKey = `${this.currentFilter}-${this.tasks.length}`;

        if (this.virtualScroll.filterCacheKey === cacheKey) {
            return this.virtualScroll.filteredTasks;
        }

        let filteredTasks = this.tasks;

        if (this.currentFilter !== 'all') {
            filteredTasks = this.tasks.filter(t => t.status === this.currentFilter);
        }

        // 排序：延期任务置顶，然后按deadline排序
        filteredTasks = [...filteredTasks].sort((a, b) => {
            if (a.status === 'delay' && b.status !== 'delay') return -1;
            if (a.status !== 'delay' && b.status === 'delay') return 1;
            return new Date(a.deadline) - new Date(b.deadline);
        });

        this.virtualScroll.filteredTasks = filteredTasks;
        this.virtualScroll.filterCacheKey = cacheKey;

        return filteredTasks;
    },

    // 处理虚拟滚动
    handleVirtualScroll() {
        const taskList = document.getElementById('taskList');
        const scrollTop = taskList.scrollTop;
        const containerHeight = taskList.clientHeight;

        const filteredTasks = this.virtualScroll.filteredTasks;
        const totalItems = filteredTasks.length;

        if (totalItems === 0) return;

        const { itemHeight, bufferSize } = this.virtualScroll;

        // 计算当前可见区域
        const newStart = Math.max(0, Math.floor(scrollTop / itemHeight) - bufferSize);
        const newEnd = Math.min(totalItems, Math.ceil((scrollTop + containerHeight) / itemHeight) + bufferSize);

        // 只有当可见区域变化时才重新渲染
        if (newStart !== this.virtualScroll.visibleStart || newEnd !== this.virtualScroll.visibleEnd) {
            this.virtualScroll.visibleStart = newStart;
            this.virtualScroll.visibleEnd = newEnd;
            this.renderVisibleTasks(filteredTasks);
        }
    },

    // 渲染可见的任务
    renderVisibleTasks(filteredTasks) {
        const taskList = document.getElementById('taskList');
        const { itemHeight, visibleStart, visibleEnd } = this.virtualScroll;
        const totalItems = filteredTasks.length;

        // 设置总高度（使用 padding 撑起滚动区域）
        const totalHeight = totalItems * itemHeight;
        const paddingTop = visibleStart * itemHeight;

        // 使用 DocumentFragment 减少 DOM 操作
        const fragment = document.createDocumentFragment();
        const tempDiv = document.createElement('div');

        const visibleTasks = filteredTasks.slice(visibleStart, visibleEnd);

        visibleTasks.forEach(task => {
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
                <div class="task-card ${statusClass}" style="height: ${itemHeight - 12}px;">
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

        // 创建容器并设置 padding
        const wrapper = document.createElement('div');
        wrapper.style.paddingTop = `${paddingTop}px`;
        wrapper.style.minHeight = `${totalHeight - paddingTop}px`;
        wrapper.appendChild(fragment);

        taskList.innerHTML = '';
        taskList.appendChild(wrapper);
    },

    // 渲染任务列表 - 使用虚拟滚动优化
    renderTaskList() {
        const taskList = document.getElementById('taskList');
        const filteredTasks = this.getFilteredTasks();

        if (filteredTasks.length === 0) {
            taskList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📭</div>
                    <p>暂无任务</p>
                </div>
            `;
            return;
        }

        // 重置滚动位置
        this.virtualScroll.visibleStart = 0;
        const containerHeight = taskList.clientHeight || 500;
        this.virtualScroll.visibleEnd = Math.ceil(containerHeight / this.virtualScroll.itemHeight) + this.virtualScroll.bufferSize * 2;

        // 渲染可见任务
        this.renderVisibleTasks(filteredTasks);

        // 滚动到顶部
        taskList.scrollTop = 0;
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

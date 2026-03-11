// LocalStorage 封装
const STORAGE_KEY = 'taskManagerData';

const TaskStorage = {
    // 获取所有任务
    getTasks() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('读取任务数据失败:', error);
            return [];
        }
    },

    // 保存所有任务
    saveTasks(tasks) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
            return true;
        } catch (error) {
            console.error('保存任务数据失败:', error);
            alert('存储空间不足，请清理一些旧数据');
            return false;
        }
    },

    // 添加任务
    addTask(task) {
        const tasks = this.getTasks();
        tasks.push(task);
        return this.saveTasks(tasks);
    },

    // 更新任务
    updateTask(taskId, updates) {
        const tasks = this.getTasks();
        const index = tasks.findIndex(t => t.id === taskId);
        if (index !== -1) {
            tasks[index] = { ...tasks[index], ...updates };
            return this.saveTasks(tasks);
        }
        return false;
    },

    // 删除任务
    deleteTask(taskId) {
        const tasks = this.getTasks().filter(t => t.id !== taskId);
        return this.saveTasks(tasks);
    },

    // 清空所有任务
    clearAll() {
        localStorage.removeItem(STORAGE_KEY);
    }
};

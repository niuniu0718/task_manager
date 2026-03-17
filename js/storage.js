// LocalStorage 封装
const STORAGE_KEY = 'taskManagerData';

// 检查 localStorage 是否可用
function isLocalStorageAvailable() {
    try {
        const test = '__test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch (e) {
        return false;
    }
}

const TaskStorage = {
    // 检查存储是否可用
    isAvailable: isLocalStorageAvailable(),

    // 获取所有任务
    getTasks() {
        if (!this.isAvailable) {
            console.error('localStorage 不可用，请检查浏览器设置或关闭隐私模式');
            return [];
        }
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
        if (!this.isAvailable) {
            alert('存储功能不可用！请关闭隐私模式或检查浏览器设置。');
            return false;
        }
        try {
            const dataStr = JSON.stringify(tasks);
            localStorage.setItem(STORAGE_KEY, dataStr);
            // 验证保存是否成功
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved !== dataStr) {
                console.error('数据保存验证失败');
                return false;
            }
            console.log('数据保存成功，共', tasks.length, '条任务');
            return true;
        } catch (error) {
            console.error('保存任务数据失败:', error);
            if (error.name === 'QuotaExceededError') {
                alert('存储空间不足，请清理一些旧数据');
            } else if (error.name === 'SecurityError') {
                alert('浏览器安全设置阻止了数据存储，请检查隐私设置');
            } else {
                alert('保存数据失败：' + error.message);
            }
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
